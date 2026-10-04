// Family-shared state. One JSON file in the private data repo is the source of truth;
// every phone keeps a local copy so the app still opens without a connection.
import { ls, textToB64, b64ToText, uid } from './util.js';
import { getKeys } from './secrets.js';

const REPO = 'thiefking10/fukuoka-trip-data';
const FILE = 'state.json';
const API = `https://api.github.com/repos/${REPO}/contents`;
const POLL_MS = 45000;

const EMPTY = { v: 1, trip: null, items: {}, missions: {}, expenses: {}, recommended: null };

export const store = {
  state: ls.get('ft.state') || structuredClone(EMPTY),
  status: 'idle', // idle | syncing | ok | offline | error | local
  lastSync: ls.get('ft.lastSync'),
  error: '',
};

let sha = ls.get('ft.sha');
let etag = null;
let dirty = ls.get('ft.dirty') || false;
let pushTimer = null;
let busy = false;
const listeners = new Set();

export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach((fn) => fn());

function saveLocal() {
  ls.set('ft.state', store.state);
  ls.set('ft.dirty', dirty);
}

function setStatus(s, err = '') {
  store.status = s;
  store.error = err;
  emit();
}

const headers = (extra = {}) => ({
  Authorization: `Bearer ${getKeys().gh}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...extra,
});

// Newest edit wins per record, so two phones editing different things never clobber each other.
function mergeMaps(a = {}, b = {}) {
  const out = { ...a };
  for (const [id, rec] of Object.entries(b)) {
    if (!out[id] || (rec.u || 0) > (out[id].u || 0)) out[id] = rec;
  }
  return out;
}

function merge(remote, local) {
  const newer = (x, y) => (!x ? y : !y ? x : (y.u || 0) > (x.u || 0) ? y : x);
  return {
    v: 1,
    trip: newer(remote.trip, local.trip),
    recommended: newer(remote.recommended, local.recommended),
    items: mergeMaps(remote.items, local.items),
    missions: mergeMaps(remote.missions, local.missions),
    expenses: mergeMaps(remote.expenses, local.expenses),
  };
}

export function update(fn) {
  fn(store.state);
  dirty = true;
  saveLocal();
  emit();
  if (!getKeys()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(sync, 1200);
}

export function put(coll, rec) {
  const id = rec.id || uid();
  update((s) => {
    s[coll][id] = { ...s[coll][id], ...rec, id, u: Date.now() };
  });
  return id;
}

export const remove = (coll, id) => put(coll, { id, del: true });

export const list = (coll) => Object.values(store.state[coll] || {}).filter((r) => !r.del);

async function pull() {
  const r = await fetch(`${API}/${FILE}`, {
    headers: headers(etag ? { 'If-None-Match': etag } : {}),
    cache: 'no-store',
  });
  if (r.status === 304) return false;
  if (r.status === 404) return false; // first run: nothing saved yet
  if (r.status === 401 || r.status === 403) throw new Error('깃허브 토큰이 거부되었습니다. 만료됐는지 확인하세요');
  if (!r.ok) throw new Error(`불러오기 실패 (${r.status})`);
  etag = r.headers.get('ETag');
  const body = await r.json();
  sha = body.sha;
  ls.set('ft.sha', sha);
  const remote = JSON.parse(b64ToText(body.content));
  store.state = merge(remote, store.state);
  return true;
}

async function push() {
  const r = await fetch(`${API}/${FILE}`, {
    method: 'PUT',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      message: 'sync',
      content: textToB64(JSON.stringify(store.state)),
      ...(sha ? { sha } : {}),
    }),
  });
  if (r.status === 409 || r.status === 422) return false; // someone saved first: merge and retry
  if (!r.ok) throw new Error(`저장 실패 (${r.status})`);
  const body = await r.json();
  sha = body.content.sha;
  etag = null;
  ls.set('ft.sha', sha);
  return true;
}

export async function sync() {
  if (!getKeys() || busy) return;
  busy = true;
  setStatus('syncing');
  try {
    await pull();
    for (let i = 0; dirty && i < 4; i++) {
      if (await push()) dirty = false;
      else {
        etag = null;
        await pull();
      }
    }
    saveLocal();
    store.lastSync = Date.now();
    ls.set('ft.lastSync', store.lastSync);
    setStatus(dirty ? 'error' : 'ok', dirty ? '저장이 계속 충돌합니다. 잠시 뒤 다시 시도합니다' : '');
  } catch (e) {
    saveLocal();
    setStatus(navigator.onLine ? 'error' : 'offline', e.message);
  } finally {
    busy = false;
  }
}

export function startSync() {
  if (!getKeys()) {
    setStatus('local');
    return;
  }
  sync();
  setInterval(() => document.visibilityState === 'visible' && sync(), POLL_MS);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && sync());
  window.addEventListener('online', sync);
}

// Local preview only: a seed file that never leaves this computer.
export async function seedLocalIfEmpty() {
  if (store.state.trip) return;
  try {
    const r = await fetch('local/seed.json', { cache: 'no-store' });
    if (r.ok) {
      store.state = await r.json();
      saveLocal();
    }
  } catch { /* no seed: the plan view shows its empty state */ }
}

// ---- photos (mission book) ----
const photoUrls = new Map();

export async function savePhoto(name, base64) {
  if (!getKeys()) return { data: `data:image/jpeg;base64,${base64}` };
  const path = `photos/${name}.jpg`;
  const r = await fetch(`${API}/${path}`, {
    method: 'PUT',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message: 'photo', content: base64 }),
  });
  if (!r.ok) throw new Error(`사진 저장 실패 (${r.status})`);
  photoUrls.set(path, `data:image/jpeg;base64,${base64}`);
  return { path };
}

export async function photoUrl(photo) {
  if (!photo) return null;
  if (photo.data) return photo.data;
  if (photoUrls.has(photo.path)) return photoUrls.get(photo.path);
  const cache = 'caches' in window ? await caches.open('ft-photos') : null;
  const hit = await cache?.match(photo.path);
  let blob;
  if (hit) blob = await hit.blob();
  else {
    const r = await fetch(`${API}/${photo.path}`, { headers: headers({ Accept: 'application/vnd.github.raw' }) });
    if (!r.ok) return null;
    blob = await r.blob();
    cache?.put(photo.path, new Response(blob));
  }
  const url = URL.createObjectURL(blob);
  photoUrls.set(photo.path, url);
  return url;
}
