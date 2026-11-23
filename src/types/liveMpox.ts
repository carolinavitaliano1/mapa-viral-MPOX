import { BrazilSurveillanceNode } from '../data/mpoxTimeline';

export interface CountryLiveStats {
  location: string;
  isoCode: string;
  date: string;
  totalCases: number;
  totalDeaths: number;
  newCases: number;
  newCasesSmoothed: number;
  totalCasesPerMillion: number;
  fatalityPct: number;
  estimatedPopulation: number | null;
}

export interface MonthlyTrendPoint {
  month: string; // YYYY-MM
  label: string; // ex: "Jan/25"
  globalNewCases: number;
  brazilNewCases: number;
}

export interface LiveMpoxSnapshot {
  fetchedAt: string;
  sourceName: string;
  sourceUrl: string;
  sourceLastModified: string | null;
  global: CountryLiveStats;
  brazil: CountryLiveStats;
  countries: Record<string, CountryLiveStats>;
  topCountries: CountryLiveStats[];
  monthlyTrend: MonthlyTrendPoint[];
}

export interface LiveUfNode extends BrazilSurveillanceNode {
  cases: number;
  population: number;
  deaths: number;
}

export interface CustomFeedMeta {
  kind: 'reference' | 'remote' | 'local';
  label: string;
  url?: string;
  updatedAt: string;
  rowCount: number;
}

export type AutoRefreshMode = 'off' | '5m' | '15m';
