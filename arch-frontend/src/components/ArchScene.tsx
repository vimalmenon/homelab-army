import { useCallback, useMemo } from 'react';
import type { NodeDef, LayerDef, EnvironmentDef, FlowDef } from '../types';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { NodeMesh } from './NodeMesh';
import { ConnectionLines } from './ConnectionLines';
import { LayerPlane } from './LayerPlane';

interface ArchSceneProps {
  environment: EnvironmentDef;
  activeFlow: FlowDef | null;
  onNodeSelect: (node: NodeDef | null) => void;
}

function LayerLabels({ layers }: { layers: LayerDef[] }) {
  return (
    <group>
      {layers.map((layer) => (
        <Text
          key={layer.id}
          position={[-layer.w / 2 - 60, 0, layer.z]}
          fontSize={14}
          color="#64748b"
          anchorX="left"
          anchorY="middle"
        >
          {layer.label}
        </Text>
      ))}
    </group>
  );
}

function SceneContent({ environment, activeFlow, onNodeSelect }: ArchSceneProps) {
  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeDef>();
    for (const n of environment.nodes) {
      map.set(n.id, n);
    }
    return map;
  }, [environment.nodes]);

  const highlightedNodes = useMemo(() => {
    const set = new Set<string>();
    if (activeFlow) {
      for (const hop of activeFlow.hops) {
        if ('node' in hop) {
          set.add(hop.node);
        }
        if ('arrow' in hop) {
          set.add(hop.node);
        }
      }
    }
    return set;
  }, [activeFlow]);

  const handleNodeClick = useCallback(
    (node: NodeDef) => {
      onNodeSelect(node?.id ? node : null);
    },
    [onNodeSelect]
  );

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[200, -300, 500]} intensity={1.2} castShadow />
      <directionalLight position={[-200, 300, -100]} intensity={0.3} />
      <fog attach="fog" args={['#0b0b1a', 1200, 2600]} />

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={150}
        maxDistance={2000}
        zoomSpeed={0.5}
        target={environment.cameraTarget}
      />

      {environment.layers.map((layer) => (
        <LayerPlane key={layer.id} layer={layer} />
      ))}

      <LayerLabels layers={environment.layers} />

      <ConnectionLines
        connections={environment.connections}
        nodeMap={nodeMap}
        highlighted={!!activeFlow}
      />

      {environment.nodes.map((node) => (
        <NodeMesh
          key={node.id}
          node={node}
          highlighted={highlightedNodes.has(node.id)}
          emissiveColor={highlightedNodes.has(node.id) ? '#00e5ff' : undefined}
          onClick={handleNodeClick}
          onPointerOver={() => {}}
          onPointerOut={() => {}}
        />
      ))}
    </>
  );
}

export function ArchScene({ environment, activeFlow, onNodeSelect }: ArchSceneProps) {
  return (
    <Canvas
      camera={{ position: environment.cameraPos, fov: 45, near: 1, far: 3000 }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#0b0b1a');
        gl.shadowMap.enabled = true;
      }}
    >
      <SceneContent environment={environment} activeFlow={activeFlow} onNodeSelect={onNodeSelect} />
    </Canvas>
  );
}
