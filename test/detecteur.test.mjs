/**
 * Le tri entre frappe humaine et lecture de scanner — sur le code livré (dist).
 * Horloge simulée : les cadences sont exactes à la milliseconde.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { creerDetecteur, REGLAGES } from '../dist/detecteur.js';

function banc() {
    let t = 0;
    let prochainId = 1;
    const minuteries = new Map();
    const horloge = {
        maintenant: () => t,
        differer: (fn, ms) => { const id = prochainId++; minuteries.set(id, { echeance: t + ms, fn }); return id; },
        annuler: (id) => { minuteries.delete(id); },
    };
    const lectures = [];
    const rendues = [];
    const d = creerDetecteur({ lecture: (c) => lectures.push(c), rendre: (k) => rendues.push(k) }, horloge);
    function avancer(ms) {
        const fin = t + ms;
        for (;;) {
            const suivante = [...minuteries.entries()].filter(([, m]) => m.echeance <= fin).sort((a, b) => a[1].echeance - b[1].echeance)[0];
            if (!suivante) break;
            t = suivante[1].echeance;
            minuteries.delete(suivante[0]);
            suivante[1].fn();
        }
        t = fin;
    }
    function taper(texte, cadence, intercepter = true, entree = false) {
        const decisions = [];
        for (const c of texte) { decisions.push(d.touche(c, intercepter)); avancer(cadence); }
        if (entree) decisions.push(d.touche('Enter', intercepter));
        return decisions;
    }
    return { d, avancer, taper, lectures, rendues };
}

test('une lecture suivie d’Entrée est reconnue, et l’Entrée n’atteint pas la page', () => {
    // Sans cela, un pavé numérique qui valide sur Entrée enregistrerait 8886.
    const b = banc();
    const decisions = b.taper('8886454090611', 8, true, true);
    assert.deepEqual(b.lectures, ['8886454090611']);
    assert.deepEqual(b.rendues, []);
    assert.ok(decisions.every((x) => x === 'absorber'));
});

test('une lecture sans suffixe se conclut au silence', () => {
    const b = banc();
    b.taper('ADK-5904', 10);
    b.avancer(REGLAGES.silence);
    assert.deepEqual(b.lectures, ['ADK-5904']);
});

test('une touche humaine isolée est rendue à la page', () => {
    const b = banc();
    b.taper('5', 0);
    b.avancer(REGLAGES.silence);
    assert.deepEqual(b.lectures, []);
    assert.deepEqual(b.rendues, [['5']]);
});

test('une saisie humaine lente reste une saisie, et son Entrée passe', () => {
    const b = banc();
    const decisions = b.taper('120', 200, true, true);
    assert.deepEqual(b.lectures, []);
    assert.deepEqual(b.rendues, [['1'], ['2'], ['0']]);
    assert.equal(decisions.at(-1), 'laisser');
});

test('deux frappes rapides ne font pas un code et sont rendues dans l’ordre', () => {
    const b = banc();
    b.taper('12', 20);
    b.avancer(REGLAGES.silence);
    assert.deepEqual(b.rendues, [['1', '2']]);
});

test('un chiffre puis Entrée : le chiffre est rendu AVANT que l’Entrée passe', () => {
    const b = banc();
    b.d.touche('7', true);
    b.avancer(30);
    assert.equal(b.d.touche('Enter', true), 'laisser');
    assert.deepEqual(b.rendues, [['7']]);
});

test('dans un champ texte, les caractères passent mais la lecture est signalée', () => {
    const b = banc();
    const decisions = b.taper('3446092', 8, false, true);
    assert.deepEqual(b.lectures, ['3446092']);
    assert.ok(decisions.slice(0, -1).every((x) => x === 'laisser'));
    assert.equal(decisions.at(-1), 'absorber');
});

test('Maj au milieu d’une rafale ne la rompt pas', () => {
    const b = banc();
    for (const k of ['Shift', 'T', 'Shift', 'Y', 'B', 'J', '-', '5']) { b.d.touche(k, true); b.avancer(8); }
    b.d.touche('Enter', true);
    assert.deepEqual(b.lectures, ['TYBJ-5']);
});

test('deux lectures enchaînées donnent deux codes', () => {
    const b = banc();
    b.taper('3446092', 8, true, true);
    b.avancer(300);
    b.taper('3430977', 8, true, true);
    assert.deepEqual(b.lectures, ['3446092', '3430977']);
});

test('une rafale sans suffixe coupée par un silence moyen est émise, pas rendue', () => {
    const b = banc();
    b.taper('ABCDE', 8);
    b.avancer(52);
    b.d.touche('9', true);
    b.avancer(REGLAGES.silence);
    assert.deepEqual(b.lectures, ['ABCDE']);
    assert.deepEqual(b.rendues, [['9']]);
});

test('une Entrée seule passe telle quelle', () => {
    const b = banc();
    assert.equal(b.d.touche('Enter', true), 'laisser');
});
