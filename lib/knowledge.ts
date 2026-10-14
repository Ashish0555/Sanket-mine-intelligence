import documents from '../data/documents.json';
import rawModel from '../data/retrieval-model.json';
import manifest from '../data/manifest.json';
export type MineProfile = {
    name: string;
    sector: 'all' | 'coal' | 'noncoal';
    method: string;
    conditions: string;
};
export type Passage = {
    id: string;
    kind: string;
    sector: string;
    title: string;
    page: number;
    endPage: number;
    printedPage?: number | null;
    text: string;
    event: string;
    category: string;
    fire: boolean;
    year?: number;
    date?: string;
    state?: string;
    scenario?: string;
    summary?: string;
    inquiry?: string;
    action?: string;
    deaths?: number | null;
};
export type Source = Passage & {
    score: number;
    reference: string;
    url: string;
};
type Model = {
    stopwords: string[];
    vocabulary: string[];
    idf: number[];
    projection: number[][];
    vectors: number[][];
    postings: Record<string, number[]>;
    lengths: number[];
    averageLength: number;
};
const docs = documents as Passage[], model = rawModel as Model;
const stops = new Set(model.stopwords), vocab = new Map(model.vocabulary.map((w, i) => [w, i]));
const byId = new Map(docs.map(document => [document.id, document]));
const genericNames = new Set(['project', 'colliery', 'collieries', 'limited', 'india', 'coal', 'area', 'north', 'south', 'east', 'west', 'mines', 'mine']);
export { manifest };
const expansions: [
    RegExp,
    string
][] = [
    [/\b(fires?|burning|aag)\b|आग|अग्नि/i, 'fire burning fiery heating ignition'],
    [/spontaneous|self.heating|स्वतः|garam/i, 'spontaneous heating coal oxidation fire'],
    [/\b(wiring|electric|electrical|bijli)\b|बिजली/i, 'electrical wiring circuit cable electrical maintenance isolation'],
    [/\b(truck|dumper|tipper|vehicle)\b/i, 'dumper tipper vehicle truck traffic'],
    [/\b(fuel|diesel|petrol|pump|refuel)\b/i, 'fuel diesel tank pump repair ignition'],
    [/\b(burning bank|hot ash|dump fire|fiery ground|highwall)\b/i, 'burning bank fiery hot strata coal dump slope'],
    [/\b(escape|evacuation|rescue|nikal|bachav)\b|बचाव|निकास/i, 'escape emergency evacuation route assembly'],
    [/\b(roof|rockfall|support|strata)\b|छत/i, 'roof support strata fall bolts'],
    [/\b(well|oil|workover|gas handling)\b/i, 'well workover gas separator hydrocarbon'],
    [/\b(first week|new officer|transferred|joining|checklist|briefing)\b/i, 'inspection supervision fire maintenance procedure emergency'],
    [/\b(karan|kyun|wajah)\b|कारण|क्यों/i, 'inquiry cause prevention'],
    [/\b(rok|bachne|safety)\b|रोक|सुरक्षा/i, 'prevention precautions supervision procedure'],
    [/\b(pani|flood|inundation)\b|पानी/i, 'water inundation flooding pumping'],
    [/\b(winding|winder|hoist|rope snap|rope break|overwind|safety catch|shaft cage)\b/i, 'winding engine winding rope shaft cage overwind brake safety catch rope clamp'],
    [/\b(trailing cable|coal cutter|sdl|lhd|insulation|short circuit|earth leakage|flameproof)\b/i, 'trailing cable insulation short circuit earth leakage coal cutter SDL LHD flameproof electrical protection'],
    [/\b(methane|firedamp|gas monitoring|gas detector|gas percentage|1\.25\s*%?|withdrawal on gas)\b/i, 'methane firedamp ventilation gas monitoring detector percentage power cut withdrawal'],
    [/\b(water[\s-]?logged|inrush|old workings|isolation stopping|barrier)\b/i, 'water logged workings inundation inrush isolation stopping barrier survey'],
];
const technicalTopics: { pattern: RegExp; terms: string[] }[] = [
    { pattern: /\b(winding|winder|hoist|rope snap|rope break|overwind|safety catch|shaft cage)\b/i, terms: ['winding', 'winder', 'hoist', 'rope', 'overwind', 'cage', 'shaft', 'brake', 'safety catch', 'rope clamp'] },
    { pattern: /\b(trailing cable|coal cutter|sdl|lhd|insulation|short circuit|earth leakage|flameproof)\b/i, terms: ['trailing cable', 'insulation', 'short circuit', 'earth leakage', 'coal cutter', 'sdl', 'lhd', 'flameproof'] },
    { pattern: /\b(methane|firedamp|gas monitoring|gas detector|gas percentage|1\.25\s*%?|withdrawal on gas)\b/i, terms: ['methane', 'firedamp', 'gas', 'ventilation', 'detector', 'power cut', 'withdrawal'] },
    { pattern: /\b(water[\s-]?logged|inrush|old workings|isolation stopping|barrier)\b/i, terms: ['waterlogged', 'water logged', 'inrush', 'old workings', 'isolation stopping', 'barrier'] },
];
export function tokenize(text: string) { return (text.toLowerCase().match(/[a-z][a-z0-9]{1,}/g) || []).filter(w => !stops.has(w)); }
export function expand(text: string) { return text + ' ' + expansions.filter(([r]) => r.test(text)).map(([, s]) => s).join(' '); }
function norm(v: number[]) { const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)); return n ? v.map(x => x / n) : v; }
function queryVector(tokens: string[]) {
    const counts = new Map<number, number>();
    for (const t of tokens) {
        const i = vocab.get(t);
        if (i !== undefined)
            counts.set(i, (counts.get(i) || 0) + 1);
    }
    const v = Array(64).fill(0) as number[];
    for (const [i, c] of counts) {
        const weight = (1 + Math.log(c)) * model.idf[i];
        for (let j = 0; j < 64; j++)
            v[j] += weight * model.projection[i][j];
    }
    return norm(v);
}
export function toSource(d: Passage, score = 0): Source {
    const label = d.sector === 'coal' ? 'Coal' : 'Non-coal';
    return { ...d, score: Math.round(score * 1000) / 1000, reference: `SANKET ${label} · PDF p. ${d.page}${d.endPage > d.page ? '–' + d.endPage : ''}`, url: `/sources/SANKET_${d.sector === 'coal' ? 'Coal' : 'NonCoal'}.pdf#page=${d.page}` };
}
export function getSource(id: string) { const d = byId.get(id); return d ? toSource(d) : null; }
export function retrievalQuestion(question: string, history: {
    role: string;
    text: string;
}[]) {
    if (!isFollowup(question))
        return question;
    const previous = history.filter(turn => turn.role === 'user');
    const context: string[] = [];
    for (let index = previous.length - 1; index >= 0; index--) {
        context.unshift(previous[index].text);
        if (!isFollowup(previous[index].text))
            break;
    }
    return [...context, question].join(' ');
}
function isFollowup(question: string) {
    return question.length < 180 && (/^(and\b|what about\b|why\b|how about\b|explain more\b|tell me more\b|which of\b|what should\b|और|क्यों)/i.test(question) || /\b(it|its|that|those|them|this case|same case)\b/i.test(question));
}
export function search(question: string, sector = 'all', limit = 6, fireOnly = false): Source[] {
    if (!['all', 'coal', 'noncoal'].includes(sector) || !Number.isInteger(limit) || limit < 1)
        return [];
    limit = Math.min(limit, 20);
    // Generic site/visit words do not identify a historical accident. Requiring
    // substantive query terms prevents a shared word like "mine" winning by itself.
    const genericQuery = new Set(['mine', 'mines', 'mining', 'visit', 'visiting', 'things', 'thinks', 'keep', 'mind', 'know', 'need', 'should', 'please']);
    const meaningful = tokenize(question).filter(word => !genericQuery.has(word));
    if (!meaningful.some(word => vocab.has(word)) && !expansions.some(([pattern]) => pattern.test(question)))
        return [];
    const enriched = expand(question), words = tokenize(enriched), unique = [...new Set(words)], original = [...new Set(tokenize(question))];
    if (!words.length)
        return [];
    const bm = new Float64Array(docs.length), matched = new Uint16Array(docs.length);
    for (const t of unique) {
        const post = model.postings[t];
        if (!post)
            continue;
        const idf = Math.log(1 + (docs.length - post.length / 2 + .5) / (post.length / 2 + .5));
        const weight = original.includes(t) ? 1 : .38;
        for (let p = 0; p < post.length; p += 2) {
            const i = post[p], tf = post[p + 1];
            bm[i] += weight * idf * (tf * 2.2) / (tf + 1.2 * (.25 + .75 * model.lengths[i] / model.averageLength));
            if (original.includes(t))
                matched[i]++;
        }
    }
    const vec = queryVector(words), max = Math.max(...bm) || 1;
    const topics = technicalTopics.filter(topic => topic.pattern.test(question));
    const ranked = docs.map((d, i) => {
        let cosine = 0;
        for (let j = 0; j < 64; j++)
            cosine += vec[j] * model.vectors[i][j];
        const titleTokens = tokenize(d.title);
        const named = titleTokens.length && titleTokens.some(t => t.length > 3 && !genericNames.has(t) && original.includes(t));
        const coverage = matched[i] / Math.max(1, original.length);
        let score = .66 * bm[i] / max + .24 * Math.max(0, cosine) + .10 * coverage;
        if (topics.length) {
            const haystack = `${d.title} ${d.category} ${d.text} ${d.inquiry || ''}`.toLowerCase();
            const topicMatches = topics.reduce((total, topic) => total + topic.terms.filter(term => haystack.includes(term)).length, 0);
            if (topicMatches)
                score += Math.min(.24, topicMatches * .04);
            else
                score *= .7;
        }
        if (d.kind === 'case')
            score *= 1.12;
        if (named && d.kind === 'case')
            score += .24;
        if (d.fire && /fire|burn|heating|aag|आग/i.test(question))
            score += .07;
        return { d, score, lexical: bm[i], cosine, matched: matched[i] };
    }).filter(x => (sector === 'all' || x.d.sector === sector) && (!fireOnly || x.d.fire) && x.lexical > 1.5 && (x.matched > 0 || x.cosine > .25));
    ranked.sort((a, b) => b.score - a.score);
    const selected: Source[] = [];
    for (const r of ranked) {
        if (r.score < .16)
            continue;
        // Separate cases may share a PDF page; only suppress overlapping page extracts.
        if (selected.some(s => (s.kind !== 'case' || r.d.kind !== 'case') && s.sector === r.d.sector && s.page <= r.d.endPage && r.d.page <= s.endPage))
            continue;
        selected.push(toSource(r.d, r.score));
        if (selected.length >= limit)
            break;
    }
    return selected;
}
export type Finding = {
    text: string;
    citations: string[];
};
export type Answer = {
    title: string;
    lead: string;
    findings: Finding[];
    actions: Finding[];
    questions: string[];
    sources: Source[];
    mode: string;
    notice?: string;
};
export const defaultProfile: MineProfile = { name: '', sector: 'all', method: 'Not specified', conditions: '' };
export function bookAnswer(question: string, sources: Source[], profile: MineProfile, briefing = false): Answer {
    if (!sources.length)
        return { title: 'The books do not give me enough evidence', lead: 'Try a mine name, a task, or a more specific hazard. I will not invent an answer or a current legal requirement.', findings: [], actions: [], questions: ['Which mine type, task and conditions are involved?'], sources: [], mode: 'not_found' };
    const cases = sources.filter(x => x.kind === 'case');
    const queryWords = tokenize(question);
    const named = cases.filter(s => tokenize(s.title).some(w => w.length >= 4 && !genericNames.has(w) && queryWords.includes(w)));
    const asksForSeveralCases = /\b(all|list|cases|accidents|incidents|history)\b/i.test(question);
    const focusedNamed = named.length && !asksForSeveralCases
        ? named.filter(source => source.score >= named[0].score * .72)
        : named;
    const useful = (focusedNamed.length && !briefing ? focusedNamed : cases.length ? cases : sources)
        .slice(0, briefing ? 5 : 3);
    const findings = useful.map(s => ({ text: `${s.title}${s.year ? ' (' + s.year + ')' : ''}: ${s.summary || s.event || excerpt(s.text, 650)}`, citations: [s.id] }));
    if (!briefing) {
        for (const source of useful) {
            const inquiry = source.inquiry || source.text.match(/\bHad[,\s][\s\S]*$/)?.[0];
            if (inquiry)
                findings.push({ text: `${source.title} — ${source.inquiry ? 'inquiry finding' : 'historical inquiry extract'}: ${excerpt(inquiry, 900)}`, citations: [source.id] });
        }
    }
    let actions = useful.filter(source => source.action).map(source => ({ text: source.action!, citations: [source.id] }));
    if (briefing) {
        const schedule: Record<string, string> = {
            'Fire-affected ground': 'Before field deployment — Mine manager and survey/ground team: verify the current plan, old workings and the authorized work location. Record the site assessment before exposing people or machines. ',
            'Vehicle / equipment fire': 'First shift — Engineering and shift supervisors: review repair methods, vehicle defects and fire-protection checks. Assign an owner to each open defect before release. ',
            'Firefighting task': 'Before fire-response work — Shift supervisor: review access, machine position, crew communication and withdrawal arrangements. Confirm competence and a crew briefing. ',
            'Oil workover fire': 'Before workover activation — Installation manager: verify the gas-handling arrangement and named direct supervision. Review the job procedure with the crew. ',
            'Escape from well fire': 'First week — Emergency coordinator: walk the designated escape routes, identify water and access hazards, and confirm assembly points and responsibilities. ',
            'Lamp-room fire': 'First shift — Workshop or lamp-room supervisor: check separation of ignition sources, fuel handling and contaminated materials. ',
        };
        const used = new Set<string>();
        actions = useful.filter(s => { if (!s.action || used.has(s.scenario || ''))
            return false; used.add(s.scenario || ''); return true; }).map(s => ({ text: (schedule[s.scenario || ''] || 'First week — Responsible supervisor: verify the relevant control and record any gap. ') + (s.action || s.inquiry || ''), citations: [s.id] }));
    }
    return { title: briefing ? 'Your first-week fire briefing' : 'What the SANKET evidence says',
        lead: briefing ? `A proposed starting plan${profile.name ? ' for ' + profile.name : ''}, with suggested owners and checks based on historical cases. ${profile.method === 'Underground' ? 'The confirmed fire case set is mainly surface work; it cannot establish an underground fire or ventilation plan.' : 'Confirm which conditions actually exist at your mine before applying these lessons.'}` : focusedNamed.length === 1 ? 'The event and inquiry below refer to the strongest matching named case. Open the citation to check the original account.' : 'These are retrieved case accounts and inquiry findings. Open a citation to check the original passage.',
        findings, actions, questions: briefing ? ['Where are active heating, old workings and unsafe ground marked on the current plan?', 'Who authorizes equipment repairs, fire response positions and withdrawal?', 'Which escape routes and fire-protection systems have been checked this shift?'] : ['Do these operating conditions match your mine, or should I narrow the search?'], sources: useful, mode: 'book', notice: 'Retrieved case evidence. Review the inquiry and confirm conditions at your mine.' };
}
function excerpt(s: string, n: number) { return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s; }
export function isEmergency(q: string) { return /(?:fire|smoke|trapped|burning|gas leak|आग|धुआं).{0,55}(?:right now|currently|now|help|अभी)|(?:right now|currently|emergency|अभी).{0,55}(?:fire|smoke|trapped|burning|gas leak|आग|धुआं)/i.test(q); }
export function emergencyAnswer(): Answer { return { title: 'Treat this as an emergency', lead: 'Raise the site alarm and contact the mine emergency control team immediately. Move to the designated safe area using the established escape route if it is safe to do so. Do not approach the fire or re-enter the affected area.', findings: [], actions: [], questions: [], sources: [], mode: 'emergency', notice: 'General immediate safety guidance. This assistant cannot assess live gas, ground, ventilation or escape conditions. Follow the site emergency plan and authorized responders.' }; }
export function isOutOfScope(q: string) { return /\b(cricket score|recipe|stock price|bitcoin|write.{0,15}(poem|romantic)|weather forecast|president of)\b/i.test(q) && !/(mine|mining|coal|sanket)/i.test(q); }
export function isCurrentLaw(q: string) { return /\b(current|latest|today|now|legal limit|mandatory limit|permissible limit)\b/i.test(q) && /\b(law|regulation|rule|limit|legal|permissible)\b/i.test(q); }
