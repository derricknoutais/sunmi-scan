#!/usr/bin/env node
/**
 * HTTPS sur le réseau local, pour tester la caméra depuis un terminal.
 *
 *   npx sunmi-https                (depuis la racine du projet Laravel)
 *
 * Une seule commande, un seul terminal : si rien ne répond sur le port 8000,
 * le relais lance lui-même `php artisan serve` et l'arrête en partant. Deux
 * processus longs à tenir dans deux onglets, c'était un de trop — le premier
 * essai l'a montré.
 *
 * Le navigateur n'ouvre la caméra que sur une origine sécurisée — https, ou
 * localhost. Un terminal qui charge l'app par l'IP du poste de développement
 * (http://192.168.x.x) n'y a donc jamais accès. Ce relais termine le TLS avec
 * un certificat auto-signé et transmet à `artisan serve`.
 *
 * Le certificat n'est signé par personne : au premier chargement, le
 * navigateur affiche un avertissement qu'il faut franchir une fois
 * (« Paramètres avancés → Continuer »). La page est alors bien en https, et la
 * caméra s'ouvre.
 *
 * Aucune dépendance : Node et OpenSSL suffisent. Rien ne sort du réseau local.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer as creerHttp, request } from 'node:http';
import { createServer } from 'node:https';
import { createServer as creerTcp } from 'node:net';
import { networkInterfaces } from 'node:os';

const PORT = Number(process.env.PORT_HTTPS ?? 8443);
const AMONT = new URL(process.env.AMONT ?? 'http://127.0.0.1:8000');
// Sous storage/ : ignoré par git dans un projet Laravel. La clé privée ne doit
// jamais partir dans un dépôt, même auto-signée.
const DOSSIER = process.env.DOSSIER_CERTIFICAT ?? 'storage/app/https-local';

/** L'adresse du poste sur le réseau local : celle que tape le terminal. */
function ipLocale() {
    for (const cartes of Object.values(networkInterfaces())) {
        for (const c of cartes ?? []) {
            if (c.family === 'IPv4' && !c.internal) return c.address;
        }
    }
    return '127.0.0.1';
}

const IP = process.env.IP_LOCALE ?? ipLocale();

/**
 * Certificat auto-signé couvrant l'IP du poste. Régénéré si l'IP change :
 * un certificat pour une autre adresse ferait échouer la connexion sans
 * possibilité de passer outre.
 */
function certificat() {
    mkdirSync(DOSSIER, { recursive: true });
    const cle = `${DOSSIER}/key.pem`;
    const cert = `${DOSSIER}/cert.pem`;
    const marque = `${DOSSIER}/ip.txt`;

    if (!existsSync(cert) || !existsSync(marque) || readFileSync(marque, 'utf8') !== IP) {
        execFileSync('openssl', [
            'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '90',
            '-keyout', cle, '-out', cert,
            '-subj', `/CN=sunmi-scan ${IP}`,
            '-addext', `subjectAltName=IP:${IP},IP:127.0.0.1,DNS:localhost`,
        ], { stdio: 'ignore' });
        writeFileSync(marque, IP);
        console.log(`  certificat généré pour ${IP} (90 jours)`);
    }

    return { key: readFileSync(cle), cert: readFileSync(cert) };
}

const serveur = createServer(certificat(), (entree, sortie) => {
    const hote = entree.headers.host ?? `${IP}:${PORT}`;

    const amont = request(
        {
            hostname: AMONT.hostname,
            port: AMONT.port,
            method: entree.method,
            path: entree.url,
            headers: {
                ...entree.headers,
                // Laravel ne croit ces en-têtes que venant de la boucle locale
                // (bootstrap/app.php) : c'est ce qui lui fait générer des URL
                // en https sur l'adresse que le terminal a tapée.
                'x-forwarded-proto': 'https',
                'x-forwarded-host': hote,
                'x-forwarded-port': String(PORT),
                'x-forwarded-for': entree.socket.remoteAddress ?? '',
            },
        },
        (reponse) => {
            sortie.writeHead(reponse.statusCode ?? 502, reponse.headers);
            reponse.pipe(sortie);
        },
    );

    amont.on('error', () => {
        if (sortie.headersSent) return sortie.end();
        sortie.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
        sortie.end(`L'application ne répond pas sur ${AMONT.origin}.\nLancez : php artisan serve --host=127.0.0.1 --port=${AMONT.port}\n`);
    });

    entree.pipe(amont);
});

