<?php

namespace SunmiScan;

/**
 * Les codes GS1 — EAN-8, UPC-A, EAN-13 — et leurs écritures équivalentes.
 *
 * Un même code-barres s'écrit de plusieurs façons, et chacune se retrouve en
 * base selon qui l'a saisi : un UPC-A lu en 12 chiffres s'enregistre souvent
 * en EAN-13 avec un zéro de tête ; un code tapé à la main perd parfois sa clé
 * de contrôle, le dernier chiffre, que les générateurs ajoutent sans toujours
 * l'afficher sous les barres.
 *
 * Même logique que src/gs1.ts, pour les écrans qui comparent côté client.
 */
final class Gs1
{
    /** Clé de contrôle GS1 : poids 3 et 1 en alternance, en partant de la droite. */
    public static function cle(string $corps): int
    {
        $somme = 0;
        $n = strlen($corps);
        for ($i = 0; $i < $n; $i++) {
            $chiffre = (int) $corps[$n - 1 - $i];
            $somme += $i % 2 === 0 ? $chiffre * 3 : $chiffre;
        }

        return (10 - $somme % 10) % 10;
    }

    /** Vrai si le dernier chiffre est bien la clé des précédents. */
    public static function cleValide(string $code): bool
    {
        return strlen($code) >= 2 && ctype_digit($code)
            && self::cle(substr($code, 0, -1)) === (int) $code[strlen($code) - 1];
    }

    /**
     * Les autres écritures du même code, avec la raison de chacune.
     *
     * Une liste de paires, pas un tableau associatif : PHP convertit une clé
     * « 123456789012 » en ENTIER, et une comparaison stricte avec des codes —
     * des chaînes — échouait alors en silence. Seules les formes à zéro de
     * tête y échappaient, par hasard.
     *
     * @return list<array{0: string, 1: string}>
     */
    public static function formesEquivalentes(string $code): array
    {
        $lu = trim($code);
        if ($lu === '' || ! ctype_digit($lu)) {
            return [];
        }

        $formes = [];
        $n = strlen($lu);

        if ($n === 12) {
            $formes[] = ['0'.$lu, 'zero_ean'];
        }
        if ($n === 13 && $lu[0] === '0') {
            $formes[] = [substr($lu, 1), 'upc'];
        }
        if (in_array($n, [8, 12, 13], true) && self::cleValide($lu)) {
            $formes[] = [substr($lu, 0, -1), 'sans_cle'];
        }
        if (in_array($n, [7, 11, 12], true)) {
            $formes[] = [$lu.self::cle($lu), 'avec_cle'];
        }

        return $formes;
    }
}
