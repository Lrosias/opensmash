#pragma once

#include <math.h>
#include <stdint.h>
#include <string.h>

// WebAssembly has no deterministic scalar fused multiply-add instruction.
// If both factors have at most 26 significant bits, their product needs at
// most 52 bits. Restrict their exponents to [-450, 450] so that product is
// also normal and finite. Multiplication is then exact in binary64, making
// the following addition equivalent to a single-rounding fma. All other
// operands, including zero and non-finite values, use the original libm.
// Compile with -ffp-contract=off and without fast-math.
static inline double melee_exact_fma(double a, double c, double b) {
    uint64_t ab, cb, bb;
    memcpy(&ab, &a, sizeof(ab));
    memcpy(&cb, &c, sizeof(cb));
    memcpy(&bb, &b, sizeof(bb));
    const unsigned ae = (unsigned)((ab >> 52) & 0x7ff);
    const unsigned ce = (unsigned)((cb >> 52) & 0x7ff);
    if (((ab | cb) & UINT64_C(0x7ffffff)) == 0 &&
        ae - 573u <= 900u && ce - 573u <= 900u &&
        (bb & UINT64_C(0x7fffffffffffffff)) < UINT64_C(0x7ff0000000000000)) {
        return a * c + b;
    }
    return fma(a, c, b);
}
