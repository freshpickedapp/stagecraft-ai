import { useState, useCallback, useRef, useEffect } from 'react';
import Head from 'next/head';

// ─── Staging styles ───────────────────────────────────────────────────────────

const STAGING_STYLES = [
  {
    id: 'modern',
    name: 'Modern',
    emoji: '◆',
    color: 'from-slate-400 to-slate-600',
    description: 'Clean lines, neutral palette',
    prompt:
      'virtually staged real estate interior, modern contemporary furniture, clean architectural lines, neutral beige white gray palette, designer sofa, glass coffee table, statement artwork, potted plant, warm hardwood floors, bright natural light, photo-realistic, professional real estate photography, ultra detailed, 8K',
    negative:
      'people, person, text, watermark, logo, blurry, distorted, low quality, cartoon, painting, ugly, crowded, cluttered',
  },
  {
    id: 'luxury',
    name: 'Luxury',
    emoji: '✦',
    color: 'from-yellow-500 to-amber-700',
    description: 'Opulent, high-end elegance',
    prompt:
      'virtually staged luxury real estate interior, expensive designer furniture, marble accent surfaces, plush velvet sofa, crystal chandelier, polished gold fixtures, large statement artwork, silk area rug, fresh orchids, candles, sophisticated opulent staging, photo-realistic, luxury real estate photography, ultra detailed, 8K',
    negative:
      'people, person, text, watermark, logo, blurry, distorted, low quality, cartoon, cheap, ikea',
  },
  {
    id: 'scandinavian',
    name: 'Scandinavian',
    emoji: '❄',
    color: 'from-sky-200 to-blue-400',
    description: 'Light wood, cozy hygge',
    prompt:
      'virtually staged Scandinavian interior design, light birch wood furniture, crisp white walls, hygge cozy atmosphere, minimalist clean design, sheepskin throw, knitted pillow, potted greenery, warm ambient pendant lighting, linen curtains, photo-realistic, real estate photography, ultra detailed, 8K',
    negative:
      'people, person, text, watermark, logo, blurry, distorted, low quality, cartoon, dark, heavy, cluttered',
  },
  {
    id: 'farmhouse',
    name: 'Farmhouse',
    emoji: '⌂',
    color: 'from-orange-300 to-amber-600',
    description: 'Rustic warmth, vintage charm',
    prompt:
      'virtually staged rustic farmhouse interior, white shiplap wall detail, reclaimed wood furniture and accents, cozy warm neutral tones, vintage Edison bulb pendant light, wrought iron fixtures, cotton linen textiles, wicker basket, dried flowers, antique accents, photo-realistic, real estate photography, ultra detailed, 8K',
    negative:
      'people, person, text, watermark, logo, blurry, distorted, low quality, cartoon, modern, sleek',
  },
  {
    id: 'coastal',
    name: 'Coastal',
    emoji: '〰',
    color: 'from-cyan-300 to-blue-500',
    description: 'Breezy beach-house vibes',
    prompt:
      'virtually staged coastal beach house interior, soft blue white color palette, rattan wicker furniture, natural linen textiles, sea glass and driftwood decor, whitewashed wood accent, tropical potted plant, bright airy open atmosphere, ocean-inspired accessories, photo-realistic, real estate photography, ultra detailed, 8K',
    negative:
      'people, person, text, watermark, logo, blurry, distorted, low quality, cartoon, dark, heavy',
  },
  {
    id: 'industrial',
    name: 'Industrial',
    emoji: '⚙',
    color: 'from-zinc-400 to-zinc-700',
    description: 'Urban loft, raw materials',
    prompt:
      'virtually staged industrial loft interior, exposed dark brick wall texture, metal pipe shelving, dark leather sofa, Edison bulb cage pendant lights, concrete and steel elements, vintage industrial furniture, matte black fixtures, factory-inspired decor, photo-realistic, real estate photography, ultra detailed, 8K',
    negative:
      'people, person, text, watermark, logo, blurry, distorted, low quality, cartoon, feminine, pastel, rustic',
  },
  {
    id: 'bohemian',
    name: 'Bohemian',
    emoji: '✿',
    color: 'from-rose-300 to-purple-500',
    description: 'Eclectic, free-spirited art',
    prompt:
      'virtually staged bohemian interior design, eclectic layered colorful textiles, macrame wall hanging, rattan chair, patterned area rug, abundant tropical plants, ethnic-inspired accessories, warm amber pendant lamp, artistic free-spirited decor, photo-realistic, real estate photography, ultra detailed, 8K',
    negative:
      'people, person, text, watermark, logo, blurry, distorted, low quality, cartoon, minimalist, cold, gray',
  },
  {
    id: 'empty',
    name: 'Empty Room',
    emoji: '□',
    color: 'from-gray-200 to-gray-400',
    description: 'Clean, furniture-free space',
    prompt:
      'professional real estate photography of completely empty clean room, freshly painted bright white walls, clean bare hardwood floors, no furniture no objects no decoration, even professional real estate lighting, immaculate and pristine, photo-realistic, professional real estate photography, ultra detailed, 8K',
    negative:
      'people, person, furniture, objects, plants, decoration, text, watermark, logo, blurry, distorted',
  },
];

