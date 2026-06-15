import type { LayerDef } from '../types';

interface LayerPlaneProps {
  layer: LayerDef;
}

export function LayerPlane({ layer }: LayerPlaneProps) {
  return (
    <mesh position={[0, 0, layer.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[layer.w * 1.05, layer.h * 1.5]} />
      <meshBasicMaterial
        color="#1a1f3a"
        transparent
        opacity={0.4}
        side={2}
        depthWrite={false}
      />
    </mesh>
  );
}
