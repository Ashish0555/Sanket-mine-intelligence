import { z } from 'zod';
import {
  bookAnswer, defaultProfile, emergencyAnswer, isCurrentLaw, isEmergency,
  isOutOfScope, retrievalQuestion, search,
} from '../../../lib/knowledge';
import { DEFAULT_MODEL, synthesize, validModel } from '../../../lib/gemini';
import { readBody, RequestError, responseHeaders } from '../../../lib/request';

export const dynamic = 'force-dynamic';
const schema = z.object({
  question: z.string().trim().min(2).max(1800),
  profile: z.object({
    name: z.string().trim().max(80),
    sector: z.enum(['all', 'coal', 'noncoal']),
    method: z.string().trim().max(80),
    conditions: z.string().trim().max(1200),
  }).strict().optional(),
  briefing: z.boolean().optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    text: z.string().trim().max(1800),
  }).strict()).max(6).optional(),
}).strict();

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: responseHeaders });

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await readBody(request));
    if (!parsed.success) return json({ error: 'The question or mine details are invalid. Check their length and try again.' }, 400);
    const { question, profile = defaultProfile, history = [] } = parsed.data;
    const briefing = parsed.data.briefing || /\b(newly transferred|new officer|taking over|first.week)\b/i.test(question);
    if (request.signal.aborted) return json({ error: 'Request stopped.' }, 499);
    if (isEmergency(question)) return json(emergencyAnswer());
    if (isOutOfScope(question)) {
      return json({
        ...bookAnswer('', [], profile),
        title: 'Ask me about mining',
        lead: 'I can help with SANKET accident cases, mining hazards, inquiry findings and prevention. This question is outside my source collection.',
      });
    }
    if (isCurrentLaw(question)) {
      return json({
        ...bookAnswer('', [], profile),
        title: 'A current rule needs a current source',
        lead: 'These SANKET books document historical accidents. They cannot establish the current legal limit or latest rule. Verify the applicable DGMS requirements and the mine’s approved permissions before acting.',
      });
    }

    const retrievalQuery = briefing
      ? `fire burning ground fuel maintenance supervision escape ${profile.method} ${profile.conditions}`
      : retrievalQuestion(question, history);
    let sources = search(retrievalQuery, profile.sector, 7, briefing);
    if (briefing) {
      const topics = profile.sector === 'noncoal'
        ? ['gas well workover fire', 'escape emergency fire']
        : ['burning fiery ground old workings', 'fuel tank wiring equipment fire', 'firefighting tanker hose escape'];
      const diverse = topics.flatMap(topic => search(`${topic} ${profile.conditions}`, profile.sector, 2, true));
      sources = [...new Map([...diverse, ...sources].map(source => [source.id, source])).values()].slice(0, 7);
    }
    const fallback = bookAnswer(retrievalQuery, sources, profile, briefing);
    const key = process.env.GEMINI_API_KEY?.trim() || '';
    const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
    if (!validModel(model)) {
      return json({ ...fallback, notice: 'The answer service is not configured correctly. Showing book evidence instead.' });
    }
    if (!key) return json({ ...fallback, notice: 'The AI answer service has no API key configured. Only matching book evidence is available.' });
    try {
      return json(await synthesize({ question, sources, profile, key, model, history, briefing, signal: request.signal }));
    } catch (error) {
      if (request.signal.aborted) return json({ error: 'Request stopped.' }, 499);
      // Never forward a provider error body or exception message to the browser.
      const notice = error instanceof Error && /^(The answer service|The configured answer service|The generated output)/.test(error.message)
        ? error.message
        : 'The AI answer service could not be reached or timed out. Please retry.';
      return json({
        ...fallback,
        ...(sources.length ? {} : {
          title: 'AI answer temporarily unavailable',
          lead: 'I could not generate an answer to your question. No matching historical case was found, so I have not substituted an unrelated accident account.',
          questions: [],
        }),
        notice,
      });
    }
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    return json({ error: 'The request could not be read. Please try again.' }, 400);
  }
}
