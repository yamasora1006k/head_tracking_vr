import { useState, Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Pause, Play, RotateCcw, AlertCircle, Loader, Maximize2, Minimize2, Info } from "lucide-react";
import { useHeadTracking } from "@/hooks/useHeadTracking";
// 3D Components
import { CameraRig } from "@/components/vr/CameraRig";
import { MuseumRoom } from "@/components/vr/MuseumRoom";
import { ArtFrame } from "@/components/vr/ArtFrame";
// UI Components
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function Home() {
  const {
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
  } = useHeadTracking();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [screenSize, setScreenSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [selectedArt, setSelectedArt] = useState<{ title: string, desc: string, url: string } | null>(null);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
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

  return (
    <div className="bg-black w-screen h-screen fixed inset-0 overflow-hidden select-none">
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
      {showDebug && (
        <div className="absolute top-4 left-4 text-green-400 font-mono text-sm pointer-events-none z-30 drop-shadow-md">
          <p>FPS: {fps}</p>
          <p>Eye X: {eyePos.x.toFixed(1)}</p>
          <p>Eye Y: {eyePos.y.toFixed(1)}</p>
          <p>Eye Z: {eyePos.z.toFixed(1)}</p>
        </div>
      )}

      {/* Control panel */}
      {!isFullscreen && (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-900/90 border-t border-gray-700 p-4 z-30">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">VR Art Museum</span>
            </h1>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => setIsTracking(!isTracking)}
                variant={isTracking ? "default" : "outline"}
                size="sm"
                className="gap-2"
                disabled={!isMediaPipeReady}
              >
                {isTracking ? <><Pause className="w-3 h-3" /> Tracking ON</> : <><Play className="w-3 h-3" /> Tracking OFF</>}
              </Button>
              <Button
                onClick={() => setShowDebug(!showDebug)}
                variant={showDebug ? "default" : "outline"}
                size="sm"
              >
                {showDebug ? "Debug ON" : "Debug OFF"}
              </Button>
              <Button
                onClick={resetPosition}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </Button>
              <Button
                onClick={handleToggleFullscreen}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Maximize2 className="w-3 h-3" /> Fullscreen
              </Button>
              <div className="flex items-center gap-2 min-w-[140px] ml-2">
                <span className="text-white text-xs whitespace-nowrap">反応速度: {alpha.toFixed(2)}</span>
                <Slider
                  value={[alpha]}
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  onValueChange={(val) => setAlpha(val[0])}
                  className="w-24"
                />
              </div>
              <div className="flex items-center gap-2 min-w-[140px] ml-2">
                <span className="text-white text-xs whitespace-nowrap">感度: {sensitivity.toFixed(1)}</span>
                <Slider
                  value={[sensitivity]}
                  min={1.0}
                  max={10.0}
                  step={0.1}
                  onValueChange={(val) => setSensitivity(val[0])}
                  className="w-24"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Exit Button */}
      {isFullscreen && (
        <button
          onClick={handleToggleFullscreen}
          className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white p-3 rounded transition-colors"
          title="Exit fullscreen (ESC)"
        >
          <Minimize2 className="w-6 h-6" />
        </button>
      )}

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
    </div>
  );
}
