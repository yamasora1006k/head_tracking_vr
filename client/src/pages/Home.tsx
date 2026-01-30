import { useState, Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Pause, Play, RotateCcw, AlertCircle, Loader, Maximize2, Minimize2, Info } from "lucide-react";
import { useHeadTracking } from "@/hooks/useHeadTracking";
// 3D Components
import { GazeController } from "@/components/vr/GazeController";
import { CameraRig } from "@/components/vr/CameraRig";
import { MuseumRoom } from "@/components/vr/MuseumRoom";
import { ArtFrame } from "@/components/vr/ArtFrame";
// UI Components
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CalibrationOverlay } from "@/components/ui/CalibrationOverlay";

interface CalibrationParams {
  inputXMin: number;
  inputXMax: number;
  inputYMin: number;
  inputYMax: number;
  matrix?: number[];
}

export default function Home() {
  const {
    videoRef,
    eyePos,
    rotation,
    blink, // New state
    iris,  // Destructure IRIS
    isTracking,
    setIsTracking,
    isMediaPipeReady,
    error,
    fps,

    // New Config
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
    gaze
  } = useHeadTracking();

  // ... (existing state)

  // ... (existing effects)

  // ...

  // In returned JSX, Control Panel section:
  // Replace the old Alpha/Sensitivity sliders with new controls


  const [isFullscreen, setIsFullscreen] = useState(false);
  const [screenSize, setScreenSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [selectedArt, setSelectedArt] = useState<{ title: string, desc: string, url: string } | null>(null);

  // Calibration State
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationParams | null>(null);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error with fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setScreenSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Calculate room dimensions for art placement
  const roomWidth = screenSize.width * 1.2;
  const roomHeight = screenSize.height * 1.2;
  const roomDepth = 1000;

  // Sample Artworks
  const artworks = [
    // --- Front Wall (3 items) ---
    {
      title: "Morning Fog",
      desc: "霧に包まれた静寂な朝の風景。",
      url: "https://picsum.photos/id/11/800/600",
      position: [-500, 0, -990] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number]
    },
    {
      title: "Mountain View",
      desc: "雄大な山々の風景。デジタル技術により、実際の窓から見ているかのような奥行きを感じることができます。",
      url: "https://picsum.photos/id/10/800/600",
      position: [0, 0, -990] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number]
    },
    {
      title: "Deep Ocean",
      desc: "深海の神秘的な青。",
      url: "https://picsum.photos/id/16/800/600",
      position: [500, 0, -990] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number]
    },
    // --- Side Walls ---
    {
      title: "Old Computer",
      desc: "古いテクノロジーの美しさ。",
      url: "https://picsum.photos/id/9/800/600",
      position: [-580, 0, -500] as [number, number, number],
      rotation: [0, Math.PI / 2, 0] as [number, number, number]
    },
    {
      title: "Abstract Waves",
      desc: "視点を変えることで表情を変える抽象画。",
      url: "https://picsum.photos/id/20/800/600",
      position: [580, 0, -500] as [number, number, number],
      rotation: [0, -Math.PI / 2, 0] as [number, number, number]
    },
    // --- Ceiling ---
    {
      title: "Renaissance Sky",
      desc: "天井を見上げると広がる、古典的な空のフレスコ画。",
      url: "https://picsum.photos/id/28/800/600",
      position: [0, (roomHeight / 2) - 10, -800] as [number, number, number],
      rotation: [Math.PI / 2, 0, 0] as [number, number, number],
      scale: 1.5 // Make ceiling art bigger
    }
  ];

  const handleArtClick = (title: string) => {
    const art = artworks.find(a => a.title === title);
    if (art) setSelectedArt(art);
  };

  const finishCalibration = (data: CalibrationParams) => {
    setCalibration(data);
    setIsCalibrating(false);
    console.log("Calibration Finished:", data);
  };

  return (
    <div className="bg-black w-screen h-screen fixed inset-0 overflow-hidden">
      {/* Hidden video element for MediaPipe */}
      <video
        ref={videoRef}
        className="hidden"
        width="640"
        height="480"
        playsInline
      />

      {/* Error message */}
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

      {/* Loading message */}
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
      {/* Calibration Overlay */}
      {
        isCalibrating && (
          <CalibrationOverlay
            gaze={gaze}
            onComplete={finishCalibration}
            onCancel={() => setIsCalibrating(false)}
          />
        )
      }

      {/* 3D Scene */}
      <Canvas>
        <Suspense fallback={null}>
          <CameraRig
            eyePos={eyePos}
            screenWidth={screenSize.width}
            screenHeight={screenSize.height}
            near={100}
            far={5000}
          />

          <GazeController
            rotation={rotation}
            iris={iris}
            gaze={gaze}
            eyePos={eyePos}
            isTracking={isTracking}
            calibration={calibration}
            trackingMode={trackingMode}
          />

          <MuseumRoom
            width={screenSize.width * 1.2}
            height={screenSize.height * 1.2}
            depth={1000}
          />

          {artworks.map((art, idx) => (
            <ArtFrame
              key={idx}
              {...art}
              onClick={handleArtClick}
            />
          ))}

        </Suspense>
      </Canvas>

      {/* Debug Info Overlay */}
      {
        showDebug && (
          <div className="absolute top-4 left-4 text-white font-mono bg-black/50 p-2 rounded pointer-events-none z-50">
            <p>FPS: {fps}</p>
            <p>Eye ({eyePos.x.toFixed(0)}, {eyePos.y.toFixed(0)}, {eyePos.z.toFixed(0)})</p>
            <p>Gaze (Y:{gaze.yaw.toFixed(3)}, P:{gaze.pitch.toFixed(3)})</p>
            <p className={blink.isBlinking ? "text-red-400" : "text-green-400"}>
              {blink.isBlinking ? "BLINKING" : "EYE OPEN"} (EAR: {((blink.leftEAR + blink.rightEAR) / 2).toFixed(3)})
            </p>
            {calibration && (
              <div className="text-xs text-stone-400 mt-1">
                Calib: X[{calibration.inputXMin.toFixed(2)}, {calibration.inputXMax.toFixed(2)}] Y[{calibration.inputYMin.toFixed(2)}, {calibration.inputYMax.toFixed(2)}]
              </div>
            )}
          </div>
        )
      }

      {/* Control panel */}
      {/* Control panel (Dock Style) */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 transition-all duration-500 z-50 ${isFullscreen ? 'translate-y-[200%]' : 'translate-y-0'}`}>
        <div className="flex items-center gap-4 px-6 py-4 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl hover:bg-black/70 transition-colors">

          {/* Title Section */}
          <div className="flex flex-col gap-0.5 mr-4 border-r border-white/10 pr-6">
            <h1 className="text-lg font-bold text-white font-serif tracking-in-expand flex items-center gap-2">
              VR Art Museum
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={resetPosition}
              variant="ghost"
              size="sm"
              className="text-stone-400 hover:text-white hover:bg-white/10 rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>

            <Button
              onClick={handleToggleFullscreen}
              variant="ghost"
              size="sm"
              className="text-stone-400 hover:text-white hover:bg-white/10 rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Fullscreen Exit Button */}
      {
        isFullscreen && (
          <button
            onClick={handleToggleFullscreen}
            className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white p-3 rounded transition-colors"
            title="Exit fullscreen (ESC)"
          >
            <Minimize2 className="w-6 h-6" />
          </button>
        )
      }

      {/* Artwork Details Modal */}
      <Dialog open={!!selectedArt} onOpenChange={(open) => !open && setSelectedArt(null)}>
        <DialogContent className="sm:max-w-[425px] bg-black/90 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
              {selectedArt?.title}
            </DialogTitle>
            <DialogDescription className="text-gray-300 pt-4">
              {selectedArt?.desc}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <img
              src={selectedArt?.url}
              alt={selectedArt?.title}
              className="w-full h-auto rounded-lg border border-gray-600"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}
