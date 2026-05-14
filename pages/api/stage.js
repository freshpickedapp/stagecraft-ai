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

  let imageBuffer;
  try {
    imageBuffer = await sharp(imageFile.filepath)
      .resize(1024, 1024, { fit: 'cover' })
      .png()
      .toBuffer();
  } catch {
    return res.status(400).json({ error: 'Could not process image.' });
  }

  try {
    const openai = new OpenAI({ apiKey });

    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: await toFile(imageBuffer, 'room.png', { type: 'image/png' }),
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
