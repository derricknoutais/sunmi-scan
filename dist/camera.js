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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/** Proportion de l'image décodée : la bande que le viseur montre. */
export const BANDE = { largeur: 0.84, hauteur: 0.34 };
/** Largeur de travail : au-delà, le décodage ralentit sans lire mieux. */
const LARGEUR_DECODAGE = 720;
const INTERVALLE_MS = 110;
const LECTURES_CONCORDANTES = 2;
/** Niveaux de gris depuis des pixels RGBA — ce qu'attend ZXing. */
export function luminance(rgba, pixels) {
    const sortie = new Uint8ClampedArray(pixels);
    for (let i = 0, j = 0; i < pixels; i++, j += 4) {
        sortie[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
    }
    return sortie;
}
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
export function lisserVerticalement(gris, largeur, hauteur, rayon) {
    if (rayon < 1)
        return gris;
    const sortie = new Uint8ClampedArray(gris.length);
    const somme = new Int32Array(largeur);
    const compte = (y) => Math.min(hauteur - 1, y + rayon) - Math.max(0, y - rayon) + 1;
    // Fenêtre glissante par colonne, parcourue ligne à ligne : un seul passage.
    for (let y = 0; y < Math.min(rayon, hauteur); y++) {
        for (let x = 0; x < largeur; x++)
            somme[x] += gris[y * largeur + x];
    }
    for (let y = 0; y < hauteur; y++) {
        const entre = y + rayon;
        const sort = y - rayon - 1;
        for (let x = 0; x < largeur; x++) {
            if (entre < hauteur)
                somme[x] += gris[entre * largeur + x];
            if (sort >= 0)
                somme[x] -= gris[sort * largeur + x];
        }
        const n = compte(y);
        for (let x = 0; x < largeur; x++)
            sortie[y * largeur + x] = somme[x] / n;
    }
    return sortie;
}
/** Lignes moyennées de part et d'autre : 2×3+1 = 7 lignes, bruit divisé par ≈ 2,6. */
const RAYON_LISSAGE = 3;
let decodeurEnCache = null;
/** ZXing n'est téléchargé qu'une fois, et seulement si la caméra sert. */
export function chargerDecodeur() {
    decodeurEnCache !== null && decodeurEnCache !== void 0 ? decodeurEnCache : (decodeurEnCache = import('@zxing/library').then((module) => {
        // Selon le chargeur (Vite, Node), le paquet arrive en exports nommés ou
        // sous `default` : on accepte les deux plutôt que de dépendre de l'outil.
        const z = ('MultiFormatOneDReader' in module ? module : module.default);
        const indices = new Map();
        // Restreindre les formats accélère nettement le décodage, et évite de
        // « reconnaître » un motif quelconque dans un format exotique.
        indices.set(z.DecodeHintType.POSSIBLE_FORMATS, [
            z.BarcodeFormat.EAN_13,
            z.BarcodeFormat.EAN_8,
            z.BarcodeFormat.UPC_A,
            z.BarcodeFormat.UPC_E,
            z.BarcodeFormat.CODE_128,
            z.BarcodeFormat.CODE_39,
            z.BarcodeFormat.ITF,
        ]);
        indices.set(z.DecodeHintType.TRY_HARDER, true);
        // Pas de `MultiFormatReader` : en 0.23, `NotFoundException` n'hérite
        // pas de `ReaderException`, et ce lecteur journalise une trace de pile
        // pour chaque image SANS code — le cas de loin le plus fréquent, une
        // vingtaine de fois par seconde dans la boucle caméra. La 0.21, épinglée
        // ici, se tait ; mais les deux lecteurs appelés directement ne
        // journalisent dans aucune version : monter de version ne ramènera pas
        // ce flot.
        const lecteur1D = new z.MultiFormatOneDReader(indices);
        const lecteurQR = new z.QRCodeReader();
        const tenter = (lecteur, image) => {
            try {
                return lecteur.decode(image, indices).getText().trim() || null;
            }
            catch (_a) {
                // Aucun code de ce type dans l'image : le cas normal, pas une erreur.
                return null;
            }
        };
        const bitmap = (g, l, h) => new z.BinaryBitmap(new z.HybridBinarizer(new z.RGBLuminanceSource(g, l, h)));
        return (gris, largeur, hauteur) => {
            var _a;
            // Le 1D d'abord : c'est ce que portent les emballages. Le QR — des
            // étiquettes qu'on imprime soi-même — garde l'image brute : le
            // lissage vertical brouillerait ses modules.
            return ((_a = tenter(lecteur1D, bitmap(lisserVerticalement(gris, largeur, hauteur, RAYON_LISSAGE), largeur, hauteur))) !== null && _a !== void 0 ? _a : tenter(lecteurQR, bitmap(gris, largeur, hauteur)));
        };
    }));
    return decodeurEnCache;
}
/** Décode la bande centrale d'une image (vidéo ou canvas) posée sur `canvas`. */
export function decoderBande(source, largeurSource, hauteurSource, canvas, decoder) {
    const b = rectangleBande(largeurSource, hauteurSource);
    canvas.width = b.largeurCible;
    canvas.height = b.hauteurCible;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return null;
    ctx.drawImage(source, b.x, b.y, b.largeur, b.hauteur, 0, 0, b.largeurCible, b.hauteurCible);
    return decoder(luminance(ctx.getImageData(0, 0, b.largeurCible, b.hauteurCible).data, b.largeurCible * b.hauteurCible), b.largeurCible, b.hauteurCible);
}
/**
 * La zone de l'image effectivement décodée : la bande du viseur, centrée, et
 * sa taille de travail une fois réduite. Isolée du canvas pour être testable.
 */
export function rectangleBande(largeurSource, hauteurSource) {
    const largeur = Math.round(largeurSource * BANDE.largeur);
    const hauteur = Math.round(hauteurSource * BANDE.hauteur);
    const echelle = Math.min(1, LARGEUR_DECODAGE / largeur);
    return {
        x: Math.round((largeurSource - largeur) / 2),
        y: Math.round((hauteurSource - hauteur) / 2),
        largeur,
        hauteur,
        largeurCible: Math.max(1, Math.round(largeur * echelle)),
        hauteurCible: Math.max(1, Math.round(hauteur * echelle)),
    };
}
function motif(e) {
    var _a;
    const nom = (_a = e === null || e === void 0 ? void 0 : e.name) !== null && _a !== void 0 ? _a : '';
    if (nom === 'NotAllowedError' || nom === 'SecurityError')
        return 'refus';
    if (nom === 'NotFoundError' || nom === 'OverconstrainedError')
        return 'pas_de_camera';
    if (nom === 'NotReadableError' || nom === 'AbortError')
        return 'occupee';
    return 'inconnu';
}
/**
 * Ouvre la caméra arrière dans `video` et appelle `surCode` au premier code
 * confirmé. Renvoie de quoi l'arrêter — il FAUT l'arrêter : une caméra oubliée
 * ouverte vide la batterie d'un terminal en une matinée.
 */
export function ouvrirCamera(video, surCode) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        if (!window.isSecureContext)
            return 'non_securise';
        if (!((_a = navigator.mediaDevices) === null || _a === void 0 ? void 0 : _a.getUserMedia))
            return 'pas_de_camera';
        let flux;
        try {
            flux = yield navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            });
        }
        catch (e) {
            return motif(e);
        }
        const piste = flux.getVideoTracks()[0];
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        video.srcObject = flux;
        let actif = true;
        let minuteur;
        function arreter() {
            actif = false;
            clearTimeout(minuteur);
            flux.getTracks().forEach((p) => p.stop());
            video.srcObject = null;
        }
        try {
            yield video.play();
        }
        catch (e) {
            arreter();
            return motif(e);
        }
        const decoder = yield chargerDecodeur();
        const canvas = document.createElement('canvas');
        let precedent = null;
        let concordances = 0;
        const boucle = () => {
            if (!actif)
                return;
            if (video.readyState >= 2 && video.videoWidth) {
                const code = decoderBande(video, video.videoWidth, video.videoHeight, canvas, decoder);
                if (code && code === precedent) {
                    concordances++;
                }
                else {
                    precedent = code;
                    concordances = code ? 1 : 0;
                }
                if (code && concordances >= LECTURES_CONCORDANTES) {
                    arreter();
                    surCode(code);
                    return;
                }
            }
            minuteur = setTimeout(boucle, INTERVALLE_MS);
        };
        boucle();
        const capacites = ((_c = (_b = piste.getCapabilities) === null || _b === void 0 ? void 0 : _b.call(piste)) !== null && _c !== void 0 ? _c : {});
        return {
            arreter,
            aTorche: !!capacites.torch,
            torche(allumee) {
                return __awaiter(this, void 0, void 0, function* () {
                    yield piste.applyConstraints({ advanced: [{ torch: allumee }] });
                });
            },
        };
    });
}
