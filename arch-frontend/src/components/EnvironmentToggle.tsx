interface EnvironmentToggleProps {
  activeEnv: 'overview' | 'cluster';
  onChange: (env: 'overview' | 'cluster') => void;
  overviewLabel: string;
  clusterLabel: string;
}

export function EnvironmentToggle({
  activeEnv,
  onChange,
  overviewLabel,
  clusterLabel,
}: EnvironmentToggleProps) {
  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
      display: 'flex',
      gap: 2,
      background: 'rgba(15, 23, 42, 0.8)',
      border: '1px solid rgba(148, 163, 184, 0.2)',
      borderRadius: 8,
      padding: 3,
      fontFamily: 'system-ui, sans-serif',
    }}>
      {(['overview', 'cluster'] as const).map((key) => {
        const label = key === 'overview' ? overviewLabel : clusterLabel;
        const active = activeEnv === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              background: active ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              color: active ? '#38bdf8' : '#94a3b8',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
