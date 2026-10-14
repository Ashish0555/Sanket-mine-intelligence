import catalog from '../../../data/catalog.json';
import manifest from '../../../data/manifest.json';
import { responseHeaders } from '../../../lib/request';

export async function GET() {
  return Response.json({ catalog, manifest }, { headers: responseHeaders });
}
