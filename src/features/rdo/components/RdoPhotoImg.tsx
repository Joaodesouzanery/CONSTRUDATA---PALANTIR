/**
 * RdoPhotoImg — <img> de foto de RDO que resolve a fonte automaticamente:
 * base64 (offline/legado) direto, ou signed URL (1h) quando a foto está no
 * bucket `rdo-photos`. Evita espalhar lógica de Storage pelos componentes.
 *
 * Cada foto é renderizada por uma instância própria (via `key`), então o
 * storagePath é estável na instância e o signed URL é resolvido uma vez.
 */
import { useEffect, useState } from 'react'
import type { RdoPhoto } from '@/types'
import { signedRdoPhotoUrl } from '../utils/rdoPhotoStorage'

export function RdoPhotoImg({
  photo,
  alt,
  className,
}: {
  photo: Pick<RdoPhoto, 'base64' | 'storagePath' | 'label'>
  alt?: string
  className?: string
}) {
  const [signed, setSigned] = useState<string | null>(null)

  useEffect(() => {
    // base64 (offline/legado) não precisa de rede; sem storagePath não há o que assinar.
    if (photo.base64 || !photo.storagePath) return
    let alive = true
    void signedRdoPhotoUrl(photo.storagePath).then((u) => {
      if (alive) setSigned(u)
    })
    return () => {
      alive = false
    }
  }, [photo.base64, photo.storagePath])

  const url = photo.base64 ?? signed

  if (!url) {
    return (
      <div
        className={`flex items-center justify-center bg-[#3d3d3d] text-[10px] text-[#9a9a9a] ${className ?? ''}`}
        title="Carregando foto…"
      >
        …
      </div>
    )
  }
  return <img src={url} alt={alt ?? photo.label} className={className} />
}
