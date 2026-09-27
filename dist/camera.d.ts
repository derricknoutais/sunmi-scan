/**
 * Lire un code-barres avec l'appareil photo, dans la page.
 *
 * Beaucoup de Sunmi (V2 Pro, V2s…) n'ont pas de module de scan : leur
 * « scanner », c'est la caméra arrière. Leur WebView (Chrome 74) n'a pas
 * `BarcodeDetector`
 * (Chrome 83+), d'où un décodeur JavaScript — ZXing — chargé seulement à
 * l'ouverture de la caméra, pour ne rien coûter au premier affichage.
 *
 * Deux choix qui comptent plus que la technique :
 *
 *  - **on ne décode que la bande du viseur**, jamais l'image entière. Sur un
 *    rayon, la caméra voit plusieurs étiquettes à la fois ; lire la voisine
 *    ferait compter la mauvaise pièce — l'erreur même que le scan doit
 *    éliminer. C'est aussi ce qui rend le décodage assez rapide pour ce
 *    processeur ;
 *  - **un code n'est retenu qu'après deux lectures identiques de suite**.
 *    Une image floue peut produire une lecture fausse ; deux lectures
 *    concordantes coûtent un tiers de seconde et écartent ce risque.
 *
 * La caméra n'est accessible que sur une origine sécurisée (https, ou
 * localhost). Ce n'est pas un réglage : c'est une règle du navigateur.
 */
export type Echec = 'non_securise' | 'pas_de_camera' | 'refus' | 'occupee' | 'inconnu';
export interface CameraOuverte {
    arreter(): void;
    /** Vrai si l'appareil sait allumer sa lampe. */
    aTorche: boolean;
    torche(allumee: boolean): Promise<void>;
}
/** Proportion de l'image décodée : la bande que le viseur montre. */
export declare const BANDE: {
    largeur: number;
    hauteur: number;
};
/** Niveaux de gris depuis des pixels RGBA — ce qu'attend ZXing. */
export declare function luminance(rgba: Uint8ClampedArray, pixels: number): Uint8ClampedArray;
/**
 * Moyenne chaque pixel avec ses voisins du dessus et du dessous.
 *
 * Les barres d'un code 1D sont verticales : toute l'information est dans le
 * sens horizontal. Moyenner entre elles 2r+1 lignes divise le bruit du capteur
 * par √(2r+1) sans déplacer d'un pixel le moindre bord de barre. C'est ce qui
 * rend la lecture fiable dans la pénombre d'un rayon, sur un petit capteur.
 *
 * Mesuré sur des EAN-13 générés, bruit uniforme par pixel, 20 tirages :
 *
 *                  ±40    ±70    ±110   ±130
 *   sans lissage   100 %  0–5 %  0 %    0 %
 *   avec (r = 3)   100 %  95–100 % 90–100 % 45–100 %
 *
 * Le seuil de tolérance presque triplé, pour un seul passage sur l'image.
 */
export declare function lisserVerticalement(gris: Uint8ClampedArray, largeur: number, hauteur: number, rayon: number): Uint8ClampedArray;
type Decodeur = (gris: Uint8ClampedArray, largeur: number, hauteur: number) => string | null;
/** ZXing n'est téléchargé qu'une fois, et seulement si la caméra sert. */
export declare function chargerDecodeur(): Promise<Decodeur>;
/** Décode la bande centrale d'une image (vidéo ou canvas) posée sur `canvas`. */
export declare function decoderBande(source: CanvasImageSource, largeurSource: number, hauteurSource: number, canvas: HTMLCanvasElement, decoder: Decodeur): string | null;
/**
 * La zone de l'image effectivement décodée : la bande du viseur, centrée, et
 * sa taille de travail une fois réduite. Isolée du canvas pour être testable.
 */
export declare function rectangleBande(largeurSource: number, hauteurSource: number): {
    x: number;
    y: number;
    largeur: number;
    hauteur: number;
    largeurCible: number;
    hauteurCible: number;
};
/**
 * Ouvre la caméra arrière dans `video` et appelle `surCode` au premier code
 * confirmé. Renvoie de quoi l'arrêter — il FAUT l'arrêter : une caméra oubliée
 * ouverte vide la batterie d'un terminal en une matinée.
 */
export declare function ouvrirCamera(video: HTMLVideoElement, surCode: (code: string) => void): Promise<CameraOuverte | Echec>;
export {};
