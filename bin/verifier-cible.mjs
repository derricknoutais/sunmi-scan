#!/usr/bin/env node
/**
 * Refuse un build que les terminaux Sunmi ne sauraient pas exécuter.
 *
 *   npx sunmi-verifier                    (public/build/assets par défaut)
 *   npx sunmi-verifier chemin/des/assets
 *
 * À enchaîner après `vite build` :  "build": "vite build && sunmi-verifier"
 *
 * Les terminaux Sunmi tournent sous Android 7.1 avec un WebView Chrome 74,
 * sans Play Store, donc jamais mis à jour. Trois façons d'y casser une
 * application, toutes silencieuses :
 *
 *  - une syntaxe JavaScript trop récente échoue au parsing du module — le
 *    fichier est téléchargé, rien ne s'exécute, aucune erreur ne s'affiche :
 *    page blanche ;
 *  - une API trop récente échoue à l'exécution, souvent dans un gestionnaire
 *    d'événement, sur un écran déjà affiché ;
 *  - une fonctionnalité CSS trop récente est ignorée : la mise en page se
 *    défait sans que rien ne le signale.
 *
 * Les deux premières font échouer la vérification. La troisième n'est qu'un
 * rapport : un CSS dégradé reste utilisable, et la corriger demande d'agir sur
 * la génération du CSS (Tailwind, PostCSS), pas sur une ligne de code.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CHROME_CIBLE = Number(process.env.CHROME_CIBLE ?? 74);
const DOSSIER = process.argv[2] ?? 'public/build/assets';

/** Comblé par compat.js, à charger avant le bundle. */
const POLYFILLES = new Set(['Promise.allSettled', '.at()', 'findLast', 'findLastIndex']);

