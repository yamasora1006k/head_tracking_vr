
import { useRef, useState, useEffect, MutableRefObject } from "react";
import { Vector3, Euler, Matrix4 } from "three";
import { OneEuroFilter } from "../utils/OneEuroFilter";
import { KalmanFilter } from "../utils/KalmanFilter";
import { calculateCenter, computeEyeScale, Point3D } from "../utils/FaceUtils";

declare global {
    interface Window {
        FaceMesh: any;
        Camera: any;
    }
}

export interface EyePosition {
    x: number;
    y: number;
    z: number;
}

export interface FaceRotation {
    yaw: number;   // Left/Right
    pitch: number; // Up/Down
    roll: number;  // Tilt
}

export interface BlinkState {
    isBlinking: boolean;
    blinkStrength: number; // 0 (open) to 1 (closed)
    leftEAR: number;
    rightEAR: number;
}

export interface IrisData {
    x: number;
    y: number;
}

export type TrackingMode = 'head' | 'iris';

interface UseHeadTrackingResult {
    videoRef: MutableRefObject<HTMLVideoElement | null>;
    eyePos: EyePosition; // Output position
    rotation: FaceRotation; // Smoothed rotation
    blink: BlinkState; // Blink status
    isTracking: boolean;
    setIsTracking: (isTracking: boolean) => void;
    isMediaPipeReady: boolean;
    error: string | null;
    fps: number;

    // Config
    trackingMode: TrackingMode;
    setTrackingMode: (mode: TrackingMode) => void;

    // Filters
    minCutoff: number; // Jitter reduction (lower = smooth, higher = responsive)
    setMinCutoff: (val: number) => void;
    beta: number;      // Speed coefficient (higher = less lag on fast move)
    setBeta: (val: number) => void;

    speedGain: number; // Acceleration factor
    setSpeedGain: (val: number) => void;

    // Backwards compatibility / Aliases for UI
    alpha: number;
    setAlpha: (val: number) => void;
    sensitivity: number;
    setSensitivity: (val: number) => void;

    resetPosition: () => void;
    showDebug: boolean;
    setShowDebug: (show: boolean) => void;
    iris: IrisData;
    gaze: { yaw: number; pitch: number };
}

// Landmark Indices
// Ref: User provided indices.
// Subject Right Eye (MediaPipe 33...):
export const SUBJECT_RIGHT_EYE = [33, 160, 158, 133, 153, 144];
// Subject Left Eye (MediaPipe 362...):
export const SUBJECT_LEFT_EYE = [362, 385, 387, 263, 373, 380];

// Face Geometry Landmarks for Pose Estimation
const POSE_LANDMARKS = {
    nose: 1,
    chin: 152,
    leftEye: 263,
    rightEye: 33,
    leftMouth: 291,
    rightMouth: 61
};

// Helper: Calculate EAR
const calculateEAR = (landmarks: any[], indices: number[]) => {
    // MediaPipe landmarks have x, y, z. We mostly care about 2D openness but 3D distance is better.
    const p = indices.map(i => new Vector3(landmarks[i].x, landmarks[i].y, landmarks[i].z));

    // Vertical distances
    const v1 = p[1].distanceTo(p[5]);
    const v2 = p[2].distanceTo(p[4]);

    // Horizontal distance
    const h = p[0].distanceTo(p[3]);

    return (v1 + v2) / (2.0 * h);
};

