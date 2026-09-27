/**
 * @derricknoutais/sunmi-scan — lire des codes-barres sur terminaux Sunmi.
 *
 * Sans framework. L'adaptateur Vue 3 est dans `@derricknoutais/sunmi-scan/vue`.
 */

// La caméra en plein écran, prête à l'emploi (le cas courant).
export { scannerCamera, TEXTES, type FenetreScanner, type OptionsFenetre, type TextesFenetre } from './fenetre.ts';

// Le scanner qui tape comme un clavier : module de scan, douchette Bluetooth.
export { ecouterScanner, type EcouteScanner, type OptionsEcoute } from './clavier.ts';

// La caméra bas niveau, pour une interface sur mesure.
export {
    BANDE,
    chargerDecodeur,
    decoderBande,
    lisserVerticalement,
    luminance,
    ouvrirCamera,
    rectangleBande,
    type CameraOuverte,
    type Echec,
} from './camera.ts';

// Le tri entre frappe humaine et lecture, logique pure.
export { creerDetecteur, horlogeNavigateur, REGLAGES, type Decision, type Horloge, type Reglages, type Sorties } from './detecteur.ts';

// Codes GS1 et leurs écritures équivalentes.
export { cleGs1, cleValide, formesEquivalentes, type RaisonEquivalence } from './gs1.ts';
