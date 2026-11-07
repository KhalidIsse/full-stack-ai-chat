import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { UIMessage } from 'ai';
import { db } from '@/db/drizzle';
import { conversation, generatedImage, message } from '@/db/schema';
import { buildImageMarkdown, IMAGE_USER_PREFIX } from '@/lib/image-message';
import { DEFAULT_CONVERSATION_TITLE, deriveTitle } from '@/lib/conversation-title';

function textMessage(id: string, role: 'user' | 'assistant', text: string): UIMessage {
  return { id, role, parts: [{ type: 'text', text }] };
}

/**
 * Saves a generated image plus the user prompt / assistant reply messages
 * so the whole exchange shows up when the conversation is opened later.
 */
export async function saveImageExchange(args: {
  conversationId: string;
  userId: string;
  prompt: string;
  base64: string;
  mimeType: string;
}): Promise<{ userMessage: UIMessage; assistantMessage: UIMessage }> {
  const { conversationId, userId, prompt, base64, mimeType } = args;

  const imageId = nanoid();
  await db.insert(generatedImage).values({
    id: imageId,
    userId,
    conversationId,
    prompt,
    mimeType,
    data: base64,
  });

  const userText = `${IMAGE_USER_PREFIX}${prompt}`;
  const userMessage = textMessage(`msg_${nanoid(16)}`, 'user', userText);
  const assistantMessage = textMessage(
    `msg_${nanoid(16)}`,
    'assistant',
    buildImageMarkdown(imageId, prompt)
  );

  try {
    const base = Date.now();
    // Explicit, increasing timestamps keep the messages in the right order.
    await db.insert(message).values([
      {
        id: userMessage.id,
        role: 'user',
        content: userText,
        conversationId,
        userId,
        createdAt: new Date(base),
      },
      {
        id: assistantMessage.id,
        role: 'assistant',
        content: (assistantMessage.parts[0] as { text: string }).text,
        conversationId,
        userId,
        createdAt: new Date(base + 1),
      },
    ]);
  } catch (error) {
    // Don't leave an orphaned image behind if the messages failed to save.
    await db.delete(generatedImage).where(eq(generatedImage.id, imageId));
    throw error;
  }

  const [conv] = await db
    .select({ title: conversation.title })
    .from(conversation)
    .where(eq(conversation.id, conversationId))
    .limit(1);

  await db
    .update(conversation)
    .set({
      updatedAt: new Date(),
      ...(conv?.title === DEFAULT_CONVERSATION_TITLE
        ? { title: deriveTitle(userText) }
        : {}),
    })
    .where(eq(conversation.id, conversationId));

  return { userMessage, assistantMessage };
}

/** Loads an image, but only if it belongs to the given user. */
export async function getImageForUser(imageId: string, userId: string) {
  const rows = await db
    .select({ mimeType: generatedImage.mimeType, data: generatedImage.data })
    .from(generatedImage)
    .where(and(eq(generatedImage.id, imageId), eq(generatedImage.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}
