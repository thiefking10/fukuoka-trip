// Calls to Claude straight from the phone. Every answer comes back as JSON that matches a
// schema, so the views can lay it out instead of dumping a wall of text.
import { getKeys } from './secrets.js';

const SDK_URL = 'https://esm.sh/@anthropic-ai/sdk@1.1.0';
const MODEL = 'claude-opus-5-5';

let Anthropic = null;
let client = null;
let clientKey = null;

export const hasAI = () => !!getKeys()?.ak;

async function getClient() {
  const key = getKeys()?.ak;
  if (!key) throw new Error('이 기능은 가족 암호로 잠금을 푼 뒤에 쓸 수 있습니다');
  if (!navigator.onLine) throw new Error('인터넷에 연결되어 있지 않습니다');
  // Loaded on first use so the rest of the app still opens without a connection.
  if (!Anthropic) Anthropic = (await import(SDK_URL)).default;
  if (!client || clientKey !== key) {
    // The key lives only on family phones (unlocked with the family passcode), never in the code.
    client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 90_000 });
    clientKey = key;
  }
  return client;
}

function friendlyError(e) {
  if (e instanceof Anthropic.AuthenticationError) return new Error('Claude 키가 거부되었습니다. 키를 확인하세요');
  if (e instanceof Anthropic.PermissionDeniedError) return new Error('이 Claude 키로는 쓸 수 없습니다. 콘솔에서 키 권한을 확인하세요');
  if (e instanceof Anthropic.RateLimitError) return new Error('요청이 잠시 몰렸습니다. 1분쯤 뒤에 다시 해 보세요');
  if (e instanceof Anthropic.BadRequestError) return new Error('요청이 거부되었습니다. Claude 콘솔에서 크레딧 잔액을 확인하세요');
  if (e instanceof Anthropic.APIConnectionError) return new Error('Claude에 연결하지 못했습니다. 인터넷을 확인하세요');
  if (e instanceof Anthropic.APIError) return new Error(`AI 응답 실패 (${e.status ?? '연결'})`);
  return e;
}

async function askJSON({ content, schema, effort }) {
  const c = await getClient();
  let res;
  try {
    res = await c.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: FAMILY,
      messages: [{ role: 'user', content }],
      output_config: { effort, format: { type: 'json_schema', schema } },
      // If a safety check declines, the API retries on a suitable model inside the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  } catch (e) {
    throw friendlyError(e);
  }
  if (res.stop_reason === 'refusal') throw new Error('이 요청에는 답할 수 없다고 합니다. 다른 사진이나 질문으로 해 보세요');
  if (res.stop_reason === 'max_tokens') throw new Error('답이 너무 길어 끊겼습니다. 사진을 더 가까이 찍어 다시 해 보세요');
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('AI 답을 읽지 못했습니다. 다시 시도해 보세요');
  }
}

// Structured outputs need every object closed and every field listed as required.
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const str = { type: 'string' };
const bool = { type: 'boolean' };
const arr = (items) => ({ type: 'array', items });

const FAMILY =
  '당신은 후쿠오카를 여행 중인 한국인 가족 4명(56세 할머니, 30세 아들, 24세 딸, 9살 손자)을 돕습니다. ' +
  '이 가족은 날것(회, 육회, 닭 회, 말고기 회, 익히지 않은 명란 등)을 먹지 않고, 많이 걷지 않으며 택시로 이동합니다. ' +
  '모든 답은 쉬운 한국어로, 짧은 문장으로 씁니다.';

const PHOTO_SCHEMA = obj({
  title: str,
  translation: str,
  what_to_do: str,
  steps: arr(str),
  items: arr(obj({ ja: str, ko: str, desc: str, price: str, raw: bool, kid: bool, pick: bool })),
  warnings: arr(str),
});

const PHOTO_MODES = {
  sign: '이 사진은 표지판이나 안내문입니다.',
  menu: '이 사진은 식당 메뉴판입니다. 메뉴를 최대 14개까지 items에 넣어 주세요.',
  machine: '이 사진은 자판기, 발권기, 코인로커 같은 기계나 버튼입니다. 무엇을 어떤 순서로 누르면 되는지 steps에 적어 주세요.',
  product: '이 사진은 가게에서 파는 상품입니다. 무슨 제품이고 어디에 쓰는지 알려 주세요.',
};

