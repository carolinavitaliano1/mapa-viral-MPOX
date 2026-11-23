export interface MpoxStep {
  id: number;
  yearLabel: string;
  shortYear: string;
  location: string;
  lat: number;
  lng: number;
  title: string;
  summary: string;
  publicHealthTag: string;
  clade: string;
  source: string;
  pinTone: 'amber' | 'coral';
  keyHighlight: string;
  cameraDistance?: number;
}

export interface BrazilSurveillanceNode {
  uf: string;
  name: string;
  lat: number;
  lng: number;
  tier: 'principal' | 'secundario' | 'vigilancia';
  sharePercent: number;
  role: string;
}

export const MPOX_STEPS: MpoxStep[] = [
  {
    id: 1,
    yearLabel: '1958',
    shortYear: '1958',
    location: 'Copenhague, Dinamarca',
    lat: 55.6761,
    lng: 12.5683,
    title: 'Descoberta do vírus',
    summary:
      'Identificado pela primeira vez em dois surtos em colônias de macacos mantidos para pesquisa. Destaque sem estigma: macacos não são o principal reservatório natural — o vírus circula em pequenos mamíferos selvagens (como roedores) na África Central e Ocidental.',
    publicHealthTag: 'História Natural da Doença',
    clade: 'Orthopoxvirus · Isolamento inicial',
    source: 'Fiocruz / OMS',
    pinTone: 'amber',
    keyHighlight:
      'A denominação histórica levou a interpretações equivocadas: primatas não humanos também adoecem e não devem sofrer maus-tratos.',
    cameraDistance: 5.4,
  },
  {
    id: 2,
    yearLabel: '1970',
    shortYear: '1970',
    location: 'República Democrática do Congo',
    lat: -4.0383,
    lng: 21.7587,
    title: 'Primeiro caso humano',
    summary:
      'Registrado em um menino de 9 meses com sintomas semelhantes aos da varíola. A doença passou a ter casos esporádicos em áreas endêmicas da África Central e Ocidental.',
    publicHealthTag: 'Epidemiologia Histórica',
    clade: 'Clado 1 (Bacia do Congo) e Clado 2 (África Ocidental)',
    source: 'OMS / Fiocruz',
    pinTone: 'amber',
    keyHighlight:
      'O registro ocorreu durante a intensificação da vigilância para erradicação da varíola humana na região.',
    cameraDistance: 5.2,
  },
  {
    id: 3,
    yearLabel: '2003',
    shortYear: '2003',
    location: 'Estados Unidos',
    lat: 41.8781,
    lng: -87.6298,
    title: 'Primeiro surto fora da África',
    summary:
      'Primeiro registro em território não endêmico, associado a animais importados (com 47 casos adicionais e disseminação bloqueada).',
    publicHealthTag: 'Vigilância Epidemiológica',
    clade: 'Clado 2a',
    source: 'Fiocruz / Ministério da Saúde (ref. CDC)',
    pinTone: 'amber',
    keyHighlight:
      'Evento zoonótico vinculado a pequenos mamíferos importados e cães-da-pradaria mantidos em comércio de animais exóticos.',
    cameraDistance: 5.3,
  },
  {
    id: 4,
    yearLabel: '06/05/2022 a 23/07/2022',
    shortYear: 'Mai–Jul 2022',
    location: 'Reino Unido / Global',
    lat: 51.5074,
    lng: -0.1278,
    title: 'Surto multinacional (Clado 2)',
    summary:
      'Primeiro caso na Europa em 06/05/2022; OMS anuncia surto global em 21/05/2022 e declara a 1ª Emergência de Saúde Pública de Importância Internacional em 23/07/2022 (encerrada em maio de 2023).',
    publicHealthTag: 'Emergência Internacional (ESPII)',
    clade: 'Clado 2b',
    source: 'OMS / Ministério da Saúde',
    pinTone: 'coral',
    keyHighlight:
      'Mudança no padrão epidemiológico com transmissão sustentada humano-a-humano em múltiplos países simultaneamente.',
    cameraDistance: 5.3,
  },
  {
    id: 5,
    yearLabel: '09/06/2022',
    shortYear: 'Jun 2022',
    location: 'São Paulo, Brasil',
    lat: -23.5505,
    lng: -46.6333,
    title: 'Primeiro caso no Brasil',
    summary:
      'Homem de 41 anos com histórico de viagem para Portugal e Espanha, confirmado pelo Instituto Adolfo Lutz após PCR negativo para varicela-zóster e sequenciamento genômico do Monkeypox virus, com monitoramento de contatos.',
    publicHealthTag: 'Diagnóstico Laboratorial no SUS',
    clade: 'Clado 2b · Sequenciamento IAL',
    source: 'Instituto Adolfo Lutz / Ministério da Saúde',
    pinTone: 'amber',
    keyHighlight:
      'Resposta rápida da rede de laboratórios de referência pública com diagnóstico diferencial e rastreamento de contatos.',
    cameraDistance: 4.5,
  },
  {
    id: 6,
    yearLabel: 'Jul–Ago/2022',
    shortYear: 'Jul–Ago 2022',
    location: 'Brasil (SP e rede SUS)',
    lat: -19.2,
    lng: -44.6,
    title: 'Grupos vulneráveis e resposta no SUS',
    summary:
      'Primeiro óbito fora da África registrado no Brasil em 29/07/2022 (paciente imunossuprimido) e primeiros 2 casos em gestantes em 02/08/2022 (Campinas e Guarulhos). Crianças e imunossuprimidos têm maior risco de quadros graves.',
    publicHealthTag: 'Equidade no SUS',
    clade: 'Clado 2b · Assistência e Prioridade Clínica',
    source: 'Ministério da Saúde / Fiocruz',
    pinTone: 'coral',
    keyHighlight:
      'Imunossuprimidos, gestantes e crianças demandam vigilância clínica intensificada e acesso equitativo ao cuidado no SUS.',
    cameraDistance: 4.5,
  },
  {
    id: 7,
    yearLabel: '14/08/2024',
    shortYear: 'Ago 2024',
    location: 'República Democrática do Congo / África',
    lat: -1.6585,
    lng: 29.2205,
    title: '2ª Emergência Internacional (Clado 1b)',
    summary:
      'OMS declara novamente emergência global devido à rápida propagação da variante clado 1b na RDC e em outros países africanos.',
    publicHealthTag: 'Vigilância Genômica Global',
    clade: 'Clado 1b',
    source: 'OMS / Fiocruz',
    pinTone: 'coral',
    keyHighlight:
      'A rápida expansão regional na África Oriental e Central motivou o alerta sanitário internacional e reforço de fronteiras.',
    cameraDistance: 5.1,
  },
  {
    id: 8,
    yearLabel: '07/03/2025 e Cenário Atual',
    shortYear: 'Mar 2025+',
    location: 'São Paulo / RJ / Rondônia (Brasil)',
    lat: -21.8,
    lng: -42.4,
    title: 'Clado 1b no Brasil e vigilância contínua',
    summary:
      'Primeiro caso da variante clado 1b confirmado em São Paulo em mulher de 29 anos após contato com familiar vindo da RDC. No país, os casos concentram-se em SP, seguido por RJ e RO, e depois MG, RS, DF e PR.',
    publicHealthTag: 'Vigilância Contínua no SUS',
    clade: 'Clado 1b + Circulação Clado 2b',
    source: 'Ministério da Saúde / Fiocruz',
    pinTone: 'coral',
    keyHighlight:
      'Rede nacional de vigilância ativa em SP, RJ, RO, MG, RS, DF e PR com monitoramento genômico e testagem oportuna.',
    cameraDistance: 4.4,
  },
];

