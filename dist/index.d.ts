/**
 * @derricknoutais/sunmi-scan — lire des codes-barres sur terminaux Sunmi.
 *
 * Sans framework. L'adaptateur Vue 3 est dans `@derricknoutais/sunmi-scan/vue`.
 */
export { scannerCamera, TEXTES, type FenetreScanner, type OptionsFenetre, type TextesFenetre } from './fenetre.ts';
export { ecouterScanner, type EcouteScanner, type OptionsEcoute } from './clavier.ts';
export { BANDE, chargerDecodeur, decoderBande, lisserVerticalement, luminance, ouvrirCamera, rectangleBande, type CameraOuverte, type Echec, } from './camera.ts';
export { creerDetecteur, horlogeNavigateur, REGLAGES, type Decision, type Horloge, type Reglages, type Sorties } from './detecteur.ts';
export { cleGs1, cleValide, formesEquivalentes, type RaisonEquivalence } from './gs1.ts';
