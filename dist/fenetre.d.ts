import { type Echec } from './camera.ts';
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
    echecs: Record<Echec, {
        titre: string;
        detail: string;
    }>;
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
export declare const TEXTES: TextesFenetre;
/**
 * Ouvre la fenêtre et la caméra. Renvoie de quoi la fermer ; elle se ferme
 * aussi d'elle-même après une lecture, et dès que la page est masquée — une
 * caméra oubliée ouverte vide la batterie d'un terminal en une matinée.
 */
export declare function scannerCamera(options: OptionsFenetre): FenetreScanner;
