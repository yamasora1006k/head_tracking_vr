
/**
 * Regression Utils
 * Implements Polynomial Regression Solver using Linear Least Squares (Pseudo-Inverse).
 * Ref: Y = X * Beta
 * Beta = (X^T * X)^-1 * X^T * Y
 * 
 * Model:
 * screenX = a0*x + a1*y + a2*x*y + a3*x^2 + a4*y^2 + a5
 * screenY = b0*x + b1*y + b2*x*y + b3*x^2 + b4*y^2 + b5
 * 
 * Input Features (x, y) order in Matrix Row:
 * [x, y, x*y, x^2, y^2, 1]
 * 
 * We need matrix inversion. Since we don't have a math library like math.js installed,
 * we implement a simple Gaussian Elimination for matrix inversion or use a lightweight approach.
 * Given the matrix size is small (6x6), we can implement Gaussian Elimination.
 */

export class PolynomialRegression {
    private coefficientsX: number[] | null = null;
    private coefficientsY: number[] | null = null;

    constructor() { }

    /**
     * Train the model with collected data points.
     * @param inputs Array of { x: number, y: number } (Gaze Yaw/Pitch)
     * @param outputs Array of { x: number, y: number } (Screen Pixels)
     */
    public fit(inputs: { x: number, y: number }[], outputs: { x: number, y: number }[]) {
        if (inputs.length < 6) {
            console.warn("Regression: Need at least 6 points for 2nd degree polynomial.");
            return;
        }

        const X = inputs.map(p => [p.x, p.y, p.x * p.y, p.x * p.x, p.y * p.y, 1]); // N x 6
        const Yx = outputs.map(p => [p.x]); // N x 1
        const Yy = outputs.map(p => [p.y]); // N x 1

        // Normal Equations: (X^T * X) * Beta = X^T * Y
        // A * Beta = B
        // Beta = A^-1 * B

        const Xt = this.transpose(X);
        const XtX = this.multiply(Xt, X); // 6 x 6
        const XtYx = this.multiply(Xt, Yx); // 6 x 1
        const XtYy = this.multiply(Xt, Yy); // 6 x 1

        try {
            const InverseXtX = this.invert(XtX);
            const BetaX = this.multiply(InverseXtX, XtYx);
            const BetaY = this.multiply(InverseXtX, XtYy);

            this.coefficientsX = BetaX.map(row => row[0]);
            this.coefficientsY = BetaY.map(row => row[0]);

            console.log("Regression Trained:", this.coefficientsX, this.coefficientsY);
        } catch (e) {
            console.error("Regression Failed (Singular Matrix?):", e);
        }
    }

    public predict(x: number, y: number): { x: number, y: number } {
        if (!this.coefficientsX || !this.coefficientsY) {
            return { x: 0, y: 0 }; // Should handle no-calibration case outside
        }

        const term = [x, y, x * y, x * x, y * y, 1];

        let outX = 0;
        let outY = 0;

        for (let i = 0; i < 6; i++) {
            outX += term[i] * this.coefficientsX[i];
            outY += term[i] * this.coefficientsY[i];
        }

        return { x: outX, y: outY };
    }

    public getCoefficients() {
        return { x: this.coefficientsX, y: this.coefficientsY };
    }

    public setCoefficients(coeffs: { x: number[], y: number[] }) {
        this.coefficientsX = coeffs.x;
        this.coefficientsY = coeffs.y;
    }

    // --- Matrix Helpers ---

    private multiply(A: number[][], B: number[][]): number[][] {
        const rowsA = A.length, colsA = A[0].length, rowsB = B.length, colsB = B[0].length;
        if (colsA !== rowsB) throw new Error("Matrix mismatch");
        const C = Array(rowsA).fill(0).map(() => Array(colsB).fill(0));
        for (let i = 0; i < rowsA; i++)
            for (let j = 0; j < colsB; j++)
                for (let k = 0; k < colsA; k++)
                    C[i][j] += A[i][k] * B[k][j];
        return C;
    }

    private transpose(A: number[][]): number[][] {
        return A[0].map((_, c) => A.map(r => r[c]));
    }

    // Gaussian Elimination for Inversion
    private invert(M: number[][]): number[][] {
        const n = M.length;
        // Create augmented matrix [M | I]
        const A = M.map((row, i) => [...row, ...Array(n).fill(0).map((_, j) => i === j ? 1 : 0)]);

        for (let i = 0; i < n; i++) {
            // Pivot
            let pivotRow = i;
            for (let j = i + 1; j < n; j++) {
                if (Math.abs(A[j][i]) > Math.abs(A[pivotRow][i])) pivotRow = j;
            }
            // Swap
            [A[i], A[pivotRow]] = [A[pivotRow], A[i]];

            const pivot = A[i][i];
            if (Math.abs(pivot) < 1e-10) throw new Error("Singular Matrix");

            // Normalize row
            for (let j = i; j < 2 * n; j++) A[i][j] /= pivot;

            // Eliminate
            for (let k = 0; k < n; k++) {
                if (k !== i) {
                    const factor = A[k][i];
                    for (let j = i; j < 2 * n; j++) A[k][j] -= factor * A[i][j];
                }
            }
        }

        // Extract inverse
        return A.map(row => row.slice(n));
    }
}
