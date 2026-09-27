/**
 * Le décodeur caméra — sans caméra ni navigateur, sur le code livré (dist).
 *
 * On fabrique de vrais codes-barres (ZXing-JS n'encodant que les QR, le banc
 * embarque un encodeur EAN-13 conforme GS1), on les compose dans une image de
 * la taille d'une vue caméra, et on les décode par le même chemin que la page.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as zxing from '@zxing/library';
import { chargerDecodeur, lisserVerticalement, luminance, rectangleBande } from '../dist/camera.js';

const Z = 'MultiFormatWriter' in zxing ? zxing : zxing.default;


/**
 * EAN-13 selon la norme GS1 — ZXing-JS ne sait encoder que les QR. 95 modules :
 * garde, 6 chiffres en L ou G selon le premier chiffre, garde centrale,
 * 6 chiffres en R, garde.
 */
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITE = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

function modulesEan13(code) {
    const c = code.split('').map(Number);
    let m = '101';
    for (let i = 1; i <= 6; i++) m += (PARITE[c[0]][i - 1] === 'L' ? L : G)[c[i]];
    m += '01010';
    for (let i = 7; i <= 12; i++) m += R[c[i]];
    return m + '101';
}

/** Dessine des modules 1D en niveaux de gris : noir 0, blanc 255, marge blanche. */
function dessinerEan13(code, module = 3, hauteurBarres = 120, marge = 30) {
    const bits = modulesEan13(code);
    const largeur = bits.length * module + 2 * marge;
    const hauteur = hauteurBarres + 2 * 12;
    const gris = new Uint8ClampedArray(largeur * hauteur).fill(255);
    for (let y = 12; y < 12 + hauteurBarres; y++) {
        for (let x = 0; x < bits.length * module; x++) {
            if (bits[Math.floor(x / module)] === '1') gris[y * largeur + x + marge] = 0;
        }
    }
    return { gris, largeur, hauteur };
}

/** QR via ZXing : c'est ce que porteront les étiquettes imprimées par Storit. */
function dessinerQR(texte, module = 4, marge = 16) {
    const matrice = new Z.MultiFormatWriter().encode(texte, Z.BarcodeFormat.QR_CODE, 0, 0, new Map());
    const n = matrice.getWidth();
    const cote = n * module + 2 * marge;
    const gris = new Uint8ClampedArray(cote * cote).fill(255);
    for (let y = 0; y < n * module; y++) {
        for (let x = 0; x < n * module; x++) {
            if (matrice.get(Math.floor(x / module), Math.floor(y / module))) gris[(y + marge) * cote + x + marge] = 0;
        }
    }
    return { gris, largeur: cote, hauteur: cote };
}

function vide(largeur, hauteur) {
    return { gris: new Uint8ClampedArray(largeur * hauteur).fill(255), largeur, hauteur };
}

function coller(fond, motif, x, y) {
    for (let j = 0; j < motif.hauteur; j++) {
        fond.gris.set(motif.gris.subarray(j * motif.largeur, (j + 1) * motif.largeur), (y + j) * fond.largeur + x);
    }
}

/** Ce que fait `drawImage` sur la bande : découpe puis réduction. */
function bande(image) {
    const b = rectangleBande(image.largeur, image.hauteur);
    const gris = new Uint8ClampedArray(b.largeurCible * b.hauteurCible);
    for (let y = 0; y < b.hauteurCible; y++) {
        for (let x = 0; x < b.largeurCible; x++) {
            const sx = b.x + Math.floor((x * b.largeur) / b.largeurCible);
            const sy = b.y + Math.floor((y * b.hauteur) / b.hauteurCible);
            gris[y * b.largeurCible + x] = image.gris[sy * image.largeur + sx];
        }
    }
    return { gris, largeur: b.largeurCible, hauteur: b.hauteurCible };
}

function bruiter(image, amplitude, graine = 7) {
    let s = graine;
    const alea = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    return { ...image, gris: image.gris.map((v) => v + alea() * amplitude) };
}


const decoder = await chargerDecodeur();
const lire = (i) => decoder(i.gris, i.largeur, i.hauteur);
const UUID = 'D29E9F00-5D59-4202-9426-5718500F2FCC';

test('la luminance donne 0 au noir et 255 au blanc', () => {
    assert.deepEqual([...luminance(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]), 2)], [0, 255]);
});

test('un EAN-13 est lu', () => assert.equal(lire(dessinerEan13('8886454090611')), '8886454090611'));

test('un QR portant un identifiant en majuscules est lu', () => assert.equal(lire(dessinerQR(UUID)), UUID));

test('un code très bruité — pénombre, petit capteur — reste lisible', () => {
    assert.equal(lire(bruiter(dessinerEan13('8886454090611'), 90)), '8886454090611');
});

test('le lissage vertical préserve chaque bord de barre', () => {
    const l = 4, h = 9;
    const g = new Uint8ClampedArray(l * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) g[y * l + x] = x % 2 ? 255 : 0;
    assert.deepEqual([...lisserVerticalement(g, l, h, 3)], [...g]);
});

test('seul le code dans le viseur est lu, jamais l’étiquette voisine', () => {
    const image = vide(1280, 720);
    const visee = dessinerEan13('8886454090611');
    const voisine = dessinerEan13('4516916208288');
    coller(image, voisine, Math.round((1280 - voisine.largeur) / 2), 20);
    coller(image, visee, Math.round((1280 - visee.largeur) / 2), Math.round((720 - visee.hauteur) / 2));
    assert.equal(lire(bande(image)), '8886454090611');
});

test('une étiquette hors du cadre n’est pas lue du tout', () => {
    const image = vide(1280, 720);
    const voisine = dessinerEan13('4516916208288');
    coller(image, voisine, Math.round((1280 - voisine.largeur) / 2), 20);
    assert.equal(lire(bande(image)), null);
});

test('une image sans code ne produit rien, et n’écrit rien dans la console', () => {
    // ZXing-JS 0.23 journalise une trace par image vide via MultiFormatReader.
    const traces = [];
    const warn = console.warn, error = console.error;
    console.warn = (...a) => traces.push(a);
    console.error = (...a) => traces.push(a);
    try {
        assert.equal(lire(vide(640, 240)), null);
        assert.equal(lire(bruiter(vide(640, 240), 90)), null);
    } finally {
        console.warn = warn;
        console.error = error;
    }
    assert.equal(traces.length, 0);
});
