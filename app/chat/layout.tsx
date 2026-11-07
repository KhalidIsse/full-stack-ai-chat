import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserConversations } from '@/lib/chat-store';
import ChatSidebar from '@/components/chat-sidebar';

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/login');
  }

  const conversations = await getUserConversations(session.user.id);

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <ChatSidebar
        initialConversations={conversations.map(c => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt.toISOString(),
        }))}
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        }}
      />
      <main className="min-h-0 min-w-0 flex-1">{children}</main>
    </div>
  );
}
