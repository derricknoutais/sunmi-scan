/**
 * @derricknoutais/sunmi-scan — lire des codes-barres sur terminaux Sunmi.
 *
 * Sans framework. L'adaptateur Vue 3 est dans `@derricknoutais/sunmi-scan/vue`.
 */
// La caméra en plein écran, prête à l'emploi (le cas courant).
export { scannerCamera, TEXTES } from "./fenetre.js";
// Le scanner qui tape comme un clavier : module de scan, douchette Bluetooth.
export { ecouterScanner } from "./clavier.js";
// La caméra bas niveau, pour une interface sur mesure.
export { BANDE, chargerDecodeur, decoderBande, lisserVerticalement, luminance, ouvrirCamera, rectangleBande, } from "./camera.js";
// Le tri entre frappe humaine et lecture, logique pure.
export { creerDetecteur, horlogeNavigateur, REGLAGES } from "./detecteur.js";
// Codes GS1 et leurs écritures équivalentes.
export { cleGs1, cleValide, formesEquivalentes } from "./gs1.js";
