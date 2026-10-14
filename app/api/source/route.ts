import { getSource } from '../../../lib/knowledge';
import { responseHeaders } from '../../../lib/request';
import { retrieveHybrid } from '../../../lib/rag/hybrid-retriever';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (id) {
    const source = getSource(id);
    return Response.json(source ? { source } : { error: 'Source not found.' }, {
      status: source ? 200 : 404,
      headers: responseHeaders,
    });
  }
  const question = url.searchParams.get('q') || '';
  const sector = url.searchParams.get('sector') || 'all';
  if (question.length > 1800 || !['all', 'coal', 'noncoal'].includes(sector)) {
    return Response.json({ error: 'Use a shorter query and a valid mine sector.' }, { status: 400, headers: responseHeaders });
  }
  return Response.json({ sources: question.trim() ? retrieveHybrid(question, sector, 6) : [] }, { headers: responseHeaders });
}
