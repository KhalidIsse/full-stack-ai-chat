export const DEFAULT_CONVERSATION_TITLE = 'New Conversation';

/** Builds a short sidebar title from the first user message. */
export function deriveTitle(text: string, max = 50): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return DEFAULT_CONVERSATION_TITLE;
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean;
}