export function useHeadTracking(): UseHeadTrackingResult {
    const videoRef = useRef<HTMLVideoElement>(null);

    // State
    const [isTracking, setIsTracking] = useState(true);
    const [showDebug, setShowDebug] = useState(true);
    const [isMediaPipeReady, setIsMediaPipeReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fps, setFps] = useState(0);

    // Config
    const [trackingMode, setTrackingMode] = useState<TrackingMode>('head');
    const [minCutoff, setMinCutoff] = useState(0.01);
    const [beta, setBeta] = useState(0.001);
    const [speedGain, setSpeedGain] = useState(2.0);

    // Ref for tracking loop
    const isTrackingRef = useRef(isTracking);
    const frameCountRef = useRef(0);
    const lastTimeRef = useRef(Date.now());
    const isInitializedRef = useRef(false);

    // Filters
    const filterYaw = useRef(new OneEuroFilter(0.1, 5.0));
    const filterPitch = useRef(new OneEuroFilter(0.1, 5.0));
    const filterRoll = useRef(new OneEuroFilter(0.1, 5.0));

    // Kalman Filters (Iris)
    // Q=0.01 (Process Noise), R=0.1 (Measurement Noise)
    const kalmanRight = useRef(new KalmanFilter(0.01, 0.1));
    const kalmanLeft = useRef(new KalmanFilter(0.01, 0.1));

    // Store last valid filtered eye position to hold during blinking
    const lastEyePosRef = useRef({ rX: 0, rY: 0, lX: 0, lY: 0 });

    // Offset for Taring
    const rotationOffsetRef = useRef<FaceRotation>({ yaw: 0, pitch: 0, roll: 0 });
    const irisOffsetRef = useRef<IrisData>({ x: 0, y: 0 });

    const recenterNextFrameRef = useRef(false);

    // Output State for UI
    const [eyePos, setEyePos] = useState<EyePosition>({ x: 0, y: 0, z: 800 });
    const [rotation, setRotation] = useState<FaceRotation>({ yaw: 0, pitch: 0, roll: 0 });
    const [blink, setBlink] = useState<BlinkState>({ isBlinking: false, blinkStrength: 0, leftEAR: 0, rightEAR: 0 });
    const [iris, setIris] = useState<IrisData>({ x: 0, y: 0 });
    const [gaze, setGaze] = useState<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });

    const configRef = useRef({ minCutoff: 0.1, beta: 5.0, speedGain: 2.0 });

    useEffect(() => {
        configRef.current = { minCutoff, beta, speedGain };
    }, [minCutoff, beta, speedGain]);

    useEffect(() => {
        isTrackingRef.current = isTracking;
    }, [isTracking]);

    useEffect(() => {
        return () => {
            isTrackingRef.current = false;
        };
    }, []);

    // Load Scripts
    useEffect(() => {
        const loadScript = (src: string) => {
            return new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${src}"]`)) {
                    resolve(true);
                    return;
                }
                const script = document.createElement("script");
                script.src = src;
                script.async = true;
                script.onload = () => resolve(true);
                script.onerror = () => reject(new Error(`Failed to load ${src}`));
                document.body.appendChild(script);
            });
        };

        const loadMediaPipe = async () => {
            try {
                await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js");
                await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
                console.log("MediaPipe scripts loaded");
            } catch (err) {
                console.error(err);
                setError("Failed to load MediaPipe scripts");
            }
        };

        loadMediaPipe();

        const checkMediaPipe = () => {
            if (window.FaceMesh && window.Camera) {
                console.log("MediaPipe libraries loaded successfully");
                setIsMediaPipeReady(true);
                setError(null);
            } else {
                setTimeout(checkMediaPipe, 500);
            }
        };
        checkMediaPipe();
    }, []);

    // Initialize MediaPipe logic
    useEffect(() => {
        if (!isMediaPipeReady || isInitializedRef.current) return;

        const initializeCamera = async () => {
            try {
                const FaceMesh = window.FaceMesh;
                const Camera = window.Camera;

                if (!FaceMesh || !Camera) throw new Error("MediaPipe libraries not available");

                const faceMesh = new FaceMesh({
                    locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
                });

                faceMesh.setOptions({
                    maxNumFaces: 1,
                    refineLandmarks: true, // Required for Iris
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });

                if (videoRef.current) {
                    const camera = new Camera(videoRef.current, {
                        onFrame: async () => {
                            if (isTrackingRef.current && videoRef.current) {
                                await faceMesh.send({ image: videoRef.current });
                            }
                            frameCountRef.current++;
                            const now = Date.now();
                            if (now - lastTimeRef.current >= 1000) {
                                setFps(frameCountRef.current);
                                frameCountRef.current = 0;
                                lastTimeRef.current = now;
                            }
                        },
                        width: 640,
                        height: 480,
                    });

                    faceMesh.onResults((results: any) => {
                        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
                            const landmarks: Point3D[] = results.multiFaceLandmarks[0];
                            const timestamp = Date.now();

                            // 1. Blink (EAR)
                            const rightEAR = calculateEAR(landmarks, SUBJECT_RIGHT_EYE);
                            const leftEAR = calculateEAR(landmarks, SUBJECT_LEFT_EYE);
                            const avgEAR = (leftEAR + rightEAR) / 2;
                            // Lowered to 0.18 to prevent false positives freezing the cursor
                            const isBlinking = avgEAR < 0.18;

                            // 2. Head Pose Calculation (In Pixel Space)
                            // Convert landmarks to Uniform Pixel Space (640x480) to avoid Aspect Ratio distortion.
                            const V_WIDTH = 640;
                            const V_HEIGHT = 480;

                            // SAFETY CHECK: Ensure Iris Landmarks (468+) exist
                            // This prevents the "Stopped Moving" / Crash issue.
                            if (landmarks.length < 478) {
                                return;
                            }

                            const landmarksPx = landmarks.map(p => ({
                                x: p.x * V_WIDTH,
                                y: p.y * V_HEIGHT,
                                z: p.z * V_WIDTH
                            }));

                            const nose = new Vector3(landmarksPx[POSE_LANDMARKS.nose].x, landmarksPx[POSE_LANDMARKS.nose].y, landmarksPx[POSE_LANDMARKS.nose].z);
                            const chin = new Vector3(landmarksPx[POSE_LANDMARKS.chin].x, landmarksPx[POSE_LANDMARKS.chin].y, landmarksPx[POSE_LANDMARKS.chin].z);
                            const leftEye = new Vector3(landmarksPx[POSE_LANDMARKS.leftEye].x, landmarksPx[POSE_LANDMARKS.leftEye].y, landmarksPx[POSE_LANDMARKS.leftEye].z);
                            const rightEye = new Vector3(landmarksPx[POSE_LANDMARKS.rightEye].x, landmarksPx[POSE_LANDMARKS.rightEye].y, landmarksPx[POSE_LANDMARKS.rightEye].z);

                            const faceX = new Vector3().subVectors(leftEye, rightEye).normalize();
                            const tempUp = new Vector3().subVectors(nose, chin).normalize();
                            const faceZ = new Vector3().crossVectors(faceX, tempUp).normalize();
                            const faceY = new Vector3().crossVectors(faceZ, faceX).normalize();

                            const rotMatrix = new Matrix4();
                            rotMatrix.makeBasis(faceX, faceY, faceZ);
                            const euler = new Euler();
                            euler.setFromRotationMatrix(rotMatrix, 'YXZ');

                            // Yaw/Pitch/Roll (Head)
                            let rawYaw = euler.y;
                            let rawPitch = euler.x;
                            let rawRoll = euler.z;

                            // Yaw correction
                            let fixedYaw = rawYaw - Math.PI;
                            if (fixedYaw < -Math.PI) fixedYaw += 2 * Math.PI;
                            if (fixedYaw > Math.PI) fixedYaw -= 2 * Math.PI;
                            fixedYaw *= -1.0;

                            // 3. Eye Gaze Calculation (Eye Corner Ref + Pixel Space)
                            // Get Eye Scale (Face Width in pixels approx)
                            const eyeScaleNorm = computeEyeScale(landmarks);

                            // Anchors (Inner Eye Corners) - Use Pixel Space
                            const anchorR = landmarksPx[33];
                            const anchorL = landmarksPx[362];

                            // Iris (Pixel Space)
                            let irisR = { x: landmarksPx[468].x, y: landmarksPx[468].y };
                            let irisL = { x: landmarksPx[473].x, y: landmarksPx[473].y };

                            // Offsets (Pixel Space)
                            const offsetR = { x: irisR.x - anchorR.x, y: irisR.y - anchorR.y };
                            const offsetL = { x: irisL.x - anchorL.x, y: irisL.y - anchorL.y };

                            // Filter Offsets (Kalman)
                            let kR = { x: 0, y: 0 };
                            let kL = { x: 0, y: 0 };

                            if (!isBlinking) {
                                // Already in pixels, no need to multiply
                                kR = kalmanRight.current.update(offsetR.x, offsetR.y);
                                kL = kalmanLeft.current.update(offsetL.x, offsetL.y);
                                lastEyePosRef.current = { rX: kR.x, rY: kR.y, lX: kL.x, lY: kL.y };
                            } else {
                                // Blink Hold (Reuse last valid pixel pos)
                                kR = { x: lastEyePosRef.current.rX, y: lastEyePosRef.current.rY };
                                kL = { x: lastEyePosRef.current.lX, y: lastEyePosRef.current.lY };
                            }

                            // Normalize Back for Angle Calculation (Approx)
                            const smoothOffsetR = { x: kR.x / V_WIDTH, y: kR.y / V_HEIGHT };
                            const smoothOffsetL = { x: kL.x / V_WIDTH, y: kL.y / V_HEIGHT };

                            // Average Offsets
                            const avgOffsetX = (smoothOffsetR.x + smoothOffsetL.x) / 2;
                            const avgOffsetY = (smoothOffsetR.y + smoothOffsetL.y) / 2;

                            // Convert to Eye Angles
                            const eyeSensitivity = 1.0;
                            const eyeRadius = eyeScaleNorm * 0.4;
                            const eyeYaw = Math.atan2(avgOffsetX, eyeRadius) * eyeSensitivity;
                            const eyePitch = Math.atan2(avgOffsetY, eyeRadius) * eyeSensitivity;

                            // 4. Recenter (Tare) - Only for Head
                            if (recenterNextFrameRef.current) {
                                rotationOffsetRef.current = { yaw: fixedYaw, pitch: rawPitch, roll: rawRoll };
                                recenterNextFrameRef.current = false;
                            }

                            // 5. Apply Head Filters
                            const appliedHeadYaw = fixedYaw - rotationOffsetRef.current.yaw;
                            const appliedHeadPitch = rawPitch - rotationOffsetRef.current.pitch;
                            const appliedHeadRoll = rawRoll - rotationOffsetRef.current.roll;

                            const fYaw = filterYaw.current.filter(appliedHeadYaw, timestamp);
                            const fPitch = filterPitch.current.filter(appliedHeadPitch, timestamp);
                            const fRoll = filterRoll.current.filter(appliedHeadRoll, timestamp);

                            // 6. Fusion (Head + Eye)
                            const isIrisMode = trackingMode === 'iris';

                            // Combine Head + Eye
                            // * 5.0 Gain for Eye Gaze to cover screen
                            const eyeGain = 5.0;
                            const eyeComponentYaw = isIrisMode ? eyeYaw * eyeGain : 0;
                            // Pitch: MediaPipe Pitch is Down=Positive. Screen Y is Down=Positive.
                            // But usually 3D cams are Y=Up.
                            // Let's stick to the previous working sign.
                            // Previous working state (Step 1003) had `eyePitch * -5.0`.
                            // Let's restore that.
                            const eyeComponentPitch = isIrisMode ? eyePitch * -5.0 : 0;

                            const finalYaw = fYaw + eyeComponentYaw;
                            const finalPitch = fPitch + eyeComponentPitch;

                            setBlink({ isBlinking, blinkStrength: avgEAR, leftEAR, rightEAR });
                            setRotation({ yaw: finalYaw, pitch: finalPitch, roll: fRoll });
                            setIris({ x: avgOffsetX, y: avgOffsetY }); // Normalized offset for UI/Debug
                            setGaze({ yaw: finalYaw, pitch: finalPitch });

                            // 7. Eye Pos (Head Position visual for CameraParallax)
                            // Restore 3D Parallax
                            const scale = 5.0;
                            setEyePos({
                                x: (landmarksPx[1].x - 320) * scale,
                                y: (landmarksPx[1].y - 240) * scale,
                                z: 800
                            });

                        }
                    });

                    camera.start();
                    setIsMediaPipeReady(true);
                    isInitializedRef.current = true;
                }
            } catch (error: any) {
                console.error("Failed to initialize MediaPipe:", error);
                setError(error.message);
            }
        };

        if (window.FaceMesh && window.Camera) {
            initializeCamera();
        }
    }, [isMediaPipeReady]);

    const resetPosition = () => {
        recenterNextFrameRef.current = true;
    };

    // Aliases
    const setAlpha = (val: number) => setBeta(val);
    const sensitivity = speedGain;
    const setSensitivity = setSpeedGain;

    return {
        videoRef,
        eyePos,
        rotation,
        blink,
        isTracking,
        setIsTracking,
        isMediaPipeReady,
        error,
        fps,
        trackingMode,
        setTrackingMode,
        minCutoff,
        setMinCutoff,
        beta,
        setBeta,
        speedGain,
        setSpeedGain,
        resetPosition,
        showDebug,
        setShowDebug,
        alpha: beta,
        setAlpha,
        sensitivity,
        setSensitivity,
        iris,
        gaze
    };
}
