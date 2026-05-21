export interface NewsItem {
  id: string
  title: string
  source: string
  category: string
  dateLabel: string
  summary: string
  url: string
  imageUrl?: string
  sourceType?: 'Fonte oficial' | 'Fonte setorial' | 'Google News RSS' | 'HTML monitorado'
  region?: string
  imageTone: 'water' | 'policy' | 'utility' | 'infra'
}

export const sanitationNewsItems: NewsItem[] = [
  ['trata-brasil', 'Instituto Trata Brasil', 'Indicadores', 'Fonte setorial', 'Indicadores e estudos sobre saneamento no Brasil', 'Acompanhamento de acesso à água, esgoto, perdas e avanços do setor com foco em dados públicos e estudos institucionais.', 'https://tratabrasil.org.br/', 'water'],
  ['ias', 'Instituto Água e Saneamento', 'Dados públicos', 'Fonte setorial', 'Monitoramento público de água e saneamento', 'Base editorial e técnica para acompanhar políticas, municípios, indicadores e prioridades de universalização.', 'https://www.aguaesaneamento.org.br/', 'policy'],
  ['abes', 'ABES', 'Técnico', 'Fonte setorial', 'Atualizações técnicas do setor de saneamento', 'Conteúdos de engenharia sanitária, eventos, regulação e debates técnicos relevantes para operadoras e construtoras.', 'https://abes-dn.org.br/', 'infra'],
  ['saneamento-hoje', 'Saneamento Hoje', 'Mercado', 'Fonte setorial', 'Cobertura setorial de saneamento e infraestrutura', 'Radar editorial para notícias de mercado, investimentos, concessões, companhias e tecnologias do setor.', 'https://saneamentohoje.com.br/', 'infra'],
  ['aesbe', 'AESBE', 'Operadoras', 'Fonte setorial', 'Notícias das companhias estaduais de saneamento', 'Acompanhamento institucional das empresas estaduais, projetos, concessões, obras e pautas de universalização.', 'https://aesbe.org.br/', 'water'],
  ['sindae', 'SINDAE', 'Institucional', 'Fonte setorial', 'Acompanhamento sindical e institucional do saneamento', 'Monitoramento de pautas trabalhistas, regulação, companhias públicas e debates locais que impactam operação e obras.', 'https://www.sindae.org.br/', 'policy'],
  ['cebds', 'CEBDS', 'Sustentabilidade', 'Fonte setorial', 'Sustentabilidade, ESG e infraestrutura resiliente', 'Fonte para agenda empresarial de clima, água, saneamento, financiamento sustentável e boas práticas corporativas.', 'https://cebds.org/', 'utility'],
  ['o-eco', 'O Eco', 'Ambiental', 'Fonte setorial', 'Meio ambiente, recursos hídricos e cidades', 'Cobertura jornalística ambiental usada apenas como descoberta e referência, sempre com leitura completa na fonte.', 'https://oeco.org.br/', 'water'],
  ['abha', 'ABHA - Águas do Brasil', 'Recursos hídricos', 'Fonte setorial', 'Comitês de bacia e gestão de águas', 'Acompanhamento de bacias, planos, projetos e governança de recursos hídricos ligados ao saneamento.', 'https://agenciaabha.com.br/', 'water'],
  ['caesb', 'Caesb', 'Operadoras', 'Fonte oficial', 'Obras e operação de saneamento no Distrito Federal', 'Fonte oficial para obras, comunicados, investimentos e operação de água e esgoto no DF.', 'https://www.caesb.df.gov.br/', 'utility'],
  ['ana', 'ANA', 'Regulação', 'Fonte oficial', 'Regulação, recursos hídricos e saneamento', 'Fonte oficial para normas de referência, segurança hídrica, regulação e diretrizes ligadas ao saneamento.', 'https://www.gov.br/ana/', 'utility'],
  ['aegea', 'Aegea', 'Operadoras', 'Fonte oficial', 'Concessões, investimentos e operação privada', 'Atualizações institucionais sobre projetos, universalização, concessões e operação de saneamento.', 'https://www.aegea.com.br/', 'infra'],
  ['copasa', 'Copasa', 'Operadoras', 'HTML monitorado', 'Atualizações da Copasa e saneamento em Minas Gerais', 'Fonte para comunicados e obras da companhia; captura automática deve passar por curadoria antes de exibição.', 'https://www.copasa.com.br/', 'water'],
  ['igua', 'Iguá Saneamento', 'Operadoras', 'HTML monitorado', 'Projetos e operação da Iguá Saneamento', 'Monitoramento institucional de concessões, operações, obras e indicadores publicados pela companhia.', 'https://igua.com.br/', 'infra'],
  ['funasa', 'FUNASA', 'Governo', 'HTML monitorado', 'Saneamento público e políticas federais', 'Acompanhamento de comunicados oficiais e políticas públicas federais ligadas ao saneamento.', 'https://www.gov.br/funasa/', 'policy'],
  ['embasa', 'Embasa', 'Operadoras', 'Google News RSS', 'Notícias da Embasa via descoberta RSS', 'Descoberta por RSS do Google News com exibição resumida e link para a fonte original.', 'https://news.google.com/search?q=Embasa%20saneamento&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'utility'],
  ['cagece', 'CAGECE', 'Operadoras', 'Fonte oficial', 'Saneamento e obras no Ceará', 'Fonte oficial para obras, abastecimento, esgotamento sanitário e comunicados da companhia cearense.', 'https://www.cagece.com.br/', 'water'],
  ['cedae', 'CEDAE', 'Operadoras', 'HTML monitorado', 'Comunicados e operação da CEDAE', 'Monitoramento de informações públicas da companhia, com curadoria para evitar republicação indevida.', 'https://cedae.com.br/', 'utility'],
  ['corsan', 'Corsan', 'Operadoras', 'Fonte oficial', 'Saneamento no Rio Grande do Sul', 'Acompanhamento de obras, investimentos e comunicados operacionais publicados pela companhia.', 'https://www.corsan.com.br/', 'infra'],
  ['casan', 'Casan', 'Operadoras', 'Fonte oficial', 'Saneamento em Santa Catarina', 'Fonte oficial para projetos, comunicados, água, esgoto e operação regional em Santa Catarina.', 'https://www.casan.com.br/', 'water'],
  ['gn-saneamento-brasil', 'Google News', 'Radar RSS', 'Google News RSS', 'Radar geral de saneamento no Brasil', 'Descoberta ampla de notícias sobre saneamento; o conteúdo exibido deve apontar para a fonte original.', 'https://news.google.com/search?q=Saneamento%20Brasil&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'water'],
  ['gn-marco-legal', 'Google News', 'Regulação', 'Google News RSS', 'Marco Legal do Saneamento', 'Monitoramento de regulação, metas de universalização, licitações, concessões e segurança jurídica.', 'https://news.google.com/search?q=Marco%20Legal%20Saneamento&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'policy'],
  ['gn-tratamento-agua', 'Google News', 'Tecnologia', 'Google News RSS', 'Tratamento de água', 'Descoberta de pautas sobre tratamento, ETA, qualidade da água, eficiência operacional e inovação.', 'https://news.google.com/search?q=Tratamento%20de%20%C3%81gua&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'utility'],
  ['gn-esgoto', 'Google News', 'Esgotamento', 'Google News RSS', 'Esgoto e saneamento', 'Acompanhamento de coleta, tratamento, obras, universalização e impactos urbanos ligados a esgoto.', 'https://news.google.com/search?q=Esgoto%20e%20Saneamento&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'infra'],
  ['gn-concessoes', 'Google News', 'Mercado', 'Google News RSS', 'Concessões de saneamento', 'Radar de leilões, PPPs, concessões, investimentos, operadores privados e estruturação de projetos.', 'https://news.google.com/search?q=Concess%C3%B5es%20Saneamento&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'infra'],
  ['gn-recursos-hidricos', 'Google News', 'Recursos hídricos', 'Google News RSS', 'Recursos hídricos', 'Notícias sobre segurança hídrica, bacias, outorgas, reservatórios, estiagens e gestão da água.', 'https://news.google.com/search?q=Recursos%20H%C3%ADdricos&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'water'],
  ['gn-brk', 'Google News', 'Operadoras', 'Google News RSS', 'BRK Ambiental', 'Descoberta de notícias sobre operações, obras e concessões relacionadas à BRK Ambiental.', 'https://news.google.com/search?q=BRK%20Ambiental&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'utility'],
  ['gn-igua', 'Google News', 'Operadoras', 'Google News RSS', 'Iguá Saneamento em notícias', 'Busca recorrente sobre Iguá Saneamento, com leitura sempre direcionada para a fonte original.', 'https://news.google.com/search?q=Igu%C3%A1%20Saneamento&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'infra'],
  ['gn-copasa-mg', 'Google News', 'Operadoras', 'Google News RSS', 'Copasa MG em notícias', 'Monitoramento de pautas regionais da Copasa e saneamento em Minas Gerais.', 'https://news.google.com/search?q=Copasa%20MG&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'water'],
  ['gn-sanepar-pr', 'Google News', 'Operadoras', 'Google News RSS', 'Sanepar PR em notícias', 'Monitoramento de obras, mercado e operação da Sanepar no Paraná.', 'https://news.google.com/search?q=Sanepar%20PR&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'utility'],
].map(([id, source, category, sourceType, title, summary, url, imageTone]) => ({
  id,
  title,
  source,
  category,
  dateLabel: sourceType,
  summary,
  url,
  sourceType,
  imageTone,
})) as NewsItem[]

export const newsComplianceNotes = [
  'Sem republicar matéria completa.',
  'Resumo próprio e curto, com link canônico.',
  'Imagem somente com permissão, feed permitido ou ativo próprio.',
]
