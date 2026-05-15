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

  // Mask for OpenAI: only open the furniture band (60–85%)
  // Top and bottom remain opaque so AI has context for the room
  const maskBuffer = await generateMask(SIZE, SIZE);

  let aiBuffer;
  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: await toFile(originalBuffer, 'room.png', { type: 'image/png' }),
      mask: await toFile(maskBuffer, 'mask.png', { type: 'image/png' }),
      prompt,
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
    // Two-ended composite:
    // Original covers top (ceiling/walls/windows) AND bottom (floor)
    // AI output shows through only in the middle furniture band
    //
    // Original alpha:
    //   0  → 58%  : 255 (fully original — ceiling, walls)
    //   58 → 68%  : gradient 255→0
    //   68 → 80%  : 0   (AI shows through — furniture bodies)
    //   80 → 90%  : gradient 0→255
    //   90 → 100% : 255 (fully original — floor)

    const { data, info } = await sharp(originalBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let y = 0; y < info.height; y++) {
      const r = y / info.height;
      let a;
      if (r <= 0.58)      a = 255;
      else if (r <= 0.68) a = Math.round(255 * (1 - (r - 0.58) / 0.10));
      else if (r <= 0.80) a = 0;
      else if (r <= 0.90) a = Math.round(255 * ((r - 0.80) / 0.10));
      else                a = 255;
      for (let x = 0; x < info.width; x++) {
        data[(y * info.width + x) * 4 + 3] = a;
      }
    }

    const maskedOriginal = await sharp(Buffer.from(data), {
      raw: { width: info.width, height: info.height, channels: 4 },
    }).png().toBuffer();

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

// Mask for OpenAI — only open furniture band (60–85%)
// opaque = preserve, transparent = AI edits
function generateMask(width, height) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const r = y / height;
    let a;
    if (r < 0.60)       a = 255;
    else if (r < 0.68)  a = Math.round(255 * (1 - (r - 0.60) / 0.08));
    else if (r < 0.82)  a = 0;
    else if (r < 0.90)  a = Math.round(255 * ((r - 0.82) / 0.08));
    else                a = 255;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      pixels[i] = 255; pixels[i + 1] = 255; pixels[i + 2] = 255;
      pixels[i + 3] = a;
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
}
