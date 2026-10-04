// Small DOM and formatting helpers shared by every view.

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

// replaceChildren() would print the word "null" for skipped pieces, so drop them first.
export function mount(root, ...kids) {
  root.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const ls = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked: the app keeps working from memory */
    }
  },
  del(key) {
    try {
      localStorage.removeItem(key);
    } catch { /* ignore */ }
  },
};

export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function nowHM(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export function dayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return { md: `${m}/${d}`, dow: DOW[dt.getDay()], dowIdx: dt.getDay() };
}

export function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const a = new Date(y, m - 1, d);
  const t = new Date();
  const b = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((a - b) / 86400000);
}

export function distKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Rough door-to-door feel for a family that mostly rides taxis.
export function distText(km) {
  if (km == null) return '';
  if (km < 0.35) return `걸어서 ${Math.max(1, Math.round(km * 15))}분`;
  const taxi = Math.max(3, Math.round(km * 3.2 + 2));
  return `${km < 10 ? km.toFixed(1) : Math.round(km)}km · 택시 약 ${taxi}분`;
}

export const yen = (n) => `${Math.round(n).toLocaleString('ko-KR')}엔`;
export const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;

export function mapsDirUrl(place) {
  const q = [place.name_ja, place.address_ja].filter(Boolean).join(' ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

export function mapsSearchUrl(query, pos) {
  const base = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  return pos ? `${base}/@${pos.lat.toFixed(5)},${pos.lng.toFixed(5)},16z` : base;
}

export function toast(msg, ms = 2600) {
  const host = document.getElementById('toasts');
  const el = h('div', { class: 'toast', role: 'status' }, msg);
  host.append(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

// Bottom sheet. Returns a close function.
export function sheet(title, body, opts = {}) {
  const close = () => {
    wrap.remove();
    document.removeEventListener('keydown', onKey);
    opts.onClose?.();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  const wrap = h(
    'div',
    { class: 'sheet-wrap', onclick: (e) => e.target === wrap && close() },
    h(
      'div',
      { class: `sheet ${opts.full ? 'sheet-full' : ''}`, role: 'dialog', 'aria-label': title },
      h(
        'div',
        { class: 'sheet-head' },
        h('h2', null, title),
        h('button', { class: 'icon-btn', 'aria-label': '닫기', onclick: close }, '✕'),
      ),
      h('div', { class: 'sheet-body' }, body),
    ),
  );
  document.body.append(wrap);
  document.addEventListener('keydown', onKey);
  return close;
}

export function confirmSheet(title, message, okLabel, onOk) {
  const close = sheet(
    title,
    h(
      'div',
      null,
      h('p', { class: 'muted' }, message),
      h(
        'div',
        { class: 'row gap' },
        h('button', { class: 'btn ghost grow', onclick: () => close() }, '취소'),
        h('button', { class: 'btn danger grow', onclick: () => { close(); onOk(); } }, okLabel),
      ),
    ),
  );
}

// Shrinks a photo so uploads stay small on roaming data.
export async function shrinkImage(file, maxSide = 1280, quality = 0.82) {
  const bmp = await createImageBitmap(file).catch(() => null);
  let w, hgt, src;
  if (bmp) {
    w = bmp.width; hgt = bmp.height; src = bmp;
  } else {
    src = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
    w = src.naturalWidth; hgt = src.naturalHeight;
  }
  const k = Math.min(1, maxSide / Math.max(w, hgt));
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * k);
  cv.height = Math.round(hgt * k);
  cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
  const dataUrl = cv.toDataURL('image/jpeg', quality);
  return { dataUrl, base64: dataUrl.split(',')[1] };
}

export const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
export function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const textToB64 = (text) => bytesToB64(new TextEncoder().encode(text));
export const b64ToText = (b64) => new TextDecoder().decode(b64ToBytes(b64.replace(/\s/g, '')));
