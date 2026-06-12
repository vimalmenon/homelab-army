import { useRef, useMemo, useEffect } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import * as THREE from 'three'
import { type Environment, type Node as NodeData } from '../data/environments'
import { getNodeGeometry, catColors, catShape, type ShapeType } from '../data/shapes'

interface Scene3DProps {
  environment: Environment
  onNodeClick: (node: NodeData) => void
  selectedNodeId?: string
  isFocused: boolean
}

export function Scene3D({ environment, onNodeClick, selectedNodeId, isFocused }: Scene3DProps) {
  const groupRef = useRef<THREE.Group>(null)

  // Destroy and rebuild when env changes
  useEffect(() => {
    if (groupRef.current) {
      while (groupRef.current.children.length) {
        groupRef.current.remove(groupRef.current.children[0])
      }
    }
  }, [environment])

  // Build connection geometry data
  const connectionData = useMemo(() => {
    return environment.connections
      .map((conn) => {
        const fromNode = environment.nodes.find((n) => n.id === conn.from)
        const toNode = environment.nodes.find((n) => n.id === conn.to)
        if (!fromNode || !toNode) return null
        return {
          from: new THREE.Vector3(fromNode.x, 0, fromNode.z),
          to: new THREE.Vector3(toNode.x, 0, toNode.z),
          fromId: conn.from,
          toId: conn.to,
        }
      })
      .filter(Boolean) as { from: THREE.Vector3; to: THREE.Vector3; fromId: string; toId: string }[]
  }, [environment])

  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.4} color="#404060" />
      <directionalLight position={[200, -300, 500]} intensity={1.2} castShadow />
      <directionalLight position={[-200, 200, -100]} intensity={0.3} color="#6688ff" />
      <hemisphereLight args={['#6688ff', '#0b0b1a', 0.4]} />

      {/* Controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={150}
        maxDistance={2000}
        zoomSpeed={0.5}
        target={[0, 0, 155]}
      />

      {/* Fog */}
      <fog attach="fog" args={['#0b0b1a', 1200, 2600]} />

      <group ref={groupRef}>
        {/* Layer planes */}
        {environment.layers.map((layer) => (
          <group key={layer.id}>
            <mesh
              position={[0, 0, layer.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
            >
              <planeGeometry args={[layer.w, layer.h]} />
              <meshStandardMaterial
                color="#141430"
                transparent
                opacity={0.5}
                side={THREE.DoubleSide}
                roughness={0.6}
                metalness={0.2}
              />
            </mesh>
            {/* Layer label as a sprite — we use drei Text */}
            <Text
              position={[-layer.w / 2 + 10, -layer.h / 2 + 18, layer.z + 2]}
              fontSize={14}
              color="#5555aa"
              fontWeight={600}
              anchorX="left"
              anchorY="top"
            >
              {layer.label}
            </Text>
          </group>
        ))}

        {/* Nodes */}
        {environment.nodes.map((node) => (
          <NodeMesh
            key={node.id}
            node={node}
            isSelected={node.id === selectedNodeId}
            isDimmed={isFocused && selectedNodeId ? !isInFlow(node.id, environment, selectedNodeId) : false}
            onClick={() => onNodeClick(node)}
          />
        ))}

        {/* Connections */}
        {connectionData.map((conn, i) => (
          <ConnectionLine key={`${conn.fromId}-${conn.toId}-${i}`} {...conn} />
        ))}
      </group>
    </>
  )
}

// ─── Node Mesh ──────────────────────────────────────────────────────────────────

interface NodeMeshProps {
  node: NodeData
  isSelected: boolean
  isDimmed: boolean
  onClick: () => void
}

function NodeMesh({ node, isSelected, isDimmed, onClick }: NodeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const colors = catColors[node.cat] || catColors.external
  const shape = catShape[node.cat] || 'box'
  const isCentered = shape === 'hex' || shape === 'cylinder'

  const geo = useMemo(
    () => getNodeGeometry(shape as ShapeType, node.w, 20, node.h),
    [shape, node.w, node.h]
  )

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (meshRef.current) {
      ;(meshRef.current.material as THREE.MeshStandardMaterial).emissive.setHex(0x6688ff)
      ;(meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3
      document.body.style.cursor = 'pointer'
    }
  }

  const handlePointerOut = () => {
    if (meshRef.current) {
      ;(meshRef.current.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000)
      ;(meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0
      document.body.style.cursor = 'default'
    }
  }

  useEffect(() => {
    return () => {
      geo.dispose()
    }
  }, [geo])

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geo}
        position={[node.x, isCentered ? 10 : 0, node.z]}
        castShadow
        onClick={(e) => { e.stopPropagation(); onClick() }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <meshStandardMaterial
          color={colors.fill}
          emissive={isSelected ? new THREE.Color(0x6688ff) : new THREE.Color(0x000000)}
          emissiveIntensity={isSelected ? 0.3 : 0}
          roughness={0.5}
          metalness={0.3}
          transparent={isDimmed}
          opacity={isDimmed ? 0.12 : 1}
        />
      </mesh>

      {/* Edge outline */}
      <lineSegments
        geometry={new THREE.EdgesGeometry(geo)}
        position={[node.x, isCentered ? 10 : 0, node.z]}
      >
        <lineBasicMaterial
          color={colors.stroke}
          transparent
          opacity={isDimmed ? 0.05 : 0.6}
        />
      </lineSegments>

      {/* Label */}
      <Text
        position={[node.x, 14, node.z]}
        fontSize={13}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {node.label}
      </Text>
    </group>
  )
}

// ─── Connection Line ─────────────────────────────────────────────────────────────

function ConnectionLine({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const points = useMemo(() => [from, to], [from, to])
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points])

  return (
    <group>
      {/* Tube */}
      <mesh>
        <tubeGeometry args={[curve, 8, 1.5, 4, false]} />
        <meshStandardMaterial
          color="#444488"
          transparent
          opacity={0.4}
          roughness={0.5}
        />
      </mesh>

      {/* Arrow cone at endpoint */}
      <mesh position={to.clone().sub(from.clone().sub(to).normalize().multiplyScalar(25))}>
        <coneGeometry args={[4, 10, 6]} />
        <meshStandardMaterial
          color="#444488"
          emissive="#444488"
          emissiveIntensity={0}
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function isInFlow(nodeId: string, env: Environment, flowRoot: string): boolean {
  if (nodeId === flowRoot) return true
  const flow = env.flows[flowRoot]
  if (!flow) return false
  return flow.hops.some((h) => h.node === nodeId || (h.arrow && (h.arrow[0] === nodeId || h.arrow[1] === nodeId)))
}
