// The two keys ship as a file locked with the family passcode (see tools/setup-keys.mjs).
// Unlocking happens once per phone; the opened keys then stay in that phone's storage.
import { ls, b64ToBytes } from './util.js';

const KEY = 'ft.keys';

export const getKeys = () => ls.get(KEY);
export const forgetKeys = () => ls.del(KEY);

export async function fetchLockedFile() {
  try {
    const r = await fetch('secrets.enc.json', { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function unlock(locked, passcode) {
  const pw = new TextEncoder().encode(passcode.trim().normalize('NFC'));
  const base = await crypto.subtle.importKey('raw', pw, 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: b64ToBytes(locked.salt), iterations: locked.iter },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(locked.iv) }, key, b64ToBytes(locked.ct));
  } catch {
    throw new Error('가족 암호가 맞지 않습니다');
  }
  const keys = JSON.parse(new TextDecoder().decode(plain));
  ls.set(KEY, keys);
  return keys;
}
