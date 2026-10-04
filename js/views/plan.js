// 일정: the recommended itinerary, editable item by item.
import { store, put, remove, list, update } from '../store.js';
import { h, mount, sheet, confirmSheet, toast, todayStr, nowHM, dayLabel, daysUntil, mapsDirUrl, uid } from '../util.js';
import { placeById, taxiCard, pickPlace, allPlaces } from '../places.js';
import { askReplan, hasAI } from '../gemini.js';

let activeDay = null;

const dayItems = (day) => list('items').filter((i) => i.day === day).sort((a, b) => a.time.localeCompare(b.time));

function nowAndNext(days) {
  const t = todayStr();
  if (!days.includes(t)) return null;
  const items = dayItems(t);
  const hm = nowHM();
  const past = items.filter((i) => i.time <= hm);
  return { now: past[past.length - 1], next: items.find((i) => i.time > hm) };
}

function ticket(trip) {
  const days = trip.days;
  const until = daysUntil(days[0]);
  const idx = days.indexOf(todayStr());
  const nn = nowAndNext(days);
  let big, small;
  if (idx >= 0) {
    big = `${idx + 1}일차`;
    small = nn?.next ? `다음 ${nn.next.time} ${nn.next.title}` : '오늘 일정을 모두 마쳤어요';
  } else if (until > 0) {
    big = `D-${until}`;
    small = `${dayLabel(days[0]).md}(${dayLabel(days[0]).dow}) 출발`;
  } else {
    big = '다녀왔어요';
    small = '미션북에서 여행을 다시 볼 수 있어요';
  }
  return h(
    'section',
    { class: 'ticket' },
    h('div', { class: 'ticket-main' },
      h('p', { class: 'eyebrow' }, trip.title),
      h('p', { class: 'ticket-big' }, big),
      nn?.now ? h('p', { class: 'ticket-now' }, h('span', { class: 'dot' }), `지금 ${nn.now.title}`) : null,
      h('p', { class: 'ticket-next' }, small),
    ),
    h('div', { class: 'ticket-stub' },
      h('button', { class: 'stub-btn', onclick: () => infoSheet(trip) }, h('span', { class: 'stub-ico' }, '✈'), '항공·호텔'),
      trip.hotel ? h('button', { class: 'stub-btn', onclick: () => taxiCard(placeById('hotel')) }, h('span', { class: 'stub-ico' }, '🚕'), '호텔로') : null,
    ),
  );
}

export function infoSheet(trip) {
  const ht = trip.hotel;
  sheet(
    '항공·호텔 정보',
    h('div', { class: 'stack' },
      (trip.flights || []).map((f) =>
        h('div', { class: 'card' },
          h('p', { class: 'eyebrow' }, `${f.label} · ${f.code}`),
          h('p', { class: 'flight' }, h('b', null, f.depTime), ` ${f.from} → `, h('b', null, f.arrTime), ` ${f.to}`),
          h('p', { class: 'muted' }, `${f.date} · 위탁수하물 ${f.baggage}`),
          f.note ? h('p', null, f.note) : null,
        )),
      ht ? h('div', { class: 'card' },
        h('p', { class: 'eyebrow' }, '숙소'),
        h('p', { class: 'strong' }, ht.name_ko),
        h('p', { class: 'ja', lang: 'ja' }, `${ht.name_ja} · ${ht.address_ja}`),
        h('p', { class: 'muted' }, `체크인 ${ht.checkin} · 체크아웃 ${ht.checkout}${ht.phone ? ` · ${ht.phone}` : ''}`),
        ht.note ? h('p', null, ht.note) : null,
        h('div', { class: 'row gap' },
          h('a', { class: 'btn small primary', href: mapsDirUrl(ht), target: '_blank', rel: 'noopener' }, '길찾기'),
          h('button', { class: 'btn small', onclick: () => taxiCard(placeById('hotel')) }, '택시 카드'),
        ),
      ) : null,
      trip.memo ? h('div', { class: 'card' }, h('p', { class: 'eyebrow' }, '메모'), h('p', { class: 'pre' }, trip.memo)) : null,
    ),
    { full: true },
  );
}

function warningFor(item, items) {
  if (item.locked) return null;
  const deadline = items.find((i) => i.deadline);
  if (deadline && item.time >= deadline.time) return `${deadline.time} ${deadline.title} 이후입니다. 비행기를 놓칠 수 있어요`;
  return null;
}