export function askPhoto(mode, question, imageBase64) {
  const text = `${PHOTO_MODES[mode] || PHOTO_MODES.sign}
${question ? `가족의 질문: "${question}"` : ''}

사진 속 일본어를 읽고 답해 주세요.
- title: 사진이 무엇인지 한 줄 (예: "신발을 벗으라는 안내문")
- translation: 핵심 문구의 한국어 번역. 긴 글은 요약
- what_to_do: 그래서 우리가 무엇을 하면 되는지 1~3문장${question ? '. 가족의 질문에 대한 답을 포함' : ''}
- steps: 순서가 있을 때만. 없으면 빈 배열
- items: 메뉴판이나 상품 목록일 때만. ja는 원문, ko는 한국어 이름, desc는 한 줄 설명, price는 가격 표기 그대로(없으면 ""), raw는 날것이 들어가면 true, kid는 초등학생이 먹기 좋으면 true, pick은 우리 가족에게 추천하는 1~3개만 true(날것 제외)
- warnings: 주의할 점. 읽을 수 없는 글자는 지어내지 말고 "글자가 잘 보이지 않습니다"라고 적기. 없으면 빈 배열`;
  return askJSON({
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
      { type: 'text', text },
    ],
    schema: PHOTO_SCHEMA,
    effort: 'medium',
  });
}

const PLACES_SCHEMA = obj({ answer: str, picks: arr(obj({ id: str, reason: str })) });

export function askPlaces(question, places, where) {
  const rows = places.map((p) => ({
    id: p.id, name: p.name_ko, cat: p.cat, area: p.area, why: p.why, price: p.price,
    dist: p._dist != null ? `${p._dist.toFixed(1)}km` : undefined,
    closed: p.closed, hours: p.hours, raw_note: p.raw_note || undefined, indoor: p.indoor,
  }));
  const text = `지금 위치: ${where}. 지금 시각: ${new Date().toLocaleString('ko-KR')}.
가족의 요청: "${question}"

아래 목록은 미리 확인해 둔 장소입니다. 반드시 이 목록 안에서만 고르세요.
${JSON.stringify(rows)}

- answer: 요청에 대한 한두 문장 답. 맞는 곳이 없으면 그렇게 말하기
- picks: 가장 좋은 곳부터 최대 3개. id는 목록의 id 그대로, reason은 이 가족에게 맞는 이유 한 문장. 휴무일이거나 영업시간이 지난 곳은 고르지 않기`;
  return askJSON({ content: text, schema: PLACES_SCHEMA, effort: 'low' });
}

const REPLAN_SCHEMA = obj({ summary: str, items: arr(obj({ time: str, title: str, note: str, placeId: str })) });

export function askReplan(request, day, items, places) {
  const text = `${day} 하루 일정을 다시 짜 달라는 요청입니다: "${request}"

현재 일정(locked가 true인 항목은 시간과 내용을 바꾸면 안 됩니다):
${JSON.stringify(items.map((i) => ({ time: i.time, title: i.title, note: i.note, placeId: i.placeId, locked: !!i.locked })))}

쓸 수 있는 장소 목록(placeId로 참조):
${JSON.stringify(places.map((p) => ({ id: p.id, name: p.name_ko, cat: p.cat, area: p.area, indoor: p.indoor, hours: p.hours, closed: p.closed })))}

- summary: 무엇을 어떻게 바꿨는지 1~2문장
- items: 잠금이 아닌 항목만(잠금 항목은 그대로 유지됩니다). time은 HH:MM, title은 짧은 제목, note는 한 줄 설명, placeId는 목록의 id 또는 "".
이동은 택시 기준으로 여유 있게 잡고, 식사 시간과 쉬는 시간을 꼭 넣으세요. 목록에 없는 장소를 지어내지 마세요.`;
  return askJSON({ content: text, schema: REPLAN_SCHEMA, effort: 'medium' });
}
