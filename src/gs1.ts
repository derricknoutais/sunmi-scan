/**
 * Les codes GS1 — EAN-8, UPC-A, EAN-13 — et leurs écritures équivalentes.
 *
 * Un même code-barres s'écrit de plusieurs façons, et chacune se retrouve en
 * base selon qui l'a saisi :
 *
 *  - un UPC-A se lit en 12 chiffres, mais s'enregistre souvent en EAN-13 avec
 *    un zéro de tête ;
 *  - un code tapé à la main perd parfois sa clé de contrôle — le dernier
 *    chiffre, que les générateurs ajoutent sans toujours l'afficher sous les
 *    barres. On croit avoir encodé « 12345678901 », les barres disent
 *    « 123456789012 ».
 *
 * Ces formes ne sont pas des ressemblances : c'est le même code. Elles restent
 * pourtant des PROPOSITIONS — on ne sait pas laquelle des fiches a été saisie
 * juste. Même logique que php/Gs1.php, pour les écrans qui comparent sans
 * interroger le serveur.
 */

export type RaisonEquivalence = 'zero_ean' | 'upc' | 'sans_cle' | 'avec_cle';

/** Clé de contrôle GS1 : poids 3 et 1 en alternance, en partant de la droite. */
export function cleGs1(corps: string): number {
    let somme = 0;
    const n = corps.length;
    for (let i = 0; i < n; i++) {
        const chiffre = Number(corps[n - 1 - i]);
        somme += i % 2 === 0 ? chiffre * 3 : chiffre;
    }

    return (10 - (somme % 10)) % 10;
}

/** Vrai si le dernier chiffre est bien la clé des précédents. */
export function cleValide(code: string): boolean {
    return /^\d{2,}$/.test(code) && cleGs1(code.slice(0, -1)) === Number(code[code.length - 1]);
}

/**
 * Les autres écritures du même code, avec la raison de chacune.
 *
 * Renvoie un tableau de paires et non un objet : une clé d'objet numérique
 * comme « 123456789012 » est convertie et réordonnée par JavaScript — le même
 * piège qu'en PHP, où il masquait deux équivalences sur trois.
 */
export function formesEquivalentes(code: string): Array<[string, RaisonEquivalence]> {
    const lu = code.trim();
    if (!/^\d+$/.test(lu)) return [];

    const formes: Array<[string, RaisonEquivalence]> = [];
    const n = lu.length;

    if (n === 12) formes.push([`0${lu}`, 'zero_ean']);
    if (n === 13 && lu[0] === '0') formes.push([lu.slice(1), 'upc']);
    if ((n === 8 || n === 12 || n === 13) && cleValide(lu)) formes.push([lu.slice(0, -1), 'sans_cle']);
    if (n === 7 || n === 11 || n === 12) formes.push([`${lu}${cleGs1(lu)}`, 'avec_cle']);

    return formes;
}
