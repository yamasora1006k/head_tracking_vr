import { useEffect, useRef, useState, MutableRefObject } from "react";

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

interface UseHeadTrackingResult {
    videoRef: MutableRefObject<HTMLVideoElement | null>;
    eyePos: EyePosition; // Smoothed position
    isTracking: boolean;
    setIsTracking: (isTracking: boolean) => void;
    isMediaPipeReady: boolean;
    error: string | null;
    fps: number;
    alpha: number;
    setAlpha: (alpha: number) => void;
    sensitivity: number;
    setSensitivity: (val: number) => void;
    resetPosition: () => void;
    showDebug: boolean;
    setShowDebug: (show: boolean) => void;
}

export function useHeadTracking(): UseHeadTrackingResult {
    const videoRef = useRef<HTMLVideoElement>(null);

    // State
    const [isTracking, setIsTracking] = useState(true);
    const [showDebug, setShowDebug] = useState(false);
    const [isMediaPipeReady, setIsMediaPipeReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fps, setFps] = useState(0);
    const [eyePos, setEyePos] = useState<EyePosition>({ x: 0, y: 0, z: 800 });
    const [alpha, setAlpha] = useState(0.8);
    const [sensitivity, setSensitivity] = useState(3.0);

    // Refs for loop processing
    const alphaRef = useRef(0.8);
    const sensitivityRef = useRef(3.0);
    const eyePosEMARef = useRef<EyePosition>({ x: 0, y: 0, z: 800 });
    const lastTimeRef = useRef(Date.now());
    const frameCountRef = useRef(0);
    const isTrackingRef = useRef(true);
    const faceMeshRef = useRef<any>(null);
    const cameraRef = useRef<any>(null);
    const isInitializedRef = useRef(false);
    const animationFrameRef = useRef<number | null>(null);

    const landmarkIndices = [4, 152, 263, 33, 308, 78];

    // Sync refs with state
    useEffect(() => {
        alphaRef.current = alpha;
    }, [alpha]);

    useEffect(() => {
        sensitivityRef.current = sensitivity;
    }, [sensitivity]);

    useEffect(() => {
        isTrackingRef.current = isTracking;
    }, [isTracking]);

    // Check MediaPipe availability
    useEffect(() => {
        const checkMediaPipe = () => {
            if (window.FaceMesh && window.Camera) {
                console.log("MediaPipe libraries loaded successfully");
                setIsMediaPipeReady(true);
                setError(null);
            } else {
                console.log("Waiting for MediaPipe libraries...");
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

                if (!FaceMesh || !Camera) {
                    throw new Error("MediaPipe libraries not available");
                }

                const faceMesh = new FaceMesh({
                    locateFile: (file: string) =>
                        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
                });

                faceMesh.setOptions({
                    maxNumFaces: 1,
                    refineLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });

                faceMeshRef.current = faceMesh;

                if (videoRef.current) {
                    const camera = new Camera(videoRef.current, {
                        onFrame: async () => {
                            if (isTrackingRef.current && videoRef.current) {
                                try {
                                    await faceMesh.send({ image: videoRef.current });
                                } catch (e) {
                                    console.error("Error sending frame to FaceMesh:", e);
                                }
                            }

                            // FPS Calculation logic called per frame (or we can do it in a separate loop if we want strictly render FPS)
                            // Here we update FPS based on camera frames processed
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

                    cameraRef.current = camera;

                    faceMesh.onResults((results: any) => {
                        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
                            const landmarks = results.multiFaceLandmarks[0];
                            const imagePoints = landmarkIndices.map((idx) => {
                                const lm = landmarks[idx];
                                return [lm.x * 640, lm.y * 480];
                            });

                            const avgX = imagePoints.reduce((sum: number, p: number[]) => sum + p[0], 0) / imagePoints.length;
                            const avgY = imagePoints.reduce((sum: number, p: number[]) => sum + p[1], 0) / imagePoints.length;

                            const scaleFactor = sensitivityRef.current;
                            const yOffset = 30;
                            const dx = (avgX - 320) * scaleFactor;
                            const dy = ((avgY - 240) * scaleFactor) + yOffset;

                            const faceWidth = Math.max(...imagePoints.map((p: number[]) => p[0])) -
                                Math.min(...imagePoints.map((p: number[]) => p[0]));
                            const dz = 700 + (250 - faceWidth) * 0.8;

                            // Smoothing
                            const currentPos = { x: dx, y: dy, z: Math.max(450, dz) };
                            const a = alphaRef.current;

                            eyePosEMARef.current = {
                                x: a * currentPos.x + (1 - a) * eyePosEMARef.current.x,
                                y: a * currentPos.y + (1 - a) * eyePosEMARef.current.y,
                                z: a * currentPos.z + (1 - a) * eyePosEMARef.current.z,
                            };
                        } else {
                            // Drift back to center if lost
                            const neutral = { x: 0, y: 0, z: 800 };
                            eyePosEMARef.current = {
                                x: 0.05 * neutral.x + 0.95 * eyePosEMARef.current.x,
                                y: 0.05 * neutral.y + 0.95 * eyePosEMARef.current.y,
                                z: 0.05 * neutral.z + 0.95 * eyePosEMARef.current.z,
                            };
                        }

                        // Update state for UI to consume
                        setEyePos({ ...eyePosEMARef.current });
                    });

                    try {
                        camera.start();
                        isInitializedRef.current = true;
                        console.log("Camera started successfully");
                    } catch (e) {
                        console.error("Error starting camera:", e);
                        setError("カメラの起動に失敗しました");
                    }
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.error("Failed to initialize camera:", errorMessage);
                setError(errorMessage);
            }
        };

        initializeCamera();

        return () => {
            if (cameraRef.current) {
                try {
                    cameraRef.current.stop();
                } catch (e) {
                    console.error("Error stopping camera:", e);
                }
            }
        };
    }, [isMediaPipeReady]);

    const resetPosition = () => {
        eyePosEMARef.current = { x: 0, y: 0, z: 800 };
        setEyePos({ x: 0, y: 0, z: 800 });
    };

    return {
        videoRef,
        eyePos,
        isTracking,
        setIsTracking,
        isMediaPipeReady,
        error,
        fps,
        alpha,
        setAlpha,
        sensitivity,
        setSensitivity,
        resetPosition,
        showDebug,
        setShowDebug
    };
}
