# sunmi-scan

Lire des codes-barres sur les terminaux Sunmi — par la **caméra** ou par le **scanner intégré** — dans une application Laravel + Vue. Tout ce qu'il faut savoir des terminaux y est déjà réglé : WebView Chrome 74 figé, caméra réservée au HTTPS, pavé numérique à protéger des scans.

Né dans Storit (inventaire tournant STA), extrait pour servir partout.

| | |
|---|---|
| `@derricknoutais/sunmi-scan` | le cœur, **sans framework** : fenêtre de scan caméra prête à l'emploi, écoute du scanner clavier, décodeur, GS1 |
| `@derricknoutais/sunmi-scan/vue` | deux composables Vue 3 |
| `@derricknoutais/sunmi-scan/compat` | les polyfills qui manquent à Chrome 74 |
| `SunmiScan\Correspondance` (PHP) | code lu → produit(s) : exacts, écritures équivalentes GS1, propositions |
| `npx sunmi-https` | HTTPS sur le réseau local, pour tester la caméra sur un terminal |
| `npx sunmi-verifier` | refuse un build que Chrome 74 ne saurait pas exécuter |

---

## Ce que les terminaux imposent

- **Chrome 74, figé.** Les Sunmi tournent sous Android 7.1 sans Play Store : leur WebView ne sera jamais mis à jour. Une syntaxe trop récente dans le JavaScript donne une **page blanche sans aucun message** ; une API trop récente casse un écran déjà affiché ; un CSS trop récent défait la mise en page en silence.
- **Beaucoup n'ont pas de module de scan** (V2 Pro, V2s…) : ni touche de scan, ni menu Scanner. Leur scanner, c'est la caméra — et un navigateur n'ouvre la caméra **qu'en HTTPS**.
- Ceux qui en ont un livrent le code comme un clavier très rapide, **suivi d'Entrée** : sans précaution, un pavé numérique qui valide sur Entrée enregistre les premiers chiffres du code comme quantité.

## Installation

### JavaScript

```bash
npm install github:derricknoutais/sunmi-scan#v0.1.0
```

En développement, à côté du projet : `npm install ../sunmi-scan`.

### PHP (facultatif — pour la correspondance côté serveur)

```json
"repositories": [{ "type": "vcs", "url": "https://github.com/derricknoutais/sunmi-scan" }]
```

```bash
composer require derricknoutais/sunmi-scan:^0.1
```

En développement : `{ "type": "path", "url": "../sunmi-scan" }`. ⚠️ Un dépôt `path` est un lien symbolique : il n'existe pas sur un serveur de production. Passer au dépôt `vcs` avant de déployer.

## Configurer le projet pour les terminaux

**1. `vite.config.ts`** — compiler pour Chrome 74 :

```ts
export default defineConfig({
    // …
    resolve: {
        // Indispensable avec une installation locale (lien symbolique) : sinon
        // le paquet charge SA copie de Vue, et ses composables ne s'accrochent
        // jamais au bon cycle de vie.
        dedupe: ['vue'],
    },
    build: {
        target: ['es2015', 'chrome58', 'safari11'],
    },
});
```

**2. `resources/js/app.ts`** — les polyfills, en **tout premier** import :

```ts
import '@derricknoutais/sunmi-scan/compat';
import { createInertiaApp } from '@inertiajs/vue3';
// …
```

Le préchargeur de Vite lui-même appelle `Promise.allSettled` (Chrome 76) à chaque page chargée à la demande : sans ce polyfill, aucune navigation Inertia n'aboutit sur un terminal.

**3. `package.json`** — vérifier chaque build :

```json
"build": "vite build && sunmi-verifier"
```

```
  ⚠ CSS : fonctionnalités ignorées par Chrome 74 — la mise en page s'y dégrade sans erreur :
      :is()                     121×  Chrome 88  → la règle entière est ignorée
      gap                        33×  Chrome 84 en flexbox (66 en grille) → éléments collés
  ✓ JavaScript compatible Chrome 74 — 38 fichiers vérifiés
```

Le JavaScript fait échouer le build ; le CSS n'est qu'un rapport — un CSS dégradé reste utilisable, et le corriger passe par la génération du CSS (Tailwind, PostCSS), pas par une ligne de code.

**4. La page de diagnostic** — à servir, pour le jour où un terminal fait des siennes en magasin, sans console ni câble :

```bash
cp node_modules/@derricknoutais/sunmi-scan/diagnostic.html public/
```

