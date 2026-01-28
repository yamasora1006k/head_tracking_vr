import { useEffect, useRef, useState } from "react";

interface EyePosition {
  x: number;
  y: number;
  z: number;
}

export function useMediaPipe(
  videoRef: React.RefObject<HTMLVideoElement>,
  isTracking: boolean,
  onPositionUpdate: (pos: EyePosition) => void
) {
  const faceMeshRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const landmarkIndices = [4, 152, 263, 33, 308, 78];
  const eyePosEMARef = useRef<EyePosition>({ x: 0, y: 0, z: 800 });
  const isTrackingRef = useRef(true);

  useEffect(() => {
    const initializeMediaPipe = async () => {
      try {
        // Load MediaPipe scripts dynamically
        const script1 = document.createElement("script");
        script1.src = "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js";
        document.head.appendChild(script1);

        const script2 = document.createElement("script");
        script2.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
        document.head.appendChild(script2);

        const script3 = document.createElement("script");
        script3.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
        document.head.appendChild(script3);

        // Wait for scripts to load
        await new Promise((resolve) => {
          script3.onload = resolve;
        });

        // Access global MediaPipe objects
        const { FaceMesh } = (window as any).FaceMesh;
        const { Camera } = (window as any).Camera;

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
                await faceMesh.send({ image: videoRef.current });
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

              const dx = (avgX - 320) * 3;
              const dy = (240 - avgY) * 3;

              const faceWidth = Math.max(...imagePoints.map((p: number[]) => p[0])) -
                Math.min(...imagePoints.map((p: number[]) => p[0]));
              const dz = 700 + (250 - faceWidth) * 0.8;

              const currentPos = { x: dx, y: dy, z: Math.max(450, dz) };

              const alpha = 0.25;
              eyePosEMARef.current = {
                x: alpha * currentPos.x + (1 - alpha) * eyePosEMARef.current.x,
                y: alpha * currentPos.y + (1 - alpha) * eyePosEMARef.current.y,
                z: alpha * currentPos.z + (1 - alpha) * eyePosEMARef.current.z,
              };

              isTrackingRef.current = true;
              onPositionUpdate(eyePosEMARef.current);
            } else {
              const neutral = { x: 0, y: 0, z: 800 };
              eyePosEMARef.current = {
                x: 0.05 * neutral.x + 0.95 * eyePosEMARef.current.x,
                y: 0.05 * neutral.y + 0.95 * eyePosEMARef.current.y,
                z: 0.05 * neutral.z + 0.95 * eyePosEMARef.current.z,
              };
              isTrackingRef.current = false;
              onPositionUpdate(eyePosEMARef.current);
            }
          });

          camera.start();
        }

        setIsInitialized(true);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to initialize MediaPipe:", error);
        setIsLoading(false);
      }
    };

    isTrackingRef.current = isTracking;

    if (isTracking && !isInitialized) {
      initializeMediaPipe();
    }

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, [isTracking, isInitialized, onPositionUpdate]);

  const reset = () => {
    eyePosEMARef.current = { x: 0, y: 0, z: 800 };
  };

  return {
    isLoading,
    isInitialized,
    eyePos: eyePosEMARef.current,
    isTracking: isTrackingRef.current,
    reset,
  };
}
