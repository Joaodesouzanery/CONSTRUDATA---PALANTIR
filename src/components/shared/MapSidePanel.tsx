import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface Tab {
  key: string
  label: string
  content: React.ReactNode
}

interface Props {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  tabs: Tab[]
}

export function MapSidePanel({ isOpen, onClose, title, subtitle, tabs }: Props) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.key ?? '')

  useEffect(() => {
    if (isOpen) setActiveTab(tabs[0]?.key ?? '')
  }, [isOpen, title]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 360,
        zIndex: 2000,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex',
        flexDirection: 'column',
        background: '#222',
        borderLeft: '1px solid #525252',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #333', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f5f5f5', lineHeight: 1.3 }}>{title}</p>
            {subtitle && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b6b6b' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b6b6b', padding: 2, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <X size={16} />
          </button>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginTop: 10 }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600,
                background: activeTab === t.key ? 'rgba(249,115,22,0.15)' : 'transparent',
                color: activeTab === t.key ? '#f97316' : '#6b6b6b',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {tabs.find((t) => t.key === activeTab)?.content}
      </div>
    </div>
  )
}
