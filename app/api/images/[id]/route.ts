import { auth } from '@/lib/auth';
import { getImageForUser } from '@/lib/image-store';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Serves a generated image, only to the user who created it.
export async function GET(req: Request, { params }: RouteContext) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await params;
  const image = await getImageForUser(id, session.user.id);
  if (!image) {
    return new Response('Not found', { status: 404 });
  }

  const bytes = new Uint8Array(Buffer.from(image.data, 'base64'));
  const extension = image.mimeType.split('/')[1] || 'png';

  return new Response(bytes, {
    headers: {
      'Content-Type': image.mimeType,
      'Content-Length': String(bytes.length),
      'Content-Disposition': `inline; filename="image-${id}.${extension}"`,
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
