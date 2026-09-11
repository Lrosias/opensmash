// Differential verification against the platform's fused operation.
// clang -O2 -ffp-contract=off -fno-fast-math melee/tests/exact-fma.c -o /tmp/melee-exact-fma
#include "../engine/MeleeExactFma.h"
#include <stdio.h>
#include <stdlib.h>

static uint64_t seed = UINT64_C(0x2f6e2b1d13579ace);
static uint64_t random_bits(void) {
    seed ^= seed << 13; seed ^= seed >> 7; seed ^= seed << 17;
    return seed;
}
static double value(uint64_t bits) {
    double d; memcpy(&d, &bits, sizeof(d)); return d;
}
static uint64_t bits(double d) {
    uint64_t u; memcpy(&u, &d, sizeof(u)); return u;
}
static unsigned long checked;
static void check(double a, double c, double b) {
    const double expected = fma(a, c, b);
    const double actual = melee_exact_fma(a, c, b);
    if (bits(expected) != bits(actual)) {
        fprintf(stderr, "Mismatch: %a * %a + %a: %a != %a\n", a, c, b, actual, expected);
        exit(1);
    }
    ++checked;
}
int main(void) {
    const uint64_t edges[] = {0, UINT64_C(0x8000000000000000), 1,
        UINT64_C(0x0010000000000000), UINT64_C(0x7fefffffffffffff),
        UINT64_C(0x7ff0000000000000), UINT64_C(0xfff0000000000000),
        UINT64_C(0x7ff8000000000123), UINT64_C(0x7ff0000000000123),
        UINT64_C(0x3ff0000000000000), UINT64_C(0xbff0000000000000)};
    for (unsigned i=0; i<sizeof(edges)/sizeof(*edges); ++i)
        for (unsigned j=0; j<sizeof(edges)/sizeof(*edges); ++j)
            for (unsigned k=0; k<sizeof(edges)/sizeof(*edges); ++k)
                check(value(edges[i]), value(edges[j]), value(edges[k]));
    for (unsigned i=0; i<2000000; ++i) {
        check(value(random_bits()), value(random_bits()), value(random_bits()));
        // Exact-product candidates, including both exponent boundaries and
        // just outside them. Cancellation probes the single-rounding result.
        uint64_t a = (random_bits() & UINT64_C(0x800fffffffffffff)) & ~UINT64_C(0x7ffffff);
        uint64_t c = (random_bits() & UINT64_C(0x800fffffffffffff)) & ~UINT64_C(0x7ffffff);
        a |= (uint64_t)(572 + i % 903) << 52;
        c |= (uint64_t)(572 + (i / 903) % 903) << 52;
        double x=value(a), y=value(c);
        check(x, y, value(random_bits()));
        check(x, y, -(x*y));
        check(x, y, nextafter(-(x*y), INFINITY));
    }
    printf("%lu bit-exact fma comparisons passed\n", checked);
}
