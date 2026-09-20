/**
 * useLocalizacao — pedir a posição ao navegador, com os erros separados.
 *
 * ⚠️ O único lugar do projeto que capturava GPS (`NovoRdoPanel`) tratava os três erros do padrão
 * W3C com **uma mensagem só** ("verifique as permissões") e **ignorava o `accuracy`**. Para o RDO
 * isso passa; para o ponto, não:
 *
 *  · "negou a permissão" e "está sem sinal" pedem condutas diferentes de quem confere a folha;
 *  · sem olhar a precisão, um fix de Wi-Fi com 2 km de erro passaria em qualquer cerca.
 */
import { useCallback, useState } from 'react'
import { motivoDoErroDeGeo, type LeituraDeLocal, type MotivoSemCerca } from '@/lib/geo'

export interface EstadoDaLocalizacao {
  lendo: boolean
  leitura: LeituraDeLocal | null
  motivo?: MotivoSemCerca
}

/** Prazo total, do toque até desistir — com folga sobre os 15 s que o navegador conta sozinho. */
const PRAZO_TOTAL_MS = 20_000

export function useLocalizacao() {
  const [estado, setEstado] = useState<EstadoDaLocalizacao>({ lendo: false, leitura: null })

  const ler = useCallback(() => new Promise<EstadoDaLocalizacao>((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const r: EstadoDaLocalizacao = { lendo: false, leitura: null, motivo: 'posicao-indisponivel' }
      setEstado(r); resolve(r); return
    }
    setEstado((e) => ({ ...e, lendo: true }))

    // ⚠️ Prazo NOSSO, além do `timeout` do navegador.
    //
    // O `timeout` do W3C só começa a contar DEPOIS que a pessoa responde ao balão de permissão —
    // enquanto o balão está na tela, nenhum dos dois callbacks dispara. Quem toca o botão e deixa
    // o balão aberto (ou o sistema operacional o engole, o que acontece em WebView) ficaria com
    // `lendo: true` para sempre, e o botão de bater ponto desabilitado para sempre, sem uma linha
    // explicando por quê.
    let respondido = false
    const encerrar = (r: EstadoDaLocalizacao) => {
      if (respondido) return
      respondido = true
      clearTimeout(prazo)
      setEstado(r); resolve(r)
    }
    const prazo = setTimeout(
      () => encerrar({ lendo: false, leitura: null, motivo: 'tempo-esgotado' }),
      PRAZO_TOTAL_MS,
    )

    navigator.geolocation.getCurrentPosition(
      (pos) => encerrar({
        lendo: false,
        leitura: { lat: pos.coords.latitude, lng: pos.coords.longitude, precisaoM: pos.coords.accuracy },
      }),
      (err) => encerrar({ lendo: false, leitura: null, motivo: motivoDoErroDeGeo(err?.code) }),
      {
        // `enableHighAccuracy` porque a cerca depende disso — o padrão usa a rede e erra muito.
        enableHighAccuracy: true,
        timeout: 15_000,
        // ⚠️ `maximumAge: 0`: posição em cache é de onde a pessoa ESTAVA. Num registro de jornada,
        // aceitar cache é aceitar que alguém bata o ponto com a localização de meia hora atrás.
        maximumAge: 0,
      },
    )
  }), [])

  return { ...estado, ler }
}
