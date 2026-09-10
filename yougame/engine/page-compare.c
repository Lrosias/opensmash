/* Exact byte equality for rollback pages; no SIMD or floating-point semantics.
 * Built independently of BattleShip, importing the engine's existing memory.
 * Both ranges must contain at least `bytes` valid bytes. */
int equal(const unsigned long long *a, const unsigned long long *b, unsigned bytes) {
    unsigned i = 0;
    for (; i + 32 <= bytes; i += 32, a += 4, b += 4)
        if ((a[0] ^ b[0]) | (a[1] ^ b[1]) | (a[2] ^ b[2]) | (a[3] ^ b[3])) return 0;
    for (; i + 8 <= bytes; i += 8, a++, b++) if (*a != *b) return 0;
    const unsigned char *x = (const unsigned char *)a, *y = (const unsigned char *)b;
    for (; i < bytes; i++, x++, y++) if (*x != *y) return 0;
    return 1;
}
