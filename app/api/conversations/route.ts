import { auth } from '@/lib/auth';
import { getOrCreateEmptyConversation, getUserConversations } from '@/lib/chat-store';

// List the signed-in user's conversations (used to refresh the sidebar)
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const conversations = await getUserConversations(session.user.id);
  return Response.json({
    conversations: conversations.map(c => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}

// Start a new chat (reuses the newest one if it is still empty)
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const id = await getOrCreateEmptyConversation(session.user.id);
  return Response.json({ id });
}
