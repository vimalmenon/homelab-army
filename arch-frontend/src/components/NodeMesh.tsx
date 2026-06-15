import * as React from 'react';
import type { NodeDef, ShapeType, NodeCategory } from '../types';
import { catShape, catColors } from '../types';
import { RoundedBox, Text, Edges } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';

interface NodeMeshProps {
  node: NodeDef;
  shape?: ShapeType;
  highlighted?: boolean;
  emissiveColor?: string;
  onClick?: (node: NodeDef) => void;
  onPointerOver?: (node: NodeDef) => void;
  onPointerOut?: () => void;
}

function ShapeGeo({ shape, node: n }: { shape: ShapeType; node: NodeDef }) {
  const w = n.w;
  const h = n.h;
  switch (shape) {
    case 'sphere':
      return <sphereGeometry args={[Math.min(w, h) / 2, 20, 20]} />;
    case 'hex':
      return <cylinderGeometry args={[w / 2, w / 2, h, 6]} />;
    case 'cylinder':
      return <cylinderGeometry args={[w / 2.5, w / 2.5, h, 16]} />;
    default:
      return <boxGeometry args={[w, h, 1]} />;
  }
}

export function NodeMesh({
  node,
  shape,
  highlighted = false,
  emissiveColor,
  onClick,
  onPointerOver,
  onPointerOut,
}: NodeMeshProps) {
  const shapeType = shape || catShape[node.cat as NodeCategory] || 'rounded';
  const colors = catColors[node.cat as NodeCategory] || catColors.service;
  const isRounded = shapeType === 'rounded' || shapeType === 'wide-pill';
  const radius = shapeType === 'wide-pill' ? 6 : 4;

  const fillColor = highlighted ? '#00e5ff' : `#${colors.fill.toString(16).padStart(6, '0')}`;
  const strokeColor = `#${colors.stroke.toString(16).padStart(6, '0')}`;
  const emissive = emissiveColor || '#000000';

  const handleClick = React.useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onClick?.(node);
    },
    [node, onClick]
  );
  const handlePointerOver = React.useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = 'pointer';
      onPointerOver?.(node);
    },
    [node, onPointerOver]
  );
  const handlePointerOut = React.useCallback(() => {
    document.body.style.cursor = 'default';
    onPointerOut?.();
  }, [onPointerOut]);

  const depth = node.cat === 'cluster' ? 1.5 : 1;

  return (
    <group position={[node.x, 0, node.z]}>
      {isRounded ? (
        <>
          <RoundedBox
// @ts-expect-error drei args type compatibility
            args={[node.w, node.h, depth, radius]}
            onClick={handleClick}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut as unknown as React.PointerEventHandler<HTMLElement>}
          >
            <meshStandardMaterial color={fillColor} roughness={0.5} metalness={0.3} emissive={emissive} />
          </RoundedBox>
          {/* @ts-expect-error drei args type compatibility */}
          <RoundedBox args={[node.w, node.h, depth, radius]}>
            <Edges color={strokeColor} />
          </RoundedBox>
        </>
      ) : (
        <>
          <mesh
            onClick={handleClick}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut as unknown as React.PointerEventHandler<HTMLElement>}
            castShadow
          >
            <ShapeGeo shape={shapeType} node={node} />
            <meshStandardMaterial color={fillColor} roughness={0.5} metalness={0.3} emissive={emissive} />
          </mesh>
          <mesh>
            <ShapeGeo shape={shapeType} node={node} />
            <Edges color={strokeColor} />
          </mesh>
        </>
      )}

      <Text
        position={[0, node.h / 2 + 16, 0]}
        fontSize={13}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {node.label}
      </Text>
      {node.subtitle && (
        <Text
          position={[0, -node.h / 2 - 12, 0]}
          fontSize={10}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          {node.subtitle}
        </Text>
      )}
    </group>
  );
}
