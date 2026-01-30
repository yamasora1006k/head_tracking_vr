/**
 * One Euro Filter for smoothing noisy signals with minimal lag.
 * Based on: Casiez, G., Roussel, N., & Vogel, D. (2012). 1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Interactive Systems.
 */
export class OneEuroFilter {
    private minCutoff: number;
    private beta: number;
    private dCutoff: number;
    private xPrev: number | null;
    private dxPrev: number | null;
    private tPrev: number | null;

    constructor(minCutoff: number = 1.0, beta: number = 0.0, dCutoff: number = 1.0) {
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
        this.xPrev = null;
        this.dxPrev = null;
        this.tPrev = null;
    }

    reset() {
        this.xPrev = null;
        this.dxPrev = null;
        this.tPrev = null;
    }

    filter(x: number, timestamp: number = Date.now()): number {
        if (this.tPrev === null) {
            this.xPrev = x;
            this.dxPrev = 0;
            this.tPrev = timestamp;
            return x;
        }

        const dt = (timestamp - this.tPrev) / 1000.0; // Convert ms to seconds
        this.tPrev = timestamp;

        // If dt is too small (e.g. duplicate frame), return previous value
        if (dt <= 0) return this.xPrev!; // Should be non-null here

        const calculateAlpha = (cutoff: number): number => {
            const tau = 1.0 / (2 * Math.PI * cutoff);
            return 1.0 / (1.0 + tau / dt);
        };

        // 1. Estimate Derivative (dx)
        const dx = (x - this.xPrev!) / dt;
        const dxSmoothed = this.exponentialSmoothing(dx, this.dxPrev!, calculateAlpha(this.dCutoff));

        // 2. Calculate Cutoff based on Speed
        // As speed increases, cutoff increases (less filtering, less lag)
        const cutoff = this.minCutoff + this.beta * Math.abs(dxSmoothed);

        // 3. Filter Signal
        const xSmoothed = this.exponentialSmoothing(x, this.xPrev!, calculateAlpha(cutoff));

        this.xPrev = xSmoothed;
        this.dxPrev = dxSmoothed;

        return xSmoothed;
    }

    private exponentialSmoothing(x: number, xPrev: number, alpha: number): number {
        return alpha * x + (1 - alpha) * xPrev;
    }
}
