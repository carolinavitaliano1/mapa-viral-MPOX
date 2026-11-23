export type VirusPartId =
  | 'outer_membrane'
  | 'surface_tubules'
  | 'inner_membrane'
  | 'lateral_bodies'
  | 'palisade_layer'
  | 'biconcave_core'
  | 'dna_genome';

export interface VirusStructureSpec {
  id: VirusPartId;
  name: string;
  shortName: string;
  colorHex: string;
  layerScale: string;
  isOuter: boolean;
  explodeOffset: [number, number, number];
  labelAnchor: [number, number, number];
  focusPoint: [number, number, number];
  biology: string;
  publicHealth: string;
}

export const VIRUS_STRUCTURES: VirusStructureSpec[] = [
  {
    id: 'outer_membrane',
    name: 'Membrana Externa (Envelope EV)',
    shortName: 'Membrana Externa',
    colorHex: '#2E7D78',
    layerScale: 'Envelope Extracelular • ~300 × 200 × 170 nm',
    isOuter: true,
    explodeOffset: [-0.68, -0.18, -0.48],
    labelAnchor: [-1.55, 0.54, 0.44],
    focusPoint: [-0.35, 0.12, 0.1],
    biology:
      'Bicamada lipoproteica adicional adquirida da rede trans-Golgi ou endossomos da célula hospedeira. Define o Vírion Extracelular Envelopado (EV), especializado na disseminação eficiente célula a célula no organismo e na evasão inicial da resposta humoral.',
    publicHealth:
      'Por ser um envelope lipídico delicado, é facilmente inativado por álcool 70%, sabão e hipoclorito de sódio. Contudo, seu rompimento libera a forma interna (MV), que permanece altamente estável e infecciosa em superfícies.',
  },
  {
    id: 'surface_tubules',
    name: 'Espículas / Túbulos de Superfície',
    shortName: 'Espículas de Superfície',
    colorHex: '#C46334',
    layerScale: 'Superfície Viral • Projeções de ~8–12 nm',
    isOuter: true,
    explodeOffset: [-0.68, -0.18, -0.48],
    labelAnchor: [-0.74, 1.05, -0.45],
    focusPoint: [-0.22, 0.28, -0.12],
    biology:
      'Complexos proteicos tubulares e glicoproteínas ancoradas na superfície do vírion. Medeiam a ligação inicial aos receptores de glicosaminoglicanos da célula-alvo e coordenam o processo de fusão de membranas.',
    publicHealth:
      'Constituem os principais alvos para anticorpos neutralizantes induzidos pela infecção ou por vacinas contra Orthopoxvirus (como a vacina de 3ª geração MVA-BN). A alta conservação estrutural explica a imunidade cruzada com a varíola.',
  },
  {
    id: 'inner_membrane',
    name: 'Membrana Interna (Vírion Maduro MV)',
    shortName: 'Membrana Interna',
    colorHex: '#3B74A6',
    layerScale: 'Vírion Intracelular Maduro • ~270 × 180 × 150 nm',
    isOuter: true,
    explodeOffset: [-0.34, -0.08, -0.24],
    labelAnchor: [0.14, 0.86, 0.86],
    focusPoint: [0.05, 0.22, 0.22],
    biology:
      'Membrana lipoproteica primária que envolve o Vírion Intracelular Maduro (MV). Abriga o complexo proteico de entrada/fusão viral e confere elevada resistência física e ambiental à partícula após a ruptura da célula infectada.',
    publicHealth:
      'O MV representa a maioria das partículas produzidas na infecção e é o principal responsável pela transmissão entre pessoas por contato direto com lesões de pele, mucosas ou fômites contaminados (roupas de cama e toalhas).',
  },
  {
    id: 'lateral_bodies',
    name: 'Corpos Laterais',
    shortName: 'Corpos Laterais',
    colorHex: '#C28D38',
    layerScale: 'Estruturas Pareadas • ~75 × 55 × 28 nm (cada)',
    isOuter: false,
    explodeOffset: [0, 0, 0],
    labelAnchor: [0.16, 0.49, 0.26],
    focusPoint: [0.05, 0.16, 0.08],
    biology:
      'Duas massas proteicas densas e granulares acomodadas nas concavidades superior e inferior da "cintura" do núcleo bicôncavo. Atuam como compartimentos de entrega rápida de proteínas efetoras logo após a entrada do vírus na célula.',
    publicHealth:
      'Transportam proteínas imunomoduladoras (como a fosfatase viral H1) que bloqueiam precocemente a sinalização de interferon da célula hospedeira, atrasando a resposta imune inata no início da infecção.',
  },
  {
    id: 'palisade_layer',
    name: 'Camada Paliçada',
    shortName: 'Camada Paliçada',
    colorHex: '#6E568E',
    layerScale: 'Revestimento do Núcleo • Espessura ~10–15 nm',
    isOuter: false,
    explodeOffset: [0, 0, 0],
    labelAnchor: [-0.98, 0.34, 0.62],
    focusPoint: [-0.24, 0.08, 0.16],
    biology:
      'Revestimento proteico espesso com organização regular em estrias radiais (semelhante a uma cerca/paliçada). Envolve toda a face externa do núcleo bicôncavo, garantindo integridade mecânica durante o tráfego intracelular.',
    publicHealth:
      'Em microscopia eletrônica de transmissão (TEM), a camada paliçada estriada ao redor do núcleo em haltere é uma assinatura morfológica clássica utilizada por laboratórios de referência para identificar Orthopoxvirus.',
  },
  {
    id: 'biconcave_core',
    name: 'Núcleo Bicôncavo (Formato de Haltere)',
    shortName: 'Núcleo Bicôncavo',
    colorHex: '#A6445B',
    layerScale: 'Core Central • ~220 × 125 × 80 nm',
    isOuter: false,
    explodeOffset: [0.24, 0.06, 0.24],
    labelAnchor: [0.92, -0.22, 0.56],
    focusPoint: [0.24, -0.05, 0.14],
    biology:
      'Compartimento central característico em formato de haltere ou amendoim. Além de proteger o genoma viral, empacota enzimas essenciais próprias (como a RNA polimerase DNA-dependente) para iniciar a transcrição imediatamente no citoplasma.',
    publicHealth:
      'Diferentemente da maioria dos vírus de DNA, os poxvírus realizam todo o ciclo replicativo no citoplasma graças às enzimas desse núcleo — um alvo estratégico para pesquisas com antivirais como tecovirimat e cidofovir.',
  },
  {
    id: 'dna_genome',
    name: 'Genoma de DNA Fita Dupla Linear',
    shortName: 'Genoma de DNA',
    colorHex: '#1E6FA8',
    layerScale: 'dsDNA Linear • ~197 kilobases (~190 genes)',
    isOuter: false,
    explodeOffset: [0.62, 0.22, 0.62],
    labelAnchor: [0.45, 0.08, 0.44],
    focusPoint: [0.18, 0.04, 0.15],
    biology:
      'Uma única molécula linear de DNA fita dupla com extremidades fechadas em alça (hairpin), codificando cerca de 190 proteínas. A região central guarda genes essenciais conservados, enquanto as extremidades determinam virulência e adaptação ao hospedeiro.',
    publicHealth:
      'O diagnóstico confirmatório da mpox é feito por PCR em tempo real sobre regiões específicas desse DNA. O sequenciamento genômico diferencia o Clado I (historicamente mais grave, incluindo o subclado Ib) do Clado II (associado ao surto global de 2022, subclado IIb).',
  },
];
