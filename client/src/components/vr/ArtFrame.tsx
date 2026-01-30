import { useRef, useState } from "react";
import { Image, Text } from "@react-three/drei";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";

interface ArtFrameProps {
    url: string;
    title: string;
    position: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
    onClick: (title: string) => void;
}

export function ArtFrame({ url, title, position, rotation = [0, 0, 0], scale = 1, onClick }: ArtFrameProps) {
    const groupRef = useRef<Group>(null);
    const [hovered, setHovered] = useState(false);

    // Animation on hover
    useFrame((state) => {
        if (groupRef.current) {
            const targetScale = hovered ? 1.05 * scale : 1 * scale;
            groupRef.current.scale.lerp({ x: targetScale, y: targetScale, z: targetScale } as any, 0.1);
        }
    });

    return (
        <group
            ref={groupRef}
            position={position}
            rotation={rotation}
            onClick={(e) => {
                e.stopPropagation();
                onClick(title);
            }}
            onPointerOver={() => {
                setHovered(true);
                document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
                setHovered(false);
                document.body.style.cursor = 'auto';
            }}
            userData={{ isArt: true, title }}
        >
            {/* Frame Background */}
            <mesh position={[0, 0, -5]}>
                <boxGeometry args={[320, 240, 10]} />
                <meshStandardMaterial color="#332211" />
            </mesh>

            {/* White Matting */}
            <mesh position={[0, 0, -1]}>
                <planeGeometry args={[300, 220]} />
                <meshStandardMaterial color="#fffff0" />
            </mesh>

            {/* The Image */}
            <Image
                url={url}
                scale={[280, 200]}
                position={[0, 0, 1]}
                transparent
            />

            {/* Label Board below */}
            {hovered && (
                <group position={[0, -140, 10]}>
                    <mesh>
                        <planeGeometry args={[200, 40]} />
                        <meshBasicMaterial color="rgba(0,0,0,0.7)" transparent />
                    </mesh>
                    <Text
                        fontSize={20}
                        color="white"
                        anchorX="center"
                        anchorY="middle"
                        position={[0, 0, 1]}
                    >
                        {title}
                    </Text>
                </group>
            )}
        </group>
    );
}
