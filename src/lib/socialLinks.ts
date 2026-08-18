/**
 * socialLinks.ts — os perfis públicos da ConstruData, num lugar só.
 *
 * Mesma razão do `features/landing/landingLinks.ts`: as URLs já viviam chumbadas dentro do
 * `Sidebar.tsx`, e a landing precisava das mesmas duas. Duplicar significa que trocar o
 * @ do Instagram deixa um link velho em algum canto — o tipo de coisa que ninguém percebe
 * porque o link continua abrindo, só que na conta errada.
 *
 * Arquivo folha: não importa nada, para poder ser usado tanto pela landing pré-renderizada
 * quanto pelo app sem risco de ciclo de import.
 *
 * Os `utm_*` que o Instagram acrescenta quando você copia o link do app ("?utm_source=
 * ig_web_button_share_sheet&igsh=…") são de rastreamento da própria sessão de quem copiou,
 * não servem para nada aqui e ficam de fora.
 */

export interface PerfilSocial {
  /** Identificador estável, usado como key de lista. */
  id: 'linkedin' | 'instagram'
  nome: string
  /** Como a conta se chama, para quem lê ("@construdata_"). */
  arroba: string
  url: string
}

export const PERFIS_SOCIAIS: readonly PerfilSocial[] = [
  {
    id: 'linkedin',
    nome: 'LinkedIn',
    arroba: '/company/construdatasoftware',
    url: 'https://www.linkedin.com/company/construdatasoftware',
  },
  {
    id: 'instagram',
    nome: 'Instagram',
    arroba: '@construdata_',
    url: 'https://www.instagram.com/construdata_',
  },
]

export const LINKEDIN_URL = PERFIS_SOCIAIS[0].url
export const INSTAGRAM_URL = PERFIS_SOCIAIS[1].url