// Port déjà pris : presque toujours un relais lancé plus tôt, dans un autre
// terminal. La trace de pile brute de Node ne le dit pas ; ceci, si.
/**
 * Tapée sans préfixe, l'adresse part en http:// — c'est le défaut de Chrome
 * sur Android. Un serveur TLS qui reçoit du texte en clair raccroche sans rien
 * envoyer, et le navigateur affiche ERR_EMPTY_RESPONSE, qui ne dit rien de la
 * cause. On accepte donc les deux sur le même port : une requête en clair
 * reçoit une redirection vers https.
 */
const redirection = creerHttp((entree, sortie) => {
    sortie.writeHead(301, { location: `https://${entree.headers.host ?? `${IP}:${PORT}`}${entree.url}` });
    sortie.end();
});

/** Un ClientHello TLS commence toujours par l'octet 0x16 ; tout le reste est du HTTP en clair. */
const aiguillage = creerTcp((connexion) => {
    connexion.once('data', (premier) => {
        connexion.pause();
        connexion.unshift(premier);
        (premier[0] === 0x16 ? serveur : redirection).emit('connection', connexion);
        process.nextTick(() => connexion.resume());
    });
    connexion.on('error', () => connexion.destroy());
});

aiguillage.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`\n  Le port ${PORT} est déjà utilisé — un relais tourne sans doute déjà dans un autre terminal.`);
        console.error(`  S'il répond, rien à faire : https://${IP}:${PORT}`);
        console.error(`  Sinon, libérez le port :  lsof -ti tcp:${PORT} | xargs kill\n`);
        process.exit(1);
    }
    throw e;
});

/** `artisan serve` répond-il ? */
function repond() {
    return new Promise((ok) => {
        const essai = request({ hostname: AMONT.hostname, port: AMONT.port, method: 'HEAD', path: '/', timeout: 1500 }, (r) => {
            r.resume();
            ok(true);
        });
        essai.on('timeout', () => essai.destroy());
        essai.on('error', () => ok(false));
        essai.end();
    });
}

let artisan = null;

/**
 * Sans `artisan serve` derrière, le relais ne sert que des 502. On le lance
 * s'il ne tourne pas — dans son propre groupe de processus, pour pouvoir
 * l'arrêter en entier : `artisan serve` lance lui-même un `php -S`.
 */
async function assurerAmont() {
    if (await repond()) {
        console.log(`  ✓ L'application répond déjà sur ${AMONT.origin}\n`);
        return;
    }

    if (!['127.0.0.1', 'localhost'].includes(AMONT.hostname)) {
        console.warn(`  ⚠ Rien ne répond sur ${AMONT.origin}.\n`);
        return;
    }

    console.log('  Démarrage de php artisan serve…');
    artisan = spawn('php', ['artisan', 'serve', `--host=${AMONT.hostname}`, `--port=${AMONT.port}`], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Le journal d'artisan — une ligne par requête — reste le seul journal.
    const relayer = (flux) =>
        flux.on('data', (d) => {
            for (const ligne of String(d).split('\n')) {
                if (ligne.trim() && !/Press Ctrl\+C|PHP_CLI_SERVER_WORKERS|Server running on/.test(ligne)) console.log(`  │ ${ligne.trim()}`);
            }
        });
    relayer(artisan.stdout);
    relayer(artisan.stderr);
    artisan.on('exit', (code) => {
        if (artisan) console.warn(`\n  ⚠ php artisan serve s'est arrêté (code ${code}). Le relais ne sert plus que des erreurs.\n`);
        artisan = null;
    });

    for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 250));
        if (await repond()) {
            console.log(`  ✓ L'application a démarré sur ${AMONT.origin}\n`);
            return;
        }
    }
    console.warn(`  ⚠ php artisan serve ne répond toujours pas après 10 s.\n`);
}

/** Ctrl+C arrête aussi le serveur qu'on a lancé : rien ne doit rester derrière. */
function arreterTout() {
    if (artisan) {
        const pid = artisan.pid;
        artisan = null;
        try {
            process.kill(-pid, 'SIGTERM');
        } catch {
            /* déjà arrêté */
        }
    }
    process.exit(0);
}
process.on('SIGINT', arreterTout);
process.on('SIGTERM', arreterTout);

aiguillage.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  L'application en https sur le réseau local :\n\n      https://${IP}:${PORT}\n`);
    console.log('  Au premier chargement sur le terminal : « Paramètres avancés » → « Continuer ».');
    console.log(`  Relais vers ${AMONT.origin} — Ctrl+C pour tout arrêter.\n`);
    assurerAmont();
});