export const BRAZIL_SURVEILLANCE_NODES: BrazilSurveillanceNode[] = [
  {
    uf: 'SP',
    name: 'São Paulo',
    lat: -23.5505,
    lng: -46.6333,
    tier: 'principal',
    sharePercent: 41.2,
    role: 'Maior concentração nacional; 1º caso de Clado 2b (2022) e 1º caso de Clado 1b (07/03/2025).',
  },
  {
    uf: 'RJ',
    name: 'Rio de Janeiro',
    lat: -22.9068,
    lng: -43.1729,
    tier: 'secundario',
    sharePercent: 18.6,
    role: 'Segundo maior polo de notificações e referência laboratorial Fiocruz/INI.',
  },
  {
    uf: 'RO',
    name: 'Rondônia',
    lat: -8.7619,
    lng: -63.9039,
    tier: 'secundario',
    sharePercent: 10.4,
    role: 'Destaque proporcional no Norte com vigilância intensificada na rede SUS.',
  },
  {
    uf: 'MG',
    name: 'Minas Gerais',
    lat: -19.9167,
    lng: -43.9345,
    tier: 'vigilancia',
    sharePercent: 8.9,
    role: 'Monitoramento regional relevante e resposta clínica para imunossuprimidos.',
  },
  {
    uf: 'RS',
    name: 'Rio Grande do Sul',
    lat: -30.0346,
    lng: -51.2177,
    tier: 'vigilancia',
    sharePercent: 6.7,
    role: 'Vigilância epidemiológica ativa na Região Sul via LACEN-RS.',
  },
  {
    uf: 'DF',
    name: 'Distrito Federal',
    lat: -15.7975,
    lng: -47.8919,
    tier: 'vigilancia',
    sharePercent: 5.8,
    role: 'Centro de coordenação nacional (SVSA/MS) e vigilância integrada.',
  },
  {
    uf: 'PR',
    name: 'Paraná',
    lat: -25.4284,
    lng: -49.2733,
    tier: 'vigilancia',
    sharePercent: 4.5,
    role: 'Vigilância de fronteira e diagnóstico molecular descentralizado.',
  },
];

