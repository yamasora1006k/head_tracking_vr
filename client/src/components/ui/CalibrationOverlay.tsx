import { useState, useEffect, useRef } from 'react';
import { IrisData } from '../../hooks/useHeadTracking';
import { PolynomialRegression } from '../../utils/RegressionUtils';

export interface CalibrationData {
    inputXMin: number;
    inputXMax: number;
    inputYMin: number;
    inputYMax: number;
    matrix?: number[]; // Homography Matrix (Legacy)
    regression?: { x: number[], y: number[] }; // Polynomial Coefficients
}


// Removed solveHomography usage




interface CalibrationOverlayProps {
    gaze: { yaw: number, pitch: number }; // Gaze Data
    onComplete: (data: CalibrationData) => void;
    onCancel: () => void;
}

const POINTS = [
    { x: 10, y: 10, id: 0 }, // Top-Left
    { x: 50, y: 10, id: 1 }, // Top-Center
    { x: 90, y: 10, id: 2 }, // Top-Right

    { x: 10, y: 50, id: 3 }, // Mid-Left
    { x: 50, y: 50, id: 4 }, // Center
    { x: 90, y: 50, id: 5 }, // Mid-Right

    { x: 10, y: 90, id: 6 }, // Bottom-Left
    { x: 50, y: 90, id: 7 }, // Bottom-Center
    { x: 90, y: 90, id: 8 }, // Bottom-Right
];

export function CalibrationOverlay({ gaze, onComplete, onCancel }: CalibrationOverlayProps) {
    const [step, setStep] = useState(0);
    const [samples, setSamples] = useState<{ x: number, y: number }[]>([]);
    const [countdown, setCountdown] = useState(3);

    // Collecting samples for current point
    const currentSamplesRef = useRef<{ yaw: number, pitch: number }[]>([]);

    useEffect(() => {
        // Start countdown for each step
        setCountdown(3);
        currentSamplesRef.current = [];

        const timer = setInterval(() => {
            setCountdown((c) => {
                if (c <= 1) {
                    // Finish this step
                    clearInterval(timer);
                    recordPoint();
                    return 0;
                }
                return c - 1;
            });
        }, 1000); // 1 second per count? A bit slow. Let's do faster.
        // Actually, user needs time to look. 
        // Let's do: Show point -> User looks -> Wait 1s -> Record for 0.5s -> Next.

        return () => clearInterval(timer);
    }, [step]);

    // Collecting gaze data continuously
    useEffect(() => {
        if (countdown <= 1) {
            // Collect data while "1" or "0" (capturing phase)
            currentSamplesRef.current.push(gaze);
        }
    }, [gaze, countdown]);

    const recordPoint = () => {
        // Average samples
        const valid = currentSamplesRef.current.filter(r => r && !isNaN(r.yaw) && !isNaN(r.pitch));
        if (valid.length === 0) valid.push(gaze); // Fallback

        const avgX = valid.reduce((sum, v) => sum + v.yaw, 0) / valid.length;
        const avgY = valid.reduce((sum, v) => sum + v.pitch, 0) / valid.length;

        // Log sample
        // console.log(`Point ${step}: Screen(${POINTS[step].x}, ${POINTS[step].y}) -> Gaze(${avgX.toFixed(3)}, ${avgY.toFixed(3)})`);

        const newSamples = [...samples, { x: avgX, y: avgY }];
        setSamples(newSamples);

        if (step < POINTS.length - 1) {
            setTimeout(() => setStep(step + 1), 500);
        } else {
            finishCalibration(newSamples);
        }
    };

    const finishCalibration = (finalSamples: { x: number, y: number }[]) => {
        // Prepare Points for Regression
        // Input: Gaze { x: yaw, y: pitch }
        // Output: Screen { x: pixelX, y: pixelY } (or normalized)

        // We train to predict NORMALIZED screen coordinates (0..1)
        // because GazeController handles scaling to window size.

        const inputs = finalSamples.map(s => ({ x: s.x, y: s.y }));
        const outputs = POINTS.map(p => ({ x: p.x / 100.0, y: p.y / 100.0 }));

        const regression = new PolynomialRegression();
        regression.fit(inputs, outputs);
        const coeffs = regression.getCoefficients();

        if (coeffs.x && coeffs.y) {
            onComplete({
                inputXMin: 0, // Unused for Regression
                inputXMax: 0,
                inputYMin: 0,
                inputYMax: 0,
                regression: { x: coeffs.x, y: coeffs.y }
            });
        } else {
            console.error("Calibration Failed");
            onCancel();
        }
    };



    return (
        <div className="fixed inset-0 z-[2000] bg-black/90 flex flex-col items-center justify-center text-white">
            <div className="absolute top-8 text-2xl font-bold">Calibration</div>
            <div className="absolute top-16 text-lg text-stone-400">
                赤い円を見つめてください ({step + 1} / {POINTS.length})
            </div>

            {/* Grid Points */}
            {POINTS.map((p, idx) => (
                <div
                    key={idx}
                    className="absolute w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: idx === step ? '#ff0055' : '#333',
                        border: idx === step ? '4px solid white' : 'none',
                        opacity: idx < step ? 0.3 : (idx === step ? 1 : 0.5),
                        scale: idx === step ? 1.5 : 1
                    }}
                >
                    {idx === step && (
                        <span className="text-xs font-mono">{Math.ceil(countdown)}</span>
                    )}
                </div>
            ))}

            <button
                onClick={onCancel}
                className="absolute bottom-8 px-6 py-2 border border-stone-600 rounded-full hover:bg-stone-800"
            >
                Cancel
            </button>
        </div>
    );
}
