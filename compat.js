/*
 * Le peu qui manque au WebView des terminaux Sunmi (Chrome 74).
 *
 * Abaisser la cible de compilation traduit la SYNTAXE, jamais les API : un
 * bundle sans `??` peut très bien appeler `Promise.allSettled`, absent avant
 * Chrome 76. Et une API manquante échoue à l'exécution, souvent dans un
 * gestionnaire d'événement, donc sans rien afficher.
 *
 * Script classique et non module : il s'exécute avant le bundle, que le
 * navigateur diffère par nature. En ES5, pour être lisible par un moteur plus
 * ancien encore si la flotte s'élargit.
 *
 * Ce fichier est délibérément minuscule. `@vitejs/plugin-legacy` embarquerait
 * core-js et un second bundle complet — une centaine de kilo-octets pour un
 * navigateur auquel il manque trois fonctions.
 *
 * Deux façons de le charger, au choix :
 *   import '@derricknoutais/sunmi-scan/compat';   // PREMIER import de app.ts
 *   <script src="/js/compat.js"></script>          // copié dans public/js
 *
 * ⚠️ Toute API ajoutée ici doit l'être aussi dans POLYFILLES de
 * bin/verifier-cible.mjs, sinon la vérification du build la refusera.
 */
(function () {
    'use strict';

    // Chrome 76 — utilisé par le préchargeur de Vite, donc à CHAQUE page
    // chargée à la demande. Sans lui, aucune navigation Inertia n'aboutit.
    if (!Promise.allSettled) {
        Promise.allSettled = function (promesses) {
            return Promise.all(
                Array.prototype.map.call(promesses, function (p) {
                    return Promise.resolve(p).then(
                        function (value) { return { status: 'fulfilled', value: value }; },
                        function (reason) { return { status: 'rejected', reason: reason }; }
                    );
                })
            );
        };
    }

    // Chrome 92 — un index négatif compte depuis la fin.
    function at(index) {
        var n = Math.trunc(Number(index)) || 0;
        if (n < 0) n += this.length;

        return n < 0 || n >= this.length ? undefined : this[n];
    }
    if (!Array.prototype.at) {
        Object.defineProperty(Array.prototype, 'at', { value: at, writable: true, configurable: true });
    }
    if (!String.prototype.at) {
        Object.defineProperty(String.prototype, 'at', { value: at, writable: true, configurable: true });
    }

    // Chrome 97 — Vue les référence dans son instrumentation des tableaux
    // réactifs. Inoffensif tant que rien ne les appelle, mais le jour où un
    // écran le fera, la panne serait muette.
    if (!Array.prototype.findLast) {
        Object.defineProperty(Array.prototype, 'findLast', {
            value: function (predicat, thisArg) {
                for (var i = this.length - 1; i >= 0; i--) {
                    if (predicat.call(thisArg, this[i], i, this)) return this[i];
                }

                return undefined;
            },
            writable: true, configurable: true,
        });
    }
    if (!Array.prototype.findLastIndex) {
        Object.defineProperty(Array.prototype, 'findLastIndex', {
            value: function (predicat, thisArg) {
                for (var i = this.length - 1; i >= 0; i--) {
                    if (predicat.call(thisArg, this[i], i, this)) return i;
                }

                return -1;
            },
            writable: true, configurable: true,
        });
    }
})();
