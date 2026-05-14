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

  let imageBuffer, maskBuffer;
  try {
    imageBuffer = await sharp(imageFile.filepath)
      .resize(1024, 1024, { fit: 'cover' })
      .png()
      .toBuffer();

    // Opaque (alpha=255) = preserve, Transparent (alpha=0) = AI edits
    // Top 45%: fully opaque (ceiling, windows, upper walls locked)
    // 45–62%: gradient transition
    // Bottom 62%+: fully transparent (furniture placement zone)
    maskBuffer = await generateMask(1024, 1024);
  } catch {
    return res.status(400).json({ error: 'Could not process image.' });
  }

  try {
    const openai = new OpenAI({ apiKey });

    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: await toFile(imageBuffer, 'room.png', { type: 'image/png' }),
      mask: await toFile(maskBuffer, 'mask.png', { type: 'image/png' }),
      prompt,
      size: '1024x1024',
      quality: 'high',
    });

    const base64 = response.data[0].b64_json;
    res.json({ image: `data:image/png;base64,${base64}` });
  } catch (err) {
    const status = err.status;
    const msg = err.message;
    if (status === 401) return res.status(401).json({ error: 'Invalid OpenAI API key.' });
    if (status === 429) return res.status(429).json({ error: 'Rate limit reached. Try again in a moment.' });
    if (status === 400) return res.status(400).json({ error: `Bad request: ${msg}` });
    res.status(500).json({ error: `Generation failed: ${msg}` });
  }
}

async function generateMask(width, height) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const ratio = y / height;
    let alpha;
    if (ratio < 0.45) alpha = 255;
    else if (ratio > 0.62) alpha = 0;
    else alpha = Math.round(255 * (1 - (ratio - 0.45) / 0.17));
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      pixels[i] = 255; pixels[i + 1] = 255; pixels[i + 2] = 255;
      pixels[i + 3] = alpha;
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
}