export interface CladeComparisonRow {
  criterion: string;
  clade1: string;
  clade2: string;
}

export const CLADE_COMPARISON: CladeComparisonRow[] = [
  {
    criterion: 'Origem geográfica histórica',
    clade1: 'Bacia do Congo / África Central (subclados 1a e 1b)',
    clade2: 'África Ocidental (subclados 2a e 2b)',
  },
  {
    criterion: 'Marco de Emergência Global (OMS)',
    clade1: '2ª ESPII declarada em 14/08/2024 (expansão do Clado 1b)',
    clade2: '1ª ESPII declarada em 23/07/2022 e encerrada em maio/2023',
  },
  {
    criterion: 'Primeiro registro confirmado no Brasil',
    clade1: '07/03/2025 em São Paulo (contato com familiar vindo da RDC)',
    clade2: '09/06/2022 em São Paulo (confirmado pelo Instituto Adolfo Lutz)',
  },
  {
    criterion: 'Gravidade clínica e atenção',
    clade1: 'Historicamente associado a quadros mais severos; monitoramento genômico prioritário',
    clade2: 'Predomínio de evolução leve a moderada; risco elevado em imunossuprimidos, gestantes e crianças',
  },
  {
    criterion: 'Diagnóstico padrão-ouro no SUS',
    clade1: 'RT-qPCR específico de swab de lesão + sequenciamento para diferenciação de clado',
    clade2: 'RT-qPCR em rede LACEN / Fiocruz / IAL com descarte diferencial (varicela-zóster, herpes)',
  },
];

