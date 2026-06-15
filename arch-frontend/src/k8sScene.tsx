import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import { Mesh, Group } from 'three';

/**
 * Design Philosophy: Cyberpunk Neon Minimalism
 * - Deep dark background with neon accents
 * - Geometric precision with glowing effects
 * - Minimal UI chrome; maximize 3D canvas
 * - Smooth, purposeful animations
 */

interface K8sComponent {
  id: string;
  name: string;
  type: 'cluster' | 'node' | 'pod' | 'service' | 'ingress';
  position: [number, number, number];
  color: string;
  description: string;
  status: 'healthy' | 'warning' | 'error';
}

const K8S_COMPONENTS: K8sComponent[] = [
  {
    id: 'cluster',
    name: 'Kubernetes Cluster',
    type: 'cluster',
    position: [0, 0, 0],
    color: '#00d9ff',
    description: 'Main Kubernetes cluster orchestrating all workloads',
    status: 'healthy',
  },
  {
    id: 'node-1',
    name: 'Master Node',
    type: 'node',
    position: [-8, 5, -8],
    color: '#00d9ff',
    description: 'Control plane node managing cluster operations',
    status: 'healthy',
  },
  {
    id: 'node-2',
    name: 'Worker Node 1',
    type: 'node',
    position: [8, 5, -8],
    color: '#39ff14',
    description: 'Worker node running application pods',
    status: 'healthy',
  },
  {
    id: 'node-3',
    name: 'Worker Node 2',
    type: 'node',
    position: [-8, 5, 8],
    color: '#39ff14',
    description: 'Worker node running application pods',
    status: 'healthy',
  },
  {
    id: 'node-4',
    name: 'Worker Node 3',
    type: 'node',
    position: [8, 5, 8],
    color: '#39ff14',
    description: 'Worker node running application pods',
    status: 'healthy',
  },
  {
    id: 'pod-1',
    name: 'API Pod',
    type: 'pod',
    position: [6, 2, -6],
    color: '#ff006e',
    description: 'REST API service pod',
    status: 'healthy',
  },
  {
    id: 'pod-2',
    name: 'Database Pod',
    type: 'pod',
    position: [10, 2, -6],
    color: '#ff006e',
    description: 'PostgreSQL database pod',
    status: 'healthy',
  },
  {
    id: 'pod-3',
    name: 'Cache Pod',
    type: 'pod',
    position: [6, 2, 6],
    color: '#ff006e',
    description: 'Redis cache pod',
    status: 'healthy',
  },
  {
    id: 'service',
    name: 'Service',
    type: 'service',
    position: [0, -5, 0],
    color: '#39ff14',
    description: 'Load balancer service exposing cluster',
    status: 'healthy',
  },
  {
    id: 'ingress',
    name: 'Ingress Controller',
    type: 'ingress',
    position: [0, -10, 0],
    color: '#00d9ff',
    description: 'Ingress controller managing external access',
    status: 'healthy',
  },
];

interface ComponentNodeProps {
  component: K8sComponent;
  onSelect: (component: K8sComponent) => void;
  isSelected: boolean;
}

