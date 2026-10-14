import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.TEST_URL || 'http://127.0.0.1:5173';
const tests = [
    ['Why did a wiper motor used inside a diesel tank cause a fire?', 'C-2016-29'],
    ['What happened in the Khadia fuel tank repair fire?', 'C-2016-29'],
    ['Cabin short circuit with extra battery wiring joints', 'C-2020-28'],
    ['Jampalli electrical fire prevention', 'C-2020-28'],
    ['Water tanker overturning while fighting a coal dump fire', 'C-2016-40'],
    ['Chirimiri burning bank firefighting worker', 'C-2017-49'],
    ['Worker moving a hose fell into hot ash', 'C-2022-18'],
    ['Lamp room match ignited a fuel soaked cloth', 'C-2022-24'],
    ['A dozer fell into an old fiery waterlogged gallery', 'C-2016-67'],
    ['Two workers drowned escaping the Oil India fire', 'N-2020-27'],
    ['Ahmedabad workover fire gas separation and supervision', 'N-2019-31'],
    ['Burning coal bank broke an excavator front glass at ROCP', 'C-2022-05'],
    ['Selected Dhori burning bank excavator fire', 'C-2022-17'],
    ['Bhowra pump crew hot strata during rain', 'C-2022-07'],
    ['Nigahi dumper collision diesel tank fire', 'C-2019-14'],
    ['Salanpur dozer rollover fire', 'C-2016-58'],
    ['Bangwar roof support steel chock sandstone fell', 'C-2016-01'],
    ['diesel tank mein pump se aag kyun lagi', 'C-2016-29'],
];
const results = [];
for (const [q, id] of tests) {
    const r = await fetch(base + '/api/source?q=' + encodeURIComponent(q));
    assert.equal(r.status, 200);
    const d = await r.json();
    const rank = d.sources.findIndex(s => s.id === id) + 1;
    results.push({ question: q, expected: id, rank, top: d.sources.slice(0, 3).map(s => s.id) });
}
async function chat(body) { const r = await fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json() }; }
for (const [q, mode] of [['There is a fire right now, help', 'emergency'], ['What is the current legal gas limit in 2026?', 'not_found'], ['Tell me the bitcoin price', 'not_found'], ['zzqxwvb florbledazzle', 'not_found']]) {
    const r = await chat({ question: q });
    assert.equal(r.status, 200);
    assert.equal(r.data.mode, mode, q);
    assert.equal(r.data.sources.length, 0);
}
const invalid = await chat({ question: '' });
assert.equal(invalid.status, 400);
const tooLong = await chat({ question: 'x'.repeat(1900) });
assert.equal(tooLong.status, 400);
const browserKey = await chat({ question: 'Khadia fire', apiKey: 'client-override-not-real' });
assert.equal(browserKey.status, 400);
const invalidModel = await chat({ question: 'Khadia fire', model: '../../private' });
assert.equal(invalidModel.status, 400);
const c = await chat({ question: 'Why did the Khadia fuel fire happen?' });
assert.equal(c.data.mode, 'book');
assert.ok(!/gemini|apiKey|serverGemini/i.test(JSON.stringify(c.data)));
assert.ok(c.data.sources.some(s => s.id === 'C-2016-29'));
assert.ok(c.data.findings.every(f => f.citations.every(id => c.data.sources.some(s => s.id === id))));
const filtered = await fetch(base + '/api/source?q=' + encodeURIComponent('fire gas well workover') + '&sector=noncoal').then(r => r.json());
assert.ok(filtered.sources.length);
assert.ok(filtered.sources.every(s => s.sector === 'noncoal'));
const briefing = await chat({ question: 'Prepare a first week fire briefing', briefing: true, profile: { name: 'Training mine', sector: 'coal', method: 'Opencast', conditions: 'burning dump and diesel equipment' } });
assert.ok(briefing.data.actions.length > 0);
assert.ok(briefing.data.sources.every(s => s.sector === 'coal' && s.fire));
const missing = await fetch(base + '/api/source?id=missing');
assert.equal(missing.status, 404);
const cross = await fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' }, body: JSON.stringify({ question: 'fire causes' }) });
assert.ok([400, 403].includes(cross.status));
const library = await fetch(base + '/api/library').then(r => r.json());
assert.ok(!('serverGemini' in library));
assert.ok(!/gemini|apiKey/i.test(JSON.stringify(library.manifest)));
assert.equal(library.catalog.length, 622);
assert.equal(library.catalog.filter(c => c.fire).length, 14);
assert.equal(library.manifest.pages, 671);
for (const name of ['SANKET_Coal.pdf', 'SANKET_NonCoal.pdf']) {
    const r = await fetch(base + '/sources/' + name, { method: 'HEAD' });
    assert.equal(r.status, 200);
}
const hits = results.filter(x => x.rank > 0).length, top1 = results.filter(x => x.rank === 1).length;
const report = { created: new Date().toISOString(), scope: '18 development retrieval checks plus API, filtering and safety-boundary checks. Not an independent field-safety evaluation.', retrieval: { queries: results.length, hitAt6: hits / results.length, top1: top1 / results.length }, results, apiChecks: 'passed', geminiLive: 'Not tested: a user API key has not been supplied.' };
await fs.mkdir('work', { recursive: true });
await fs.writeFile('work/evaluation.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
assert.ok(hits >= 17, 'Expected at least 17 of 18 known cases in top 6');
