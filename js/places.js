// Place lookups, location, and the place card every view shares.
import { PLACES } from './data/places.js';
import { FOOD_CATS, AREAS } from './data/static.js';
import { store, put } from './store.js';
import { h, ls, distKm, distText, mapsDirUrl, sheet, toast, todayStr, dayLabel } from './util.js';

export function hotelPlace() {
  const ht = store.state.trip?.hotel;
  return ht ? { id: 'hotel', cat: 'stay', area: 'hotel', ...ht } : null;
}

export function allPlaces() {
  const ht = hotelPlace();
  return ht ? [ht, ...PLACES] : PLACES;
}

export const placeById = (id) => (id ? allPlaces().find((p) => p.id === id) : null);

export const catLabel = (cat) =>
  FOOD_CATS.find((c) => c.id === cat)?.label || { sight: '볼거리', shopping: '쇼핑', stay: '숙소', onsen: '온천', pier: '선착장' }[cat] || cat;

// ---- where are we measuring from ----
let lastPos = ls.get('ft.pos');
let baseMode = ls.get('ft.base') || 'gps';

export const getBaseMode = () => baseMode;
export function setBaseMode(m) {
  baseMode = m;
  ls.set('ft.base', m);
}

export function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('이 기기에서는 위치를 쓸 수 없습니다'));
    navigator.geolocation.getCurrentPosition(
      (g) => {
        lastPos = { lat: g.coords.latitude, lng: g.coords.longitude, at: Date.now() };
        ls.set('ft.pos', lastPos);
        resolve(lastPos);
      },
      (e) => reject(new Error(e.code === 1 ? '위치 권한이 꺼져 있습니다. 브라우저 설정에서 허용해 주세요' : '위치를 잡지 못했습니다')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

// The point distances are measured from, plus a label the views show next to it.
export function basePoint() {
  const ht = hotelPlace();
  if (baseMode === 'gps' && lastPos) {
    const mins = Math.round((Date.now() - lastPos.at) / 60000);
    return { pos: lastPos, label: mins < 2 ? '현재 위치 기준' : `${mins}분 전 위치 기준` };
  }
  if (ht?.lat != null) return { pos: ht, label: '호텔 기준' };
  return { pos: null, label: '' };
}

export function isClosedToday(p) {
  const days = store.state.trip?.days || [];
  const t = todayStr();
  if (!days.includes(t) || !p.closedDows) return false;
  return p.closedDows.includes(dayLabel(t).dowIdx);
}

// ---- shared UI ----
// Keeps the block number (1-1-2) on one line so a driver never reads a split number.
function addrParts(addr) {
  const m = addr.match(/^(D*)([d０-９][^s]*)(.*)$/);
  return m ? [m[1], h('span', { class: 'nowrap' }, m[2]), m[3]] : [addr];
}

export function taxiCard(p) {
  sheet(
    '택시 기사님께 보여주세요',
    h(
      'div',
      { class: 'taxi' },
      h('p', { class: 'taxi-lead', lang: 'ja' }, 'ここまでお願いします'),
      h('p', { class: 'taxi-name', lang: 'ja' }, p.name_ja),
      h('p', { class: 'taxi-addr', lang: 'ja' }, ...addrParts(p.address_ja || '')),
      p.phone ? h('p', { class: 'taxi-tel' }, `TEL ${p.phone}`) : null,
      h('p', { class: 'muted center' }, `"${p.name_ko}"(으)로 가 달라는 뜻입니다`),
    ),
    { full: true },
  );
}

export function addToPlan(p, defaults = {}) {
  const days = store.state.trip?.days || [];
  if (!days.length) return toast('일정을 불러온 뒤에 넣을 수 있습니다');
  const t = todayStr();
  const daySel = h('select', { class: 'input' }, days.map((d, i) => {
    const l = dayLabel(d);
    return h('option', { value: d, selected: d === (defaults.day || (days.includes(t) ? t : days[0])) }, `${i + 1}일차 ${l.md}(${l.dow})`);
  }));
  const time = h('input', { class: 'input', type: 'time', value: defaults.time || '12:00' });
  const close = sheet(
    '일정에 넣기',
    h(
      'div',
      { class: 'form' },
      h('p', { class: 'strong' }, p.name_ko),
      h('label', null, '날짜', daySel),
      h('label', null, '시간', time),
      h('button', {
        class: 'btn primary',
        onclick: () => {
          put('items', { day: daySel.value, time: time.value, title: p.name_ko, note: p.why || '', placeId: p.id, kind: 'see' });
          close();
          toast('일정에 넣었습니다');
        },
      }, '일정에 넣기'),
    ),
  );
}

export function placeCard(p, opts = {}) {
  const base = basePoint();
  const km = distKm(base.pos, p);
  const closed = isClosedToday(p);
  const tags = [
    catLabel(p.cat),
    AREAS[p.area],
    km != null ? distText(km) : null,
    p.price,
  ].filter(Boolean);
  return h(
    'article',
    { class: `place ${opts.top ? 'place-top' : ''} ${closed ? 'place-closed' : ''}` },
    opts.top ? h('div', { class: 'ribbon' }, opts.topLabel || '가장 추천') : null,
    h('h3', null, p.name_ko, p.tabelog ? h('span', { class: 'score', title: '현지 맛집 사이트 평점' }, `★ ${p.tabelog}`) : null),
    h('p', { class: 'ja', lang: 'ja' }, p.name_ja),
    h('div', { class: 'tags' }, tags.map((t) => h('span', { class: 'tag' }, t)), closed ? h('span', { class: 'tag tag-warn' }, '오늘 휴무') : null),
    opts.reason ? h('p', { class: 'reason' }, opts.reason) : null,
    p.why ? h('p', null, p.why) : null,
    h(
      'dl',
      { class: 'facts' },
      p.hours ? [h('dt', null, '영업'), h('dd', null, p.hours)] : null,
      p.closed ? [h('dt', null, '휴무'), h('dd', null, p.closed)] : null,
      p.reservation ? [h('dt', null, '예약'), h('dd', null, p.reservation)] : null,
      p.queue ? [h('dt', null, '대기'), h('dd', null, p.queue)] : null,
      p.walk ? [h('dt', null, '걷기'), h('dd', null, p.walk)] : null,
      p.duration ? [h('dt', null, '소요'), h('dd', null, p.duration)] : null,
      p.cash_only ? [h('dt', null, '결제'), h('dd', null, '현금만 받습니다')] : null,
    ),
    p.raw_note ? h('p', { class: 'note-warn' }, `날것 주의: ${p.raw_note}`) : null,
    h(
      'div',
      { class: 'row gap wrap' },
      h('a', { class: 'btn small primary', href: mapsDirUrl(p), target: '_blank', rel: 'noopener' }, '길찾기'),
      h('button', { class: 'btn small', onclick: () => taxiCard(p) }, '택시 카드'),
      opts.noAdd ? null : h('button', { class: 'btn small', onclick: () => addToPlan(p) }, '일정에 넣기'),
      opts.extra || null,
    ),
  );
}

// A searchable list of places for picking one.
export function pickPlace(title, onPick, filter) {
  const base = basePoint();
  const rows = allPlaces()
    .filter((p) => !filter || filter(p))
    .map((p) => ({ p, km: distKm(base.pos, p) }))
    .sort((a, b) => (a.km ?? 99) - (b.km ?? 99));
  const listEl = h('div', { class: 'pick-list' });
  const draw = (q) => {
    listEl.replaceChildren(
      ...rows
        .filter(({ p }) => !q || `${p.name_ko}${p.name_ja}${catLabel(p.cat)}`.toLowerCase().includes(q.toLowerCase()))
        .map(({ p, km }) =>
          h('button', { class: 'pick', onclick: () => { close(); onPick(p); } },
            h('span', { class: 'strong' }, p.name_ko),
            h('span', { class: 'muted' }, [catLabel(p.cat), km != null ? distText(km) : null].filter(Boolean).join(' · ')),
          )),
    );
  };
  const close = sheet(
    title,
    h('div', null,
      h('input', { class: 'input', type: 'search', placeholder: '이름이나 종류로 찾기', oninput: (e) => draw(e.target.value) }),
      h('p', { class: 'muted small' }, base.label ? `${base.label}으로 가까운 순` : ''),
      listEl,
    ),
    { full: true },
  );
  draw('');
}