export const R_SCRIPT_CONTENT = `# ==============================================================================
# Projeto de Extensão em Farmácia · Saúde Pública e Epidemiologia (SUS)
# Análise Bioestatística da Mpox no Brasil (SINAN / e-SUS)
# ==============================================================================

library(tidyverse)
library(epiR)

# 1. Carregamento dos dados agregados de vigilância por UF
mpox_uf <- tibble(
  uf = c("SP", "RJ", "RO", "MG", "RS", "DF", "PR"),
  casos_confirmados = c(4120, 1860, 1040, 890, 670, 580, 450),
  populacao_estimada = c(44411238, 16054524, 1581196, 20539989, 10882965, 2817381, 11444380),
  obitos = c(6, 5, 1, 3, 1, 0, 0)
)

# 2. Taxa de incidência por 100.000 habitantes e taxa de letalidade (%)
indicadores <- mpox_uf %>%
  mutate(
    incidencia_100k = (casos_confirmados / populacao_estimada) * 1e5,
    letalidade_pct  = (obitos / casos_confirmados) * 100,
    participacao_pct = (casos_confirmados / sum(casos_confirmados)) * 100
  ) %>%
  arrange(desc(incidencia_100k))

print(indicadores)

# 3. Intervalo de Confiança 95% (Poisson exato) para a incidência de SP
ic_sp <- epi.conf(
  dat = as.matrix(cbind(4120, 44411238)),
  ctype = "inc.rate",
  method = "exact",
  N = 1e5,
  conf.level = 0.95
)

cat(sprintf("Incidência SP: %.2f (IC95%%: %.2f - %.2f) por 100 mil hab.\\n",
            ic_sp$est, ic_sp$lower, ic_sp$upper))

# 4. Gráfico epidemiológico limpo para boletim de extensão
ggplot(indicadores, aes(x = reorder(uf, participacao_pct), y = participacao_pct)) +
  geom_col(fill = "#F59E0B", width = 0.65) +
  coord_flip() +
  labs(
    title = "Concentração Proporcional de Casos de Mpox por UF",
    subtitle = "Ordem de concentração: SP, seguido por RJ e RO, depois MG, RS, DF e PR",
    x = "Unidade Federativa",
    y = "Participação relativa (%)",
    caption = "Fonte: Base educativa · Vigilância Epidemiológica SUS / Fiocruz"
  ) +
  theme_minimal(base_size = 12)`;

export const PYTHON_SCRIPT_CONTENT = `# ==============================================================================
# Projeto de Extensão em Farmácia · Saúde Pública e Epidemiologia (SUS)
# Pipeline de Bioestatística e Vigilância da Mpox em Python
# ==============================================================================

import math
import pandas as pd
from scipy import stats

# 1. Conjunto de referência educativa por UF (concentração SP > RJ, RO > MG, RS, DF, PR)
dados = [
    {"uf": "SP", "casos": 4120, "populacao": 44411238, "obitos": 6},
    {"uf": "RJ", "casos": 1860, "populacao": 16054524, "obitos": 5},
    {"uf": "RO", "casos": 1040, "populacao": 1581196,  "obitos": 1},
    {"uf": "MG", "casos": 890,  "populacao": 20539989, "obitos": 3},
    {"uf": "RS", "casos": 670,  "populacao": 10882965, "obitos": 1},
    {"uf": "DF", "casos": 580,  "populacao": 2817381,  "obitos": 0},
    {"uf": "PR", "casos": 450,  "populacao": 11444380, "obitos": 0},
]

df = pd.DataFrame(dados)

# 2. Cálculo de indicadores epidemiológicos
df["incidencia_100k"] = (df["casos"] / df["populacao"]) * 100_000
df["letalidade_pct"] = (df["obitos"] / df["casos"]) * 100
df["proporcao_pct"] = (df["casos"] / df["casos"].sum()) * 100

# 3. Intervalo de Confiança 95% de Wilson para letalidade agregada
def ic95_wilson(eventos: int, total: int, z: float = 1.96):
    p = eventos / total
    denom = 1 + (z ** 2) / total
    centro = (p + (z ** 2) / (2 * total)) / denom
    margem = (z * math.sqrt((p * (1 - p) + (z ** 2) / (4 * total)) / total)) / denom
    return max(0.0, (centro - margem) * 100), min(100.0, (centro + margem) * 100)

total_casos = int(df["casos"].sum())
total_obitos = int(df["obitos"].sum())
ic_inf, ic_sup = ic95_wilson(total_obitos, total_casos)

print(df[["uf", "casos", "incidencia_100k", "letalidade_pct"]].to_string(index=False))
print(f"\\nLetalidade agregada: {(total_obitos/total_casos)*100:.2f}% (IC95%: {ic_inf:.2f}% - {ic_sup:.2f}%)")

# 4. Teste Qui-Quadrado de heterogeneidade regional
qui2, p_valor = stats.chisquare(df["casos"])
print(f"Teste de aderência Qui-Quadrado: X² = {qui2:.1f}, p = {p_valor:.3e}")`;

