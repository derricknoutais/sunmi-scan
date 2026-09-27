/**
 * Distinguer une lecture de scanner d'une frappe humaine.
 *
 * En mode « clavier simulé », le scanner du Sunmi tape le code comme un clavier
 * très rapide, souvent suivi d'Entrée. Rien ne distingue ces frappes de celles
 * d'un humain — sauf la cadence : un scanner enchaîne ses caractères en
 * quelques millisecondes, un humain en plus de cent.
 *
 * L'enjeu n'est pas cosmétique. Le pavé numérique écoute le clavier de façon
 * globale et valide sur Entrée : sans ce tri, lire l'EAN 8886454090611
 * enregistrerait une quantité de 8886 sur la ligne affichée.
 *
 * Deux modes, selon la cible de la frappe :
 *  - **interception** (aucun champ texte actif) : les caractères sont retenus
 *    le temps de savoir s'il s'agit d'une rafale. Une touche isolée est rendue
 *    à l'écran avec au plus `silence` ms de retard — imperceptible ;
 *  - **observation** (un vrai champ texte est actif) : les caractères
 *    s'inscrivent normalement dans le champ, on se contente de reconnaître la
 *    rafale pour la signaler et d'absorber l'Entrée qui la termine.
 *
 * Aucune dépendance au DOM : l'horloge est injectée, ce qui rend la logique
 * testable sans navigateur (test/detecteur.test.mjs).
 */
export const REGLAGES = {
    ecartMax: 50,
    silence: 80,
    longueurMin: 3,
};
export function horlogeNavigateur() {
    return {
        maintenant: () => performance.now(),
        differer: (fn, ms) => setTimeout(fn, ms),
        annuler: (id) => clearTimeout(id),
    };
}
export function creerDetecteur(sorties, horloge, reglages = REGLAGES) {
    let tampon = [];
    let absorbees = false;
    let dernier = 0;
    let minuteur = null;
    function vider() {
        if (minuteur !== null) {
            horloge.annuler(minuteur);
            minuteur = null;
        }
        const etat = { touches: tampon, absorbees };
        tampon = [];
        absorbees = false;
        return etat;
    }
    /** Tranche le sort du tampon : lecture s'il est assez long, sinon rendu à l'écran. */
    function conclure() {
        const { touches, absorbees: retenues } = vider();
        const code = touches.join('').trim();
        if (touches.length >= reglages.longueurMin && code) {
            sorties.lecture(code);
            return true;
        }
        if (retenues && touches.length) {
            sorties.rendre(touches);
        }
        return false;
    }
    return {
        touche(key, intercepter) {
            const t = horloge.maintenant();
            if (key === 'Enter') {
                // Une Entrée sans rien avant est humaine : elle valide la saisie.
                if (!tampon.length)
                    return 'laisser';
                // Une Entrée qui termine une lecture ne doit JAMAIS atteindre le
                // pavé : elle validerait la quantité de la ligne affichée.
                return conclure() ? 'absorber' : 'laisser';
            }
            // Retour arrière, flèches, Maj… : jamais un caractère de code. Maj
            // peut s'intercaler dans une rafale (codes en majuscules) sans la
            // rompre, puisqu'elle ne remet pas le tampon à zéro.
            if (key.length !== 1)
                return 'laisser';
            // Trop lent pour un scanner : ce qui précédait est terminé.
            if (tampon.length && t - dernier > reglages.ecartMax) {
                conclure();
            }
            tampon.push(key);
            dernier = t;
            absorbees = absorbees || intercepter;
            if (minuteur !== null)
                horloge.annuler(minuteur);
            minuteur = horloge.differer(() => {
                minuteur = null;
                conclure();
            }, reglages.silence);
            return intercepter ? 'absorber' : 'laisser';
        },
        /** Oublie une lecture en cours — au démontage de l'écran. */
        reinitialiser() {
            vider();
        },
    };
}
