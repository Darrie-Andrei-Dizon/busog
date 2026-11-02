// Barcode scanning and Open Food Facts lookup.
// Scanning uses the browser's BarcodeDetector (Chrome on Android and most
// desktop Chrome). Where it's missing, people type the number instead.

export const canScan = () => typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

let stream = null;
let timer = null;

export async function startScan(video, onCode) {
  stopScan();
  const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  video.srcObject = stream;
  await video.play();
  timer = setInterval(async () => {
    try {
      const codes = await detector.detect(video);
      if (codes.length) {
        const code = codes[0].rawValue;
        stopScan();
        onCode(code);
      }
    } catch { /* keep trying */ }
  }, 300);
}

export function stopScan() {
  clearInterval(timer);
  timer = null;
  if (stream) for (const t of stream.getTracks()) t.stop();
  stream = null;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// Look up a product. Resolves to a food draft, null when not found, or
// throws when the database can't be reached.
export async function lookup(code) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,nutriments,serving_size,serving_quantity`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const n = p.nutriments || {};
    const kcal = num(n['energy-kcal_100g']) ?? (num(n.energy_100g) != null ? n.energy_100g / 4.184 : null);
    if (kcal == null) return null;
    const sodiumG = num(n.sodium_100g) ?? (num(n.salt_100g) != null ? n.salt_100g / 2.5 : null);
    const servingG = num(p.serving_quantity);
    return {
      name: [p.product_name, p.brands?.split(',')[0]].filter(Boolean).join(', ') || `Product ${code}`,
      kcal: Math.round(kcal),
      protein: num(n.proteins_100g) ?? 0,
      carbs: num(n.carbohydrates_100g) ?? 0,
      fat: num(n.fat_100g) ?? 0,
      sodium: sodiumG != null ? Math.round(sodiumG * 1000) : null,
      servingG: servingG > 0 ? servingG : null,
      servingLabel: p.serving_size || null,
      source: 'Open Food Facts (community data; check against the label)',
      sourceUrl: `https://world.openfoodfacts.org/product/${encodeURIComponent(code)}`,
    };
  } finally {
    clearTimeout(t);
  }
}
