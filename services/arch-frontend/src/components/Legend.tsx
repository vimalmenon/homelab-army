export function Legend() {
  const items = [
    { color: '#5555cc', label: 'Networking / Infra', dotClass: 'bg-[#5555cc]' },
    { color: '#44aa44', label: 'Public Sites', dotClass: 'bg-[#44aa44]' },
    { color: '#cc4444', label: 'Cluster Infrastructure', dotClass: 'bg-[#cc4444]' },
    { color: '#8844cc', label: 'Microservices', dotClass: 'bg-[#8844cc]' },
    { color: '#4488cc', label: 'External / SaaS', dotClass: 'bg-[#4488cc]' },
    { color: '#6666aa', label: 'Connections', dotClass: 'bg-[#6666aa]' },
  ]

  return (
    <div className="fixed bottom-6 left-6 z-20 rounded-xl border border-[rgba(74,74,138,0.3)] bg-[rgba(15,15,35,0.8)] p-3 text-xs text-[#8888cc] backdrop-blur-md max-w-[200px]">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 my-0.5">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.dotClass}`} />
          {item.label}
        </div>
      ))}
    </div>
  )
}
