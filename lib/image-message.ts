// Shared helpers (safe to import from client and server code).
// A generated image is stored in the message table as a normal text message
// containing a markdown image that points to our own image route:
//   ![prompt](/api/images/<id>)

export const IMAGE_USER_PREFIX = '🎨 ';

export function buildImageMarkdown(imageId: string, prompt: string): string {
  const alt = prompt.replace(/[\[\]\r\n]+/g, ' ').trim().slice(0, 200);
  return `![${alt}](/api/images/${imageId})`;
}

const IMAGE_MESSAGE_RE = /^!\[([\s\S]*)\]\(\/api\/images\/([A-Za-z0-9_-]+)\)$/;

export function parseImageMessage(
  text: string
): { imageId: string; prompt: string } | null {
  const match = IMAGE_MESSAGE_RE.exec(text.trim());
  if (!match) return null;
  return { prompt: match[1], imageId: match[2] };
}
