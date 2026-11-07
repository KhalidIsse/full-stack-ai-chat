import { getOrCreateEmptyConversation } from '@/lib/chat-store';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function NewChatPage() {
  // Get the authenticated session
  const session = await auth.api.getSession({
    headers: await headers()
})



  if (!session) {
    // session not found, redirect to login
    console.log('session not found, redirecting to login', session);
    redirect('/login');
  }

  // Open a fresh conversation (reuses the newest one if it is still empty)
  const conversationId = await getOrCreateEmptyConversation(session.user.id);
  redirect(`/chat/${conversationId}`);
}