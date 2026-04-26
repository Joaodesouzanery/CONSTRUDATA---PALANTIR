// Catálogo fixo de serviços do RDO Sabesp (extraído do documento padrão)

export interface ServicoCatalogo {
  codigo: string;
  descricao: string;
  unidade: "M" | "UN";
  opcoesDisponiveis?: string[];
}

export const SERVICOS_ESGOTO: ServicoCatalogo[] = [
  { codigo: "420009", descricao: "REDE DE ESGOTO - PVC DN150 - ESCAVAÇÃO MECÂNICA", unidade: "M" },
  { codigo: "420011", descricao: "REDE DE ESGOTO - PVC DN150 - ESCAVAÇÃO MANUAL", unidade: "M" },
  { codigo: "420010", descricao: "REDE DE ESGOTO - PVC DN200 - ESCAVAÇÃO MECÂNICA", unidade: "M" },
  { codigo: "420012", descricao: "REDE DE ESGOTO - PVC DN200 - ESCAVAÇÃO MANUAL", unidade: "M" },
  { codigo: "", descricao: "REDE DE ESGOTO - PVC DN300", unidade: "M" },
  { codigo: "500007", descricao: "REDE DE ESGOTO - PVC DN300 - BEIRA RIO", unidade: "M" },
  { codigo: "500008", descricao: "PV ADUELA DE CONCRETO ATÉ 2M - ESCAVAÇÃO MECÂNICA", unidade: "UN" },
  { codigo: "500009", descricao: "PV ADUELA DE CONCRETO ATÉ 2M - ESCAVAÇÃO MANUAL", unidade: "UN" },
  { codigo: "70070187", descricao: "PV PLÁSTICO ATÉ 2M", unidade: "UN" },
  { codigo: "70070188", descricao: "PV PLÁSTICO DE 2,01M ATÉ 2,5M", unidade: "UN" },
  { codigo: "70070189", descricao: "PV PLÁSTICO DE 2,51M ATÉ 3M", unidade: "UN" },
  { codigo: "500011", descricao: "PI ADUELA DE CONCRETO ATÉ 1,60M - ESCAVAÇÃO MECÂNICA", unidade: "UN" },
  { codigo: "500012", descricao: "PI ADUELA CONCRETO ATÉ 1,60 - ESCAVAÇÃO MANUAL", unidade: "UN" },
  { codigo: "500013", descricao: "PI PLÁSTICO ATÉ 1,6M", unidade: "UN" },
  { codigo: "500015", descricao: "RAMAL ESGOTO PVC DN 100 ATÉ 1,25", unidade: "M" },
  { codigo: "500016", descricao: "RAMAL ESGOTO PVC DN 150 ATÉ 1,25", unidade: "M" },
  { codigo: "500017", descricao: "RAMAL ESGOTO PVC DN 200 ATÉ 1,25", unidade: "M" },
  { codigo: "420001", descricao: "CAIXA DE INSPEÇÃO 600X600 ATE 1,25", unidade: "UN" },
  { codigo: "500019", descricao: "LIGAÇÃO INTRA TIPO 1 (UM IMÓVEL)", unidade: "UN" },
  { codigo: "500020", descricao: "LIGAÇÃO INTRA TIPO 2 (DOIS IMÓVEIS NA MESMA LIGAÇÃO)", unidade: "UN" },
  { codigo: "500023", descricao: "LIGAÇÃO DE ESGOTO ATÉ CAIXA DE INSPEÇÃO ATÉ 2M", unidade: "UN" },
  {
    codigo: "",
    descricao: "REPOSIÇÃO DO PAVIMENTO - VALA DE REDE (CIMENTADO/ASFALTO - DN150/200/300)",
    unidade: "M",
    opcoesDisponiveis: ["Cimentado", "Asfalto", "DN150", "DN200", "DN300"],
  },
  {
    codigo: "",
    descricao: "REPOSIÇÃO DO PAVIMENTO - LIGAÇÃO NAS RESIDÊNCIAS (CIMENTADO/ASFALTO)",
    unidade: "UN",
    opcoesDisponiveis: ["Cimentado", "Asfalto"],
  },
];

