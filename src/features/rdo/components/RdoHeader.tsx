import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Download, FileText, Plus, Settings } from 'lucide-react'
import { useRdoStore } from '@/store/rdoStore'
import { LogoConfigModal } from './LogoConfigModal'
import type { RdoTab } from '@/types'

const TABS: { key: RdoTab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'historico', label: 'Historico de RDOs' },
  { key: 'sabesp', label: 'RDO Sabesp' },
  { key: 'novo', label: 'Novo RDO' },
  { key: 'empreiteiros', label: 'Empreiteiros' },
]

function escapeCell(value: string | number | null | undefined): string {
  const str = Array.from(String(value ?? ''))
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
  const neutralized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
  return `"${neutralized.replace(/"/g, '""')}"`
}

export function RdoHeader() {
  const { activeTab, setActiveTab, rdos } = useRdoStore()
  const [showLogoModal, setShowLogoModal] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const isSabespRoute = location.pathname === '/app/rdo-sabesp'

  function openRdoTab(tab: RdoTab) {
    if (tab === 'sabesp') {
      navigate('/app/rdo-sabesp')
      return
    }
    setActiveTab(tab)
    if (location.pathname !== '/app/rdo') navigate('/app/rdo')
  }

  function handleExportCsv() {
    const BOM = '\uFEFF'
    const header = [
      escapeCell('N RDO'),
      escapeCell('Data'),
      escapeCell('Responsavel'),
      escapeCell('Trechos'),
      escapeCell('Metros Executados'),
      escapeCell('Fotos'),
    ].join(',')
    const rows = rdos.map((r) =>
      [
        escapeCell(r.number),
        escapeCell(r.date),
        escapeCell(r.responsible),
        escapeCell(r.trechos.length),
        escapeCell(r.trechos.reduce((s, t) => s + t.executedMeters, 0).toFixed(2)),
        escapeCell(r.photos.length),
      ].join(','),
    )
    const csv = BOM + [header, ...rows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rdos-${new Date().toISOString().slice(0, 10)}.csv`
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <>
      <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
        <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-lg leading-tight">RDO</h1>
              <p className="text-[#a3a3a3] text-xs">Relatorio Diario de Obras</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLogoModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#a3a3a3] hover:text-[#f97316] hover:bg-[#484848] transition-colors border border-[#525252] hover:border-[#f97316]/30"
            >
              <Settings size={15} />
              <span className="hidden sm:inline">Configurar Logo</span>
            </button>
            <button
              onClick={() => openRdoTab('novo')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors bg-[#f97316] hover:bg-[#ea580c]"
            >
              <Plus size={15} />
              Novo RDO
            </button>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
            >
              <Download size={15} />
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex px-6 gap-1 min-w-max pb-0">
            {TABS.map((tab) => {
              const isActive = tab.key === 'sabesp' ? isSabespRoute : !isSabespRoute && activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => openRdoTab(tab.key)}
                  className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2 ${
                    isActive
                      ? 'text-[#f97316] border-[#f97316] bg-[#3d3d3d]'
                      : 'text-[#a3a3a3] border-transparent hover:text-[#f5f5f5] hover:bg-[#3d3d3d]/50'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {showLogoModal && <LogoConfigModal onClose={() => setShowLogoModal(false)} />}
    </>
  )
}