function ComponentNode({ component, onSelect, isSelected }: ComponentNodeProps) {
  const meshRef = useRef<Mesh>(null);
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const startTimeRef = useRef(Date.now());

  useFrame(() => {
    if (meshRef.current) {
      // Pulsing animation for healthy status
      if (component.status === 'healthy') {
        const elapsed = (Date.now() - startTimeRef.current) * 0.003;
        meshRef.current.scale.x = 1 + Math.sin(elapsed) * 0.1;
        meshRef.current.scale.y = 1 + Math.sin(elapsed) * 0.1;
        meshRef.current.scale.z = 1 + Math.sin(elapsed) * 0.1;
      }

      // Rotation animation
      if (groupRef.current) {
        groupRef.current.rotation.x += 0.002;
        groupRef.current.rotation.y += 0.003;
      }
    }
  });

  const getGeometry = () => {
    switch (component.type) {
      case 'cluster':
        return <sphereGeometry args={[2, 32, 32]} />;
      case 'node':
        return <boxGeometry args={[1.5, 1.5, 1.5]} />;
      case 'pod':
        return <boxGeometry args={[0.8, 0.8, 0.8]} />;
      case 'service':
        return <octahedronGeometry args={[1.2, 0]} />;
      case 'ingress':
        return <tetrahedronGeometry args={[1.5]} />;
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  const glowIntensity = isSelected ? 3 : hovered ? 2 : 1;
  const emissiveIntensity = isSelected ? 0.8 : hovered ? 0.5 : 0.3;

  const handleClick = (e: any) => {
    e.stopPropagation();
    onSelect(component);
  };

  return (
    <group ref={groupRef} position={component.position}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        {getGeometry()}
        <meshStandardMaterial
          color={component.color}
          emissive={component.color}
          emissiveIntensity={emissiveIntensity}
          wireframe={false}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Glow effect */}
      <mesh scale={1.3}>
        {getGeometry()}
        <meshBasicMaterial
          color={component.color}
          transparent
          opacity={0.2 * glowIntensity}
          wireframe={false}
        />
      </mesh>

      {/* Wireframe outline */}
      <mesh>
        {getGeometry()}
        <meshBasicMaterial
          color={component.color}
          wireframe
          transparent
          opacity={0.6 * glowIntensity}
        />
      </mesh>

      {/* Label */}
      <Text
        position={[0, -1.5, 0]}
        fontSize={0.4}
        color={component.color}
        anchorX="center"
        anchorY="top"
      >
        {component.name}
      </Text>
    </group>
  );
}

interface SceneProps {
  selectedComponent: K8sComponent | null;
  onSelectComponent: (component: K8sComponent | null) => void;
}

function Scene({ selectedComponent, onSelectComponent }: SceneProps) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(15, 15, 15);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[15, 15, 15]} fov={75} />
      <OrbitControls
        autoRotate={!selectedComponent}
        autoRotateSpeed={2}
        enableZoom
        enablePan
        minDistance={5}
        maxDistance={50}
      />

      {/* Lighting */}
      <ambientLight intensity={0.5} color="#ffffff" />
      <pointLight position={[10, 10, 10]} intensity={1} color="#00d9ff" />
      <pointLight position={[-10, 10, -10]} intensity={0.8} color="#ff006e" />
      <pointLight position={[0, -10, 0]} intensity={0.6} color="#39ff14" />

      {/* Grid */}
      <gridHelper args={[40, 40]} position={[0, -15, 0]} />

      {/* Components */}
      {K8S_COMPONENTS.map((component) => (
        <ComponentNode
          key={component.id}
          component={component}
          onSelect={onSelectComponent}
          isSelected={selectedComponent?.id === component.id}
        />
      ))}
    </>
  );
}

export default function K8sScene() {
  const [selectedComponent, setSelectedComponent] = useState<K8sComponent | null>(null);

  return (
    <div className="w-full h-screen bg-background relative">
      <Canvas>
        <Scene
          selectedComponent={selectedComponent}
          onSelectComponent={setSelectedComponent}
        />
      </Canvas>

      {/* Info Panel */}
      {selectedComponent && (
        <div className="absolute bottom-6 left-6 max-w-sm z-50">
          <div className="bg-card/80 backdrop-blur-md border border-primary/50 rounded-lg p-4 shadow-lg">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-bold text-primary">
                {selectedComponent.name}
              </h3>
              <button
                onClick={() => setSelectedComponent(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {selectedComponent.description}
            </p>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: selectedComponent.color }}
              />
              <span className="text-xs text-muted-foreground capitalize">
                {selectedComponent.status}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-6 right-6 max-w-xs z-50">
        <div className="bg-card/80 backdrop-blur-md border border-primary/50 rounded-lg p-4 shadow-lg">
          <h4 className="text-sm font-bold text-primary mb-3">Legend</h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#00d9ff' }} />
              <span className="text-muted-foreground">Cluster / Control Plane</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#39ff14' }} />
              <span className="text-muted-foreground">Worker Nodes / Services</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ff006e' }} />
              <span className="text-muted-foreground">Pods</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Info */}
      <div className="absolute top-6 left-6 z-50">
        <div className="bg-card/80 backdrop-blur-md border border-primary/50 rounded-lg p-4 shadow-lg">
          <h2 className="text-xl font-bold text-primary mb-2">K8s Explorer</h2>
          <p className="text-xs text-muted-foreground">
            Drag to rotate • Scroll to zoom • Click to inspect
          </p>
        </div>
      </div>
    </div>
  );
}
