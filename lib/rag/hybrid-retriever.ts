import type { Source } from '../knowledge';
import { hybridSearch, type RetrievalFilter } from './hybrid-search';

export type QueryIntent = RetrievalFilter & {
  equipment_type?: 'locomotive' | 'dozer' | 'hauler' | 'winder' | 'flp_switchgear' | 'continuous_miner' | 'sdl_lhd';
  hazard_category?: 'spontaneous_combustion' | 'gas_ventilation' | 'strata_roof' | 'inundation' | 'electrical' | 'machinery';
  mandatoryTerms: string[];
};

const intents: [keyof QueryIntent, RegExp, string[]][] = [
  ['method', /\b(underground|belowground|u\/g|shaft|stope|gallery|goaf|depillaring)\b/i, []],
  ['method', /\b(opencast|open[\s-]cast|open pit|quarry|ocp|bench|highwall)\b/i, []],
  ['sector', /\b(metal|metalliferous|copper|gold|zinc|lead|iron ore|granite|stone)\b/i, []],
  ['sector', /\b(coal|colliery|coking|cmr|goaf|continuous miner)\b/i, []],
  ['equipment_type', /\b(locomotive|locomotives|haulage)\b/i, ['locomotive', 'haulage']],
  ['equipment_type', /\b(dozer|bulldozer)\b/i, ['dozer']],
  ['equipment_type', /\b(dumper|truck|tipper|hauler)\b/i, ['dumper', 'hauler']],
  ['equipment_type', /\b(winder|winding|hoist|rope)\b/i, ['winder', 'winding', 'rope']],
  ['equipment_type', /\b(flp|flameproof|feeler gauge|gap tolerance|gap testing)\b/i, ['flp', 'flameproof', 'feeler gauge', 'gap']],
  ['equipment_type', /\b(continuous miner|cutter drum)\b/i, ['continuous miner', 'cutter drum']],
  ['equipment_type', /\b(sdl|lhd|load haul dump)\b/i, ['sdl', 'lhd', 'load haul dump']],
  ['hazard_category', /\b(goaf|spontaneous combustion|heating|heating warning|sealed goaf)\b/i, ['goaf', 'heating', 'spontaneous']],
  ['hazard_category', /\b(methane|firedamp|fire damp|gas|ventilation|auxiliary fan|recirculation)\b/i, ['methane', 'firedamp', 'ventilation', 'auxiliary fan', 'recirculation']],
  ['hazard_category', /\b(rockburst|rock burst|roof|strata|fall of ground|highwall)\b/i, ['rockburst', 'roof', 'strata']],
  ['hazard_category', /\b(waterlogged|water[\s-]logged|inrush|inundation|old workings)\b/i, ['waterlogged', 'inrush', 'inundation']],
  ['hazard_category', /\b(electrical|electric|short circuit|switchgear|cable|flp)\b/i, ['electrical', 'switchgear', 'cable']],
  ['hazard_category', /\b(machinery|conveyor|feeder|locomotive|haulage|continuous miner|sdl|lhd)\b/i, ['machinery', 'conveyor', 'feeder']],
];

export function classifyQueryIntent(question: string): QueryIntent {
  const intent: QueryIntent = { mandatoryTerms: [] };
  for (const [field, pattern, terms] of intents) {
    if (!pattern.test(question)) continue;
    if (field === 'method' && !intent.method) intent.method = pattern.test('underground') ? 'underground' : 'opencast';
    if (field === 'sector' && !intent.sector) intent.sector = pattern.test('metal') ? 'non_coal_metal' : 'coal';
    if (field === 'equipment_type' && !intent.equipment_type) {
      intent.equipment_type = terms[0] as QueryIntent['equipment_type'];
    }
    if (field === 'hazard_category' && !intent.hazard_category) {
      intent.hazard_category = terms[0] === 'goaf' || terms[0] === 'heating'
        ? 'spontaneous_combustion'
        : terms[0] === 'methane' || terms[0] === 'firedamp' || terms[0] === 'ventilation'
          ? 'gas_ventilation'
          : terms[0] === 'rockburst' || terms[0] === 'roof' || terms[0] === 'strata'
            ? 'strata_roof'
            : terms[0] === 'waterlogged' || terms[0] === 'inrush'
              ? 'inundation'
              : terms[0] === 'electrical' || terms[0] === 'switchgear'
                ? 'electrical'
                : 'machinery';
    }
    intent.mandatoryTerms.push(...terms);
  }
  return { ...intent, mandatoryTerms: [...new Set(intent.mandatoryTerms)] };
}

export function retrieveHybrid(question: string, sector: 'all' | 'coal' | 'noncoal' = 'all', limit = 6, fireOnly = false): Source[] {
  const intent = classifyQueryIntent(question);
  const filters: RetrievalFilter = {
    method: intent.method,
    sector: intent.sector,
    domain: intent.domain,
    equipment_type: intent.equipment_type,
    hazard_category: intent.hazard_category,
  };
  const candidates = hybridSearch(question, sector, Math.max(limit * 3, 12), fireOnly, filters);
  const technical = intent.mandatoryTerms.length > 0;
  const exact = (source: Source) => {
    const haystack = `${source.title} ${source.category} ${source.text} ${source.inquiry || ''}`.toLowerCase();
    return intent.mandatoryTerms.filter(term => haystack.includes(term.toLowerCase())).length;
  };
  const relevant = technical
    ? candidates.filter(source => exact(source) > 0 && source.score >= 0.008)
    : candidates.filter(source => source.score >= 0.008);
  return relevant.slice(0, limit);
}
