import { loadChat, getConversation } from '@/lib/chat-store';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Chat from '@/components/chat';
import { headers } from 'next/headers';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatPage({ params }: PageProps) {
  const { id } = await params;
  
  // Get the authenticated session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    // session not found, redirect to login
    console.log('session not found, redirecting to login', session);
    redirect('/login');
  }

  // Validate conversation ownership
  const conversation = await getConversation(id, session.user.id);
  if (!conversation) {
    redirect('/chat');
  }

  // Load messages for this conversation (Vercel guide pattern)
  const initialMessages = await loadChat(id);

  return (
    <Chat 
      key={id}
      conversationId={id} 
      initialMessages={initialMessages}
      conversationTitle={conversation.title}
    />
  );
}
