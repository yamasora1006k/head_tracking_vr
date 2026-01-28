import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pause, Play, RotateCcw } from "lucide-react";

interface EyePosition {
  x: number;
  y: number;
  z: number;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationRef = useRef<number | null>(null);

  const [isTracking, setIsTracking] = useState(true);
  const [showDebug, setShowDebug] = useState(true);
  const [fps, setFps] = useState(0);
  const [eyePos, setEyePos] = useState<EyePosition>({ x: 0, y: 0, z: 800 });
  const [isLoading, setIsLoading] = useState(true);

  const eyePosEMARef = useRef<EyePosition>({ x: 0, y: 0, z: 800 });
  const lastTimeRef = useRef(Date.now());
  const frameCountRef = useRef(0);
  const isTrackingRef = useRef(true);
  const faceMeshRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  const landmarkIndices = [4, 152, 263, 33, 308, 78];

  // Initialize MediaPipe
  useEffect(() => {
    const initializeMediaPipe = async () => {
      try {
        // Load MediaPipe via CDN
        const loadScript = (src: string): Promise<void> => {
          return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
          });
        };

        // Load all required scripts
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js");
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js");
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");

        // Access global objects
        const { FaceMesh } = (window as any).FaceMesh;
        const { Camera } = (window as any).Camera;

        if (!FaceMesh || !Camera) {
          throw new Error("MediaPipe libraries not loaded");
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
            } else {
              const neutral = { x: 0, y: 0, z: 800 };
              eyePosEMARef.current = {
                x: 0.05 * neutral.x + 0.95 * eyePosEMARef.current.x,
                y: 0.05 * neutral.y + 0.95 * eyePosEMARef.current.y,
                z: 0.05 * neutral.z + 0.95 * eyePosEMARef.current.z,
              };
            }
          });

          camera.start();
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Failed to initialize MediaPipe:", error);
        setIsLoading(false);
      }
    };

    isTrackingRef.current = isTracking;
    initializeMediaPipe();

    return () => {
      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
        } catch (e) {
          console.error("Error stopping camera:", e);
        }
      }
    };
  }, []);

  // Wireframe room generation
  const generateWireframeRoom = () => {
    const w = 640;
    const h = 360;
    const d = 1000;
    const gridSize = 100;

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
          const x1 = canvas.width / 2 + s1.x;
          const y1 = canvas.height / 2 - s1.y;
          const x2 = canvas.width / 2 + s2.x;
          const y2 = canvas.height / 2 - s2.y;

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

  const handleReset = () => {
    eyePosEMARef.current = { x: 0, y: 0, z: 800 };
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Hidden video element for MediaPipe */}
      <video
        ref={videoRef}
        className="hidden"
        width="640"
        height="480"
      />

      {/* Main canvas */}
      <div className="flex-1 flex items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="border-2 border-green-500 shadow-2xl max-w-full"
        />
      </div>

      {/* Control panel */}
      <div className="bg-gray-900 border-t border-gray-700 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <h1 className="text-2xl font-bold text-white">
              Head Tracking Desktop VR
            </h1>
            <div className="flex gap-3 flex-wrap">
              <Button
                onClick={() => setIsTracking(!isTracking)}
                variant={isTracking ? "default" : "outline"}
                size="sm"
                className="gap-2"
              >
                {isTracking ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Tracking ON
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
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
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
            </div>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <div className="p-4 space-y-2 text-sm text-gray-300">
              <p>
                <strong>操作方法:</strong> Webカメラを使用して頭の位置を追跡します。頭を左右・上下・前後に動かすと、画面内の部屋がそれに応じて変化します。
              </p>
              <p>
                <strong>ボタン:</strong> Tracking ON/OFF でカメラ追跡の有効/無効、Debug ON/OFF でデバッグ情報の表示/非表示、Reset で視点位置をリセットできます。
              </p>
              {isLoading && (
                <p className="text-yellow-400">
                  <strong>初期化中...</strong> MediaPipeを読み込んでいます。
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
