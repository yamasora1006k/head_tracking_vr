
/**
 * Utility functions for face and iris tracking geometry.
 * Ref: hint.text
 */

// Landmark Indices
export const LEFT_IRIS_INDICES = [473, 474, 475, 476, 477];
export const RIGHT_IRIS_INDICES = [468, 469, 470, 471, 472];

export const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144];
export const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380];

// Key points for Eye Scale (Face Width at eye level)
// 33: Left eye outer corner
// 263: Right eye outer corner
// 133: Left eye inner corner
// 362: Right eye inner corner
export const EYE_SCALE_INDICES = [33, 263, 133, 362];

export interface Point2D {
    x: number;
    y: number;
}

export interface Point3D {
    x: number;
    y: number;
    z: number;
}

/**
 * Calculates Euclidean distance between two 3D points (ignoring z for 2D distance if needed, but landmarks are 3D).
 * The reference uses 2D pixel coordinates, so we'll treat them as 2D if z is not critical,
 * but MediaPipe returns 3D. We'll use 3D distance for robustness or projections.
 * However, the python code explicitly projects to 2D (x*w, y*h).
 * We will assume input points are already in the desired coordinate space (likely screen pixels or normalized aspect-corrected).
 */
export function distance2D(p1: Point2D | Point3D, p2: Point2D | Point3D): number {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

/**
 * Computes the Eye Scale (reference distance) based on outer and inner eye corner distances.
 * Ref: compute_eye_scale
 */
export function computeEyeScale(landmarks: Point3D[], width: number = 1, height: number = 1): number {
    // Landmarks are expected to be 0-1 normalized if width/height are passed to scale them
    // Or pre-scaled.
    // The python code: 
    // p33, p263 = landmarks_array[33], landmarks_array[263]
    // ...
    // d_outer = norm(p263 - p33)

    const p33 = scalePoint(landmarks[33], width, height);
    const p263 = scalePoint(landmarks[263], width, height);
    const p133 = scalePoint(landmarks[133], width, height);
    const p362 = scalePoint(landmarks[362], width, height);

    const dOuter = distance2D(p33, p263);
    const dInner = distance2D(p133, p362);

    return Math.max(1e-6, (dOuter + dInner) / 2.0);
}

/**
 * Calculates the center of a group of landmarks.
 */
export function calculateCenter(indices: number[], landmarks: Point3D[], width: number = 1, height: number = 1): Point2D {
    let sumX = 0;
    let sumY = 0;
    indices.forEach(idx => {
        const p = scalePoint(landmarks[idx], width, height);
        sumX += p.x;
        sumY += p.y;
    });
    return {
        x: sumX / indices.length,
        y: sumY / indices.length
    };
}

/**
 * Calculates Gaze Angle.
 * Ref: calculate_gaze_angle
 */
export function calculateGazeAngle(irisCenter: Point2D, eyeCenter: Point2D): { angle: number, distance: number } {
    const dx = irisCenter.x - eyeCenter.x;
    const dy = irisCenter.y - eyeCenter.y;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return { angle, distance };
}

/**
 * Helper to scale normalized landmark to pixel space.
 */
function scalePoint(p: Point3D, width: number, height: number): Point2D {
    return {
        x: p.x * width,
        y: p.y * height
    };
}
