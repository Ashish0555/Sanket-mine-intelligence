import type { Source } from '../knowledge';
import { search } from '../knowledge';

export type MineMethod = 'underground' | 'opencast';
export type MineSector = 'coal' | 'non_coal_metal';
export type RegulationDomain = 'ventilation' | 'blasting' | 'strata_roof' | 'machinery_chp' | 'hauling';

export type RetrievalFilter = {
  method?: MineMethod;
  sector?: MineSector;
  domain?: RegulationDomain;
  equipment_type?: string;
  hazard_category?: string;
};

type Ranked = { source: Source; rank: number; exact: number };

const methodPatterns: [MineMethod, RegExp][] = [
  ['underground', /\b(underground|belowground|u\/g|shaft|stope|drift|gallery|depillaring|bord(?:er)?\s+and\s+pillar)\b/i],
  ['opencast', /\b(opencast|open[\s-]cast|open pit|quarry|o\/c|ocp|bench|highwall|haul road|dump slope)\b/i],
];
const sectorPatterns: [MineSector, RegExp][] = [
  ['non_coal_metal', /\b(metal|metalliferous|copper|gold|zinc|lead|iron ore|granite|marble|stone|quarry)\b/i],
  ['coal', /\b(coal|colliery|coking|depillaring|longwall|cmr)\b/i],
];
const domainPatterns: [RegulationDomain, RegExp][] = [
  ['ventilation', /\b(ventilation|air current|airflow|recirculation|auxiliary fan|methane|firedamp|gas|dust)\b/i],
  ['blasting', /\b(blast|blasting|flyrock|fly rock|misfire|explosive|stemming|shot[\s-]?firer)\b/i],
  ['strata_roof', /\b(rockburst|rock burst|roof|strata|fall of ground|highwall|slope stability|support)\b/i],
  ['machinery_chp', /\b(conveyor|crusher|feeder|winder|winding|rope|trailing cable|lhd|sdl|machinery|chp)\b/i],
  ['hauling', /\b(dumper|truck|tipper|haul road|collision|vehicle|parking|runaway)\b/i],
];
const equipmentPatterns: [string, RegExp][] = [
  ['locomotive', /\b(locomotive|haulage)\b/i],
  ['dozer', /\b(dozer|bulldozer)\b/i],
  ['hauler', /\b(dumper|truck|tipper|hauler)\b/i],
  ['winder', /\b(winder|winding|hoist|rope)\b/i],
  ['flp_switchgear', /\b(flp|flameproof|switchgear|feeler gauge|gap tolerance)\b/i],
  ['continuous_miner', /\b(continuous miner|cutter drum)\b/i],
  ['sdl_lhd', /\b(sdl|lhd|load haul dump)\b/i],
];
const hazardPatterns: [string, RegExp][] = [
  ['spontaneous_combustion', /\b(goaf|spontaneous combustion|heating|sealed goaf)\b/i],
  ['gas_ventilation', /\b(methane|firedamp|fire damp|gas|ventilation|auxiliary fan|recirculation)\b/i],
  ['strata_roof', /\b(rockburst|rock burst|roof|strata|fall of ground|highwall)\b/i],
  ['inundation', /\b(waterlogged|water[\s-]logged|inrush|inundation|old workings)\b/i],
  ['electrical', /\b(electrical|electric|short circuit|switchgear|cable|flp)\b/i],
  ['machinery', /\b(machinery|conveyor|feeder|locomotive|haulage|continuous miner|sdl|lhd)\b/i],
];

const lexicalTerms: Record<string, string[]> = {
  'regulation 164': ['regulation 164', 'reg. 164', '164', 'blasting'],
  'auxiliary fan': ['auxiliary fan', 'ventilation', 'recirculation', 'air current'],
  recirculation: ['recirculation', 'airflow', 'ventilation', 'auxiliary fan'],
  rockburst: ['rockburst', 'rock burst', 'seismic', 'deep metal', 'ground pressure'],
  flyrock: ['flyrock', 'fly rock', 'blasting', 'explosive', 'stemming'],
  misfire: ['misfire', 'misfired', 'explosive', 'shot-firer', 'blasting'],
  conveyor: ['conveyor', 'belt', 'nip point', 'pull cord', 'machinery'],
  'trailing cable': ['trailing cable', 'insulation', 'earth leakage', 'short circuit'],
};

