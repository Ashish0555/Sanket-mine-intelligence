import './sites-env.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { unstable_getVarsForDev } from 'wrangler';
import { loadTypeScript } from './test-support.mjs';
const { POST } = loadTypeScript('app/api/chat/route.ts');
const { GET } = loadTypeScript('app/api/library/route.ts');
const originalFetch = globalThis.fetch;
const originalKey = process.env.GEMINI_API_KEY, originalModel = process.env.GEMINI_MODEL;
const sentinel = 'server-only-test-value-not-a-real-key';
const ask = async (extra) => {
    const response = await POST(new Request('http://localhost/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'Why did the Khadia fuel tank fire happen?', ...extra }) }));
    return { status: response.status, body: await response.json() };
};
let calls = 0;
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'sanket-env-test-'));
try {
    fs.writeFileSync(path.join(work, '.env'), `GEMINI_API_KEY=${sentinel}\nGEMINI_MODEL=gemini-3.5-flash-lite\n`);
    const env = unstable_getVarsForDev(path.join(work, 'wrangler.json'), undefined, {}, undefined, true);
    assert.equal(env.GEMINI_API_KEY.value, sentinel);
    assert.equal(env.GEMINI_MODEL.value, 'gemini-3.5-flash-lite');
    const builtEnv = unstable_getVarsForDev(path.resolve('dist/server/wrangler.json'), [path.join(work, '.env')], {}, undefined, true);
    assert.equal(builtEnv.GEMINI_API_KEY.value, sentinel);
    process.env.GEMINI_API_KEY = '';
    process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite';
    globalThis.fetch = async () => { throw new Error('Unexpected external call'); };
    const fallback = await ask({});
    assert.equal(fallback.body.mode, 'book');
    process.env.GEMINI_API_KEY = sentinel;
    globalThis.fetch = async (url, init) => {
        calls++;
        assert.equal(init.headers['x-goog-api-key'], sentinel);
        assert.ok(!String(url).includes(sentinel));
        assert.ok(!init.body.includes(sentinel));
        const source = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text).evidence[0].id;
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ title: 'Evidence-based answer', lead: 'Review the cited inquiry.', findings: [{ text: 'Test finding.', citations: [source] }], actions: [{ text: 'Test action.', citations: [source] }], questions: [] }) }] } }] }));
    };
    const answer = await ask({});
    assert.equal(answer.status, 200);
    assert.equal(answer.body.mode, 'synthesis');
    assert.equal(calls, 1);
    assert.ok(!JSON.stringify(answer.body).includes(sentinel));
    assert.ok(!('model' in answer.body));
    assert.ok(!/gemini|apiKey|serverGemini/i.test(JSON.stringify(answer.body)));
    for (const extra of [{ apiKey: 'browser-test-value' }, { model: 'gemini-browser-override' }])
        assert.equal((await ask(extra)).status, 400);
    assert.equal(calls, 1, 'Browser credential/model overrides must be rejected before provider access');
    globalThis.fetch = async () => { throw new Error('Sensitive internal detail ' + sentinel); };
    const failed = await ask({});
    assert.equal(failed.body.mode, 'book');
    assert.ok(!JSON.stringify(failed.body).includes(sentinel));
    const library = await (await GET()).json();
    assert.ok(!('serverGemini' in library));
    assert.ok(!/gemini|apiKey/i.test(JSON.stringify(library.manifest)));
    assert.ok(!fs.existsSync('app/api/connect/route.ts'));
    for (const file of ['app/page.tsx', 'app/globals.css'])
        assert.ok(!/gemini|apiKey|Connect securely/i.test(fs.readFileSync(file, 'utf8')), file);
    const publicEnv = fs.readFileSync('.env.example', 'utf8');
    assert.match(publicEnv, /^GEMINI_API_KEY=\s*$/m);
    console.log('Server environment and credential-isolation checks passed. No real provider request was made.');
}
finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined)
        delete process.env.GEMINI_API_KEY;
    else
        process.env.GEMINI_API_KEY = originalKey;
    if (originalModel === undefined)
        delete process.env.GEMINI_MODEL;
    else
        process.env.GEMINI_MODEL = originalModel;
    fs.rmSync(work, { recursive: true, force: true });
}
