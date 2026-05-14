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

  // Resize original to square PNG
  let originalBuffer;
  try {
    originalBuffer = await sharp(imageFile.filepath)
      .resize(SIZE, SIZE, { fit: 'cover' })
      .png()
      .toBuffer();
  } catch {
    return res.status(400).json({ error: 'Could not process image.' });
  }

  // Mask for OpenAI: transparent = editable, opaque = preserve
  // Only open up the bottom 55% for furniture placement
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

  // Hard composite: paste original's upper zone back over the AI output pixel-for-pixel.
  // This guarantees ceiling, windows, walls above the seam are IDENTICAL to the upload.
  try {
    const SEAM = Math.round(SIZE * 0.45); // 461px — top of furniture zone

    // Extract upper portion from the original
    const upperOriginal = await sharp(originalBuffer)
      .extract({ left: 0, top: 0, width: SIZE, height: SEAM })
      .png()
      .toBuffer();

    // Paste it onto the AI output at position 0,0
    const finalBuffer = await sharp(aiBuffer)
      .composite([{ input: upperOriginal, top: 0, left: 0 }])
      .png()
      .toBuffer();

    const base64 = finalBuffer.toString('base64');
    res.json({ image: `data:image/png;base64,${base64}` });
  } catch {
    res.status(500).json({ error: 'Could not composite final image.' });
  }
}

// OpenAI mask: opaque (alpha=255) = preserve, transparent (alpha=0) = AI edits
function generateMask(width, height) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const ratio = y / height;
    let alpha;
    if (ratio < 0.45) alpha = 255;       // preserve top 45%
    else if (ratio > 0.62) alpha = 0;    // AI fills bottom 38%
    else alpha = Math.round(255 * (1 - (ratio - 0.45) / 0.17));
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      pixels[i] = 255; pixels[i + 1] = 255; pixels[i + 2] = 255;
      pixels[i + 3] = alpha;
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
}
