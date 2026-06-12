interface EnvironmentBarProps {
  envKeys: string[]
  envLabels: Record<string, string>
  activeEnv: string
  onSwitch: (key: string) => void
}

export function EnvironmentBar({ envKeys, envLabels, activeEnv, onSwitch }: EnvironmentBarProps) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-20 flex gap-1 rounded-xl bg-[rgba(15,15,35,0.85)] p-1 backdrop-blur-md border border-[rgba(74,74,138,0.3)]">
      {envKeys.map((key) => (
        <button
          key={key}
          onClick={() => onSwitch(key)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            activeEnv === key
              ? 'bg-[rgba(85,85,204,0.3)] text-white'
              : 'text-[#8888cc] hover:text-[#aaccff] hover:bg-[rgba(74,74,138,0.2)]'
          }`}
        >
          {envLabels[key]}
        </button>
      ))}
    </div>
  )
}
