<?php

namespace SunmiScan;

/**
 * Tout ce qu'un code lu au scanner peut désigner dans un catalogue — sans
 * jamais trancher à la place de l'utilisateur quand ce n'est pas certain.
 *
 *  - **exacts** : les produits qui portent ce code tel quel. Un seul → l'écran
 *    peut le retenir directement. Plusieurs → ambiguïté réelle, le même code
 *    saisi sur deux fiches : prendre le premier serait compter une pièce au
 *    hasard, l'écran doit proposer la liste.
 *  - **proches** : seulement s'il n'y a aucun exact. D'abord les autres
 *    écritures du MÊME code-barres (Gs1::formesEquivalentes), puis les codes
 *    qui commencent comme la lecture ou la contiennent. Jamais retenus
 *    d'office : ils se proposent, l'utilisateur choisit.
 *
 * La source du catalogue n'est pas l'affaire de cette classe : chaque projet
 * dit seulement, par des fonctions, quels codes porte un produit.
 *
 *   $trouve = Correspondance::chercher(
 *       $code,
 *       Product::all(),
 *       codesDe: fn ($p) => [$p->sku, ...$p->barcodes],
 *       identifiantDe: fn ($p) => $p->uuid,
 *   );
 */
final class Correspondance
{
    /** L'ordre des proches : les équivalences d'abord, les ressemblances ensuite. */
    public const RAISONS = ['zero_ean', 'upc', 'sans_cle', 'avec_cle', 'prefixe', 'contient'];

    public const PROCHES_MAX = 8;

    /** En deçà, un fragment se retrouve partout : la liste ne dirait plus rien. */
    private const FRAGMENT_MIN = 5;

    /** Un code plus court que ceci ne compte pas comme « commence pareil ». */
    private const PREFIXE_MIN = 6;

    /**
     * @template T
     *
     * @param  iterable<T>  $produits
     * @param  callable(T): iterable<string|null>  $codesDe  Les codes que porte un produit : SKU, codes-barres…
     * @param  (callable(T): string)|null  $identifiantDe  Un identifiant qui ne compte qu'en correspondance EXACTE
     *                                                     (UUID d'une étiquette QR) : un bout de chiffres se
     *                                                     retrouve par hasard dans un UUID hexadécimal.
     * @return array{exacts: list<T>, proches: list<array{produit: T, raison: string}>}
     */
    public static function chercher(string $code, iterable $produits, callable $codesDe, ?callable $identifiantDe = null): array
    {
        $lu = mb_strtoupper(trim($code));
        if ($lu === '') {
            return ['exacts' => [], 'proches' => []];
        }

        $normaliser = static function ($produit) use ($codesDe): array {
            $codes = [];
            foreach ($codesDe($produit) as $c) {
                $c = mb_strtoupper(trim((string) $c));
                if ($c !== '') {
                    $codes[$c] = true;
                }
            }

            // Les clés numériques sont redevenues des entiers : on les rend en chaînes.
            return array_map('strval', array_keys($codes));
        };

        $catalogue = [];
        $exacts = [];
        foreach ($produits as $produit) {
            $codes = $normaliser($produit);
            $catalogue[] = [$produit, $codes];

            if (in_array($lu, $codes, true)
                || ($identifiantDe !== null && mb_strtoupper((string) $identifiantDe($produit)) === $lu)) {
                $exacts[] = $produit;
            }
        }

        if ($exacts) {
            return ['exacts' => $exacts, 'proches' => []];
        }

        $formes = Gs1::formesEquivalentes($lu);
        $rang = array_flip(self::RAISONS);
        $proches = [];

        foreach ($catalogue as [$produit, $codes]) {
            $raison = null;

            foreach ($formes as [$forme, $motif]) {
                if (in_array($forme, $codes, true)) {
                    $raison = $motif;
                    break;
                }
            }

            if ($raison === null && mb_strlen($lu) >= self::FRAGMENT_MIN) {
                foreach ($codes as $c) {
                    if (mb_strlen($c) >= self::PREFIXE_MIN && (str_starts_with($c, $lu) || str_starts_with($lu, $c))) {
                        $raison = 'prefixe';
                        break;
                    }
                    if (str_contains($c, $lu)) {
                        $raison ??= 'contient';
                    }
                }
            }

            if ($raison !== null) {
                $proches[] = ['produit' => $produit, 'raison' => $raison];
            }
        }

        // usort est stable depuis PHP 8.0 : à raison égale, l'ordre du catalogue.
        usort($proches, static fn ($a, $b) => $rang[$a['raison']] <=> $rang[$b['raison']]);

        return ['exacts' => [], 'proches' => array_slice($proches, 0, self::PROCHES_MAX)];
    }
}
