import formidable from 'formidable';
import FormData from 'form-data';
import axios from 'axios';
import sharp from 'sharp';

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey =
    req.headers['x-api-key'] || process.env.STABILITY_API_KEY;

  if (!apiKey) {
    return res.status(401).json({
      error: 'Stability AI API key required. Add your key in Settings.',
    });
  }

  const form = formidable({ maxFileSize: 20 * 1024 * 1024 });
  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch {
    return res.status(400).json({ error: 'Could not process the image upload.' });
  }

  const imageFile = files.image?.[0];
  if (!imageFile) {
    return res.status(400).json({ error: 'No image provided.' });
  }

  const prompt = fields.prompt?.[0];
  const negativePrompt = fields.negative_prompt?.[0] || '';
  const controlStrength = fields.control_strength?.[0] || '0.80';

  if (!prompt) {
    return res.status(400).json({ error: 'Staging style prompt is required.' });
  }

  let imageBuffer;
  try {
    imageBuffer = await sharp(imageFile.filepath)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch {
    return res.status(400).json({
      error: 'Could not process the image. Please try a different file.',
    });
  }

  const formData = new FormData();
  formData.append('image', imageBuffer, {
    filename: 'room.jpg',
    contentType: 'image/jpeg',
  });
  formData.append('prompt', prompt);
  if (negativePrompt) {
    formData.append('negative_prompt', negativePrompt);
  }
  formData.append('control_strength', controlStrength);
  formData.append('output_format', 'jpeg');

  try {
    const response = await axios.post(
      'https://api.stability.ai/v2beta/stable-image/control/structure',
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

    const { image, seed } = response.data;
    res.json({ image: `data:image/jpeg;base64,${image}`, seed });
  } catch (err) {
    const status = err.response?.status;
    const msg =
      err.response?.data?.message ||
      err.response?.data?.errors?.[0] ||
      err.message;

    if (status === 401) {
      return res.status(401).json({
        error: 'Invalid API key. Double-check your Stability AI key in Settings.',
      });
    }
    if (status === 402) {
      return res.status(402).json({
        error: 'Insufficient Stability AI credits. Top up at platform.stability.ai.',
      });
    }
    if (status === 429) {
      return res.status(429).json({
        error: 'Rate limit reached. Please wait a moment and try again.',
      });
    }
    if (err.code === 'ECONNABORTED') {
      return res.status(504).json({
        error:
          'Generation timed out. On Vercel free tier, functions max out at 10s — upgrade to Vercel Pro or deploy to Railway for 60s.',
      });
    }

    res.status(500).json({ error: `Generation failed: ${msg}` });
  }
}
