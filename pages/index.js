import { useState, useCallback, useRef, useEffect } from 'react';
import Head from 'next/head';

const BASE_SUFFIX = ', same wall color, same flooring, same ceiling, same windows, identical room architecture, only furniture added, professional real estate photography, photorealistic, natural window lighting, interior design magazine quality, 8k, shot on Canon 5D Mark IV';

const STAGING_STYLES = [
  {
    id: 'modern', name: 'Modern', emoji: '◆', color: 'from-slate-400 to-slate-600',
    description: 'Clean lines, neutral tones',
    prompt: 'existing room with modern contemporary furniture added: low-profile sofa, glass coffee table, accent chair, floor lamp, abstract wall art, neutral area rug' + BASE_SUFFIX,
  },
  {
    id: 'rustic', name: 'Rustic', emoji: '⌂', color: 'from-orange-300 to-amber-600',
    description: 'Warm farmhouse, Pottery Barn',
    prompt: 'existing room with rustic farmhouse furniture added: linen sofa, reclaimed wood coffee table, Edison floor lamp, woven rug, dried floral arrangement, warm wood accents' + BASE_SUFFIX,
  },
  {
    id: 'luxury', name: 'Luxury', emoji: '✦', color: 'from-yellow-500 to-amber-700',
    description: 'High-end, Architectural Digest',
    prompt: 'existing room with luxury designer furniture added: tufted velvet sofa, marble side tables, designer floor lamp, silk rug, large fine art, gold accents, fresh orchids' + BASE_SUFFIX,
  },
  {
    id: 'scandinavian', name: 'Scandinavian', emoji: '❄', color: 'from-sky-200 to-blue-400',
    description: 'White & light wood, cozy hygge',
    prompt: 'existing room with Scandinavian furniture added: birch wood sofa with linen cushions, sheepskin throw, low wood coffee table, pendant lamp, small potted plant' + BASE_SUFFIX,
  },
  {
    id: 'vacant', name: 'Vacant', emoji: '□', color: 'from-gray-200 to-gray-400',
    description: 'Empty, professionally cleaned',
    prompt: 'same room completely empty, all furniture removed, pristine bare floors, clean walls, no objects, vacant listing photo, same wall color, same flooring, same ceiling, same windows, professional real estate photography, 8k',
  },
];

const LOADING_MSGS = [
  'Analyzing room structure…',
  'Selecting furniture…',
  'Placing accent pieces…',
  'Calibrating lighting…',
  'Adding finishing touches…',
  'Almost ready…',
];

function CompareSlider({ beforeUrl, afterUrl }) {
  const [pos, setPos] = useState(50);
  const ref = useRef(null);
  const dragging = useRef(false);

  const calc = useCallback((clientX) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(2, Math.min(98, ((clientX - r.left) / r.width) * 100)));
  }, []);

  useEffect(() => {
    const up = () => { dragging.current = false; };
    const move = (e) => { if (dragging.current) calc(e.clientX ?? e.touches?.[0]?.clientX); };
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
    <div ref={ref} className="relative select-none overflow-hidden rounded-2xl shadow-2xl cursor-ew-resize" onClick={(e) => calc(e.clientX)}>
      <img src={afterUrl} alt="Staged" className="w-full block" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={beforeUrl} alt="Original" className="w-full h-full object-cover" draggable={false} />
      </div>
      <div className="absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.3)]" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}>
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
      <span className="absolute top-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-sm text-white text-xs font-bold rounded-full tracking-widest">BEFORE</span>
      <span className="absolute top-4 right-4 px-3 py-1 bg-black/50 backdrop-blur-sm text-white text-xs font-bold rounded-full tracking-widest">AFTER</span>
    </div>
  );
}

