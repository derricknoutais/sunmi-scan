import { type Ref } from 'vue';
import { type OptionsEcoute } from './clavier.ts';
import { type OptionsFenetre } from './fenetre.ts';
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
export declare function useScanner(surLecture: (code: string) => void, options?: OptionsEcoute): {
    derniereLecture: Ref<string | null>;
    activer: () => void;
};
/**
 * La caméra en plein écran. `ouvrir()` depuis un bouton ; la fenêtre se ferme
 * d'elle-même après une lecture, et au démontage du composant.
 */
export declare function useScannerCamera(surLecture: (code: string) => void, options?: Omit<OptionsFenetre, 'surLecture' | 'surFermeture'>): {
    ouvert: Ref<boolean>;
    ouvrir: () => void;
    fermer: () => void;
};
