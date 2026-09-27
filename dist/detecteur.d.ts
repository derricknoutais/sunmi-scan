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
export interface Reglages {
    /** Écart maximal entre deux caractères d'une même lecture. */
    ecartMax: number;
    /** Silence qui clôt une lecture émise sans suffixe Entrée. */
    silence: number;
    /** En deçà, ce n'est pas un code : une ou deux frappes rapides restent humaines. */
    longueurMin: number;
}
export declare const REGLAGES: Reglages;
export type Decision = 'absorber' | 'laisser';
export interface Horloge {
    maintenant(): number;
    differer(fn: () => void, ms: number): unknown;
    annuler(id: unknown): void;
}
export interface Sorties {
    /** Un code complet vient d'être lu. */
    lecture(code: string): void;
    /** Des frappes retenues n'étaient pas une lecture : il faut les rendre, dans l'ordre. */
    rendre(touches: string[]): void;
}
export declare function horlogeNavigateur(): Horloge;
export declare function creerDetecteur(sorties: Sorties, horloge: Horloge, reglages?: Reglages): {
    touche(key: string, intercepter: boolean): Decision;
    /** Oublie une lecture en cours — au démontage de l'écran. */
    reinitialiser(): void;
};
