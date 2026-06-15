import type { NodeDef } from '../types';

interface DetailPanelProps {
  node: NodeDef | null;
  onClose: () => void;
}

export function DetailPanel({ node, onClose }: DetailPanelProps) {
  if (!node) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: 20,
      background: 'rgba(15, 23, 42, 0.9)',
      border: '1px solid rgba(148, 163, 184, 0.25)',
      borderRadius: 8,
      padding: '16px 20px',
      fontFamily: 'system-ui, sans-serif',
      maxWidth: 320,
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 16 }}>{node.label}</div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{node.subtitle}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: 18,
            padding: '0 4px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      {node.desc && (
        <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
          {node.desc}
        </div>
      )}
      {node.url && (
        <a
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            color: '#38bdf8',
            fontSize: 13,
            marginTop: 10,
            textDecoration: 'none',
          }}
        >
          Open {node.url.replace('https://', '')} →
        </a>
      )}
    </div>
  );
}