export const SERVICOS_AGUA: ServicoCatalogo[] = [
  { codigo: "410355", descricao: "REDE DE ÁGUA PEAD ATÉ 32MM", unidade: "M" },
  { codigo: "410356", descricao: "REDE DE ÁGUA PEAD DE 63 A 125 MM", unidade: "M" },
  { codigo: "", descricao: "REDE DE ÁGUA PEAD DE 80 A 160 MM", unidade: "M" },
  { codigo: "500033", descricao: "LIGAÇÃO DE ÁGUA - AVULSA", unidade: "UN" },
  { codigo: "500034", descricao: "LIGAÇÃO DE ÁGUA - SUCESSIVA", unidade: "UN" },
  { codigo: "500036", descricao: "LIGAÇÃO INTRADOMICILIAR TIPO I", unidade: "UN" },
  { codigo: "410222", descricao: "INSTALAÇÃO DE CAIXA UMA", unidade: "UN" },
  { codigo: "410224", descricao: "INSTALAÇÃO DE CAVALETES", unidade: "UN" },
  { codigo: "410237", descricao: "SUBSTITUIÇÃO DE HIDRÔMETRO", unidade: "UN" },
  { codigo: "410419", descricao: "INSTAL. SELAS ELETR DE 40 A 90", unidade: "UN" },
  { codigo: "410420", descricao: "INSTAL. SELAS ELETR DE 110 A 125", unidade: "UN" },
  { codigo: "410423", descricao: "INST LUVA ELETR DE 20 A 32", unidade: "UN" },
  { codigo: "410424", descricao: "INST LUVA ELETR DE 40 A 90", unidade: "UN" },
  { codigo: "410425", descricao: "INST LUVA ELETR DE 110 A 125", unidade: "UN" },
  { codigo: "410426", descricao: "INST LUVA ELETR DE 140 A 160", unidade: "UN" },
  { codigo: "500041", descricao: "INTERLIGAÇÃO 50 A 100 S/ REP", unidade: "UN" },
  { codigo: "500042", descricao: "INTERLIGAÇÃO 150 A 250 S/ REP", unidade: "UN" },
  { codigo: "500045", descricao: "INSTALAÇÃO VALVULA PVC 50 A 100", unidade: "UN" },
  { codigo: "500046", descricao: "INSTALAÇÃO VALVULA FF 50 A 100", unidade: "UN" },
  { codigo: "500047", descricao: "INSTALAÇÃO VALVULA FF 150 A 250", unidade: "UN" },
  {
    codigo: "",
    descricao: "REPOSIÇÃO DO PAVIMENTO - VALA DE REDE",
    unidade: "M",
    opcoesDisponiveis: ["Cimentado", "Asfalto"],
  },
  {
    codigo: "",
    descricao: "REPOSIÇÃO DO PAVIMENTO - LIGAÇÃO NAS RESIDÊNCIAS",
    unidade: "UN",
    opcoesDisponiveis: ["Cimentado", "Asfalto"],
  },
  {
    codigo: "",
    descricao: "REPOSIÇÃO DO PAVIMENTO - INTERLIGAÇÕES",
    unidade: "UN",
    opcoesDisponiveis: ["Cimentado", "Asfalto"],
  },
];

export const CARGOS_PADRAO = [
  "ENGENHEIRO",
  "TOPOGRAFO",
  "AJUDANTE DE TOPOGRAFO",
  "ENCARREGADO DE OBRAS",
  "TÉCNICO DE SEGURANÇA",
  "OPERADOR DE MÁQUINAS",
  "SERVIÇOS GERAIS / AJUDANTE",
  "APONTADOR",
  "MOTORISTA",
  "ARMADOR",
  "CARPINTEIRO",
  "PEDREIRO",
  "ENCANADOR",
  "SOLDADOR",
];

export const EQUIPAMENTOS_PADRAO = [
  "BOMBA D'AGUA",
  "CAMINHÃO BASCULANTE",
  "CAMINHÃO GUINDAUTO MUNK",
  "CAMINHÃO CARROCERIA",
  "ESCAVADEIRA HIDRÁULICA",
  "MINI ESCAVADEIRA",
  "RETROESCAVADEIRA",
  "BOBCAT",
  "VEICULO LEVES",
  "ROMPEDOR",
  "COMPRESSOR",
  "GRUPO GERADOR",
];

export const CRIADOUROS = [
  { value: "sao_manoel", label: "São Manoel" },
  { value: "morro_do_teteu", label: "Morro do Tetéu" },
  { value: "joao_carlos", label: "João Carlos" },
  { value: "pantanal_baixo", label: "Pantanal Baixo" },
  { value: "vila_israel", label: "Vila Israel" },
  { value: "outro", label: "Outro" },
];

export const MOTIVOS_PARALISACAO = [
  "Intervenção Policial",
  "Chuva / Alagamento",
  "Outro",
];