export default function Home() {
  const [originalImage, setOriginalImage] = useState(null);
  const [selectedStyleId, setSelectedStyleId] = useState('modern');
  const [results, setResults] = useState([]);
  const [activeResultId, setActiveResultId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  const fileInputRef = useRef(null);

  const selectedStyle = STAGING_STYLES.find((s) => s.id === selectedStyleId);
  const activeResult = results.find((r) => r.id === activeResultId);
  const view = isGenerating ? 'generating' : activeResultId && activeResult ? 'result' : originalImage ? 'configure' : 'upload';

  useEffect(() => {
    if (!isGenerating) return;
    const t = setInterval(() => setMsgIndex((i) => (i + 1) % LOADING_MSGS.length), 3000);
    return () => clearInterval(t);
  }, [isGenerating]);

  const handleFile = useCallback((file) => {
    if (!file?.type.startsWith('image/')) return;
    setOriginalImage({ file, dataUrl: URL.createObjectURL(file) });
    setResults([]);
    setActiveResultId(null);
    setError(null);
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setMsgIndex(0);
    try {
      const blob = await resizeImage(originalImage.file, 1024);
      const fd = new FormData();
      fd.append('image', blob, 'room.jpg');
      fd.append('prompt', selectedStyle.prompt);

      const res = await fetch('/api/stage', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      const result = { id: `${Date.now()}`, styleId: selectedStyleId, styleName: selectedStyle.name, imageUrl: data.image };
      setResults((prev) => [...prev, result]);
      setActiveResultId(result.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const download = (url, name) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `staged-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.jpg`;
    a.click();
  };

  return (
    <>
      <Head>
        <title>StageCraft AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center">
          <span className="font-bold text-gray-900">StageCraft <span className="text-blue-700">AI</span></span>
        </div>
      </header>

      <main>
        {/* UPLOAD */}
        {view === 'upload' && (
          <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 bg-gradient-to-b from-blue-50/50 to-white">
            <div className="max-w-lg w-full text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Virtual Room Staging</h1>
              <p className="text-gray-500 mb-8">Upload a room photo to generate AI-staged versions</p>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-14 cursor-pointer transition-all ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/40'}`}
              >
                <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} className="hidden" />
                <div className="text-4xl mb-3">📷</div>
                <p className="font-semibold text-gray-700">{isDragging ? 'Drop it!' : 'Drop room photo here'}</p>
                <p className="text-sm text-gray-400 mt-1">or click to browse</p>
              </div>
            </div>
          </div>
        )}

        {/* CONFIGURE */}
        {view === 'configure' && (
          <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-60 flex-shrink-0">
                <div className="lg:sticky lg:top-20">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Room Photo</p>
                  <div className="relative rounded-2xl overflow-hidden shadow-lg">
                    <img src={originalImage.dataUrl} alt="Room" className="w-full" />
                    <button onClick={() => { setOriginalImage(null); setResults([]); }} className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center text-lg leading-none transition-colors">×</button>
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-5">Choose Staging Style</h2>
                {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {STAGING_STYLES.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => { setSelectedStyleId(s.id); setError(null); }}
                      className={`relative cursor-pointer rounded-xl overflow-hidden transition-all group ${selectedStyleId === s.id ? 'ring-2 ring-blue-600 ring-offset-2 scale-[1.03]' : 'hover:scale-[1.03]'}`}
                    >
                      <div className={`aspect-square bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                        <span className="text-3xl group-hover:scale-110 transition-transform">{s.emoji}</span>
                      </div>
                      <div className="p-2 bg-white border-t border-gray-100">
                        <div className="text-xs font-semibold text-gray-900">{s.name}</div>
                        <div className="text-[11px] text-gray-400 leading-tight">{s.description}</div>
                      </div>
                      {selectedStyleId === s.id && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button onClick={handleGenerate} className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-2xl text-base shadow-lg shadow-blue-200/60 transition-all">
                  Generate {selectedStyle?.name} Staging →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GENERATING */}
        {view === 'generating' && (
          <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
            <div className="text-center max-w-xs">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${selectedStyle?.color} flex items-center justify-center text-2xl shadow-md`}>{selectedStyle?.emoji}</div>
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Staging with {selectedStyle?.name}</h2>
              <p className="text-gray-500 text-sm">{LOADING_MSGS[msgIndex]}</p>
              <p className="text-xs text-gray-400 mt-3">Usually 15–30 seconds</p>
            </div>
          </div>
        )}

        {/* RESULT */}
        {view === 'result' && activeResult && (
          <div className="max-w-5xl mx-auto px-4 py-8">
            <CompareSlider beforeUrl={originalImage.dataUrl} afterUrl={activeResult.imageUrl} />
            <p className="text-center text-xs text-gray-400 mt-2 mb-5">← Drag to compare</p>

            {results.length > 1 && (
              <div className="flex gap-2 flex-wrap mb-4">
                {results.map((r) => {
                  const s = STAGING_STYLES.find((x) => x.id === r.styleId);
                  return (
                    <button key={r.id} onClick={() => setActiveResultId(r.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${activeResultId === r.id ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {s?.emoji} {r.styleName}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => download(activeResult.imageUrl, activeResult.styleName)} className="flex-1 py-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Download
              </button>
              <button onClick={() => { setActiveResultId(null); setError(null); }} className="flex-1 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">Try Another Style</button>
              <button onClick={() => { setOriginalImage(null); setResults([]); setActiveResultId(null); }} className="px-5 py-3 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 transition-colors">New Room</button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function resizeImage(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > max || height > max) {
        if (width > height) { height = Math.round(height * max / width); width = max; }
        else { width = Math.round(width * max / height); height = max; }
      }
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      c.getContext('2d').drawImage(img, 0, 0, width, height);
      c.toBlob(resolve, 'image/jpeg', 0.92);
    };
    img.onerror = reject;
    img.src = url;
  });
}
