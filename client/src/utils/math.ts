// Math Utilities for Computer Vision

export interface Point {
    x: number;
    y: number;
}

// Solve Homography Matrix
// Maps src points to dst points using 3x3 matrix H.
// Requires at least 4 point pairs.
export function solveHomography(src: Point[], dst: Point[]): number[] | null {
    if (src.length < 4 || dst.length < 4) return null;

    // Use at most 4 points for basic DLT, or 9 points for Least Squares?
    // Let's implement basic Linear Least Squares for N points.
    // Each point pair gives 2 equations.
    // Ah = 0.

    // For point i: h0*x + h1*y + h2 - h6*x*X - h7*y*X - h8*X = 0
    //              h3*x + h4*y + h5 - h6*x*Y - h7*y*Y - h8*Y = 0
    // Fix h8 = 1.
    // 8 Unknowns.

    const A: number[][] = [];
    const B: number[] = [];

    // Use only first 4 points for deterministic exact solution?
    // Or all points for regression. Regression is better for 9 points.
    const n = Math.min(src.length, dst.length);
    for (let i = 0; i < n; i++) {
        const s = src[i];
        const d = dst[i];

        // Eq 1: h0*x + h1*y + h2 - h6*x*X - h7*y*X = X
        A.push([s.x, s.y, 1, 0, 0, 0, -s.x * d.x, -s.y * d.x]);
        B.push(d.x);

        // Eq 2: h3*x + h4*y + h5 - h6*x*Y - h7*y*Y = Y
        A.push([0, 0, 0, s.x, s.y, 1, -s.x * d.y, -s.y * d.y]);
        B.push(d.y);
    }

    // A [8xN] * h = B [N]
    // Solve using pseudo-inverse: h = (A^T A)^-1 A^T B
    // Implementing general matrix inversion is heavy.

    // For simpler approach, if we have exactly 4 points, A is 8x8. We can use Gaussian elimination.
    // For 9 points (18 equations), we need Least Squares.
    // Gaussian Elimination for linear regression (Normal Equations).

    // ATA (8x8)
    const ATA = new Array(8).fill(0).map(() => new Array(8).fill(0));
    const ATB = new Array(8).fill(0);

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let sum = 0;
            for (let i = 0; i < A.length; i++) {
                sum += A[i][r] * A[i][c]; // A^T * A
            }
            ATA[r][c] = sum;
        }

        let sumB = 0;
        for (let i = 0; i < A.length; i++) {
            sumB += A[i][r] * B[i]; // A^T * B
        }
        ATB[r] = sumB;
    }

    // Solve ATA * h = ATB via Gaussian Elimination
    const N = 8;
    for (let i = 0; i < N; i++) {
        // Pivot
        let pivot = ATA[i][i];
        if (Math.abs(pivot) < 1e-6) return null; // Singular

        for (let j = i + 1; j < N; j++) {
            const factor = ATA[j][i] / pivot;
            ATB[j] -= factor * ATB[i];
            for (let k = i; k < N; k++) {
                ATA[j][k] -= factor * ATA[i][k];
            }
        }
    }

    // Back substitution
    const h = new Array(8).fill(0);
    for (let i = N - 1; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j < N; j++) {
            sum += ATA[i][j] * h[j];
        }
        h[i] = (ATB[i] - sum) / ATA[i][i];
    }

    return [...h, 1]; // Append h8 = 1
}

export function applyHomography(p: Point, h: number[]): Point {
    // x' = (h0*x + h1*y + h2) / (h6*x + h7*y + h8)
    // y' = (h3*x + h4*y + h5) / (h6*x + h7*y + h8)
    const w = h[6] * p.x + h[7] * p.y + h[8];
    if (Math.abs(w) < 1e-6) return { x: 0, y: 0 };

    const x = (h[0] * p.x + h[1] * p.y + h[2]) / w;
    const y = (h[3] * p.x + h[4] * p.y + h[5]) / w;

    return { x, y };
}
