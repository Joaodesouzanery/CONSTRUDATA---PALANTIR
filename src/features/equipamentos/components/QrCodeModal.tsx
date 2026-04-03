/**
 * QrCodeModal — generates and displays a printable QR code for an equipment item.
 */
import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { X, Printer } from 'lucide-react'
import type { EquipmentProfile } from '@/types'

interface QrCodeModalProps {
  equipment: EquipmentProfile
  onClose: () => void
}

export function QrCodeModal({ equipment, onClose }: QrCodeModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const qrUrl = `${window.location.origin}/app/gestao-equipamentos?equip=${equipment.id}`

  function handlePrint() {
    const el = printRef.current
    if (!el) return
    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${equipment.name}</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
            h2 { margin-bottom: 4px; }
            p { color: #666; margin: 4px 0; font-size: 14px; }
            .code-box { display: inline-block; border: 2px solid #333; border-radius: 12px; padding: 24px; margin: 20px 0; }
            .info { font-size: 12px; color: #999; margin-top: 16px; }
          </style>
        </head>
        <body>
          <h2>${equipment.name}</h2>
          <p>${equipment.code} — ${equipment.type}</p>
          <div class="code-box">
            ${el.querySelector('svg')?.outerHTML || ''}
          </div>
          <p><strong>Modelo:</strong> ${equipment.brand} ${equipment.model} (${equipment.year})</p>
          <p><strong>S/N:</strong> ${equipment.serialNumber}</p>
          <p class="info">Escaneie o QR Code para ver as informacoes completas do equipamento.</p>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 300)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#3d3d3d] rounded-2xl border border-[#525252] w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <h3 className="text-white font-semibold text-sm">QR Code do Equipamento</h3>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center" ref={printRef}>
          <div className="bg-white rounded-xl p-4 mb-4">
            <QRCodeSVG
              value={qrUrl}
              size={180}
              level="H"
              includeMargin={false}
            />
          </div>
          <h4 className="text-white font-medium text-sm">{equipment.name}</h4>
          <p className="text-[#a3a3a3] text-xs mt-1">
            {equipment.code} — {equipment.type}
          </p>
          <p className="text-[#6b6b6b] text-xs mt-1">
            {equipment.brand} {equipment.model} ({equipment.year})
          </p>
          <p className="text-[#6b6b6b] text-xs mt-1">S/N: {equipment.serialNumber}</p>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-[#525252] flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors"
          >
            <Printer size={15} /> Imprimir QR Code
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[#a3a3a3] hover:text-white bg-[#484848] hover:bg-[#525252] transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
