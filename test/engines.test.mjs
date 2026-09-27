import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import semver from 'semver';

/**
 * Les projets qui dépendent de ce paquet s'installent sur leurs serveurs de
 * build — en Node 20, parfois avec Yarn 1 (constaté sur Forge). Yarn 1 refuse
 * TOUTE l'installation dès qu'une dépendance déclare un `engines.node` qui
 * exclut le Node du serveur ; npm n'en fait qu'un avertissement, si bien que
 * rien ne se voit en local. ZXing 0.22+ exige Node 24 : ce test empêche
 * qu'une montée de version casse les déploiements des projets.
 */
const NODE_SERVEURS = '20.0.0';

test(`aucune dépendance d'exécution n'exclut Node ${semver.major(NODE_SERVEURS)}`, () => {
    const verrou = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

    const exclues = Object.entries(verrou.packages)
        // "" : le paquet lui-même. `dev` ne s'installe pas chez les projets ;
        // une dépendance `optional` incompatible, Yarn l'écarte sans échouer.
        .filter(([chemin, p]) => chemin !== '' && !p.dev && !p.optional && !p.devOptional && !p.peer)
        .filter(([, p]) => typeof p.engines?.node === 'string' && !semver.satisfies(NODE_SERVEURS, p.engines.node))
        .map(([chemin, p]) => `${chemin.replace(/^.*node_modules\//, '')}@${p.version} exige node ${p.engines.node}`);

    assert.deepEqual(exclues, []);
});
