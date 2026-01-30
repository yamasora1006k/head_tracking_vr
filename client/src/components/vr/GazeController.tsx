import { useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, Raycaster, Mesh, Group } from "three";
import { Html } from "@react-three/drei";
import { FaceRotation, IrisData, EyePosition, TrackingMode } from "@/hooks/useHeadTracking";
import { PolynomialRegression } from "@/utils/RegressionUtils";

interface CalibrationParams {
    inputXMin: number;
    inputXMax: number;
    inputYMin: number;
    inputYMax: number;
    matrix?: number[];
    regression?: { x: number[], y: number[] };
}

interface GazeControllerProps {
    rotation: FaceRotation;
    iris: IrisData;
    gaze: { yaw: number; pitch: number }; // Unified Gaze Vector (Head + Eye)
    eyePos: EyePosition; // For offset calculation if needed, though camera pos is enough
    isTracking: boolean;
    calibration?: CalibrationParams | null;
    trackingMode?: TrackingMode; // Optional for backward compat, default to 'head'
}

export function GazeController({ rotation, iris, gaze, eyePos, isTracking, calibration, trackingMode = 'head' }: GazeControllerProps) {
    const { camera, scene } = useThree();
    const raycaster = useRef(new Raycaster());
    const cursorRef = useRef<Group>(null);
    const regressionRef = useRef(new PolynomialRegression());

    // Update regression model when calibration changes
    useEffect(() => {
        if (calibration && calibration.regression) {
            regressionRef.current.setCoefficients(calibration.regression);
        }
    }, [calibration]);

    useFrame((state, delta) => {
        if (!isTracking || !cursorRef.current) return;

        // Use Screen Plane Mapping Strategy
        const distance = 100; // Fixed z-plane for cursor

        // Bounds for Visibility (approximate for FOV 50 at dist 100)
        // At z=-100, assuming perspective camera with standard FOV.
        // We can clamp to these to keep cursor "on screen".
        const maxY = 45;
        const maxX = 45 * (window.innerWidth / window.innerHeight);

        let targetX = 0;
        let targetY = 0;

        // Unified Gaze Logic
        // The 'gaze' prop already contains the correct fused angle (Head + Eye if mode is iris, or just Head).
        // It is in radians. We map radians to screen units.

        // Scale factor: 0.5 rad (~30 deg) covers half screen (~45 units) approx.
        const screenScale = 70.0;

        // Fallback to rotation if gaze is missing (should not happen with updated hook)
        const yaw = gaze ? gaze.yaw : rotation.yaw;
        const pitch = gaze ? gaze.pitch : rotation.pitch;

        targetX = (isNaN(yaw) ? 0 : yaw) * screenScale;
        targetY = (isNaN(pitch) ? 0 : pitch) * screenScale;

        // Note: Calibration is temporarily bypassed in favor of geometric accuracy.
        // Future improvement: Apply linear regression to the Angle (radians) if needed.

        // --- CLAMPING ---
        // Ensure cursor never leaves the visual field
        targetX = Math.max(-maxX, Math.min(maxX, targetX));
        targetY = Math.max(-maxY, Math.min(maxY, targetY));

        // Convert local camera coords (x, y, -distance) to world coords
        const localPos = new Vector3(targetX, targetY, -distance);
        localPos.applyMatrix4(camera.matrixWorld);

        cursorRef.current.position.copy(localPos);
        cursorRef.current.lookAt(camera.position);

        // Raycast from Camera to Cursor for interaction
        const rayDir = new Vector3().subVectors(localPos, camera.position).normalize();
        raycaster.current.set(camera.position, rayDir);
    });

    if (!isTracking) return null;

    return (
        <group ref={cursorRef} renderOrder={999}>
            {/* Visual Reticle Removed per user request */}
        </group>
    );
}
