<?php

/**
 * Tests de Gs1 et Correspondance — sans PHPUnit, pour ne rien imposer au
 * paquet : `php test/php/correspondance.php`, code de sortie non nul en cas
 * d'échec.
 */

require __DIR__.'/../../php/Gs1.php';
require __DIR__.'/../../php/Correspondance.php';

use SunmiScan\Correspondance;
use SunmiScan\Gs1;

$echecs = 0;
$total = 0;

function cas(string $nom, callable $fn): void
{
    global $echecs, $total;
    $total++;
    try {
        $fn();
        echo "  ✓ {$nom}\n";
    } catch (Throwable $e) {
        $echecs++;
        echo "  ✗ {$nom}\n      {$e->getMessage()}\n";
    }
}

function egal($attendu, $obtenu): void
{
    if ($attendu !== $obtenu) {
        throw new RuntimeException('attendu '.var_export($attendu, true).', obtenu '.var_export($obtenu, true));
    }
}

/** Le catalogue d'un projet quelconque : ici des tableaux, ailleurs des modèles Eloquent. */
function chercher(string $code, array $produits): array
{
    $r = Correspondance::chercher(
        $code,
        $produits,
        codesDe: fn ($p) => [$p['sku'] ?? null, ...($p['codes'] ?? [])],
        identifiantDe: fn ($p) => $p['id'],
    );

    return [
        'exacts' => array_column($r['exacts'], 'id'),
        'proches' => array_map(fn ($x) => [$x['produit']['id'], $x['raison']], $r['proches']),
    ];
}

cas('la clé GS1 est calculée comme par les générateurs', function () {
    egal(2, Gs1::cle('12345678901'));
    egal(1, Gs1::cle('400638133393'));
    egal(4, Gs1::cle('9638507'));
});

cas('les écritures équivalentes d’un UPC-A lu en entier', function () {
    egal([['0123456789012', 'zero_ean'], ['12345678901', 'sans_cle'], ['1234567890128', 'avec_cle']], Gs1::formesEquivalentes('123456789012'));
});

cas('un code exact unique est retenu, sans proposition', function () {
    egal(['exacts' => ['a'], 'proches' => []], chercher('adk-5904', [
        ['id' => 'a', 'sku' => 'ADK-5904'],
        ['id' => 'b', 'sku' => 'ADK-59041'],
    ]));
});

cas('un code partagé par deux fiches les renvoie toutes les deux', function () {
    egal(['a', 'b'], chercher('DOUBLON', [
        ['id' => 'a', 'sku' => 'DOUBLON'],
        ['id' => 'b', 'sku' => 'X', 'codes' => ['doublon']],
    ])['exacts']);
});

cas('un UPC-A lu en entier propose la fiche saisie sans sa clé', function () {
    // Le cas vécu : « 12345678901 » tapé dans un générateur, « 123456789012 » dans les barres.
    egal([['rad', 'sans_cle']], chercher('123456789012', [['id' => 'rad', 'sku' => '12345678901']])['proches']);
});

cas('une forme purement numérique est bien comparée — le piège des clés entières', function () {
    egal([['rad', 'avec_cle']], chercher('12345678901', [['id' => 'rad', 'sku' => '123456789012']])['proches']);
});

cas('UPC-A et EAN-13 à zéro de tête sont le même code', function () {
    egal([['ean', 'zero_ean']], chercher('123456789012', [['id' => 'ean', 'sku' => '0123456789012']])['proches']);
    egal([['upc', 'upc']], chercher('0098765432109', [['id' => 'upc', 'sku' => '098765432109']])['proches']);
});

cas('les équivalences passent devant les ressemblances', function () {
    egal(['meme', 'ressemble'], array_column(chercher('123456789012', [
        ['id' => 'ressemble', 'sku' => '1234567890123456'],
        ['id' => 'meme', 'sku' => '12345678901'],
    ])['proches'], 0));
});

cas('un fragment trop court ne propose rien', function () {
    egal([], chercher('1234', [['id' => 'a', 'sku' => '123456789']])['proches']);
});

cas('l’identifiant ne compte qu’en correspondance exacte', function () {
    $uuid = 'd29e9f00-5d59-4202-9426-5718500f2fcc';
    egal(['exacts' => [$uuid], 'proches' => []], chercher(strtoupper($uuid), [['id' => $uuid, 'sku' => 'X']]));
    egal(['exacts' => [], 'proches' => []], chercher('5718500f2f', [['id' => $uuid, 'sku' => 'SANS-RAPPORT']]));
});

cas('les proches sont plafonnés', function () {
    $produits = [];
    for ($i = 0; $i < 20; $i++) {
        $produits[] = ['id' => "p{$i}", 'sku' => "ABCDEF-{$i}"];
    }
    egal(Correspondance::PROCHES_MAX, count(chercher('ABCDEF', $produits)['proches']));
});

cas('fonctionne avec des objets, pas seulement des tableaux', function () {
    $produit = new class
    {
        public string $uuid = 'u1';

        public array $barcodes = ['8886454090611'];
    };
    $r = Correspondance::chercher('8886454090611', [$produit], codesDe: fn ($p) => $p->barcodes, identifiantDe: fn ($p) => $p->uuid);
    egal($produit, $r['exacts'][0]);
});

cas('un code vide ne trouve rien', function () {
    egal(['exacts' => [], 'proches' => []], chercher('  ', [['id' => 'a', 'sku' => '']]));
});

echo "\n".($total - $echecs)." / {$total} réussis\n";
exit($echecs ? 1 : 0);
