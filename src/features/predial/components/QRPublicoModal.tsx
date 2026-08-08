/**
 * QRPublicoModal — o síndico gera/mostra o QR público de chamados do prédio ATIVO. Garante um
 * `publicSlug` para o site (na 1ª vez) e renderiza o QR da URL `…/chamado/<slug>` para imprimir/
 * distribuir. O morador escaneia e cai no ChamadoPublicoPage (sem login). Indisponível em modo
 * Demonstração (o prédio-demo não existe no servidor).
 */
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Download, QrCode, X } from 'lucide-react'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { isNonProductionDataMode } from '@/lib/runtimeMode'

export function QRPublicoModal({ onClose }: { onClose: () => void }) {
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const sites = useTorreStore((s) => s.sites)
  const ensurePublicSlug = useTorreStore((s) => s.ensurePublicSlug)
  const site = sites.find((s) => s.id === activeObraId) ?? null
  const demo = isNonProductionDataMode()

  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Garante o slug (fora do demo). Só chama a ACTION do store (não é setState de React); o slug
  // volta reativo por `site.publicSlug`, sem estado local.
  const siteId = site?.id
  useEffect(() => {
    if (siteId && !demo && !site?.publicSlug) ensurePublicSlug(siteId)
  }, [siteId, demo, site?.publicSlug, ensurePublicSlug])

  const slug = site?.publicSlug ?? null
  const url = slug ? `${window.location.origin}/chamado/${slug}` : null

  useEffect(() => {
    if (!url) return
    let ok = true
    void QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: '#111111', light: '#ffffff' } })
      .then((d) => { if (ok) setDataUrl(d) })
      .catch(() => { if (ok) setDataUrl(null) })
    return () => { ok = false }
  }, [url])

  function copiar() {
    if (!url) return
    void navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-[#525252] bg-[#2c2c2c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#525252] px-5 py-3">
          <div className="flex items-center gap-2"><QrCode size={18} className="text-[#f97316]" /><h2 className="text-sm font-bold text-white">QR público de chamados</h2></div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5">
          {!site ? (
            <p className="py-8 text-center text-sm text-[#a3a3a3]">Selecione um prédio no seletor do topo para gerar o QR.</p>
          ) : demo ? (
            <p className="py-8 text-center text-sm text-[#a3a3a3]">O QR público fica disponível fora do modo Demonstração (o prédio-modelo não existe no servidor).</p>
          ) : (
            <div className="text-center">
              <p className="mb-3 text-xs text-[#a3a3a3]">Imprima e afixe no prédio. O morador escaneia e abre um chamado <strong className="text-[#e5e5e5]">sem precisar de login</strong>.</p>
              <div className="mx-auto mb-3 grid h-[240px] w-[240px] place-items-center rounded-lg bg-white p-2">
                {dataUrl ? <img src={dataUrl} alt="QR do chamado público" className="h-full w-full" /> : <span className="text-xs text-[#6b6b6b]">gerando…</span>}
              </div>
              <p className="mb-1 text-sm font-semibold text-white">{site.name}</p>
              {url && <p className="mb-4 break-all font-mono text-[10px] text-[#6b6b6b]">{url}</p>}
              <div className="flex justify-center gap-2">
                <button onClick={copiar} className="inline-flex items-center gap-1.5 rounded-lg border border-[#525252] bg-[#333333] px-3 py-2 text-xs font-semibold text-[#e5e5e5] hover:bg-[#3f3f3f]"><Copy size={13} /> {copied ? 'Copiado!' : 'Copiar link'}</button>
                {dataUrl && <a href={dataUrl} download={`qr-chamado-${slug}.png`} className="inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white hover:bg-[#ea580c]"><Download size={13} /> Baixar QR</a>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
