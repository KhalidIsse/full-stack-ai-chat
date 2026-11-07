'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LogOut, Menu, MessageSquare, Plus, Trash2, X, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

export interface SidebarConversation {
  id: string;
  title: string;
  updatedAt: string; // ISO date
}

interface ChatSidebarProps {
  initialConversations: SidebarConversation[];
  user: { name: string; email: string; image?: string | null };
}

/** Other components dispatch this event to make the sidebar reload its list. */
export const CONVERSATIONS_CHANGED_EVENT = 'conversations:changed';

function groupByDate(items: SidebarConversation[]) {
  const DAY = 24 * 60 * 60 * 1000;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const groups: { label: string; items: SidebarConversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Previous 30 days', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const item of items) {
    const time = new Date(item.updatedAt).getTime();
    if (time >= startOfToday) groups[0].items.push(item);
    else if (time >= startOfToday - DAY) groups[1].items.push(item);
    else if (time >= startOfToday - 7 * DAY) groups[2].items.push(item);
    else if (time >= startOfToday - 30 * DAY) groups[3].items.push(item);
    else groups[4].items.push(item);
  }

  return groups.filter(group => group.items.length > 0);
}

export default function ChatSidebar({ initialConversations, user }: ChatSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [open, setOpen] = useState(false); // mobile drawer
  const [creating, setCreating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const firstRun = useRef(true);

  const activeId = pathname.startsWith('/chat/') ? pathname.split('/')[2] : null;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations);
      }
    } catch {
      // keep showing the current list
    }
  }, []);

  // Grouping depends on the browser's time zone, so only group after mount
  // (avoids a server/client hydration mismatch).
  useEffect(() => setMounted(true), []);

  // Reload the list whenever the user navigates to another chat
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    refresh();
    setOpen(false);
  }, [pathname, refresh]);

  // Reload the list when a chat finishes a message or image
  useEffect(() => {
    window.addEventListener(CONVERSATIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CONVERSATIONS_CHANGED_EVENT, refresh);
  }, [refresh]);

  async function handleNewChat() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/conversations', { method: 'POST' });
      if (!res.ok) throw new Error('Could not create chat');
      const { id } = await res.json();
      router.push(`/chat/${id}`);
      setOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setConversations(prev => prev.filter(c => c.id !== id));
      if (id === activeId) {
        router.push('/chat');
      }
    } catch (error) {
      console.error(error);
      window.alert('Could not delete this chat. Please try again.');
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  const groups = mounted
    ? groupByDate(conversations)
    : [{ label: 'Recent', items: conversations }];

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-rose-100 bg-white px-3 md:hidden">
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open chat history">
          <Menu className="h-5 w-5" />
        </Button>
        <span className="text-sm font-medium text-gray-900">AI Chat</span>
      </div>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-rose-100 bg-gray-50 transition-transform',
          'md:static md:z-auto md:translate-x-0 md:shrink-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center gap-2 p-3">
          <Button
            onClick={handleNewChat}
            disabled={creating}
            className="flex-1 justify-start gap-2 bg-rose-500 text-white hover:bg-rose-600"
          >
            <Plus className="h-4 w-4" />
            New chat
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close chat history"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Chat history">
          {conversations.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-500">
              Your chats will appear here.
            </p>
          )}

          {groups.map(group => (
            <div key={group.label} className="mb-3">
              <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(item => (
                  <li key={item.id} className="group relative">
                    <Link
                      href={`/chat/${item.id}`}
                      prefetch={false}
                      title={item.title}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 pr-9 text-sm text-gray-700 hover:bg-rose-50',
                        item.id === activeId && 'bg-rose-100 font-medium text-rose-700 hover:bg-rose-100'
                      )}
                    >
                      <MessageSquare className="h-4 w-4 shrink-0 opacity-60" />
                      <span className="truncate">{item.title}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.title)}
                      aria-label={`Delete chat ${item.title}`}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 hover:bg-rose-100 hover:text-rose-600 focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-rose-100 p-3">
          <div className="mb-2 flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.image || ''} />
              <AvatarFallback className="bg-rose-500 text-xs text-white">
                {user.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => router.push('/dashboard')}>
              <LayoutDashboard className="h-3.5 w-3.5" />
              Dashboard
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={handleSignOut}>
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
