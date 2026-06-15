import type { NodeDef, ConnectionDef } from '../types';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

interface ConnectionLinesProps {
  connections: ConnectionDef[];
  nodeMap: Map<string, NodeDef>;
  highlighted?: boolean;
  flowColor?: string;
}

export function ConnectionLines({ connections, nodeMap, highlighted, flowColor }: ConnectionLinesProps) {
  const color = flowColor || (highlighted ? '#00e5ff' : '#2a2f4a');

  return (
    <group>
      {connections.map((conn, i) => {
        const fromNode = nodeMap.get(conn.from);
        const toNode = nodeMap.get(conn.to);
        if (!fromNode || !toNode) return null;

        const from = new THREE.Vector3(fromNode.x, 0, fromNode.z);
        const to = new THREE.Vector3(toNode.x, 0, toNode.z);

        return (
          <Line
            key={`conn-${i}-${conn.from}-${conn.to}`}
            points={[from, to]}
            color={color}
            lineWidth={1}
            transparent
            opacity={highlighted ? 0.8 : 0.3}
          />
        );
      })}
    </group>
  );
}
