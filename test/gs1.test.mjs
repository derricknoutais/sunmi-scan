import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { cleGs1, cleValide, formesEquivalentes } from '../dist/gs1.js';

test('la clé GS1 est calculée comme par les générateurs', () => {
    assert.equal(cleGs1('12345678901'), 2);   // UPC-A → 123456789012
    assert.equal(cleGs1('400638133393'), 1);  // EAN-13 → 4006381333931
    assert.equal(cleGs1('9638507'), 4);       // EAN-8 → 96385074
});

test('une clé valide est reconnue, une fausse non', () => {
    assert.ok(cleValide('123456789012'));
    assert.ok(!cleValide('123456789013'));
    assert.ok(!cleValide('ADK-5904'));
});

test('un UPC-A lu en entier a trois autres écritures', () => {
    assert.deepEqual(formesEquivalentes('123456789012'), [
        ['0123456789012', 'zero_ean'],
        ['12345678901', 'sans_cle'],
        ['1234567890128', 'avec_cle'],
    ]);
});

test('un UPC-A tapé sans sa clé la retrouve', () => {
    assert.deepEqual(formesEquivalentes('12345678901'), [['123456789012', 'avec_cle']]);
});

test('un EAN-13 à zéro de tête se lit aussi en UPC-A', () => {
    assert.deepEqual(formesEquivalentes('0123456789012')[0], ['123456789012', 'upc']);
});

test('un code alphanumérique n’a pas d’écriture équivalente', () => {
    assert.deepEqual(formesEquivalentes('ADK-5904'), []);
});
