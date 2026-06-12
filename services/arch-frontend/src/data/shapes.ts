import * as THREE from 'three'

export type ShapeType = 'sphere' | 'hex' | 'rounded' | 'cylinder' | 'wide-pill'

/**
 * Factory: returns a geometry for the given shape type.
 *
 * Shape → meaning:
 *   sphere    → Cloudflare infrastructure (entry points)
 *   hex       → Cluster infrastructure (hexagonal prism, 6 sides)
 *   rounded   → Microservices (soft corners)
 *   cylinder  → External / SaaS (databases, APIs)
 *   wide-pill → Public Sites (wide rounded rectangles)
 */
export function getNodeGeometry(shape: ShapeType, w: number, h: number, d: number): THREE.BufferGeometry {
  switch (shape) {
    case 'sphere':
      return new THREE.SphereGeometry(Math.min(w, h) / 2, 20, 20)
    case 'hex':
      return new THREE.CylinderGeometry(w / 2, w / 2, h, 6)
    case 'rounded': {
      // RoundedBox wrapper
      const geo = new THREE.BoxGeometry(w, h, d)
      return geo
    }
    case 'cylinder':
      return new THREE.CylinderGeometry(w / 2.5, w / 2.5, h, 16)
    case 'wide-pill': {
      const geo = new THREE.BoxGeometry(w, h, d)
      return geo
    }
    default:
      return new THREE.BoxGeometry(w, h, d)
  }
}

/** Map category → shape type */
export const catShape: Record<string, ShapeType> = {
  infrastructure: 'sphere',
  site: 'wide-pill',
  cluster: 'hex',
  service: 'rounded',
  external: 'cylinder',
}

/** Category colors */
export const catColors: Record<string, { fill: string; stroke: string }> = {
  infrastructure: { fill: '#1a1a4e', stroke: '#5555cc' },
  site: { fill: '#1a3a1a', stroke: '#44aa44' },
  cluster: { fill: '#3a1a1a', stroke: '#cc4444' },
  service: { fill: '#2a1a3a', stroke: '#8844cc' },
  external: { fill: '#1a2a3a', stroke: '#4488cc' },
}

export const catLabels: Record<string, string> = {
  infrastructure: 'Networking / Infra',
  site: 'Public Site',
  cluster: 'Cluster Infrastructure',
  service: 'Microservice',
  external: 'External / SaaS',
}
