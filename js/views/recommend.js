// 추천: "뭐 먹지?", sights, shopping, asking in words, and a hand-off to Google Maps.
import { PLACES } from '../data/places.js';
import { FOOD_CATS } from '../data/static.js';
import { h, mount, distKm, mapsSearchUrl, toast } from '../util.js';
import { placeCard, basePoint, locate, getBaseMode, setBaseMode, isClosedToday, placeById } from '../places.js';
import { askPlaces, hasAI } from '../gemini.js';

let mode = 'food';
let cat = null;
let aiResult = null;

function ranked(listIn) {
  const base = basePoint();
  return listIn
    .map((p) => {
      const km = distKm(base.pos, p);
      // Reputation first, then a penalty that grows with distance: this family prefers short rides.
      const score = (p.tabelog ?? 3.45) - Math.min(1.2, (km ?? 2) * 0.12) - (isClosedToday(p) ? 5 : 0);
      return { ...p, _dist: km, _score: score };
    })
    .sort((a, b) => b._score - a._score);
}

function baseBar(rerender) {
  const base = basePoint();
  const here = async (btn) => {
    btn.textContent = '위치 찾는 중…';
    try {
      setBaseMode('gps');
      await locate();
    } catch (e) {
      toast(e.message);
      setBaseMode('hotel');
    }
    rerender();
  };
  return h('div', { class: 'basebar' },
    h('span', { class: 'muted' }, base.label || '위치 기준 없음'),
    h('div', { class: 'seg' },
      h('button', { class: getBaseMode() === 'gps' ? 'on' : '', onclick: (e) => here(e.currentTarget) }, '현재 위치'),
      h('button', { class: getBaseMode() === 'hotel' ? 'on' : '', onclick: () => { setBaseMode('hotel'); rerender(); } }, '호텔'),
    ));
}

function foodPanel(rerender) {
  const cats = FOOD_CATS.filter((c) => PLACES.some((p) => p.cat === c.id));
  const grid = h('div', { class: 'catgrid' }, cats.map((c) =>
    h('button', { class: `cat ${cat === c.id ? 'on' : ''}`, onclick: () => { cat = cat === c.id ? null : c.id; aiResult = null; rerender(); } },
      h('span', { class: 'cat-ico' }, c.icon), c.label)));
  if (!cat) return h('div', null, h('h2', { class: 'q' }, '오늘 뭐 먹지?'), h('p', { class: 'muted' }, '먹고 싶은 걸 누르면 가장 좋은 곳을 골라 드려요.'), grid);
  const rows = ranked(PLACES.filter((p) => p.cat === cat));
  const [top, ...rest] = rows;
  return h('div', null,
    h('h2', { class: 'q' }, '오늘 뭐 먹지?'),
    grid,
    top ? placeCard(top, { top: true, topLabel: '지금 가장 추천', reason: isClosedToday(top) ? '오늘은 쉬는 날입니다. 다른 후보를 보세요.' : `미리 확인한 ${rows.length}곳 중에서 평판과 거리(${basePoint().label || '호텔 기준'})를 함께 따져 골랐습니다.` }) : h('p', { class: 'muted' }, '아직 조사한 곳이 없습니다. 아래 검색을 써 보세요.'),
    rest.length ? h('h3', { class: 'sub' }, '다른 후보') : null,
    rest.map((p) => placeCard(p)),
  );
}

function listPanel(kind, title) {
  const rows = ranked(PLACES.filter((p) => p.cat === kind)).sort((a, b) => (a._dist ?? 99) - (b._dist ?? 99));
  return h('div', null, h('h2', { class: 'q' }, title), rows.map((p) => placeCard(p)));
}

function askBox(rerender) {
  const input = h('input', { class: 'input', type: 'text', placeholder: '예: 안 맵고 국물 있는 저녁' });
  const out = h('div', { class: 'stack' });
  const drawResult = () => {
    if (!aiResult) return;
    out.replaceChildren(
      h('p', { class: 'reason' }, aiResult.answer || ''),
      ...(aiResult.picks || []).map((pk, i) => {
        const p = placeById(pk.id);
        return p ? placeCard(p, { top: i === 0, topLabel: 'AI 추천', reason: pk.reason }) : null;
      }).filter(Boolean),
    );
  };
  const go = async () => {
    const q = input.value.trim();
    if (!q) return toast('무엇을 찾는지 적어 주세요');
    if (!hasAI()) return toast('AI 기능은 가족 암호로 잠금을 푼 뒤에 쓸 수 있습니다');
    out.replaceChildren(h('p', { class: 'loading' }, '목록에서 고르는 중…'));
    try {
      aiResult = await askPlaces(q, ranked(PLACES), basePoint().label || '후쿠오카 시내');
      drawResult();
    } catch (e) {
      out.replaceChildren(h('p', { class: 'note-warn' }, e.message));
    }
  };
  drawResult();
  return h('section', { class: 'panel' },
    h('h2', { class: 'q' }, '말로 물어보기'),
    h('p', { class: 'muted' }, '미리 확인해 둔 목록 안에서 골라 드립니다.'),
    h('form', { class: 'row gap', onsubmit: (e) => { e.preventDefault(); go(); } }, input, h('button', { class: 'btn primary', type: 'submit' }, '찾기')),
    out,
  );
}

function searchBox() {
  const input = h('input', { class: 'input', type: 'search', placeholder: '예: 편의점, 약국, ATM' });
  const quick = ['편의점', '약국', 'ATM', '화장실', '드럭스토어', '카페'];
  const open = (q) => {
    if (!q) return toast('검색할 말을 적어 주세요');
    const base = basePoint();
    window.open(mapsSearchUrl(q, base.pos), '_blank', 'noopener');
  };
  return h('section', { class: 'panel' },
    h('h2', { class: 'q' }, '내 주변 직접 검색'),
    h('p', { class: 'muted' }, '구글맵이 열려 지금 영업 중인 곳과 길을 보여줍니다.'),
    h('form', { class: 'row gap', onsubmit: (e) => { e.preventDefault(); open(input.value.trim()); } }, input, h('button', { class: 'btn', type: 'submit' }, '구글맵에서 찾기')),
    h('div', { class: 'row gap wrap' }, quick.map((q) => h('button', { class: 'chip', onclick: () => open(q) }, q))),
  );
}

export function renderRecommend(root) {
  const rerender = () => renderRecommend(root);
  const tabs = [['food', '음식'], ['sight', '볼거리'], ['shopping', '쇼핑']];
  mount(root, 
    baseBar(rerender),
    h('div', { class: 'seg wide' }, tabs.map(([id, label]) => h('button', { class: mode === id ? 'on' : '', onclick: () => { mode = id; rerender(); } }, label))),
    mode === 'food' ? foodPanel(rerender) : mode === 'sight' ? listPanel('sight', '가 볼 만한 곳') : listPanel('shopping', '시간 남으면 쇼핑'),
    askBox(rerender),
    searchBox(),
  );
}
