/* Exact byte equality for rollback pages, 16 bytes per load with Wasm SIMD (integer lanes only:
 * no floating-point semantics, every bit counts). Built independently of BattleShip, importing
 * the engine's existing memory. Both ranges must contain at least `bytes` valid bytes. */
#include <wasm_simd128.h>
int equal(const unsigned char *a, const unsigned char *b, unsigned bytes) {
    unsigned i = 0;
    for (; i + 64 <= bytes; i += 64) {
        v128_t d = wasm_v128_or(wasm_v128_or(wasm_v128_xor(wasm_v128_load(a + i), wasm_v128_load(b + i)),
                                             wasm_v128_xor(wasm_v128_load(a + i + 16), wasm_v128_load(b + i + 16))),
                                wasm_v128_or(wasm_v128_xor(wasm_v128_load(a + i + 32), wasm_v128_load(b + i + 32)),
                                             wasm_v128_xor(wasm_v128_load(a + i + 48), wasm_v128_load(b + i + 48))));
        if (wasm_v128_any_true(d)) return 0;
    }
    for (; i + 16 <= bytes; i += 16)
        if (wasm_v128_any_true(wasm_v128_xor(wasm_v128_load(a + i), wasm_v128_load(b + i)))) return 0;
    for (; i < bytes; i++) if (a[i] != b[i]) return 0;
    return 1;
}
