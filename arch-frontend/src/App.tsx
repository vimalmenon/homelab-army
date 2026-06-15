import { useState, useEffect, useRef } from 'react';
import type { NodeDef, FlowDef } from './types';
import { ArchScene } from './components/ArchScene';
import { EnvironmentToggle } from './components/EnvironmentToggle';
import { DetailPanel } from './components/DetailPanel';
import { Legend } from './components/Legend';
import { overview, cluster } from './data';

function App() {
  const [activeEnv, setActiveEnv] = useState<'overview' | 'cluster'>('overview');
  const [activeFlow, setActiveFlow] = useState<FlowDef | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeDef | null>(null);
  const flowTimeoutRef = useRef<number | null>(null);

  const environment = activeEnv === 'overview' ? overview : cluster;

  useEffect(() => {
    const envFlows = environment.flows;
    const flowKeys = Object.keys(envFlows);
    if (flowKeys.length === 0) return;

    let currentFlowIdx = 0;

    const runFlow = () => {
      const flowKey = flowKeys[currentFlowIdx];
      const flow = envFlows[flowKey];

      let totalDuration = 0;
      for (const hop of flow.hops) {
        totalDuration += hop.duration;
      }
      totalDuration += 3000;

      setActiveFlow(flow);

      flowTimeoutRef.current = window.setTimeout(() => {
        setActiveFlow(null);
        currentFlowIdx = (currentFlowIdx + 1) % flowKeys.length;
        flowTimeoutRef.current = window.setTimeout(runFlow, 2000);
      }, totalDuration);
    };

    runFlow();

    return () => {
      if (flowTimeoutRef.current !== null) {
        clearTimeout(flowTimeoutRef.current);
      }
    };
  }, [activeEnv, environment.flows]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
      background: '#0b0b1a',
    }}>
      <ArchScene
        environment={environment}
        activeFlow={activeFlow}
        onNodeSelect={setSelectedNode}
      />

      <EnvironmentToggle
        activeEnv={activeEnv}
        onChange={(env) => { setActiveEnv(env); setSelectedNode(null); }}
        overviewLabel={overview.label}
        clusterLabel={cluster.label}
      />

      <div style={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        color: '#64748b',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        Click a node for details · Scroll to zoom · Drag to orbit
      </div>

      <Legend />
      <DetailPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}

export default App;
