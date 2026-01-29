import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useLayoutEffect } from "react";
import { PerspectiveCamera, Vector3, Matrix4 } from "three";
import { EyePosition } from "../../hooks/useHeadTracking";

interface CameraRigProps {
    eyePos: EyePosition; // x, y, z in screen pixels (approx)
    screenWidth: number;
    screenHeight: number;
    near?: number;
    far?: number;
}

export function CameraRig({
    eyePos,
    screenWidth,
    screenHeight,
    near = 10,
    far = 10000
}: CameraRigProps) {
    const { camera, set, size } = useThree();

    // Set initial camera setup
    useLayoutEffect(() => {
        camera.matrixAutoUpdate = false;
    }, [camera]);

    useFrame(() => {
        // Current eye position
        const { x, y, z } = eyePos;

        // We assume the screen is at Z=0.
        // The camera (eye) is at (x, y, z).
        // The screen boundaries are [-w/2, w/2] and [-h/2, h/2].

        // 1. Set Camera Position
        camera.position.set(x, y, z);

        // 2. Orientation: Camera should be looking straight forward (parallel to screen normal)
        // In Three.js, default camera looks down -Z. This matches our setup if screen is at Z=0 and room is -Z.
        camera.rotation.set(0, 0, 0);
        camera.updateMatrixWorld();

        // 3. Update Projection Matrix (Off-Axis Projection)
        // We project the screen corners onto the near plane.
        // Distance from eye to screen is 'z'.

        if (z > 0.1) { // Avoid division by zero or negative z
            const distToScreen = z;
            const ratio = near / distToScreen;

            const left = (-screenWidth / 2 - x) * ratio;
            const right = (screenWidth / 2 - x) * ratio;
            const bottom = (-screenHeight / 2 - y) * ratio;
            const top = (screenHeight / 2 - y) * ratio;

            const pCamera = camera as PerspectiveCamera;
            pCamera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
        }
    });

    return null;
}
