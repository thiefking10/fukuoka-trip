// Locks the two keys with the family passcode and writes secrets.enc.json.
// Run it yourself in a terminal:  node tools/setup-keys.mjs
// Nothing typed here is shown on screen or saved anywhere except the locked file.
import { webcrypto as crypto } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ITER = 600000;
const REPO = 'thiefking10/fukuoka-trip-data';
const OUT = process.env.FT_SETUP_OUT || join(dirname(fileURLToPath(import.meta.url)), '..', 'secrets.enc.json');

function askHidden(label) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          return resolve(value.trim());
        }
        if (ch === '\u0003') { stdout.write('\n취소했습니다.\n'); process.exit(1); }
        if (ch === '\u007f' || ch === '\b') { value = [...value].slice(0, -1).join(''); continue; }
        if (ch >= ' ') value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

const b64 = (bytes) => Buffer.from(bytes).toString('base64');

export async function lock(keys, passcode) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode.trim().normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(keys)));
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

async function checkGithub(token) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/state.json`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (r.status === 200 || r.status === 404) return r.status === 200 ? '확인됨 (일정 파일을 읽었습니다)' : '확인됨 (저장소에 접근됩니다)';
  throw new Error(r.status === 401 ? '토큰이 올바르지 않습니다' : `저장소에 접근하지 못했습니다 (${r.status}). 토큰에 ${REPO} 저장소와 Contents 권한이 있는지 확인하세요`);
}

async function checkGemini(key) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { headers: { 'x-goog-api-key': key } });
  if (r.ok) return '확인됨';
  throw new Error(`제미나이 키가 거부되었습니다 (${r.status})`);
}

async function main() {
  // Test hook: lets the lock/unlock round trip be checked with throwaway values.
  if (process.env.FT_SETUP_TEST) {
    writeFileSync(OUT, JSON.stringify(await lock({ gh: 'test-gh', gm: 'test-gm' }, process.env.FT_SETUP_TEST), null, 2));
    console.log(`test file written: ${OUT}`);
    return;
  }
  if (!process.stdin.isTTY) {
    console.error('터미널에서 직접 실행해 주세요:  node tools/setup-keys.mjs');
    process.exit(1);
  }
  console.log('\n후쿠오카 가족여행 앱 - 키 잠그기');
  console.log('입력하는 글자는 화면에 보이지 않습니다. 붙여 넣고 엔터를 누르세요.\n');

  const gh = await askHidden('1) 깃허브 토큰 (github_pat_...): ');
  try { console.log(`   ${await checkGithub(gh)}`); } catch (e) { console.error(`   ${e.message}`); process.exit(1); }

  const gm = await askHidden('2) 제미나이 API 키: ');
  try { console.log(`   ${await checkGemini(gm)}`); } catch (e) { console.error(`   ${e.message}`); process.exit(1); }

  let pass;
  for (;;) {
    pass = await askHidden('3) 가족 암호 (12글자 이상 권장): ');
    if (pass.length < 8) { console.log('   너무 짧습니다. 8글자 이상으로 정해 주세요.'); continue; }
    const again = await askHidden('   가족 암호 한 번 더: ');
    if (again === pass) break;
    console.log('   두 번 입력한 암호가 다릅니다. 다시 입력해 주세요.');
  }

  writeFileSync(OUT, JSON.stringify(await lock({ gh, gm }, pass), null, 2));
  console.log(`\n완료: ${OUT}`);
  console.log('이 파일은 잠겨 있어서 깃허브에 올려도 됩니다. 가족 암호는 가족에게만 알려 주세요.\n');
}

main();
