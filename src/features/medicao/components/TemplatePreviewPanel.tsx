/**
 * TemplatePreviewPanel — Overlay panel that shows the standard template format
 * as a reference, with a download button for the empty template.
 */
import { X, Download, Table2 } from 'lucide-react'
import { TEMPLATE_COLUMNS, exportEmptyTemplate } from '../utils/medicaoTemplate'

interface TemplatePreviewPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function TemplatePreviewPanel({ isOpen, onClose }: TemplatePreviewPanelProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#525252]">
          <div className="flex items-center gap-2">
            <Table2 size={18} className="text-[#f97316]" />
            <div>
              <h2 className="text-[#f5f5f5] font-semibold text-base">
                Modelo Padrao de Medicao
              </h2>
              <p className="text-[#a3a3a3] text-xs mt-0.5">
                Formato padrão para importação e exportação
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          {/* Instructions */}
          <div className="p-3 rounded-lg bg-[#f97316]/10 border border-[#f97316]/30">
            <p className="text-[#f97316] text-xs font-medium mb-1">
              Como usar o modelo padrao
            </p>
            <ul className="text-[#a3a3a3] text-xs space-y-1 list-disc list-inside">
              <li>Baixe o modelo vazio e preencha com os dados da medicao</li>
              <li>Ao importar, ative "Normalizar para template padrão" para ajustes automaticos</li>
              <li>Campos obrigatórios: Item, Descrição, UN, Qtd Contratada, Qtd Medida, Preço Unitário</li>
              <li>Valor Medido é calculado automaticamente se deixado em branco</li>
            </ul>
          </div>

          {/* Columns table */}
          <div className="overflow-x-auto rounded-lg border border-[#525252]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#3d3d3d]">
                  <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">#</th>
                  <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">Coluna</th>
                  <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">Campo Interno</th>
                  <th className="px-3 py-2 text-right text-[#a3a3a3] font-medium">Largura</th>
                </tr>
              </thead>
              <tbody>
                {TEMPLATE_COLUMNS.map((col, i) => (
                  <tr
                    key={col.key}
                    className="border-t border-[#525252] hover:bg-[#484848]"
                  >
                    <td className="px-3 py-1.5 text-[#6b6b6b] font-mono">
                      {i + 1}
                    </td>
                    <td className="px-3 py-1.5 text-[#f5f5f5] font-medium">
                      {col.label}
                    </td>
                    <td className="px-3 py-1.5 text-[#a3a3a3] font-mono">
                      {col.key}
                    </td>
                    <td className="px-3 py-1.5 text-[#a3a3a3] font-mono text-right">
                      {col.width}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#525252]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={exportEmptyTemplate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors"
          >
            <Download size={15} />
            Baixar Modelo Vazio
          </button>
        </div>
      </div>
    </div>
  )
}
