import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Play, RotateCcw, AlertCircle, Loader, Maximize2, Minimize2 } from "lucide-react";

interface EyePosition {
  x: number;
  y: number;
  z: number;
}

declare global {
  interface Window {
    FaceMesh: any;
    Camera: any;
    DrawingUtils: any;
  }
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationRef = useRef<number | null>(null);

  const [isTracking, setIsTracking] = useState(true);
  const [showDebug, setShowDebug] = useState(true);
  const [fps, setFps] = useState(0);
  const [eyePos, setEyePos] = useState<EyePosition>({ x: 0, y: 0, z: 800 });
  const [isMediaPipeReady, setIsMediaPipeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const eyePosEMARef = useRef<EyePosition>({ x: 0, y: 0, z: 800 });
  const lastTimeRef = useRef(Date.now());
  const frameCountRef = useRef(0);
  const isTrackingRef = useRef(true);
  const faceMeshRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const isInitializedRef = useRef(false);

  const landmarkIndices = [4, 152, 263, 33, 308, 78];

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

  // Initialize MediaPipe Camera and Face Mesh
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
            } else {
              const neutral = { x: 0, y: 0, z: 800 };
              eyePosEMARef.current = {
                x: 0.05 * neutral.x + 0.95 * eyePosEMARef.current.x,
                y: 0.05 * neutral.y + 0.95 * eyePosEMARef.current.y,
                z: 0.05 * neutral.z + 0.95 * eyePosEMARef.current.z,
              };
            }
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

  // Update tracking state
  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  // Wireframe room generation
  const generateWireframeRoom = () => {
    const canvas = canvasRef.current;
    if (!canvas) return [];
    
    // Calculate room dimensions based on canvas aspect ratio
    const aspectRatio = canvas.width / canvas.height;
    const h = 360 * scale;
    const w = h * aspectRatio;
    const d = 1000 * scale;
    const gridSize = 100 * scale;

    const lines: Array<[[number, number, number], [number, number, number]]> = [];

    const vertices = [
      [-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0],
      [-w / 2, -h / 2, -d], [w / 2, -h / 2, -d], [w / 2, h / 2, -d], [-w / 2, h / 2, -d],
    ] as [number, number, number][];

    // Main edges
    lines.push([vertices[0], vertices[1]]);
    lines.push([vertices[1], vertices[2]]);
    lines.push([vertices[2], vertices[3]]);
    lines.push([vertices[3], vertices[0]]);

    lines.push([vertices[4], vertices[5]]);
    lines.push([vertices[5], vertices[6]]);
    lines.push([vertices[6], vertices[7]]);
    lines.push([vertices[7], vertices[4]]);

    lines.push([vertices[0], vertices[4]]);
    lines.push([vertices[1], vertices[5]]);
    lines.push([vertices[2], vertices[6]]);
    lines.push([vertices[3], vertices[7]]);

    // Grid lines
    for (let x = -w / 2; x <= w / 2; x += gridSize) {
      lines.push([[x, -h / 2, 0], [x, -h / 2, -d]]);
      lines.push([[x, h / 2, 0], [x, h / 2, -d]]);
    }

    for (let z = 0; z >= -d; z -= gridSize) {
      lines.push([[-w / 2, -h / 2, z], [w / 2, -h / 2, z]]);
      lines.push([[-w / 2, h / 2, z], [w / 2, h / 2, z]]);
    }

    for (let y = -h / 2; y <= h / 2; y += gridSize) {
      lines.push([[-w / 2, y, 0], [-w / 2, y, -d]]);
      lines.push([[w / 2, y, 0], [w / 2, y, -d]]);
    }

    return lines;
  };

  // Off-axis projection
  const projectPoint = (point: [number, number, number], eye: EyePosition) => {
    const [px, py, pz] = point;
    const { x: ex, y: ey, z: ez } = eye;

    const dx = px - ex;
    const dy = py - ey;
    const dz = pz - ez;

    if (Math.abs(dz) < 1e-6) return null;

    const t = -ez / dz;
    const sx = ex + t * dx;
    const sy = ey + t * dy;

    return { x: sx, y: sy };
  };

  const handleReset = () => {
    eyePosEMARef.current = { x: 0, y: 0, z: 800 };
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Update canvas size on window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle mouse wheel for zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((prev) => {
        const newScale = e.deltaY > 0 ? prev * 0.9 : prev * 1.1;
        return Math.max(0.5, Math.min(3, newScale));
      });
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const lines = generateWireframeRoom();

    const render = () => {
      frameCountRef.current++;
      const now = Date.now();
      if (now - lastTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      setEyePos(eyePosEMARef.current);

      // Clear canvas
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw wireframe
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 1;

      for (const [p1, p2] of lines) {
        const s1 = projectPoint(p1, eyePosEMARef.current);
        const s2 = projectPoint(p2, eyePosEMARef.current);

        if (s1 && s2) {
          const x1 = canvas.width / 2 + s1.x * 0.98;
          const y1 = canvas.height / 2 - s1.y * 0.98;
          const x2 = canvas.width / 2 + s2.x * 0.98;
          const y2 = canvas.height / 2 - s2.y * 0.98;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      // Draw debug info
      if (showDebug) {
        ctx.fillStyle = "#00ff00";
        ctx.font = "bold 16px monospace";
        ctx.shadowColor = "#000000";
        ctx.shadowBlur = 4;
        const debugInfo = [
          `FPS: ${fps}`,
          `Eye X: ${eyePosEMARef.current.x.toFixed(1)}`,
          `Eye Y: ${eyePosEMARef.current.y.toFixed(1)}`,
          `Eye Z: ${eyePosEMARef.current.z.toFixed(1)}`,
        ];

        debugInfo.forEach((text, i) => {
          ctx.fillText(text, 12, 24 + i * 22);
        });
      }

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [showDebug]);

  return (
    <div className="bg-black w-screen h-screen fixed inset-0 overflow-hidden">
      {/* Hidden video element for MediaPipe */}
      <video
        ref={videoRef}
        className="hidden"
        width="640"
        height="480"
      />

      {/* Error message - overlay */}
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-900/80 border-b border-red-700 p-4 z-40">
          <div className="flex items-center gap-3 text-red-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">エラー</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading message - overlay */}
      {!isMediaPipeReady && !error && (
        <div className="absolute top-0 left-0 right-0 bg-blue-900/80 border-b border-blue-700 p-4 z-40">
          <div className="flex items-center gap-3 text-blue-100">
            <Loader className="w-5 h-5 flex-shrink-0 animate-spin" />
            <div>
              <p className="font-semibold">初期化中...</p>
              <p className="text-sm">MediaPipeライブラリを読み込んでいます。</p>
            </div>
          </div>
        </div>
      )}

      {/* Main canvas - full screen */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />

      {/* Control panel - overlay at bottom */}
      {!isFullscreen && (
      <div className="absolute bottom-0 left-0 right-0 bg-gray-900/90 border-t border-gray-700 p-4 z-30">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-lg font-bold text-white">
            Head Tracking Desktop VR
          </h1>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => setIsTracking(!isTracking)}
              variant={isTracking ? "default" : "outline"}
              size="sm"
              className="gap-2"
              disabled={!isMediaPipeReady}
            >
              {isTracking ? (
                <>
                  <Pause className="w-3 h-3" />
                  Tracking ON
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  Tracking OFF
                </>
              )}
            </Button>
            <Button
              onClick={() => setShowDebug(!showDebug)}
              variant={showDebug ? "default" : "outline"}
              size="sm"
            >
              {showDebug ? "Debug ON" : "Debug OFF"}
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
            <Button
              onClick={handleToggleFullscreen}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Maximize2 className="w-3 h-3" />
              Fullscreen
            </Button>
            <div className="text-white text-sm flex items-center gap-2">
              Zoom: {(scale * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Fullscreen exit button */}
      {isFullscreen && (
        <button
          onClick={handleToggleFullscreen}
          className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white p-3 rounded transition-colors"
          title="Exit fullscreen (ESC)"
        >
          <Minimize2 className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
