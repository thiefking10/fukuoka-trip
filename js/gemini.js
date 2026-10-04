// Calls to the Gemini API straight from the phone. Every prompt asks for JSON so the
// views can lay the answer out instead of dumping a wall of text.
import { getKeys } from './secrets.js';
import { ls } from './util.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
// Tried in order. If none of these exist any more, the model list is asked for a flash model.
const PREFERRED = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];

let model = ls.get('ft.model');

async function discoverModel(key) {
  const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
  if (!r.ok) return null;
  const names = ((await r.json()).models || [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace('models/', ''))
    .filter((n) => n.includes('flash') && !/tts|image|audio|live|embedding/.test(n));
  return names.find((n) => !n.includes('lite') && !n.includes('preview')) || names[0] || null;
}

async function call(m, key, parts) {
  return fetch(`${BASE}/models/${m}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    }),
  });
}

export const hasAI = () => !!getKeys()?.gm;

export async function askJSON(prompt, imageBase64) {
  const key = getKeys()?.gm;
  if (!key) throw new Error('이 기능은 가족 암호로 잠금을 푼 뒤에 쓸 수 있습니다');
  if (!navigator.onLine) throw new Error('인터넷에 연결되어 있지 않습니다');
  const parts = [{ text: prompt }];
  if (imageBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } });

  const candidates = [...new Set([model, ...PREFERRED].filter(Boolean))];
  let r;
  let quotaHit = false;
  for (const m of candidates) {
    r = await call(m, key, parts);
    if (r.ok) { model = m; ls.set('ft.model', m); break; }
    if (r.status === 429) { quotaHit = true; continue; } // this model's free quota is used up: try the next
    if (r.status !== 404) break;
  }
  if (r.status === 404) {
    const found = await discoverModel(key);
    if (found) {
      r = await call(found, key, parts);
      if (r.ok) { model = found; ls.set('ft.model', found); }
    }
  }
  if (!r.ok) {
    if (r.status === 429 || quotaHit) throw new Error('무료 사용량을 잠시 넘었습니다. 1분쯤 뒤에 다시 해 보세요');
    if (r.status === 400 || r.status === 403) throw new Error('제미나이 키가 거부되었습니다. 키를 확인하세요');
    throw new Error(`AI 응답 실패 (${r.status})`);
  }
  const body = await r.json();
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) throw new Error('AI가 답을 내지 못했습니다. 다시 시도해 보세요');
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new Error('AI 답을 읽지 못했습니다. 다시 시도해 보세요');
  }
}

const FAMILY =
  '우리는 후쿠오카를 여행 중인 한국인 가족 4명입니다(56세 어머니, 성인 2명, 초등학교 3학년 남자아이). ' +
  '날것(회, 육회, 닭 회, 말고기 회, 익히지 않은 명란 등)은 먹지 않습니다. 많이 걷지 않고 택시로 이동합니다. ' +
  '모든 답은 쉬운 한국어로, 짧은 문장으로 써 주세요.';

const PHOTO_MODES = {
  sign: '이 사진은 표지판이나 안내문입니다.',
  menu: '이 사진은 식당 메뉴판입니다. 메뉴를 최대 14개까지 items에 넣어 주세요.',
  machine: '이 사진은 자판기, 발권기, 코인로커 같은 기계나 버튼입니다. 무엇을 어떤 순서로 누르면 되는지 steps에 적어 주세요.',
  product: '이 사진은 가게에서 파는 상품입니다. 무슨 제품이고 어디에 쓰는지 알려 주세요.',
};

export function askPhoto(mode, question, imageBase64) {
  const prompt = `${FAMILY}

${PHOTO_MODES[mode] || PHOTO_MODES.sign}
${question ? `가족의 질문: "${question}"` : ''}

사진 속 일본어를 읽고 아래 JSON 형식으로만 답하세요.
{
  "title": "사진이 무엇인지 한 줄 (예: '신발을 벗으라는 안내문')",
  "translation": "핵심 문구의 한국어 번역. 긴 글은 요약",
  "what_to_do": "그래서 우리가 무엇을 하면 되는지 1~3문장",
  "steps": ["순서가 있을 때만. 없으면 빈 배열"],
  "items": [{"ja": "원문", "ko": "한국어 이름", "desc": "어떤 음식/물건인지 한 줄", "price": "가격 표기 그대로 또는 ''", "raw": true/false, "kid": true/false, "pick": true/false}],
  "warnings": ["주의할 점. 없으면 빈 배열"]
}
규칙: items는 메뉴판이나 상품 목록일 때만 채웁니다. raw는 날것이 들어가면 true. kid는 초등학생이 먹기 좋으면 true. pick은 우리 가족에게 추천하는 메뉴 1~3개만 true(날것은 제외). 읽을 수 없는 글자는 지어내지 말고 warnings에 "글자가 잘 보이지 않습니다"라고 쓰세요.`;
  return askJSON(prompt, imageBase64);
}

export function askPlaces(question, places, where) {
  const rows = places.map((p) => ({
    id: p.id, name: p.name_ko, cat: p.cat, area: p.area, why: p.why, price: p.price,
    dist: p._dist != null ? `${p._dist.toFixed(1)}km` : undefined,
    closed: p.closed, hours: p.hours, raw_note: p.raw_note || undefined, indoor: p.indoor,
  }));
  const prompt = `${FAMILY}

지금 위치: ${where}. 지금 시각: ${new Date().toLocaleString('ko-KR')}.
가족의 요청: "${question}"

아래 목록은 미리 확인해 둔 장소입니다. 반드시 이 목록 안에서만 고르세요. 목록에 맞는 곳이 없으면 picks를 비우고 answer에 그렇게 말하세요.
${JSON.stringify(rows)}

JSON으로만 답하세요.
{"answer": "요청에 대한 한두 문장 답", "picks": [{"id": "목록의 id", "reason": "이 가족에게 맞는 이유 한 문장"}]}
picks는 가장 좋은 곳부터 최대 3개. 휴무일이거나 영업시간이 지난 곳은 고르지 마세요.`;
  return askJSON(prompt);
}

export function askReplan(request, day, items, places) {
  const prompt = `${FAMILY}

${day} 하루 일정을 다시 짜 달라는 요청입니다: "${request}"

현재 일정(잠금 항목은 시간과 내용을 바꾸면 안 됩니다):
${JSON.stringify(items.map((i) => ({ time: i.time, title: i.title, note: i.note, placeId: i.placeId, locked: !!i.locked })))}

쓸 수 있는 장소 목록(placeId로 참조):
${JSON.stringify(places.map((p) => ({ id: p.id, name: p.name_ko, cat: p.cat, area: p.area, indoor: p.indoor, hours: p.hours, closed: p.closed })))}

JSON으로만 답하세요.
{"summary": "무엇을 어떻게 바꿨는지 1~2문장", "items": [{"time": "HH:MM", "title": "짧은 제목", "note": "한 줄 설명", "placeId": "목록의 id 또는 ''"}]}
규칙: items에는 잠금이 아닌 항목만 넣습니다(잠금 항목은 그대로 유지됩니다). 이동은 택시 기준으로 여유 있게 잡고, 식사 시간과 쉬는 시간을 꼭 넣으세요. 목록에 없는 장소를 지어내지 마세요.`;
  return askJSON(prompt);
}
