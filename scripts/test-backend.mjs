import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadTypeScript } from './test-support.mjs';

const { POST } = loadTypeScript('app/api/chat/route.ts');
const { GET } = loadTypeScript('app/api/source/route.ts');
const { search, bookAnswer, defaultProfile, retrievalQuestion, getSource } = loadTypeScript('lib/knowledge.ts');
const { classifyQueryIntent, retrieveHybrid } = loadTypeScript('lib/rag/hybrid-retriever.ts');
const { readBody } = loadTypeScript('lib/request.ts');
const originalKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;
const originalFetch = globalThis.fetch;
const ask = async (body, headers = {}) => {
  const result = await POST(new Request('http://localhost/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  }));
  return { status: result.status, body: await result.json() };
};
let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log(`PASS ${name}`); };
try {
  process.env.GEMINI_API_KEY = '';
  process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite';
  globalThis.fetch = async () => assert.fail('Book-mode checks must not make an external request');

  await check('follow-up retrieval retains the original case across two follow-ups', async () => {
    const history = [
      { role: 'user', text: 'Why did the Khadia fuel tank fire happen?' },
      { role: 'assistant', text: 'The inquiry identified unsuitable repair equipment.' },
      { role: 'user', text: 'Why was that unsafe?' },
      { role: 'assistant', text: 'Review the cited fuel-system repair inquiry.' },
    ];
    const question = 'How can we prevent it?';
    assert.match(retrievalQuestion(question, history), /Khadia/);
    const answer = await ask({ question, history });
    assert.equal(answer.status, 200);
    assert.equal(answer.body.mode, 'book');
    assert.equal(answer.body.sources[0].id, 'C-2016-29');
    assert.match(answer.body.findings.map(finding => finding.text).join(' '), /inquiry finding/);
    assert.equal(retrievalQuestion('Tell me about the Jampalli electrical fire', history), 'Tell me about the Jampalli electrical fire');
  });
  await check('historical inquiry extracts are findings, not proposed actions', () => {
    const source = getSource('C-2016-01');
    const answer = bookAnswer('Bangwar roof fall', [source], defaultProfile);
    assert.equal(answer.actions.length, 0);
    assert.ok(answer.findings.some(finding => finding.text.includes('historical inquiry extract: Had,')));
    assert.ok(answer.findings.every(finding => finding.citations.every(id => answer.sources.some(source => source.id === id))));
  });
  await check('specific named-mine questions exclude weak same-name cases', () => {
    const question = 'Why did the Khadia fuel-tank fire happen, and how could it have been prevented?';
    const answer = bookAnswer(question, search(question, 'all', 7), defaultProfile);
    assert.deepEqual(answer.sources.map(source => source.id), ['C-2016-29']);
    assert.ok(answer.findings.every(finding => finding.citations.includes('C-2016-29')));
  });
  await check('technical machinery and gas queries prioritize matching case categories', () => {
    const winding = search('winding engine safety rope snaps overwind safety catch', 'all', 3);
    assert.equal(winding[0].id, 'N-2022-15');
    assert.equal(winding[0].kind, 'case');
    const cable = search('trailing cable electrical fire insulation short circuit', 'all', 3);
    assert.ok(cable.some(source => ['N-2019-29', 'C-2021-32', 'C-2019-28'].includes(source.id)));
    const gas = search('methane firedamp exceeding 1.25 percent gas monitoring', 'coal', 3);
    assert.ok(gas.some(source => ['C-2018-42', 'C-2016-56'].includes(source.id)));
  });
  await check('technical intent applies strict context and returns a clean gap', () => {
    assert.deepEqual(classifyQueryIntent('underground locomotive machinery'), {
      method: 'underground', equipment_type: 'locomotive', hazard_category: 'machinery',
      mandatoryTerms: ['locomotive', 'haulage', 'machinery', 'conveyor', 'feeder'],
    });
    assert.deepEqual(retrieveHybrid('FLP switchgear gap tolerances', 'all', 3), []);
  });
  await check('strict body schema rejects all browser credential overrides', async () => {
    for (const extra of [
      { apiKey: 'browser-key' }, { model: 'browser-model' },
      { profile: { ...defaultProfile, apiKey: 'nested-browser-key' } },
      { history: [{ role: 'user', text: 'fire', model: 'nested-model' }] },
    ]) assert.equal((await ask({ question: 'Khadia fire', ...extra })).status, 400);
  });
  await check('request origin, media type and byte limits', async () => {
    assert.equal((await ask({ question: 'Khadia fire' }, { Origin: 'https://untrusted.example' })).status, 403);
    assert.equal((await ask({ question: 'Khadia fire' }, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await ask({ question: 'Khadia fire' }, { 'Content-Length': '24001' })).status, 413);
    let cancelled = false;
    const stream = new ReadableStream({
      pull(controller) { controller.enqueue(new TextEncoder().encode('अ'.repeat(9000))); },
      cancel() { cancelled = true; },
    });
    await assert.rejects(() => readBody(new Request('http://localhost/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half',
    })), error => error.status === 413);
    assert.equal(cancelled, true, 'An over-limit stream must be stopped without reading the rest');
    await assert.rejects(() => readBody(new Request('http://localhost/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid',
    })), error => error.status === 400);
  });
  await check('source lookup validates sector and query length', async () => {
    for (const query of ['sector=unknown&q=fire', `q=${'a'.repeat(1801)}`]) {
      assert.equal((await GET(new Request(`http://localhost/api/source?${query}`))).status, 400);
    }
    const response = await GET(new Request('http://localhost/api/source?id=missing'));
    assert.equal(response.status, 404);
    assert.deepEqual(search('fire', 'unknown'), []);
    assert.deepEqual(search('fire', 'all', 0), []);
  });
  await check('briefing evidence remains within the reviewed fire subset and sector', async () => {
    for (const sector of ['coal', 'noncoal']) {
      const result = await ask({ question: 'Prepare a first week fire briefing', briefing: true, profile: { ...defaultProfile, sector } });
      assert.equal(result.status, 200);
      assert.ok(result.body.sources.length);
      assert.ok(result.body.actions.length);
      assert.ok(result.body.sources.every(source => source.fire && source.sector === sector));
    }
  });
  await check('emergency, current-rule and unsupported questions abstain from case answers', async () => {
    for (const [question, mode] of [
      ['There is a fire right now, help', 'emergency'],
      ['What is the latest legal gas limit?', 'not_found'],
      ['Tell me the bitcoin price', 'not_found'],
      ['zzqxwvb florbledazzle', 'not_found'],
    ]) {
      const result = await ask({ question });
      assert.equal(result.body.mode, mode);
      assert.equal(result.body.sources.length, 0);
    }
  });
  await check('general questions reach Gemini without unrelated book matches', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    try {
      for (const question of ['thinks to keep in mind when visiting mine', 'things to keep in mind when visiting mine', 'What should a visitor know before a mine visit?']) {
        assert.deepEqual(search(question), []);
        let called = false;
        globalThis.fetch = async (_url, init) => {
          called = true;
          const body = JSON.parse(init.body);
          assert.deepEqual(JSON.parse(body.contents[0].parts[0].text).evidence, []);
          return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({
            title: 'Preparing for a mine visit', lead: 'Attend the site induction and remain with your authorized escort.',
            actions: [{ text: 'General guidance: confirm the required PPE with the site before arriving.', citations: [] }], findings: [], questions: [],
          }) }] } }] }));
        };
        const result = await ask({ question });
        assert.ok(called);
        assert.equal(result.body.mode, 'synthesis');
        assert.equal(result.body.sources.length, 0);
      }
      globalThis.fetch = async () => new Response('', { status: 429 });
      const failed = await ask({ question: 'things to keep in mind when visiting mine' });
      assert.match(failed.body.notice, /usage limit/);
      assert.equal(failed.body.findings.length, 0);
    } finally { process.env.GEMINI_API_KEY = ''; }
  });
  await check('corpus, model and source-page references agree', () => {
    const documents = JSON.parse(fs.readFileSync('data/documents.json', 'utf8'));
    const model = JSON.parse(fs.readFileSync('data/retrieval-model.json', 'utf8'));
    const manifest = JSON.parse(fs.readFileSync('data/manifest.json', 'utf8'));
    const catalog = JSON.parse(fs.readFileSync('data/catalog.json', 'utf8'));
    assert.equal(documents.length, manifest.chunks);
    assert.equal(new Set(documents.map(document => document.id)).size, documents.length);
    assert.equal(model.vectors.length, documents.length);
    assert.equal(model.lengths.length, documents.length);
    assert.equal(model.vocabulary.length, model.projection.length);
    assert.equal(model.vocabulary.length, model.idf.length);
    assert.ok(model.vectors.every(vector => vector.length === manifest.dimensions));
    assert.ok(model.projection.every(vector => vector.length === manifest.dimensions));
    assert.equal(catalog.length, manifest.cases);
    assert.equal(documents.filter(document => document.fire).length, manifest.fireCases);
    assert.equal(documents.filter(document => document.fire).reduce((sum, document) => sum + document.deaths, 0), manifest.fireDeaths);
    for (const document of documents) {
      const book = manifest.books.find(book => book.id === document.sector);
      assert.ok(book && document.page >= 1 && document.endPage >= document.page && document.endPage <= book.pages, document.id);
      assert.ok(getSource(document.id).url.endsWith(`#page=${document.page}`), document.id);
    }
  });
  console.log(`${checks} backend regression groups passed. Corpus reference checks do not establish factual entailment or current site safety.`);
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = originalModel;
}
