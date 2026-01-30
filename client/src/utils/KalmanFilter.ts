/**
 * Simple 2D Kalman Filter implementation in TypeScript.
 * Based on OpenCV's KalmanFilter logic (State: x, y, dx, dy / Measurement: x, y)
 * Reference: hint.text provided by user.
 */
export class KalmanFilter {
    // State Vector [x, y, dx, dy]
    private x: number[];

    // Covariance Matrix P (4x4)
    private P: number[][];

    // Process Noise Covariance Q (4x4)
    private Q: number[][];

    // Measurement Noise Covariance R (2x2)
    private R: number[][];

    // Transition Matrix F (4x4)
    // [1, 0, 1, 0]
    // [0, 1, 0, 1]
    // [0, 0, 1, 0]
    // [0, 0, 0, 1]
    private F: number[][];

    // Measurement Matrix H (2x4)
    // [1, 0, 0, 0]
    // [0, 1, 0, 0]
    private H: number[][];

    private initialized: boolean = false;

    constructor(processNoise = 0.01, measurementNoise = 0.1) {
        // Initialize State: 0
        this.x = [0, 0, 0, 0];

        // Initialize P (Identity)
        this.P = this.eye(4);

        // Initialize Q (Process Noise)
        this.Q = this.eye(4, processNoise);

        // Initialize R (Measurement Noise)
        this.R = this.eye(2, measurementNoise);

        // Initialize F (Transition)
        this.F = [
            [1, 0, 1, 0],
            [0, 1, 0, 1],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ];

        // Initialize H (Measurement)
        this.H = [
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ];
    }

    public update(mx: number, my: number): { x: number, y: number } {
        if (!this.initialized) {
            this.x = [mx, my, 0, 0];
            this.initialized = true;
            return { x: mx, y: my };
        }

        // --- PREDICT ---
        // x = F * x
        this.x = this.multiplyMatrixVector(this.F, this.x);

        // P = F * P * F^T + Q
        const FP = this.multiplyMatrices(this.F, this.P);
        const FT = this.transposeTest(this.F); // Using explicit transpose
        const FPF_T = this.multiplyMatrices(FP, FT);
        this.P = this.addMatrices(FPF_T, this.Q);


        // --- CORRECT (UPDATE) ---
        // y = z - H * x (Innovation)
        const z = [mx, my];
        const Hx = this.multiplyMatrixVector(this.H, this.x);
        const y = [z[0] - Hx[0], z[1] - Hx[1]];

        // S = H * P * H^T + R (Innovation Covariance)
        const HP = this.multiplyMatrices(this.H, this.P);
        const HT = this.transposeTest(this.H);
        const HPH_T = this.multiplyMatrices(HP, HT);
        const S = this.addMatrices(HPH_T, this.R);

        // K = P * H^T * S^-1 (Kalman Gain)
        const Si = this.invert2x2(S);
        const PHT = this.multiplyMatrices(this.P, HT);
        const K = this.multiplyMatrices(PHT, Si);

        // x = x + K * y
        const Ky = this.multiplyMatrixVector(K, y);
        this.x = [
            this.x[0] + Ky[0],
            this.x[1] + Ky[1],
            this.x[2] + Ky[2],
            this.x[3] + Ky[3]
        ];

        // P = (I - K * H) * P
        const KH = this.multiplyMatrices(K, this.H);
        const I = this.eye(4);
        const I_KH = this.subtractMatrices(I, KH);
        this.P = this.multiplyMatrices(I_KH, this.P);

        return { x: this.x[0], y: this.x[1] };
    }

    // --- Matrix Helpers using vanilla arrays ---

    private eye(n: number, scale = 1.0): number[][] {
        const m = [];
        for (let i = 0; i < n; i++) {
            const row = new Array(n).fill(0);
            row[i] = scale;
            m.push(row);
        }
        return m;
    }

    private multiplyMatrixVector(A: number[][], v: number[]): number[] {
        const result = new Array(A.length).fill(0);
        for (let i = 0; i < A.length; i++) {
            let sum = 0;
            for (let j = 0; j < v.length; j++) {
                sum += A[i][j] * v[j];
            }
            result[i] = sum;
        }
        return result;
    }

    private multiplyMatrices(A: number[][], B: number[][]): number[][] {
        const rowsA = A.length, colsA = A[0].length;
        const rowsB = B.length, colsB = B[0].length;
        if (colsA !== rowsB) throw new Error("Matrix mismatch");

        const result = [];
        for (let i = 0; i < rowsA; i++) {
            const row = new Array(colsB).fill(0);
            for (let j = 0; j < colsB; j++) {
                let sum = 0;
                for (let k = 0; k < colsA; k++) {
                    sum += A[i][k] * B[k][j];
                }
                row[j] = sum;
            }
            result.push(row);
        }
        return result;
    }

    private addMatrices(A: number[][], B: number[][]): number[][] {
        return A.map((row, i) => row.map((val, j) => val + B[i][j]));
    }

    private subtractMatrices(A: number[][], B: number[][]): number[][] {
        return A.map((row, i) => row.map((val, j) => val - B[i][j]));
    }

    private transposeTest(A: number[][]): number[][] {
        return A[0].map((_, c) => A.map(r => r[c]));
    }

    private invert2x2(M: number[][]): number[][] {
        const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
        if (Math.abs(det) < 1e-6) return [[0, 0], [0, 0]]; // Fallback
        const invDet = 1 / det;
        return [
            [M[1][1] * invDet, -M[0][1] * invDet],
            [-M[1][0] * invDet, M[0][0] * invDet]
        ];
    }
}
