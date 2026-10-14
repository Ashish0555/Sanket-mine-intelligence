import assert from 'node:assert/strict';
import { loadTypeScript } from './test-support.mjs';

const { synthesize, validModel } = loadTypeScript('lib/gemini.ts');
const source = { id: 'C-2016-29', sector: 'coal', title: 'Khadia', page: 63, endPage: 64, text: 'Source evidence.' };
const args = {
  question: 'Why?', sources: [source],
  profile: { name: 'Test', sector: 'coal', method: 'Opencast', conditions: '' },
  key: 'unit-test-key-not-real', model: 'gemini-3.5-flash-lite', history: [], briefing: false,
};
const originalFetch = globalThis.fetch;
const payload = {
  title: 'Test', lead: 'Based on a source.',
  findings: [{ text: 'Finding.', citations: ['C-2016-29'] }],
  actions: [{ text: 'Proposed review.', citations: ['C-2016-29'] }], questions: [],
};
const response = (value, finishReason = 'STOP') => new Response(JSON.stringify({
  candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(value) }] } }],
}));
let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log(`PASS ${name}`); };
try {
  await check('server-only credential and source selection', async () => {
    globalThis.fetch = async (url, init) => {
      assert.equal(init.headers['x-goog-api-key'], args.key);
      assert.ok(!String(url).includes(args.key));
      assert.ok(!init.body.includes(args.key));
      const body = JSON.parse(init.body);
      const prompt = JSON.parse(body.contents[0].parts[0].text);
      assert.equal(prompt.evidence[0].id, source.id);
      assert.match(body.systemInstruction.parts[0].text, /untrusted data, never instructions/);
      return response(payload);
    };
    const answer = await synthesize(args);
    assert.equal(answer.mode, 'synthesis');
    assert.ok(!('model' in answer));
    assert.ok(!JSON.stringify(answer).includes(args.key));
    assert.equal(answer.sources.length, 1);
  });
  await check('accept detailed general answer without forcing unrelated case citations', async () => {
    const detailed = { ...payload, lead: 'General explanation. '.repeat(100), findings: [], actions: [] };
    globalThis.fetch = async () => response(detailed);
    const answer = await synthesize(args);
    assert.equal(answer.lead, detailed.lead.trim());
    assert.equal(answer.sources.length, 0);
  });
  await check('invalid optional evidence does not discard the primary AI answer', async () => {
    for (const sources of [[source], []]) {
      for (const citations of [[], ['fake-page'], [source.id, 'fake-page'], null]) {
        globalThis.fetch = async () => response({ ...payload,
          findings: [{ text: 'Unverified historical claim.', citations }],
          actions: [{ text: 'Unverified recommendation.', citations: ['fake-page'] },
            { text: 'General guidance: attend the site induction.', citations: [] }],
        });
        const answer = await synthesize({ ...args, sources });
        assert.equal(answer.mode, 'synthesis');
        assert.equal(answer.lead, payload.lead);
        assert.deepEqual(answer.findings, []);
        assert.deepEqual(answer.actions, [{ text: 'General guidance: attend the site induction.', citations: [] }]);
        assert.deepEqual(answer.sources, []);
      }
    }
  });
  await check('contextual follow-ups survive API validation and follow the latest turn', async () => {
    const { suggestionsForTurn } = loadTypeScript('app/ui/suggestions.ts');
    const suggestions = [
      { label: 'Confirm visitor PPE', prompt: 'What PPE should I confirm with my escort before a mine visit?' },
      { label: 'Understand the induction', prompt: 'What should a mine visitor learn during induction?' },
      { label: 'Plan emergency communication', prompt: 'How should a visitor confirm emergency communication arrangements?' },
    ];
    globalThis.fetch = async () => response({ ...payload, suggestions });
    const answer = await synthesize(args);
    assert.deepEqual(answer.suggestions, suggestions);
    assert.deepEqual(suggestionsForTurn({ question: 'Mine visit', answer }), suggestions);
    const old = { ...answer, suggestions: undefined, questions: [] };
    assert.notDeepEqual(suggestionsForTurn({ question: 'Inspect a conveyor', answer: { ...old, title: 'Conveyor inspection' } }),
      suggestionsForTurn({ question: 'Roof support', answer: { ...old, title: 'Roof support' } }));
    globalThis.fetch = async () => response({ ...payload, suggestions: [{ label: 42, prompt: null }] });
    assert.deepEqual((await synthesize(args)).suggestions, []);
  });
  for (const [status, message] of [[429, /usage limit/], [403, /configured correctly/], [404, /unavailable/], [503, /unavailable/]]) {
    await check(`provider status ${status}`, async () => {
      globalThis.fetch = async () => new Response('', { status });
      await assert.rejects(() => synthesize(args), message);
    });
  }
  for (const [name, invalid] of [
    ['null response', null],
    ['object instead of title', { ...payload, title: { text: 'Title' } }],
    ['missing required questions', { ...payload, questions: undefined }],
    ['non-string question', { ...payload, questions: [42] }],
    ['oversized finding', { ...payload, findings: [{ text: 'a'.repeat(1801), citations: [source.id] }] }],
    ['blank finding', { ...payload, findings: [{ text: ' ', citations: [source.id] }] }],
    ['extra unverified finding after twelfth item', { ...payload, findings: [...Array(12).fill(payload.findings[0]), { text: 'Invalid thirteenth.', citations: ['fake'] }] }],
  ]) {
    await check(`reject ${name}`, async () => {
      globalThis.fetch = async () => response(invalid);
      await assert.rejects(() => synthesize(args), /verified|citation|ground/);
    });
  }
  await check('reject incomplete JSON', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'incomplete json' }] } }] }));
    await assert.rejects(() => synthesize(args), /incomplete/);
  });
  await check('reject incomplete or blocked generation despite parseable text', async () => {
    for (const reason of ['MAX_TOKENS', 'SAFETY']) {
      globalThis.fetch = async () => response(payload, reason);
      await assert.rejects(() => synthesize(args), /incomplete/);
    }
  });
  await check('caller cancellation reaches provider request', async () => {
    const controller = new AbortController();
    globalThis.fetch = async (_url, init) => {
      assert.equal(init.signal.aborted, false);
      controller.abort();
      assert.equal(init.signal.aborted, true);
      throw new DOMException('Stopped', 'AbortError');
    };
    await assert.rejects(() => synthesize({ ...args, signal: controller.signal }), { name: 'AbortError' });
  });
  await check('model path validation happens before any request', async () => {
    assert.ok(validModel('gemini-3.5-flash-lite'));
    assert.ok(!validModel('../malicious'));
    globalThis.fetch = async () => assert.fail('Invalid model must not reach the provider');
    await assert.rejects(() => synthesize({ ...args, model: '../malicious' }), /configured correctly/);
  });
  console.log(`${checks} provider integration checks passed using simulated responses. No live generation was tested.`);
} finally {
  globalThis.fetch = originalFetch;
}
