import formidable from 'formidable';
import FormData from 'form-data';
import axios from 'axios';
import sharp from 'sharp';

export const config = { api: { bodyParser: false } };

const NEGATIVE_PROMPT =
  'cartoon, illustrated, watermark, text, people, pets, animals, ' +
  'different wall color, repainted walls, new flooring, different floor, renovated, ' +
  'different ceiling, altered windows, new windows, changed architecture, ' +
  'distorted architecture, fisheye lens, wide angle distortion, oversaturated, ' +
  'unrealistic lighting, cheap furniture, cluttered, messy, blurry, low quality, ' +
  'extra rooms, merged rooms, floating furniture, room redesign, remodeled';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'STABILITY_API_KEY is not set on the server.' });

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
  if (!prompt) return res.status(400).json({ error: 'Staging prompt required.' });

  let imageBuffer;
  try {
    imageBuffer = await sharp(imageFile.filepath)
      .resize(1024, 1024, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch {
    return res.status(400).json({ error: 'Could not process image.' });
  }

  const formData = new FormData();
  formData.append('init_image', imageBuffer, { filename: 'room.jpg', contentType: 'image/jpeg' });
  formData.append('image_strength', '0.80');
  formData.append('cfg_scale', '7');
  formData.append('steps', '45');
  formData.append('sampler', 'K_DPMPP_2M');
  formData.append('text_prompts[0][text]', prompt);
  formData.append('text_prompts[0][weight]', '1');
  formData.append('text_prompts[1][text]', NEGATIVE_PROMPT);
  formData.append('text_prompts[1][weight]', '-1');

  try {
    const response = await axios.post(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        timeout: 55000,
      }
    );

    const artifact = response.data.artifacts?.[0];
    if (!artifact?.base64) return res.status(500).json({ error: 'No image returned from API.' });

    res.json({ image: `data:image/jpeg;base64,${artifact.base64}` });
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.response?.data?.errors?.[0] || err.message;
    if (status === 401) return res.status(401).json({ error: 'Invalid Stability AI API key.' });
    if (status === 402) return res.status(402).json({ error: 'Insufficient Stability AI credits.' });
    if (status === 429) return res.status(429).json({ error: 'Rate limit reached. Try again in a moment.' });
    res.status(500).json({ error: `Generation failed: ${msg}` });
  }
}
