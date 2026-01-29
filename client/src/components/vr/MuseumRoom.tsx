import { useMemo } from "react";
import { DoubleSide } from "three";

interface MuseumRoomProps {
    width: number;
    height: number;
    depth: number;
}

export function MuseumRoom({ width, height, depth }: MuseumRoomProps) {
    // Room dimensions:
    // Screen is at Z=0. Room extends to Z = -depth.
    // Width/Height match the screen at the front, but we might want the room to be larger?
    // Let's make the room box-shaped.

    const halfW = width / 2;
    const halfH = height / 2;
    const backZ = -depth;

    return (
        <group>
            {/* Floor */}
            <mesh position={[0, -halfH, -depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[width, depth]} />
                <meshStandardMaterial color="#4a4a4a" />
                <gridHelper args={[width, 10, "#000000", "#555555"]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} />
            </mesh>

            {/* Ceiling */}
            <mesh position={[0, halfH, -depth / 2]} rotation={[Math.PI / 2, 0, 0]}>
                <planeGeometry args={[width, depth]} />
                <meshStandardMaterial color="#eeeeee" />
            </mesh>

            {/* Back Wall */}
            <mesh position={[0, 0, backZ]}>
                <planeGeometry args={[width, height]} />
                <meshStandardMaterial color="#888888" />
            </mesh>

            {/* Left Wall */}
            <mesh position={[-halfW, 0, -depth / 2]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[depth, height]} />
                <meshStandardMaterial color="#aaaaaa" side={DoubleSide} />
            </mesh>

            {/* Right Wall */}
            <mesh position={[halfW, 0, -depth / 2]} rotation={[0, -Math.PI / 2, 0]}>
                <planeGeometry args={[depth, height]} />
                <meshStandardMaterial color="#aaaaaa" side={DoubleSide} />
            </mesh>

            {/* Ambient Light */}
            <ambientLight intensity={0.5} />

            {/* Spotlights for atmosphere */}
            <pointLight position={[0, halfH - 100, -depth / 2]} intensity={1} />
        </group>
    );
}