Écrite en ES5, elle s'affiche sur n'importe quel navigateur, donne la version du moteur et ce qu'il sait faire, et teste le scanner intégré : mode de sortie, cadence, suffixe.

## Vue 3

```vue
<script setup lang="ts">
import { useScanner, useScannerCamera } from '@derricknoutais/sunmi-scan/vue';

function surLecture(code: string) {
    // retrouver la référence, sauter à la ligne…
}

// La caméra — pour les terminaux sans module de scan.
const { ouvrir } = useScannerCamera(surLecture, { couleur: '#115e6b' });

// Le scanner qui tape comme un clavier — module de scan, douchette Bluetooth.
// Actif du montage au démontage ; protège le pavé numérique des scans.
useScanner(surLecture);
</script>

<template>
    <button type="button" @click="ouvrir">Scanner</button>
</template>
```

Les deux peuvent cohabiter : c'est ce que fait Storit, pour que le même écran serve sur un terminal avec ou sans module de scan.

## Sans framework — Vue 2, Alpine, Blade

```js
import { ecouterScanner, scannerCamera } from '@derricknoutais/sunmi-scan';

document.querySelector('#scanner').addEventListener('click', () => {
    scannerCamera({ surLecture: (code) => chercher(code), couleur: '#115e6b' });
});

const ecoute = ecouterScanner((code) => chercher(code));
// en quittant l'écran : ecoute.arreter();
```

## Les choix de la caméra

- **Seule la bande du viseur est décodée**, jamais l'image entière. Sur un rayon, la caméra voit plusieurs étiquettes ; lire la voisine ferait compter la mauvaise pièce. Le cadre affiché est exactement la zone décodée.
- **Deux lectures identiques de suite** avant de retenir un code.
- **Les lignes sont moyennées verticalement** avant le décodage 1D : les barres étant verticales, l'information est tout entière horizontale, et ce lissage efface le bruit du capteur sans déplacer un bord. Mesuré : lecture fiable jusqu'à ±40 de bruit par pixel sans, ±110 avec.
- **ZXing n'est chargé qu'à l'ouverture de la caméra** (120 Ko compressés), et on contourne son `MultiFormatReader`, qui dans la version 0.23 écrit une trace de pile dans la console pour chaque image sans code.

## Côté serveur : ce qu'un code désigne

```php
use SunmiScan\Correspondance;

$trouve = Correspondance::chercher(
    $request->query('c'),
    Product::all(),
    codesDe: fn ($p) => [$p->sku, ...$p->barcodes],
    identifiantDe: fn ($p) => $p->uuid,   // facultatif : correspondance exacte seulement
);

// ['exacts' => [...], 'proches' => [['produit' => ..., 'raison' => 'sans_cle'], ...]]
```

- **Un seul exact** → le retenir directement.
- **Plusieurs exacts** → le même code sur deux fiches : **proposer la liste**. Prendre le premier reviendrait à compter une pièce au hasard.
- **Aucun exact** → les `proches`, à **proposer, jamais retenir d'office** : d'abord les autres écritures du même code-barres — un UPC-A enregistré en EAN-13 avec son zéro, ou sans sa clé de contrôle —, puis les codes qui commencent ou contiennent la lecture.

La clé de contrôle mérite qu'on s'y arrête : un générateur de codes-barres affiche souvent les 11 chiffres qu'on a tapés, mais **encode 12 chiffres** — il ajoute la clé. On croit avoir imprimé `12345678901`, les barres disent `123456789012`. La lecture est juste ; c'est la saisie « à vue » qui ne l'est pas.

## Tester sur un terminal

```bash
npx sunmi-https
```

Lance `php artisan serve` s'il ne tourne pas, et un relais HTTPS devant lui, avec un certificat auto-signé couvrant l'IP du poste. Sur le terminal : **`https://<IP du poste>:8443`** — le préfixe `https://` compris ; au premier accès, « Paramètres avancés » → « Continuer ». `Ctrl+C` arrête tout.

Laravel doit croire le relais, sinon il génère des liens d'assets en `http` que la page sécurisée bloque. Dans `bootstrap/app.php` :

```php
$middleware->trustProxies(at: ['127.0.0.1', '::1']);
```

## Développer le paquet

```bash
npm install
npm test          # compile, puis 25 tests JavaScript sur dist/ et 13 tests PHP
```

Les tests tournent sous Node, sans navigateur ni caméra : le banc fabrique de vrais codes-barres (un encodeur EAN-13 conforme GS1, ZXing-JS n'encodant que les QR) et les décode par le même chemin que la page. `dist/` est versionné : une installation depuis GitHub ne compile rien.
