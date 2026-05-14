import formidable from 'formidable';
import OpenAI, { toFile } from 'openai';
import sharp from 'sharp';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not set on the server.' });

  const form = formidable({ maxFileSize: 20 * 1024 * 1024 });
  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch {
    return res.status(400).json({ error: 'Could not process image upload.' });
  }

  const imageFile = files.image?.[0];
  if (!imageFile) return res.status(400).json({ error: 'No image provided.' });

  const prompt = fields.prompt?.[0];
  if (!prompt) return res.status(400).json({ error: 'Prompt required.' });

  const SIZE = 1024;

  let originalBuffer;
  try {
    originalBuffer = await sharp(imageFile.filepath)
      .resize(SIZE, SIZE, { fit: 'cover' })
      .png()
      .toBuffer();
  } catch {
    return res.status(400).json({ error: 'Could not process image.' });
  }

  // Sample the average floor color from the lower-center of the original
  // so we can anchor the AI to the correct floor color in the prompt
  let floorColorHint = '';
  try {
    const sample = await sharp(originalBuffer)
      .extract({ left: 256, top: 700, width: 512, height: 200 })
      .resize(1, 1)
      .removeAlpha()
      .raw()
      .toBuffer();
    const [r, g, b] = sample;
    const lum = (r * 0.299 + g * 0.587 + b * 0.114);
    const tone = lum > 180 ? 'light' : lum > 100 ? 'medium' : 'dark';
    const warmth = r - b > 25 ? 'warm' : r - b < -15 ? 'cool' : 'neutral';
    floorColorHint = `The floor is ${tone} ${warmth}-toned — keep it exactly the same color and texture.`;
  } catch { /* non-fatal */ }

  const fullPrompt = `${prompt} ${floorColorHint}`;

  // Mask for OpenAI: only open the bottom 30% for furniture (transparent = editable)
  // Everything above 70% is opaque (preserved by OpenAI)
  const maskBuffer = await generateMask(SIZE, SIZE);

  let aiBuffer;
  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: await toFile(originalBuffer, 'room.png', { type: 'image/png' }),
      mask: await toFile(maskBuffer, 'mask.png', { type: 'image/png' }),
      prompt: fullPrompt,
      size: '1024x1024',
      quality: 'high',
    });
    aiBuffer = Buffer.from(response.data[0].b64_json, 'base64');
  } catch (err) {
    const status = err.status;
    const msg = err.message;
    if (status === 401) return res.status(401).json({ error: 'Invalid OpenAI API key.' });
    if (status === 429) return res.status(429).json({ error: 'Rate limit reached. Try again in a moment.' });
    if (status === 400) return res.status(400).json({ error: `Bad request: ${msg}` });
    return res.status(500).json({ error: `Generation failed: ${msg}` });
  }

  try {
    // Soft composite: apply a gradient alpha to the original so it fades out
    // only at the very bottom (furniture zone). Everywhere else = original pixels.
    // Fade starts at 65%, fully transparent by 82% — AI furniture shows through below.
    const { data, info } = await sharp(originalBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const FADE_START = 0.65;
    const FADE_END = 0.82;
    for (let y = 0; y < info.height; y++) {
      const ratio = y / info.height;
      let alpha;
      if (ratio <= FADE_START) alpha = 255;
      else if (ratio >= FADE_END) alpha = 0;
      else alpha = Math.round(255 * (1 - (ratio - FADE_START) / (FADE_END - FADE_START)));
      for (let x = 0; x < info.width; x++) {
        data[(y * info.width + x) * 4 + 3] = alpha;
      }
    }

    const maskedOriginal = await sharp(Buffer.from(data), {
      raw: { width: info.width, height: info.height, channels: 4 },
    }).png().toBuffer();

    // AI output as base, soft-blended original layered on top
    const finalBuffer = await sharp(aiBuffer)
      .ensureAlpha()
      .composite([{ input: maskedOriginal, blend: 'over' }])
      .png()
      .toBuffer();

    res.json({ image: `data:image/png;base64,${finalBuffer.toString('base64')}` });
  } catch {
    res.status(500).json({ error: 'Could not composite final image.' });
  }
}

// OpenAI mask: opaque = preserve, transparent = AI edits
// Keep top 70% opaque, only open bottom 30% for furniture
function generateMask(width, height) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const ratio = y / height;
    let alpha;
    if (ratio < 0.65) alpha = 255;
    else if (ratio > 0.80) alpha = 0;
    else alpha = Math.round(255 * (1 - (ratio - 0.65) / 0.15));
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      pixels[i] = 255; pixels[i + 1] = 255; pixels[i + 2] = 255;
      pixels[i + 3] = alpha;
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
}
