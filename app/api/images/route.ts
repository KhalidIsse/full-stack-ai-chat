import { auth } from '@/lib/auth';
import { getConversation } from '@/lib/chat-store';
import { saveImageExchange } from '@/lib/image-store';
import { generateOpenAIImage, ImageGenerationError, type Aspect } from '@/lib/openai-image';

export const maxDuration = 60;

const ASPECTS: Aspect[] = ['square', 'landscape', 'portrait'];

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => null);
    const conversationId = typeof body?.id === 'string' ? body.id : '';
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const aspect: Aspect = ASPECTS.includes(body?.aspect) ? body.aspect : 'square';

    if (!conversationId) return json({ error: 'Conversation ID is required' }, 400);
    if (!prompt) return json({ error: 'Please describe the image you want.' }, 400);
    if (prompt.length > 1000) {
      return json({ error: 'The prompt is too long (max 1000 characters).' }, 400);
    }

    const conversation = await getConversation(conversationId, session.user.id);
    if (!conversation) return json({ error: 'Conversation not found' }, 404);

    const { base64, mimeType } = await generateOpenAIImage({ prompt, aspect });

    const { userMessage, assistantMessage } = await saveImageExchange({
      conversationId,
      userId: session.user.id,
      prompt,
      base64,
      mimeType,
    });

    return json({ userMessage, assistantMessage });
  } catch (error) {
    console.error('Image generation error:', error);
    if (error instanceof ImageGenerationError) {
      const status = error.status >= 400 && error.status < 600 ? error.status : 500;
      return json({ error: error.message }, status);
    }
    return json({ error: 'Image generation failed. Please try again.' }, 500);
  }
}