export interface SusWorkflowStage {
  step: string;
  title: string;
  unit: string;
  description: string;
  actions: string[];
}

export const SUS_WORKFLOW_STAGES: SusWorkflowStage[] = [
  {
    step: '01',
    title: 'Acolhimento sem estigma e triagem clínica',
    unit: 'UBS / UPA / Serviço de Farmácia Clínica',
    description:
      'Recepção sigilosa e humanizada de qualquer pessoa com lesões cutâneas ou mucosas agudas, febre, linfadenopatia ou histórico de contato próximo.',
    actions: [
      'Fornecer máscara cirúrgica e cobrir lesões expostas com vestimenta ou curativo limpo',
      'Encaminhar para sala reservada evitando aglomeração na recepção',
      'Avaliar sinais de gravidade e pertencimento a grupos vulneráveis (imunossuprimidos, gestantes e crianças)',
    ],
  },
  {
    step: '02',
    title: 'Coleta de swab e notificação imediata',
    unit: 'Vigilância Epidemiológica Municipal / SINAN',
    description:
      'Coleta adequada do conteúdo das vesículas, pústulas ou crostas com swab estéril e registro compulsório nos sistemas oficiais do SUS.',
    actions: [
      'Utilizar EPI completo (avental impermeável, luvas, proteção ocular e máscara PFF2/N95)',
      'Acondicionar amostras em tubo seco estéril conforme protocolo LACEN',
      'Preencher ficha de notificação e mapear contatos próximos dos últimos 21 dias',
    ],
  },
  {
    step: '03',
    title: 'Diagnóstico molecular e vigilância genômica',
    unit: 'LACEN · Instituto Adolfo Lutz · Fiocruz',
    description:
      'Confirmação por RT-qPCR com diagnóstico diferencial (ex.: varicela-zóster, sífilis, herpes) e sequenciamento para identificação de Clado 1b ou Clado 2b.',
    actions: [
      'Descartar diagnósticos diferenciais frequentes na atenção primária',
      'Sequenciar casos sentinelas ou com vínculo de viagem a regiões com circulação de Clado 1b',
      'Integrar resultado laboratorial diretamente à equipe de vigilância local',
    ],
  },
  {
    step: '04',
    title: 'Acompanhamento farmacoterapêutico e bloqueio',
    unit: 'Equipe Multiprofissional · Farmácia SUS',
    description:
      'Cuidado de suporte sintomático, prevenção de infecções bacterianas secundárias, isolamento domiciliar orientado e monitoramento de contatos.',
    actions: [
      'Orientar manejo seguro da dor, febre e higiene das lesões sem automedicação irritativa',
      'Garantir continuidade de terapias crônicas (como TARV em pessoas vivendo com HIV)',
      'Manter isolamento até queda completa das crostas e formação de pele íntegra',
    ],
  },
];

export const DEFAULT_GITHUB_URL = 'https://github.com/extensao-farmacia-sus/atlas-mpox-3d';