function itemCard(item, items, isNow) {
  const place = placeById(item.placeId);
  const warn = warningFor(item, items);
  return h(
    'li',
    { class: `tl-item kind-${item.kind || 'see'} ${isNow ? 'is-now' : ''}` },
    h('div', { class: 'tl-time' }, item.time, item.locked ? h('span', { class: 'lock', title: '잠금' }, '🔒') : null),
    h('div', { class: 'tl-body' },
      h('h3', null, item.title),
      item.note ? h('p', { class: 'tl-note' }, item.note) : null,
      warn ? h('p', { class: 'note-warn' }, warn) : null,
      item.choice ? h('div', { class: 'choices' }, item.choice.map((c) =>
        h('div', { class: 'choice' }, h('p', { class: 'strong' }, c.label), h('p', { class: 'muted' }, c.desc)))) : null,
      item.ja ? h('button', { class: 'ja-line', lang: 'ja', onclick: () => jaSheet(item.ja) }, '🗣 ', item.ja[0].ja) : null,
      h('div', { class: 'row gap wrap' },
        place ? h('a', { class: 'btn small primary', href: mapsDirUrl(place), target: '_blank', rel: 'noopener' }, '길찾기') : null,
        place ? h('button', { class: 'btn small', onclick: () => taxiCard(place) }, '택시 카드') : null,
        h('button', { class: 'btn small ghost', onclick: () => editItem(item) }, item.locked ? '자세히' : '바꾸기'),
      ),
    ),
  );
}

function jaSheet(lines) {
  sheet('직원에게 보여주세요', h('div', { class: 'stack' }, lines.map((l) =>
    h('div', { class: 'phrase big' }, h('p', { class: 'phrase-ja', lang: 'ja' }, l.ja), h('p', { class: 'muted' }, l.ko)))), { full: true });
}

function editItem(item) {
  const isNew = !item.id;
  if (item.locked) {
    return sheet(item.title, h('div', null,
      h('p', { class: 'strong' }, `${item.time} ${item.title}`),
      item.note ? h('p', null, item.note) : null,
      h('p', { class: 'muted' }, '항공편에 맞춘 잠금 항목이라 바꿀 수 없습니다.')));
  }
  let placeId = item.placeId || '';
  const time = h('input', { class: 'input', type: 'time', value: item.time || '12:00' });
  const title = h('input', { class: 'input', type: 'text', value: item.title || '', placeholder: '예: 캐널시티 구경' });
  const note = h('textarea', { class: 'input', rows: 3, placeholder: '메모 (선택)' }, item.note || '');
  const placeLine = h('p', { class: 'muted' });
  const drawPlace = () => {
    const p = placeById(placeId);
    placeLine.textContent = p ? `연결된 장소: ${p.name_ko}` : '연결된 장소 없음';
  };
  drawPlace();
  const choose = () => pickPlace('장소 고르기', (p) => {
    placeId = p.id;
    if (!title.value.trim() || isNew || title.value === item.title) title.value = p.name_ko;
    if (!note.value.trim()) note.value = p.why || '';
    drawPlace();
  });
  const save = () => {
    if (!title.value.trim()) return toast('제목을 적어 주세요');
    put('items', { ...(isNew ? { day: item.day, kind: 'see' } : { id: item.id }), time: time.value, title: title.value.trim(), note: note.value.trim(), placeId });
    close();
    toast(isNew ? '일정을 추가했습니다' : '일정을 바꿨습니다');
  };
  const close = sheet(
    isNew ? '일정 추가' : '일정 바꾸기',
    h('div', { class: 'form' },
      h('label', null, '시간', time),
      h('label', null, '제목', title),
      h('label', null, '메모', note),
      placeLine,
      h('button', { class: 'btn', onclick: choose }, isNew ? '추천 목록에서 고르기' : '다른 곳으로 바꾸기'),
      h('button', { class: 'btn primary', onclick: save }, isNew ? '일정 추가' : '바꾼 내용 저장'),
      isNew ? null : h('button', { class: 'btn danger ghost', onclick: () => { close(); remove('items', item.id); toast('일정을 지웠습니다'); } }, '이 일정 지우기'),
    ),
  );
}