const REGLES_JS = [
    { nom: '??  (coalescence)', depuis: 80, motif: /\?\?[^=]/g, dansRegex: true },
    { nom: '?.  (chaînage optionnel)', depuis: 80, motif: /\?\.[A-Za-z_$[(]/g },
    { nom: '??=  ||=  &&=', depuis: 85, motif: /\?\?=|\|\|=|&&=/g },
    { nom: 'static { }', depuis: 94, motif: /\bstatic\s*\{/g },
    { nom: 'Promise.allSettled', depuis: 76, motif: /\ballSettled\b/g },
    { nom: '.at()', depuis: 92, motif: /(?<![A-Za-z0-9_$.])[A-Za-z0-9_$\])]\.at\(/g },
    { nom: 'findLast', depuis: 97, motif: /\bfindLast\b/g },
    { nom: 'findLastIndex', depuis: 97, motif: /\bfindLastIndex\b/g },
    { nom: '.replaceAll()', depuis: 85, motif: /\.replaceAll\(/g },
    { nom: 'structuredClone', depuis: 98, motif: /\bstructuredClone\b/g },
    { nom: 'Object.hasOwn', depuis: 93, motif: /\bhasOwn\b/g },
];

const REGLES_CSS = [
    { nom: 'inset', depuis: 87, motif: /(?:^|[;{\s])inset\s*:/g, effet: 'positionnement perdu (utiliser top/right/bottom/left)' },
    // `:is(.dark *)` : le mode sombre de Tailwind 3.4, par classe. Ignoré par un
    // terminal resté en clair, donc sans effet : compté à part pour ne pas
    // crier au loup — un projet Tailwind en produit une centaine.
    { nom: ':is()', depuis: 88, motif: /:is\((?!\.dark \*\))/g, effet: 'la règle entière est ignorée' },
    { nom: ':is(.dark *)', depuis: 88, motif: /:is\(\.dark \*\)/g, effet: 'mode sombre seulement — sans effet sur un terminal en clair', benin: true },
    { nom: ':where()', depuis: 88, motif: /:where\(/g, effet: 'la règle entière est ignorée (dans Tailwind 3.4 : la remise à zéro de base)' },
    { nom: ':has()', depuis: 105, motif: /:has\(/g, effet: 'la règle entière est ignorée' },
    { nom: 'max() / min() / clamp()', depuis: 79, motif: /(?:max|min|clamp)\(/g, effet: 'la déclaration est ignorée' },
    { nom: 'aspect-ratio', depuis: 88, motif: /aspect-ratio\s*:/g, effet: 'proportions perdues' },
    { nom: 'color-mix() / oklch()', depuis: 111, motif: /color-mix\(|oklch\(/g, effet: 'couleur ignorée' },
    { nom: '@layer', depuis: 99, motif: /@layer\b/g, effet: 'tout le bloc est ignoré' },
];

/**
 * `gap` n'est connu en flexbox que depuis Chrome 84 ; en grille, depuis 66.
 * On ne peut pas savoir, dans le CSS, si la classe servira à une flexbox : on
 * le compte à part, sans l'imputer à tort à une grille.
 */
const GAP = /(?:^|[;{\s])(?:row-|column-)?gap\s*:/g;

if (!existsSync(DOSSIER)) {
    console.error(`\n  ✗ ${DOSSIER} n'existe pas — lancer le build d'abord.\n`);
    process.exit(1);
}

const fichiers = readdirSync(DOSSIER);
const trouves = new Map();

for (const fichier of fichiers.filter((f) => f.endsWith('.js'))) {
    const source = readFileSync(join(DOSSIER, fichier), 'utf8');

    for (const regle of REGLES_JS) {
        if (regle.depuis <= CHROME_CIBLE || POLYFILLES.has(regle.nom)) continue;

        for (const m of source.matchAll(regle.motif)) {
            // `\??` dans une expression régulière n'est pas l'opérateur.
            if (regle.dansRegex && /[/\\]\s*$/.test(source.slice(m.index - 2, m.index))) continue;

            const contexte = source.slice(Math.max(0, m.index - 60), m.index + 25).replace(/\n/g, ' ');
            if (!trouves.has(regle.nom)) trouves.set(regle.nom, { depuis: regle.depuis, exemples: [] });
            trouves.get(regle.nom).exemples.push(`${fichier} … ${contexte}`);
        }
    }
}

// --- CSS : rapport seulement ---
const css = new Map();
let gaps = 0;
for (const fichier of fichiers.filter((f) => f.endsWith('.css'))) {
    const source = readFileSync(join(DOSSIER, fichier), 'utf8');
    for (const regle of REGLES_CSS) {
        if (regle.depuis <= CHROME_CIBLE) continue;
        const n = [...source.matchAll(regle.motif)].length;
        if (n) css.set(regle.nom, { n: (css.get(regle.nom)?.n ?? 0) + n, depuis: regle.depuis, effet: regle.effet });
    }
    if (CHROME_CIBLE < 84) gaps += [...source.matchAll(GAP)].length;
}

if (css.size || gaps) {
    console.warn(`\n  ⚠ CSS : fonctionnalités ignorées par Chrome ${CHROME_CIBLE} — la mise en page s'y dégrade sans erreur :\n`);
    for (const [nom, { n, depuis, effet }] of css) {
        console.warn(`      ${nom.padEnd(24)} ${String(n).padStart(4)}×  Chrome ${depuis}  → ${effet}`);
    }
    if (gaps) console.warn(`      ${'gap'.padEnd(24)} ${String(gaps).padStart(4)}×  Chrome 84 en flexbox (66 en grille) → éléments collés`);
    console.warn('');
}

if (trouves.size === 0) {
    const nJs = fichiers.filter((f) => f.endsWith('.js')).length;
    console.log(`  ✓ JavaScript compatible Chrome ${CHROME_CIBLE} — ${nJs} fichiers vérifiés`);
    process.exit(0);
}

console.error(`\n  ✗ Ce build ne tournera pas sur les terminaux (Chrome ${CHROME_CIBLE}).\n`);
for (const [nom, { depuis, exemples }] of trouves) {
    console.error(`    ${nom} — exige Chrome ${depuis}, ${exemples.length} occurrence(s)`);
    console.error(`        ${exemples[0]}\n`);
}
console.error('    Syntaxe  → abaisser build.target dans vite.config (voir README)');
console.error('    API      → un polyfill dans compat.js du paquet, et son nom dans POLYFILLES ici.\n');
process.exit(1);
