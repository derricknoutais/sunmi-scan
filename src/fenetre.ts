import { BANDE, ouvrirCamera, type CameraOuverte, type Echec } from './camera.ts';

/**
 * Une fenêtre de scan plein écran, prête à l'emploi, sans framework.
 *
 * Elle marche partout — Vue 3, Vue 2, Alpine, une page Blade — parce qu'elle
 * construit son propre DOM et embarque ses propres styles. Des classes
 * Tailwind ne serviraient à rien ici : Tailwind ne génère que les classes
 * qu'il trouve dans les fichiers qu'il analyse, et `node_modules` n'en fait
 * pas partie. La fenêtre s'afficherait nue.
 *
 * Ses styles n'emploient rien qu'ignore le WebView Chrome 74 des terminaux :
 * pas de `inset` (Chrome 87), pas de `gap` en flexbox (Chrome 84), pas de
 * `max()` (Chrome 79). Une fonctionnalité CSS inconnue ne casse rien
 * bruyamment ; elle est ignorée, et la mise en page se défait en silence.
 *
 * Le cadre du viseur correspond exactement à la bande décodée : ce qui est
 * encadré est ce qui est lu, ni plus ni moins.
 */

export interface TextesFenetre {
    titre: string;
    consigne: string;
    ouverture: string;
    allumer: string;
    eteindre: string;
    reessayer: string;
    fermer: string;
    echecs: Record<Echec, { titre: string; detail: string }>;
}

export interface OptionsFenetre {
    /** Appelé avec le premier code confirmé ; la fenêtre se ferme d'elle-même. */
    surLecture(code: string): void;
    /** Appelé à chaque fermeture, lecture ou abandon. */
    surFermeture?(): void;
    /** Couleur des boutons d'action — celle de l'application hôte. */
    couleur?: string;
    textes?: Partial<TextesFenetre>;
}

export interface FenetreScanner {
    fermer(): void;
}

export const TEXTES: TextesFenetre = {
    titre: 'Scanner',
    consigne: 'Code-barres à plat dans le cadre, à 10–20 cm',
    ouverture: 'Ouverture de la caméra…',
    allumer: 'Allumer la lampe',
    eteindre: 'Éteindre la lampe',
    reessayer: 'Réessayer',
    fermer: 'Fermer',
    echecs: {
        non_securise: {
            titre: 'La caméra exige une adresse sécurisée',
            detail: "Le navigateur ne donne accès à la caméra qu'en https. En production ce sera le cas ; en test sur le réseau local, ouvrez l'application par son adresse https.",
        },
        refus: {
            titre: "L'accès à la caméra a été refusé",
            detail: "Touchez le cadenas à gauche de l'adresse, autorisez la caméra, puis réessayez.",
        },
        pas_de_camera: {
            titre: 'Aucune caméra arrière disponible',
            detail: "Ce terminal ne présente pas de caméra au navigateur. Cherchez la référence par son nom.",
        },
        occupee: {
            titre: 'La caméra est déjà utilisée',
            detail: "Une autre application s'en sert. Fermez-la, puis réessayez.",
        },
        inconnu: {
            titre: "La caméra n'a pas pu s'ouvrir",
            detail: 'Réessayez. Si cela persiste, cherchez la référence par son nom.',
        },
    },
};

const STYLES = `
.ss-fenetre{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483000;display:flex;flex-direction:column;background:#000;color:#fff;font-family:-apple-system,Roboto,"Segoe UI",Arial,sans-serif;-webkit-tap-highlight-color:transparent}
.ss-video{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}
.ss-viseur{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.ss-cadre{position:relative;border:2px solid rgba(255,255,255,.9);border-radius:16px;box-shadow:0 0 0 9999px rgba(0,0,0,.55)}
.ss-ligne{position:absolute;left:12px;right:12px;top:50%;height:2px;margin-top:-1px;background:rgba(239,68,68,.9)}
.ss-haut{position:relative;display:flex;align-items:center;justify-content:space-between;padding:16px 16px 0;padding-top:calc(16px + env(safe-area-inset-top, 0px))}
.ss-titre{margin:0;font-size:15px;font-weight:600}
.ss-rond{width:44px;height:44px;border:0;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;font-size:26px;line-height:44px;text-align:center;padding:0;cursor:pointer}
.ss-bas{position:relative;margin-top:auto;padding:0 20px 24px;padding-bottom:calc(24px + env(safe-area-inset-bottom, 0px))}
.ss-consigne{margin:0;text-align:center;font-size:15px;line-height:1.35;color:rgba(255,255,255,.9)}
.ss-lampe{display:block;margin:16px auto 0;height:48px;padding:0 20px;border:0;border-radius:24px;background:rgba(255,255,255,.15);color:#fff;font-size:15px;font-weight:600;cursor:pointer}
.ss-carte{background:#fff;color:#111;border-radius:16px;padding:20px}
.ss-carte-titre{margin:0;font-size:17px;font-weight:600}
.ss-carte-detail{margin:6px 0 0;font-size:15px;line-height:1.5;color:#444}
.ss-actions{display:flex;margin-top:16px}
.ss-actions button{flex:1;height:48px;border:0;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer}
.ss-actions button+button{margin-left:8px}
.ss-principal{background:var(--ss-couleur,#115e6b);color:#fff}
.ss-secondaire{background:#f1f1f1;color:#111}
`;

