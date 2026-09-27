import { creerDetecteur, horlogeNavigateur, REGLAGES } from "./detecteur.js";
export function ecouterScanner(surLecture, options = {}) {
    let rejeu = false;
    let puits = null;
    let minuteurPuits;
    const detecteur = creerDetecteur({
        lecture: surLecture,
        // Les frappes retenues n'étaient pas une lecture : on les rejoue
        // pour la page, qui écoute peut-être la fenêtre (un pavé numérique).
        // `rejeu` empêche qu'on les intercepte une seconde fois.
        rendre: (touches) => {
            rejeu = true;
            try {
                for (const key of touches) {
                    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
                }
            }
            finally {
                rejeu = false;
            }
        },
    }, horlogeNavigateur());
    /** Un vrai champ de saisie — pas notre puits, qui n'est qu'un réceptacle. */
    function estChampTexte(el) {
        if (!el || el === puits)
            return false;
        if (el instanceof HTMLTextAreaElement)
            return true;
        if (el instanceof HTMLElement && el.isContentEditable)
            return true;
        return el instanceof HTMLInputElement && /^(text|search|email|number|tel|url|password)$/.test(el.type);
    }
    function conclurePuits() {
        clearTimeout(minuteurPuits);
        if (!puits)
            return;
        const code = puits.value.replace(/[\r\n\t]+/g, '').trim();
        puits.value = '';
        if (code.length >= REGLAGES.longueurMin)
            surLecture(code);
    }
    function surTouche(e) {
        if (rejeu || e.ctrlKey || e.metaKey || e.altKey || e.isComposing)
            return;
        // Saisie directe suivie d'une Entrée : le texte est déjà dans le puits,
        // l'Entrée qui suit ne doit surtout pas valider ce que la page affiche.
        if (e.key === 'Enter' && puits && puits.value.trim()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            conclurePuits();
            return;
        }
        if (detecteur.touche(e.key, !estChampTexte(e.target)) === 'absorber') {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }
    function surSaisiePuits() {
        clearTimeout(minuteurPuits);
        minuteurPuits = setTimeout(conclurePuits, REGLAGES.silence);
    }
    /**
     * Saisie directe dans un VRAI champ (une recherche, par exemple) : un seul
     * événement qui insère plusieurs caractères hors composition n'est pas une
     * frappe. Le texte reste dans le champ ; la page décide quoi en faire. Une
     * fausse alerte — mot validé par le clavier Android — est bénigne si la
     * page retombe alors sur une recherche ordinaire.
     */
    function surSaisieChamp(e) {
        if (!(e instanceof InputEvent) || !estChampTexte(e.target))
            return;
        if (e.isComposing || e.inputType !== 'insertText')
            return;
        const texte = (e.data || '').trim();
        if (texte.length >= REGLAGES.longueurMin)
            surLecture(texte);
    }
    /**
     * Le puits garde le focus tant qu'aucun vrai champ ne le réclame. Toucher
     * un bouton le lui prend un instant ; on le lui rend aussitôt, sans jamais
     * le voler à une saisie en cours.
     */
    function activer() {
        setTimeout(() => {
            if (!puits || estChampTexte(document.activeElement))
                return;
            if (document.activeElement !== puits)
                puits.focus({ preventScroll: true });
        }, 0);
    }
    window.addEventListener('keydown', surTouche, true);
    document.addEventListener('input', surSaisieChamp, true);
    if (options.puits !== false) {
        puits = document.createElement('input');
        puits.type = 'text';
        puits.setAttribute('inputmode', 'none');
        puits.setAttribute('autocomplete', 'off');
        puits.setAttribute('autocapitalize', 'off');
        puits.setAttribute('spellcheck', 'false');
        puits.setAttribute('aria-hidden', 'true');
        puits.tabIndex = -1;
        puits.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:0;padding:0;pointer-events:none;';
        puits.addEventListener('input', surSaisiePuits);
        puits.addEventListener('blur', activer);
        document.body.appendChild(puits);
        activer();
    }
    return {
        activer,
        arreter() {
            window.removeEventListener('keydown', surTouche, true);
            document.removeEventListener('input', surSaisieChamp, true);
            clearTimeout(minuteurPuits);
            detecteur.reinitialiser();
            if (puits) {
                puits.removeEventListener('blur', activer);
                puits.remove();
                puits = null;
            }
        },
    };
}
