import { useEffect, useState } from "react";

export function useMediaPipeLoader() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMediaPipe = async () => {
      try {
        // Check if already loaded
        if ((window as any).FaceMesh && (window as any).Camera) {
          setIsLoaded(true);
          return;
        }

        // Load scripts sequentially
        const scripts = [
          "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js",
          "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js",
          "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
        ];

        for (const src of scripts) {
          await new Promise<void>((resolve, reject) => {
            // Check if script already exists
            if (document.querySelector(`script[src="${src}"]`)) {
              resolve();
              return;
            }

            const script = document.createElement("script");
            script.src = src;
            script.async = false;
            script.crossOrigin = "anonymous";

            script.onload = () => {
              console.log(`Loaded: ${src}`);
              resolve();
            };

            script.onerror = () => {
              reject(new Error(`Failed to load ${src}`));
            };

            document.head.appendChild(script);
          });
        }

        // Verify libraries are available
        const maxRetries = 10;
        let retries = 0;

        while (retries < maxRetries) {
          if ((window as any).FaceMesh && (window as any).Camera) {
            setIsLoaded(true);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
          retries++;
        }

        throw new Error("MediaPipe libraries not available after loading");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("MediaPipe loading error:", errorMessage);
        setError(errorMessage);
      }
    };

    loadMediaPipe();
  }, []);

  return { isLoaded, error };
}
