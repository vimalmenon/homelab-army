import { type Node } from '../data/environments'

interface DetailPanelProps {
  node: Node | null
  onClose: () => void
  onShowFlow: () => void
  onFocusMode: () => void
  onResetFlow: () => void
  hasFlow: boolean
  isFocused: boolean
  flowActive: boolean
}

export function DetailPanel({
  node, onClose, onShowFlow, onFocusMode, onResetFlow,
  hasFlow, isFocused, flowActive,
}: DetailPanelProps) {
  if (!node) return null

  return (
    <div
      className={`fixed top-0 right-0 z-30 h-full w-[340px] overflow-y-auto border-l border-[rgba(74,74,138,0.3)] bg-[rgba(11,11,26,0.92)] p-6 text-[#ccc] backdrop-blur-xl transition-all duration-300 ${
        node ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 border-none bg-transparent text-[#666] text-xl cursor-pointer hover:text-white"
      >
        ✕
      </button>

      <h2 className="text-xl font-semibold text-white mb-1">{node.label}</h2>
      <p className="text-sm text-[#8888cc] mb-4">{node.subtitle || ''}</p>
      <p className="text-sm leading-relaxed text-[#aaa] mb-4">{node.desc}</p>

      {node.url && (
        <a
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-md bg-[rgba(68,136,204,0.15)] px-4 py-1.5 text-sm text-[#68b8ff] no-underline mb-4 hover:bg-[rgba(68,136,204,0.25)]"
        >
          {node.url}
        </a>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={onShowFlow}
          disabled={!hasFlow}
          className="rounded-md border border-[rgba(74,74,138,0.4)] bg-[rgba(15,15,35,0.8)] px-3.5 py-1.5 text-sm text-[#aaccff] cursor-pointer transition-all hover:bg-[rgba(68,136,204,0.2)] hover:border-[#4488cc] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {flowActive ? '⏳ Flowing...' : hasFlow ? '▶ Show Flow' : '▶ Show Flow'}
        </button>
        <button
          onClick={onFocusMode}
          className="rounded-md border border-[rgba(74,74,138,0.4)] bg-[rgba(15,15,35,0.8)] px-3.5 py-1.5 text-sm text-[#aaccff] cursor-pointer transition-all hover:bg-[rgba(68,136,204,0.2)] hover:border-[#4488cc]"
        >
          {isFocused ? '◎ Exit Focus' : '◎ Focus Mode'}
        </button>
        <button
          onClick={onResetFlow}
          className="rounded-md border border-[rgba(74,74,138,0.4)] bg-[rgba(15,15,35,0.8)] px-3.5 py-1.5 text-sm text-[#aaccff] cursor-pointer transition-all hover:bg-[rgba(68,136,204,0.2)] hover:border-[#4488cc]"
        >
          ✖ Reset
        </button>
      </div>

      <p className="mt-2 text-xs italic text-[#aaa]">
        Layer: {node.cat}
      </p>
    </div>
  )
}
