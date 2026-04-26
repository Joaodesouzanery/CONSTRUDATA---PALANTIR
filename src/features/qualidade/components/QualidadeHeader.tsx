import { useState } from 'react'
import { Download, FileWarning, Plus, Settings, ShieldCheck } from 'lucide-react'
import { useQualidadeStore } from '@/store/qualidadeStore'
import { LogoConfigModal } from '@/features/rdo/components/LogoConfigModal'
import type { FvsTab } from '@/types'

const TABS: { key: FvsTab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'novo', label: '+ Nova FVS' },
  { key: 'nao-conformidade', label: '+ Não Conformidade' },
  { key: 'historico', label: 'Histórico Qualidade' },
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

export function QualidadeHeader() {
  const { activeTab, setActiveTab, fvss, nonConformities } = useQualidadeStore()
  const [showLogoModal, setShowLogoModal] = useState(false)

  function handleExportCsv() {
    const BOM = '\uFEFF'
    const header = [
      escapeCell('Tipo'),
      escapeCell('Número'),
      escapeCell('Identificação'),
      escapeCell('Contrato'),
      escapeCell('Data'),
      escapeCell('Responsável'),
      escapeCell('Itens Conformes'),
      escapeCell('Itens Não Conformes'),
      escapeCell('NC Aberta'),
      escapeCell('Nº NC'),
    ].join(',')

    const fvsRows = fvss.map((f) => {
      const conformes = f.items.filter((i) => i.conformity === 'conforme' || i.conformity === 'reinspecao_ok').length
      const naoConformes = f.items.filter((i) => i.conformity === 'nao_conforme').length
      return [
        escapeCell('FVS'),
        escapeCell(f.number),
        escapeCell(f.identificationNo),
        escapeCell(f.contractNo),
        escapeCell(f.date),
        escapeCell(f.responsibleLeader),
        escapeCell(conformes),
        escapeCell(naoConformes),
        escapeCell(f.ncRequired ? 'SIM' : 'NÃO'),
        escapeCell(f.ncNumber),
      ].join(',')
    })

    const ncRows = nonConformities.map((nc) => [
      escapeCell('Não Conformidade'),
      escapeCell(nc.number),
      escapeCell(nc.location),
      escapeCell(nc.company),
      escapeCell(nc.date),
      escapeCell(nc.openedBy),
      escapeCell(''),
      escapeCell(''),
      escapeCell('SIM'),
      escapeCell(nc.ncNumber),
    ].join(','))

    const csv = BOM + [header, ...fvsRows, ...ncRows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qualidade-${new Date().toISOString().slice(0, 10)}.csv`
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
              <ShieldCheck size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-lg leading-tight">Qualidade</h1>
              <p className="text-[#a3a3a3] text-xs">FVS e Não Conformidades</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowLogoModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#a3a3a3] hover:text-[#f97316] transition-colors border border-[#525252] hover:border-[#f97316]/30"
            >
              <Settings size={15} />
              <span className="hidden sm:inline">Configurar Logo</span>
            </button>
            <button
              onClick={() => setActiveTab('novo')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors bg-[#f97316] hover:bg-[#ea580c]"
            >
              <Plus size={15} />
              Nova FVS
            </button>
            <button
              onClick={() => setActiveTab('nao-conformidade')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors border border-[#525252]"
            >
              <FileWarning size={15} />
              <span className="hidden sm:inline">Não Conformidade</span>
              <span className="sm:hidden">NC</span>
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
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
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
