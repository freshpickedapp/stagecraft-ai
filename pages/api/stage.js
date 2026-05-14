import formidable from 'formidable';
import FormData from 'form-data';
import axios from 'axios';
import sharp from 'sharp';

export const config = { api: { bodyParser: false } };

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
  const negativePrompt = fields.negative_prompt?.[0] || '';
  if (!prompt) return res.status(400).json({ error: 'Staging prompt required.' });

  // Resize image to max 1024px, dimensions must be multiples of 64
  let imageBuffer, imgW, imgH;
  try {
    const meta = await sharp(imageFile.filepath).metadata();
    let w = meta.width, h = meta.height;
    const maxDim = 1024;
    if (w > maxDim || h > maxDim) {
      if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
      else { w = Math.round(w * maxDim / h); h = maxDim; }
    }
    // Round to nearest multiple of 64 (Stability AI requirement)
    w = Math.round(w / 64) * 64;
    h = Math.round(h / 64) * 64;

    imageBuffer = await sharp(imageFile.filepath)
      .resize(w, h)
      .jpeg({ quality: 90 })
      .toBuffer();

    imgW = w;
    imgH = h;
  } catch {
    return res.status(400).json({ error: 'Could not process image.' });
  }

  // Generate inpainting mask:
  // Black (0)   = preserve exactly (upper room: ceiling, windows, upper walls)
  // White (255) = AI fills here   (lower room: floor, furniture zone, lower walls)
  // Smooth gradient transition in the middle to avoid harsh seams
  const maskBuffer = await generateStagingMask(imgW, imgH);

  const formData = new FormData();
  formData.append('image', imageBuffer, { filename: 'room.jpg', contentType: 'image/jpeg' });
  formData.append('mask', maskBuffer, { filename: 'mask.png', contentType: 'image/png' });
  formData.append('prompt', prompt);
  formData.append('negative_prompt', negativePrompt || 'blurry, distorted, low quality, cartoon, people, text, watermark, changed walls, changed windows, different room');
  formData.append('output_format', 'jpeg');

  try {
    const response = await axios.post(
      'https://api.stability.ai/v2beta/stable-image/edit/inpaint',
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

    res.json({ image: `data:image/jpeg;base64,${response.data.image}` });
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.response?.data?.errors?.[0] || err.message;
    if (status === 401) return res.status(401).json({ error: 'Invalid Stability AI API key.' });
    if (status === 402) return res.status(402).json({ error: 'Insufficient Stability AI credits.' });
    if (status === 429) return res.status(429).json({ error: 'Rate limit reached. Try again in a moment.' });
    res.status(500).json({ error: `Generation failed: ${msg}` });
  }
}

// Mask: top 30% black (preserve), bottom 50% white (add furniture), gradient between
async function generateStagingMask(width, height) {
  const pixels = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    const ratio = y / height;
    let v;
    if (ratio < 0.30) v = 0;
    else if (ratio > 0.58) v = 255;
    else v = Math.round(((ratio - 0.30) / 0.28) * 255);
    pixels.fill(v, y * width, (y + 1) * width);
  }
  return sharp(pixels, { raw: { width, height, channels: 1 } }).png().toBuffer();
}