function injecterStyles() {
    if (document.getElementById('sunmi-scan-styles')) return;
    const style = document.createElement('style');
    style.id = 'sunmi-scan-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
}

function element<K extends keyof HTMLElementTagNameMap>(balise: K, classe: string, texte?: string): HTMLElementTagNameMap[K] {
    const el = document.createElement(balise);
    el.className = classe;
    if (texte !== undefined) el.textContent = texte;

    return el;
}

/**
 * Ouvre la fenêtre et la caméra. Renvoie de quoi la fermer ; elle se ferme
 * aussi d'elle-même après une lecture, et dès que la page est masquée — une
 * caméra oubliée ouverte vide la batterie d'un terminal en une matinée.
 */
export function scannerCamera(options: OptionsFenetre): FenetreScanner {
    const textes: TextesFenetre = {
        ...TEXTES,
        ...options.textes,
        echecs: { ...TEXTES.echecs, ...(options.textes && options.textes.echecs) },
    };
    injecterStyles();

    const racine = element('div', 'ss-fenetre');
    racine.setAttribute('role', 'dialog');
    racine.setAttribute('aria-modal', 'true');
    racine.setAttribute('aria-label', textes.titre);
    if (options.couleur) racine.style.setProperty('--ss-couleur', options.couleur);

    const video = element('video', 'ss-video');
    video.setAttribute('playsinline', 'true');
    video.muted = true;

    const viseur = element('div', 'ss-viseur');
    const cadre = element('div', 'ss-cadre');
    cadre.style.width = `${BANDE.largeur * 100}%`;
    cadre.style.height = `${BANDE.hauteur * 100}%`;
    cadre.appendChild(element('div', 'ss-ligne'));
    viseur.appendChild(cadre);

    const haut = element('div', 'ss-haut');
    const croix = element('button', 'ss-rond', '×');
    croix.type = 'button';
    croix.setAttribute('aria-label', textes.fermer);
    haut.appendChild(element('p', 'ss-titre', textes.titre));
    haut.appendChild(croix);

    const bas = element('div', 'ss-bas');

    racine.appendChild(video);
    racine.appendChild(viseur);
    racine.appendChild(haut);
    racine.appendChild(bas);
    document.body.appendChild(racine);

    let camera: CameraOuverte | null = null;
    let ferme = false;
    let torche = false;

    function vider() {
        while (bas.firstChild) bas.removeChild(bas.firstChild);
    }

    function afficherAttente(enCours: boolean) {
        vider();
        viseur.style.display = '';
        bas.appendChild(element('p', 'ss-consigne', enCours ? textes.ouverture : textes.consigne));

        if (camera && camera.aTorche) {
            const lampe = element('button', 'ss-lampe', torche ? textes.eteindre : textes.allumer);
            lampe.type = 'button';
            lampe.addEventListener('click', () => {
                if (!camera) return;
                camera
                    .torche(!torche)
                    .then(() => {
                        torche = !torche;
                        lampe.textContent = torche ? textes.eteindre : textes.allumer;
                    })
                    .catch(() => {
                        /* lampe indisponible à cet instant : sans conséquence */
                    });
            });
            bas.appendChild(lampe);
        }
    }

    function afficherEchec(echec: Echec) {
        vider();
        viseur.style.display = 'none';
        const carte = element('div', 'ss-carte');
        carte.appendChild(element('p', 'ss-carte-titre', textes.echecs[echec].titre));
        carte.appendChild(element('p', 'ss-carte-detail', textes.echecs[echec].detail));
        const actions = element('div', 'ss-actions');
        const reessayer = element('button', 'ss-principal', textes.reessayer);
        const fermer = element('button', 'ss-secondaire', textes.fermer);
        reessayer.type = fermer.type = 'button';
        reessayer.addEventListener('click', demarrer);
        fermer.addEventListener('click', fermerFenetre);
        actions.appendChild(reessayer);
        actions.appendChild(fermer);
        carte.appendChild(actions);
        bas.appendChild(carte);
    }

    function demarrer() {
        afficherAttente(true);
        ouvrirCamera(video, (code) => {
            camera = null;
            fermerFenetre();
            options.surLecture(code);
        }).then((resultat) => {
            // Fermée pendant l'ouverture : ne pas laisser une caméra allumée derrière.
            if (ferme) {
                if (typeof resultat !== 'string') resultat.arreter();

                return;
            }
            if (typeof resultat === 'string') {
                afficherEchec(resultat);
            } else {
                camera = resultat;
                torche = false;
                afficherAttente(false);
            }
        });
    }

    function surVisibilite() {
        if (document.hidden) fermerFenetre();
    }

    function fermerFenetre() {
        if (ferme) return;
        ferme = true;
        if (camera) camera.arreter();
        camera = null;
        document.removeEventListener('visibilitychange', surVisibilite);
        racine.remove();
        if (options.surFermeture) options.surFermeture();
    }

    croix.addEventListener('click', fermerFenetre);
    document.addEventListener('visibilitychange', surVisibilite);
    demarrer();

    return { fermer: fermerFenetre };
}
