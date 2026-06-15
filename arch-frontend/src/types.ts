export type ShapeType = 'sphere' | 'hex' | 'rounded' | 'cylinder' | 'wide-pill';

export type NodeCategory = 'infrastructure' | 'site' | 'cluster' | 'service' | 'external';

export interface LayerDef {
  id: string;
  label: string;
  z: number;
  w: number;
  h: number;
}

export interface NodeDef {
  id: string;
  layer: string;
  label: string;
  subtitle: string;
  x: number;
  z: number;
  w: number;
  h: number;
  cat: NodeCategory;
  desc: string;
  url: string;
}

export interface ConnectionDef {
  from: string;
  to: string;
}

export type FlowHop =
  | { node: string; duration: number }
  | { arrow: [string, string]; node: string; duration: number };

export interface FlowDef {
  label: string;
  hops: FlowHop[];
}

export interface EnvironmentDef {
  label: string;
  layers: LayerDef[];
  nodes: NodeDef[];
  connections: ConnectionDef[];
  flows: Record<string, FlowDef>;
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
}

export interface CatColors {
  fill: number;
  stroke: number;
}

export const catShape: Record<NodeCategory, ShapeType> = {
  infrastructure: 'sphere',
  site: 'wide-pill',
  cluster: 'hex',
  service: 'rounded',
  external: 'cylinder',
};

export const catColors: Record<NodeCategory, CatColors> = {
  infrastructure: { fill: 0x1a1a4e, stroke: 0x5555cc },
  site: { fill: 0x1a3a1a, stroke: 0x44aa44 },
  cluster: { fill: 0x3a1a1a, stroke: 0xcc4444 },
  service: { fill: 0x2a1a3a, stroke: 0x8844cc },
  external: { fill: 0x1a2a3a, stroke: 0x4488cc },
};

export const catLabels: Record<NodeCategory, string> = {
  infrastructure: 'Networking / Infra',
  site: 'Public Site',
  cluster: 'Cluster Infrastructure',
  service: 'Microservice',
  external: 'External / SaaS',
};
