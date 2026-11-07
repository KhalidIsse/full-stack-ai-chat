import { auth } from '@/lib/auth';
import { deleteConversation } from '@/lib/chat-store';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteConversation(id, session.user.id);
  if (!deleted) {
    return new Response('Conversation not found', { status: 404 });
  }

  return Response.json({ success: true });
}
