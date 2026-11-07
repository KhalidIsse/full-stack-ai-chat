import { UIMessage } from 'ai';
import { db } from '@/db/drizzle';
import { conversation, message } from '@/db/schema';
import { and, desc, eq, exists, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { DEFAULT_CONVERSATION_TITLE, deriveTitle } from '@/lib/conversation-title';

/**
 * Create a new conversation for a user
 */
export async function createConversation(userId: string, title?: string): Promise<string> {
  const conversationId = nanoid();
  
  await db.insert(conversation).values({
    id: conversationId,
    title: title || DEFAULT_CONVERSATION_TITLE,
    userId,
  });
  
  return conversationId;
}

/**
 * Load messages for a specific conversation (Vercel guide pattern)
 */
export async function loadChat(conversationId: string): Promise<UIMessage[]> {
  const messages = await db
    .select()
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .orderBy(message.createdAt);

  return messages.map(msg => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    parts: [{ type: 'text' as const, text: msg.content }],
  }));
}

/**
 * Legacy function for backward compatibility
 */
export async function loadMessages(conversationId: string): Promise<UIMessage[]> {
  return loadChat(conversationId);
}

/**
 * Save messages to database (Vercel guide pattern)
 */
export async function saveChat({ chatId, messages }: { chatId: string; messages: UIMessage[] }): Promise<void> {
  console.log('saveChat called with:', { chatId, messagesCount: messages.length });
  
  // Get the conversation to get userId
  const conv = await db
    .select({ userId: conversation.userId, title: conversation.title })
    .from(conversation)
    .where(eq(conversation.id, chatId))
    .limit(1);

  if (conv.length === 0) {
    throw new Error('Conversation not found');
  }

  // Get existing messages to avoid duplicates
  const existingMessages = await db
    .select({ id: message.id })
    .from(message)
    .where(eq(message.conversationId, chatId));

  const existingIds = new Set(existingMessages.map(m => m.id));
  console.log('Existing message IDs:', Array.from(existingIds));

  // Insert only new messages
  const newMessages = messages.filter(msg => !existingIds.has(msg.id));
  console.log('New messages to save:', newMessages.length);
  console.log('New messages details:', newMessages.map(msg => {
    const textPart = msg.parts.find(part => part.type === 'text');
    return { id: msg.id, role: msg.role, content: textPart?.text || '' };
  }));
  
  if (newMessages.length > 0) {
    // Explicit, increasing timestamps keep user/assistant messages in order
    // (rows inserted in one statement would otherwise share the same time).
    const baseTime = Date.now();
    const messageData = newMessages.map((msg, index) => {
      // Find the text part in the message (not just the first part)
      const textPart = msg.parts.find(part => part.type === 'text');
      const content = textPart?.text || '';
      
      return {
        id: msg.id,
        content,
        role: msg.role,
        conversationId: chatId,
        userId: conv[0].userId,
        createdAt: new Date(baseTime + index),
      };
    });

    console.log('Inserting message data:', messageData);
    await db.insert(message).values(messageData);
    console.log('Messages inserted successfully');
  } else {
    console.log('No new messages to insert');
  }

  // Update conversation timestamp (and give it a title on the first message)
  const firstUserMessage = newMessages.find(msg => msg.role === 'user');
  const firstUserText =
    firstUserMessage?.parts.find(part => part.type === 'text')?.text ?? '';
  const shouldSetTitle =
    conv[0].title === DEFAULT_CONVERSATION_TITLE && firstUserText.trim().length > 0;

  await db
    .update(conversation)
    .set({
      updatedAt: new Date(),
      ...(shouldSetTitle ? { title: deriveTitle(firstUserText) } : {}),
    })
    .where(eq(conversation.id, chatId));
}

/**
 * Legacy function for backward compatibility
 */
export async function saveMessages(conversationId: string, messages: UIMessage[], userId: string): Promise<void> {
  return saveChat({ chatId: conversationId, messages });
}

/**
 * Get user's conversations (only the ones that contain at least one message,
 * so empty "New chat" drafts don't clutter the sidebar)
 */
export async function getUserConversations(userId: string) {
  return await db
    .select()
    .from(conversation)
    .where(
      and(
        eq(conversation.userId, userId),
        exists(
          db
            .select({ one: sql`1` })
            .from(message)
            .where(eq(message.conversationId, conversation.id))
        )
      )
    )
    .orderBy(desc(conversation.updatedAt));
}

/**
 * Start a new chat. If the user's newest conversation is still empty it is
 * reused, so clicking "New chat" repeatedly doesn't create piles of blanks.
 */
export async function getOrCreateEmptyConversation(userId: string): Promise<string> {
  const latest = await db
    .select({ id: conversation.id })
    .from(conversation)
    .where(eq(conversation.userId, userId))
    .orderBy(desc(conversation.createdAt))
    .limit(1);

  if (latest[0]) {
    const hasMessages = await db
      .select({ id: message.id })
      .from(message)
      .where(eq(message.conversationId, latest[0].id))
      .limit(1);
    if (hasMessages.length === 0) {
      return latest[0].id;
    }
  }

  return createConversation(userId);
}

/**
 * Delete a conversation (messages and images are removed by ON DELETE CASCADE)
 */
export async function deleteConversation(conversationId: string, userId: string): Promise<boolean> {
  const deleted = await db
    .delete(conversation)
    .where(and(eq(conversation.id, conversationId), eq(conversation.userId, userId)))
    .returning({ id: conversation.id });
  return deleted.length > 0;
}

/**
 * Get conversation by ID (with user validation)
 */
export async function getConversation(conversationId: string, userId: string) {
  const result = await db
    .select()
    .from(conversation)
    .where(eq(conversation.id, conversationId))
    .limit(1);

  const conv = result[0];
  if (!conv || conv.userId !== userId) {
    return null;
  }

  return conv;
}
