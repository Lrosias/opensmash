/* Exact byte comparison for rollback pages, 16 bytes per load with Wasm SIMD (integer lanes only:
 * no floating-point semantics, every bit counts). Built independently of BattleShip, importing
 * the engine's existing memory. Both ranges must contain at least `bytes` valid bytes. */
#include <wasm_simd128.h>
static inline int block_differs(const unsigned char *a, const unsigned char *b) {
    v128_t d = wasm_v128_or(wasm_v128_or(wasm_v128_xor(wasm_v128_load(a), wasm_v128_load(b)),
                                         wasm_v128_xor(wasm_v128_load(a + 16), wasm_v128_load(b + 16))),
                            wasm_v128_or(wasm_v128_xor(wasm_v128_load(a + 32), wasm_v128_load(b + 32)),
                                         wasm_v128_xor(wasm_v128_load(a + 48), wasm_v128_load(b + 48))));
    return wasm_v128_any_true(d);
}
int equal(const unsigned char *a, const unsigned char *b, unsigned bytes) {
    unsigned i = 0;
    for (; i + 64 <= bytes; i += 64) if (block_differs(a + i, b + i)) return 0;
    for (; i + 16 <= bytes; i += 16)
        if (wasm_v128_any_true(wasm_v128_xor(wasm_v128_load(a + i), wasm_v128_load(b + i)))) return 0;
    for (; i < bytes; i++) if (a[i] != b[i]) return 0;
    return 1;
}
/* The byte offset of the first 64-byte block that differs, or 0xFFFFFFFF when the ranges are
 * equal: one call covers a run of pages, and the caller resumes after the page it names. */
unsigned first_diff(const unsigned char *a, const unsigned char *b, unsigned bytes) {
    unsigned i = 0;
    for (; i + 64 <= bytes; i += 64) if (block_differs(a + i, b + i)) return i;
    for (; i < bytes; i++) if (a[i] != b[i]) return i;
    return 0xFFFFFFFFu;
}