const LOADING_MESSAGES = [
  'Analyzing room structure…',
  'Selecting the perfect furniture…',
  'Placing accent pieces…',
  'Calibrating lighting and shadows…',
  'Adding finishing touches…',
  'Polishing every detail…',
  'Almost ready…',
];

// ─── CompareSlider ─────────────────────────────────────────────────────────────

function CompareSlider({ beforeUrl, afterUrl }) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef(null);
  const dragging = useRef(false);

  const calc = useCallback((clientX) => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(2, Math.min(98, ((clientX - r.left) / r.width) * 100)));
  }, []);

  useEffect(() => {
    const up = () => { dragging.current = false; };
    const move = (e) => {
      if (dragging.current) calc(e.clientX ?? e.touches?.[0]?.clientX);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, [calc]);

  return (
    <div
      ref={containerRef}
      className="relative select-none overflow-hidden rounded-2xl shadow-2xl cursor-ew-resize"
      onClick={(e) => calc(e.clientX)}
    >
      <img src={afterUrl} alt="Staged" className="w-full block" draggable={false} />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <img src={beforeUrl} alt="Original" className="w-full h-full object-cover" draggable={false} />
      </div>

      {/* Divider */}
      <div
        className="absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.35)]"
        style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 bg-white rounded-full shadow-2xl flex items-center justify-center border border-gray-100 cursor-ew-resize"
          onMouseDown={(e) => { e.preventDefault(); dragging.current = true; }}
          onTouchStart={() => { dragging.current = true; }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M6 3.5L2 9l4 5.5" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 3.5L16 9l-4 5.5" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <span className="absolute top-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-sm text-white text-xs font-bold rounded-full tracking-widest">
        BEFORE
      </span>
      <span className="absolute top-4 right-4 px-3 py-1 bg-black/50 backdrop-blur-sm text-white text-xs font-bold rounded-full tracking-widest">
        AFTER
      </span>
    </div>
  );
}

// ─── StyleCard ─────────────────────────────────────────────────────────────────

function StyleCard({ style, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`relative cursor-pointer rounded-xl overflow-hidden transition-all duration-200 group ${
        selected ? 'ring-2 ring-blue-600 ring-offset-2 scale-[1.04]' : 'hover:scale-[1.04]'
      }`}
    >
      <div className={`aspect-square bg-gradient-to-br ${style.color} flex items-center justify-center`}>
        <span className="text-4xl drop-shadow group-hover:scale-110 transition-transform duration-200 leading-none">
          {style.emoji}
        </span>
      </div>
      <div className="p-2.5 bg-white border-t border-gray-100">
        <div className="text-xs font-semibold text-gray-900">{style.name}</div>
        <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">{style.description}</div>
      </div>
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ─── SettingsModal ─────────────────────────────────────────────────────────────

function SettingsModal({ currentKey, onSave, onClose }) {
  const [input, setInput] = useState(currentKey);

  const save = () => {
    onSave(input.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-6">Connect your Stability AI account to start generating.</p>

        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Stability AI API Key</label>
        <p className="text-sm text-gray-500 mb-3">
          Get a free key at{' '}
          <a
            href="https://platform.stability.ai/account/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-medium"
          >
            platform.stability.ai →
          </a>
        </p>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="sk-..."
          autoFocus
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
        <p className="text-xs text-gray-400 mt-2">🔒 Stored only in your browser — never sent to our servers</p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setInput('')}
            className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={save}
            className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Save Key
          </button>
        </div>

        <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
          <p className="text-xs text-amber-700">
            💡 Each staging uses ~3 Stability AI credits (≈$0.03–0.04). New accounts receive free credits to start.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [originalImage, setOriginalImage] = useState(null);
  const [selectedStyleId, setSelectedStyleId] = useState('modern');
  const [controlStrength, setControlStrength] = useState('0.80');
  const [results, setResults] = useState([]);
  const [activeResultId, setActiveResultId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  const fileInputRef = useRef(null);

  const selectedStyle = STAGING_STYLES.find((s) => s.id === selectedStyleId);
  const activeResult = results.find((r) => r.id === activeResultId);

  const view = isGenerating
    ? 'generating'
    : activeResultId && activeResult
    ? 'result'
    : originalImage
    ? 'configure'
    : 'upload';

  useEffect(() => {
    const stored = localStorage.getItem('stagecraft_api_key');
    if (stored) setApiKey(stored);
  }, []);

  useEffect(() => {
    if (!isGenerating) return;
    const t = setInterval(() => setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length), 3000);
    return () => clearInterval(t);
  }, [isGenerating]);

  const saveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('stagecraft_api_key', key);
  };

  const handleFileSelect = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, or WEBP).');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Image must be under 20MB.');
      return;
    }
    const dataUrl = URL.createObjectURL(file);
    setOriginalImage({ file, dataUrl });
    setResults([]);
    setActiveResultId(null);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files?.[0]);
    },
    [handleFileSelect]
  );

  const handleGenerate = async () => {
    if (!apiKey) { setShowSettings(true); return; }
    setIsGenerating(true);
    setError(null);
    setMsgIndex(0);

    try {
      const resizedBlob = await resizeImage(originalImage.file, 1024);
      const formData = new FormData();
      formData.append('image', resizedBlob, 'room.jpg');
      formData.append('prompt', selectedStyle.prompt);
      formData.append('negative_prompt', selectedStyle.negative);
      formData.append('control_strength', controlStrength);

      const response = await fetch('/api/stage', {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Generation failed. Please try again.');

      const result = { id: `${Date.now()}`, styleId: selectedStyleId, styleName: selectedStyle.name, imageUrl: data.image };
      setResults((prev) => [...prev, result]);
      setActiveResultId(result.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (imageUrl, styleName) => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `staged-${styleName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.jpg`;
    a.click();
  };

  const handleNewRoom = () => {
    setOriginalImage(null);
    setResults([]);
    setActiveResultId(null);
    setError(null);
    setSelectedStyleId('modern');
  };

  return (
    <>
      <Head>
        <title>StageCraft AI — Virtual Room Staging</title>
        <meta name="description" content="AI-powered virtual staging for real estate agents. Transform any room photo instantly." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏠</text></svg>" />
      </Head>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-700 to-blue-500 rounded-lg flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">
              StageCraft <span className="text-blue-700">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {apiKey && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full font-medium">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                API Key Set
              </span>
            )}
            <a
              href="https://platform.stability.ai/account/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:block text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Get API Key
            </a>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* ── UPLOAD ── */}
        {view === 'upload' && (
          <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-blue-50/60 to-white flex flex-col items-center justify-center px-4 py-16">
            <div className="max-w-3xl w-full">
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  AI-Powered Virtual Staging
                </div>
                <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 leading-tight">
                  Stage Any Room.{' '}
                  <span className="text-blue-700">Instantly.</span>
                </h1>
                <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
                  Upload a room photo, pick a staging style, and get a hyper-realistic staged version in seconds.
                  No stagers. No trucks. No $3,000 bills.
                </p>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                    : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                  className="hidden"
                />
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-gray-700 mb-1">
                  {isDragging ? 'Drop it here!' : 'Drop your room photo here'}
                </p>
                <p className="text-sm text-gray-400">or click to browse · JPG, PNG, WEBP · up to 20MB</p>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">
                  {error}
                </div>
              )}

              <div className="mt-12 grid grid-cols-3 gap-6 text-center">
                {[
                  { icon: '📷', n: '01', title: 'Upload Room', desc: 'Any room photo — empty or furnished' },
                  { icon: '🎨', n: '02', title: 'Choose Style', desc: 'Modern, Luxury, Farmhouse & more' },
                  { icon: '⬇️', n: '03', title: 'Download', desc: 'Hyper-realistic staged image, ready to use' },
                ].map((s) => (
                  <div key={s.n}>
                    <div className="text-2xl mb-2">{s.icon}</div>
                    <div className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-1">{s.n}</div>
                    <div className="font-semibold text-gray-800 text-sm mb-1">{s.title}</div>
                    <div className="text-xs text-gray-400 leading-relaxed">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIGURE ── */}
        {view === 'configure' && (
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-64 flex-shrink-0">
                <div className="lg:sticky lg:top-24">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Your Room</p>
                  <div className="relative rounded-2xl overflow-hidden shadow-lg">
                    <img src={originalImage.dataUrl} alt="Uploaded room" className="w-full block" />
                    <button
                      onClick={handleNewRoom}
                      className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center text-xl leading-none transition-colors"
                      title="Upload a different photo"
                    >
                      ×
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-2">Tap × to use a different photo</p>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Choose Your Staging Style</h1>

                {error && (
                  <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                  {STAGING_STYLES.map((style) => (
                    <StyleCard
                      key={style.id}
                      style={style}
                      selected={selectedStyleId === style.id}
                      onClick={() => { setSelectedStyleId(style.id); setError(null); }}
                    />
                  ))}
                </div>

                <div className="mb-8">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Staging Intensity</p>
                  <div className="flex gap-2">
                    {[
                      { value: '0.70', label: 'Subtle', hint: 'Closer to original' },
                      { value: '0.80', label: 'Balanced', hint: '✦ Recommended' },
                      { value: '0.88', label: 'Bold', hint: 'Maximum change' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setControlStrength(opt.value)}
                        className={`flex-1 py-2.5 px-2 rounded-xl text-sm text-center border transition-all ${
                          controlStrength === opt.value
                            ? 'border-blue-500 bg-blue-50 text-blue-800'
                            : 'border-gray-200 text-gray-600 hover:border-blue-200 bg-white'
                        }`}
                      >
                        <div className="font-semibold">{opt.label}</div>
                        <div className="text-[11px] opacity-60 mt-0.5">{opt.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  className="w-full py-4 bg-blue-700 hover:bg-blue-800 active:scale-[0.99] text-white font-bold rounded-2xl text-lg shadow-lg shadow-blue-200/80 transition-all"
                >
                  Generate {selectedStyle?.name} Staging →
                </button>

                {!apiKey && (
                  <p className="text-center text-sm text-amber-700 mt-3">
                    ⚠️ You need a{' '}
                    <button onClick={() => setShowSettings(true)} className="underline font-semibold hover:text-amber-800">
                      Stability AI API key
                    </button>{' '}
                    to generate stagings.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── GENERATING ── */}
        {view === 'generating' && (
          <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
            <div className="text-center max-w-sm w-full">
              <div className="relative w-28 h-28 mx-auto mb-7">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${selectedStyle?.color} flex items-center justify-center text-3xl shadow-lg`}>
                    {selectedStyle?.emoji}
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Staging with {selectedStyle?.name}
              </h2>
              <p className="text-gray-500 text-sm min-h-[20px]">
                {LOADING_MESSAGES[msgIndex]}
              </p>
              <p className="text-xs text-gray-400 mt-4">Typically 15–30 seconds</p>

              <div className="mt-8 rounded-xl overflow-hidden opacity-30 shadow-md">
                <img src={originalImage?.dataUrl} alt="Original" className="w-full block" />
              </div>
            </div>
          </div>
        )}

        {/* ── RESULT ── */}
        {view === 'result' && activeResult && (
          <div className="max-w-5xl mx-auto px-4 py-8">
            <CompareSlider beforeUrl={originalImage.dataUrl} afterUrl={activeResult.imageUrl} />

            <p className="text-center text-xs text-gray-400 mt-3 mb-6">
              ← Drag the handle to compare before &amp; after
            </p>

            {results.length > 1 && (
              <div className="flex gap-2 mb-5 flex-wrap">
                {results.map((r) => {
                  const s = STAGING_STYLES.find((x) => x.id === r.styleId);
                  return (
                    <button
                      key={r.id}
                      onClick={() => setActiveResultId(r.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        activeResultId === r.id
                          ? 'bg-blue-700 text-white shadow-md'
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
                      }`}
                    >
                      <span>{s?.emoji}</span> {r.styleName}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleDownload(activeResult.imageUrl, activeResult.styleName)}
                className="flex-1 py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-200/60"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Image
              </button>
              <button
                onClick={() => { setActiveResultId(null); setError(null); }}
                className="flex-1 py-3.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Try Another Style
              </button>
              <button
                onClick={handleNewRoom}
                className="sm:w-auto px-6 py-3.5 border border-gray-200 text-gray-500 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                New Room
              </button>
            </div>
          </div>
        )}
      </main>

      {showSettings && (
        <SettingsModal currentKey={apiKey} onSave={saveApiKey} onClose={() => setShowSettings(false)} />
      )}
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resizeImage(file, maxDimension) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(resolve, 'image/jpeg', 0.92);
    };
    img.onerror = reject;
    img.src = url;
  });
}
