export const responseHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const MAX_BODY_BYTES = 24_000;

export class RequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'RequestError';
  }
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

export async function readBody(request: Request): Promise<unknown> {
  if (!sameOrigin(request)) {
    throw new RequestError('This request must come from the SANKET website.', 403);
  }
  const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new RequestError('Send the request as JSON.', 415);
  }
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
    throw new RequestError('The request is too large. Shorten the question or mine details.', 413);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('The request body is missing.', 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RequestError('The request is too large. Shorten the question or mine details.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new RequestError('The request is not valid JSON. Please try again.', 400);
  }
}
