import { useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { environments, type Node } from './data/environments'
import { EnvironmentBar } from './components/EnvironmentBar'
import { Legend } from './components/Legend'
import { DetailPanel } from './components/DetailPanel'
import { Scene3D } from './components/Scene3D'

export default function App() {
  const envKeys = Object.keys(environments)
  const envLabels = Object.fromEntries(envKeys.map((k) => [k, environments[k].label]))

  const [activeEnv, setActiveEnv] = useState('overview')
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  const env = environments[activeEnv]
  const hasFlow = selectedNode ? !!env.flows[selectedNode.id] : false

  const handleSwitch = useCallback((key: string) => {
    setActiveEnv(key)
    setSelectedNode(null)
    setIsFocused(false)
  }, [])

  const handleNodeClick = useCallback((node: Node) => {
    setSelectedNode(node)
  }, [])

  const handleClosePanel = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const handleShowFlow = useCallback(() => {
    // TODO: implement flow animation
  }, [])

  const handleFocusMode = useCallback(() => {
    setIsFocused((prev) => !prev)
  }, [])

  const handleResetFlow = useCallback(() => {
    setIsFocused(false)
  }, [])

  return (
    <div className="w-full h-screen bg-[#0b0b1a] overflow-hidden relative">
      <EnvironmentBar
        envKeys={envKeys}
        envLabels={envLabels}
        activeEnv={activeEnv}
        onSwitch={handleSwitch}
      />

      <Canvas
        camera={{ position: [0, -1600, 1100], fov: 45, near: 1, far: 3000 }}
        gl={{ antialias: true }}
        className="w-full h-full touch-none"
      >
        <Scene3D
          environment={env}
          onNodeClick={handleNodeClick}
          selectedNodeId={selectedNode?.id}
          isFocused={isFocused}
        />
      </Canvas>

      <Legend />

      <DetailPanel
        node={selectedNode}
        onClose={handleClosePanel}
        onShowFlow={handleShowFlow}
        onFocusMode={handleFocusMode}
        onResetFlow={handleResetFlow}
        hasFlow={hasFlow}
        isFocused={isFocused}
        flowActive={false}
      />
    </div>
  )
}
