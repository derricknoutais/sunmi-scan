/**
 * Le scanner intégré d'un terminal — ou une douchette Bluetooth —, vu depuis
 * une page web, sans framework.
 *
 * Selon son réglage, il livre le code de deux façons, et les deux doivent
 * fonctionner sans rien configurer :
 *
 *  - **clavier simulé** — des frappes très rapides, souvent suivies d'Entrée.
 *    Elles sont captées AVANT tout autre écouteur (phase de capture), triées
 *    par `creerDetecteur`, et une touche isolée est rendue à la page telle
 *    quelle. C'est ce qui empêche un pavé numérique qui écoute le clavier
 *    d'enregistrer « 8886 » en quantité quand on lit l'EAN 8886454090611 ;
 *  - **saisie directe** — le texte est injecté d'un bloc dans le champ qui a
 *    le focus, sans aucune frappe. Un écran sans champ en reçoit un, invisible,
 *    qui garde le focus sans ouvrir de clavier (`inputmode="none"`, supporté
 *    dès Chrome 66).
 *
 * Le bouton de scan physique ne passe jamais par ici : c'est le terminal qui
 * déclenche la lecture. Une page web ne peut pas allumer le laser ; elle peut
 * seulement être prête à recevoir ce qu'il lit.
 */
export interface EcouteScanner {
    /** Retire tous les écouteurs et le champ invisible. À appeler en quittant l'écran. */
    arreter(): void;
    /** Rend le focus au champ invisible, s'il n'est pas pris par un vrai champ. */
    activer(): void;
}
export interface OptionsEcoute {
    /**
     * Champ invisible pour le mode « saisie directe ». Vrai par défaut. À
     * désactiver sur un écran où le focus doit rester libre en permanence.
     */
    puits?: boolean;
}
export declare function ecouterScanner(surLecture: (code: string) => void, options?: OptionsEcoute): EcouteScanner;