function inferredFilter(question: string): RetrievalFilter {
  const filter: RetrievalFilter = {};
  const method = methodPatterns.find(([, pattern]) => pattern.test(question));
  const sector = sectorPatterns.find(([, pattern]) => pattern.test(question));
  const domain = domainPatterns
    .map(([value, pattern]) => [value, pattern.test(question) ? 1 : 0] as const)
    .sort((a, b) => b[1] - a[1])[0];
  if (method) filter.method = method[0];
  if (sector) filter.sector = sector[0];
  if (domain?.[1]) filter.domain = domain[0];
  return filter;
}

export function classifySource(source: Source): RetrievalFilter {
  const text = `${source.title} ${source.category} ${source.text} ${source.inquiry || ''}`;
  return {
    method: methodPatterns.find(([, pattern]) => pattern.test(text))?.[0],
    sector: source.sector === 'coal' ? 'coal' : 'non_coal_metal',
    domain: domainPatterns.find(([, pattern]) => pattern.test(text))?.[0],
    equipment_type: equipmentPatterns.find(([, pattern]) => pattern.test(text))?.[0],
    hazard_category: hazardPatterns.find(([, pattern]) => pattern.test(text))?.[0],
  };
}

function passesFilter(source: Source, filter: RetrievalFilter) {
  const metadata = classifySource(source);
  return (!filter.method || metadata.method === filter.method) &&
    (!filter.sector || metadata.sector === filter.sector) &&
  (!filter.domain || metadata.domain === filter.domain) &&
  (!filter.equipment_type || metadata.equipment_type === filter.equipment_type) &&
  (!filter.hazard_category || metadata.hazard_category === filter.hazard_category);
}

function exactMatches(source: Source, question: string) {
  const haystack = `${source.title} ${source.category} ${source.text} ${source.inquiry || ''}`.toLowerCase();
  const terms = Object.entries(lexicalTerms)
    .filter(([term]) => question.toLowerCase().includes(term))
    .flatMap(([, values]) => values);
  return terms.filter(term => haystack.includes(term)).length;
}

function rankWithRrf(results: Source[], filter: RetrievalFilter): Ranked[] {
  return results.filter(source => passesFilter(source, filter)).map((source, index) => ({
    source,
    rank: 1 / (60 + index + 1),
    exact: 0,
  }));
}

export function hybridSearch(question: string, sector = 'all', limit = 6, fireOnly = false, filter?: RetrievalFilter): Source[] {
  const inferred = inferredFilter(question);
  const effective: RetrievalFilter = { ...inferred, ...filter };
  if (sector === 'coal') effective.sector = 'coal';
  if (sector === 'noncoal') effective.sector = 'non_coal_metal';

  // The existing LSA search supplies dense candidates. Re-running it with a
  // keyword-expanded query provides a lexical/BM25 candidate list using the
  // same indexed postings, while RRF prevents either signal dominating alone.
  const dense = search(question, sector, 20, fireOnly);
  const keywordQuery = Object.keys(lexicalTerms)
    .filter(term => question.toLowerCase().includes(term))
    .flatMap(term => lexicalTerms[term])
    .join(' ');
  const lexical = search(`${question} ${keywordQuery}`, sector, 20, fireOnly);
  const fused = new Map<string, Ranked>();
  for (const result of [...rankWithRrf(dense, effective), ...rankWithRrf(lexical, effective)]) {
    const current = fused.get(result.source.id);
    if (current) {
      current.rank += result.rank;
      current.exact = Math.max(current.exact, exactMatches(result.source, question));
    } else {
      result.exact = exactMatches(result.source, question);
      fused.set(result.source.id, result);
    }
  }
  return [...fused.values()]
    .sort((a, b) => (b.exact - a.exact) || (b.rank - a.rank))
    .slice(0, limit)
    .map((result, index) => ({ ...result.source, score: Math.round((result.rank + result.exact * .01) * 1000) / 1000 - index * 0.0001 }));
}

export { inferredFilter };
