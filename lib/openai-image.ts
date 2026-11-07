export type Aspect = 'square' | 'landscape' | 'portrait';

const SIZES: Record<Aspect, string> = {
  square: '1024x1024',
  landscape: '1536x1024',
  portrait: '1024x1536',
};

export const DEFAULT_IMAGE_MODEL = 'gpt-image-2.5-sunburst';

export class ImageGenerationError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'ImageGenerationError';
    this.status = status;
  }
}

export async function generateOpenAIImage(args: {
  prompt: string;
  aspect: Aspect;
}): Promise<{ base64: string; mimeType: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ImageGenerationError('OPENAI_API_KEY is not set on the server.', 500);
  }

  const model = process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  if (model.startsWith('dall-e')) {
    throw new ImageGenerationError(
      `OPENAI_IMAGE_MODEL is set to "${model}", which OpenAI removed from its API in May 2026. ` +
        `Use ${DEFAULT_IMAGE_MODEL} instead.`,
      500
    );
  }

  const quality = process.env.OPENAI_IMAGE_QUALITY || 'medium';

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: args.prompt,
        n: 1,
        size: SIZES[args.aspect],
        quality,
        output_format: 'jpeg',
        output_compression: 85,
      }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ImageGenerationError('Image generation took too long. Please try again.', 504);
    }
    throw new ImageGenerationError('Could not reach OpenAI. Please try again.', 502);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message: string =
      payload?.error?.message || `OpenAI returned an error (HTTP ${response.status}).`;
    throw new ImageGenerationError(message, response.status);
  }

  const base64: string | undefined = payload?.data?.[0]?.b64_json;
  if (!base64) {
    throw new ImageGenerationError('OpenAI did not return an image. Please try again.', 502);
  }

  return { base64, mimeType: 'image/jpeg' };
}