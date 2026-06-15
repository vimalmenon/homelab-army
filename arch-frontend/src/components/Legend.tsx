import type { NodeCategory } from '../types';
import { catLabels, catColors } from '../types';

const catOrder: NodeCategory[] = ['infrastructure', 'cluster', 'service', 'site', 'external'];

export function Legend() {
  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      right: 20,
      background: 'rgba(15, 23, 42, 0.85)',
      border: '1px solid rgba(148, 163, 184, 0.2)',
      borderRadius: 8,
      padding: '12px 16px',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 12,
      zIndex: 10,
    }}>
      <div style={{ color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        Legend
      </div>
      {catOrder.map((cat) => {
        const c = catColors[cat];
        const color = `#${c.stroke.toString(16).padStart(6, '0')}`;
        return (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: cat === 'infrastructure' ? '50%' : 2,
              background: color,
            }} />
            <span style={{ color: '#cbd5e1' }}>{catLabels[cat]}</span>
          </div>
        );
      })}
    </div>
  );
}
