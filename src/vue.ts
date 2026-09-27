import { onMounted, onUnmounted, ref, type Ref } from 'vue';
import { ecouterScanner, type EcouteScanner, type OptionsEcoute } from './clavier.ts';
import { scannerCamera, type FenetreScanner, type OptionsFenetre } from './fenetre.ts';

/**
 * Les deux façons de lire un code, pour un composant Vue 3.
 *
 * Ce ne sont que des enveloppes : toute la logique vit dans `ecouterScanner`
 * et `scannerCamera`, utilisables telles quelles en Vue 2, Alpine ou
 * JavaScript sans framework.
 */

/**
 * Le scanner qui tape comme un clavier — module de scan d'un Sunmi, douchette
 * Bluetooth. À appeler dans `setup` : l'écoute démarre au montage et s'arrête
 * au démontage.
 */
export function useScanner(
    surLecture: (code: string) => void,
    options: OptionsEcoute = {},
): { derniereLecture: Ref<string | null>; activer: () => void } {
    const derniereLecture = ref<string | null>(null);
    let ecoute: EcouteScanner | null = null;

    onMounted(() => {
        ecoute = ecouterScanner((code) => {
            derniereLecture.value = code;
            surLecture(code);
        }, options);
    });
    onUnmounted(() => {
        if (ecoute) ecoute.arreter();
        ecoute = null;
    });

    return {
        derniereLecture,
        activer: () => {
            if (ecoute) ecoute.activer();
        },
    };
}

/**
 * La caméra en plein écran. `ouvrir()` depuis un bouton ; la fenêtre se ferme
 * d'elle-même après une lecture, et au démontage du composant.
 */
export function useScannerCamera(
    surLecture: (code: string) => void,
    options: Omit<OptionsFenetre, 'surLecture' | 'surFermeture'> = {},
): { ouvert: Ref<boolean>; ouvrir: () => void; fermer: () => void } {
    const ouvert = ref(false);
    let fenetre: FenetreScanner | null = null;

    function fermer() {
        if (fenetre) fenetre.fermer();
    }

    function ouvrir() {
        if (fenetre) return;
        ouvert.value = true;
        fenetre = scannerCamera({
            ...options,
            surLecture,
            surFermeture: () => {
                ouvert.value = false;
                fenetre = null;
            },
        });
    }

    onUnmounted(fermer);

    return { ouvert, ouvrir, fermer };
}