function replanSheet(day) {
  if (!hasAI()) return toast('AI 기능은 가족 암호로 잠금을 푼 뒤에 쓸 수 있습니다');
  const l = dayLabel(day);
  const box = h('textarea', { class: 'input', rows: 3, placeholder: '예: 비가 와서 오후를 실내로 바꾸고 싶어' });
  const out = h('div', { class: 'stack' });
  const examples = ['비 오니까 실내 위주로 바꿔줘', '어머니가 피곤하셔서 오후를 쉬는 일정으로', '아이가 좋아할 곳을 하나 더 넣어줘'];
  const go = async () => {
    if (!box.value.trim()) return toast('어떻게 바꾸고 싶은지 적어 주세요');
    out.replaceChildren(h('p', { class: 'loading' }, '일정을 다시 짜는 중…'));
    try {
      const res = await askReplan(box.value.trim(), `${l.md}(${l.dow})`, dayItems(day), allPlaces());
      const locked = dayItems(day).filter((i) => i.locked);
      const merged = [...locked.map((i) => ({ ...i, _locked: true })), ...(res.items || [])].sort((a, b) => a.time.localeCompare(b.time));
      out.replaceChildren(
        h('p', { class: 'reason' }, res.summary || ''),
        h('ul', { class: 'preview' }, merged.map((i) => h('li', null, h('b', null, i.time), ` ${i.title}`, i._locked ? ' 🔒' : '', i.note ? h('span', { class: 'muted' }, ` — ${i.note}`) : null))),
        h('button', { class: 'btn primary', onclick: () => {
          update((s) => {
            const now = Date.now();
            for (const i of Object.values(s.items)) if (i.day === day && !i.locked && !i.del) Object.assign(i, { del: true, u: now });
            for (const n of res.items || []) {
              const id = uid();
              s.items[id] = { id, day, time: n.time, title: n.title, note: n.note || '', placeId: placeById(n.placeId) ? n.placeId : '', kind: 'see', u: now };
            }
          });
          close();
          toast('새 일정으로 바꿨습니다');
        } }, '이 일정으로 바꾸기'),
        h('p', { class: 'muted small' }, '마음에 들지 않으면 닫으면 됩니다. 원래 일정은 그대로 남습니다.'),
      );
    } catch (e) {
      out.replaceChildren(h('p', { class: 'note-warn' }, e.message));
    }
  };
  const close = sheet(`${l.md}(${l.dow}) 일정 다시 짜기`, h('div', { class: 'form' },
    box,
    h('div', { class: 'row gap wrap' }, examples.map((x) => h('button', { class: 'chip', onclick: () => { box.value = x; } }, x))),
    h('button', { class: 'btn primary', onclick: go }, '다시 짜 보기'),
    out,
  ), { full: true });
}

function resetAll() {
  const rec = store.state.recommended?.items;
  if (!rec) return toast('추천 여정을 찾지 못했습니다');
  confirmSheet('추천 여정으로 되돌리기', '직접 바꾸거나 추가한 일정이 모두 사라지고 처음의 추천 여정으로 돌아갑니다.', '되돌리기', () => {
    update((s) => {
      const now = Date.now();
      for (const i of Object.values(s.items)) Object.assign(i, { del: true, u: now });
      for (const r of rec) s.items[r.id] = { ...r, u: now };
    });
    toast('추천 여정으로 되돌렸습니다');
  });
}

export function renderPlan(root) {
  const trip = store.state.trip;
  if (!trip) {
    mount(root, h('div', { class: 'empty' },
      h('h2', null, '일정을 불러오는 중입니다'),
      h('p', { class: 'muted' }, store.error || '처음 한 번은 인터넷 연결이 필요합니다. 연결을 확인한 뒤 잠시 기다려 주세요.')));
    return;
  }
  const days = trip.days;
  if (!activeDay || !days.includes(activeDay)) activeDay = days.includes(todayStr()) ? todayStr() : days[0];
  const items = dayItems(activeDay);
  const nn = activeDay === todayStr() ? nowAndNext(days) : null;

  mount(root, 
    ticket(trip),
    h('nav', { class: 'days', 'aria-label': '날짜' }, days.map((d, i) => {
      const l = dayLabel(d);
      return h('button', { class: `day ${d === activeDay ? 'on' : ''}`, onclick: () => { activeDay = d; renderPlan(root); } },
        h('span', { class: 'day-n' }, `${i + 1}일차`), h('span', { class: 'day-d' }, `${l.md} ${l.dow}`));
    })),
    items.length
      ? h('ol', { class: 'timeline' }, items.map((i) => itemCard(i, items, nn?.now?.id === i.id)))
      : h('div', { class: 'empty' }, h('p', null, '이 날은 일정이 비어 있어요.'), h('p', { class: 'muted' }, '아래에서 일정을 추가하거나 추천 여정으로 되돌릴 수 있습니다.')),
    h('div', { class: 'plan-actions' },
      h('button', { class: 'btn primary', onclick: () => editItem({ day: activeDay }) }, '+ 일정 추가'),
      h('button', { class: 'btn', onclick: () => replanSheet(activeDay) }, '말로 다시 짜기'),
      h('button', { class: 'btn ghost', onclick: resetAll }, '추천 여정으로 되돌리기'),
    ),
  );
}
