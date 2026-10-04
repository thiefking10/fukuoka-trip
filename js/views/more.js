// 더보기: taxi card, phrase cards, yen calculator and spending, packing, onsen guide, settings.
import { store, put, remove, list, update, sync } from '../store.js';
import { h, mount, ls, sheet, toast, yen, won, todayStr, dayLabel, confirmSheet } from '../util.js';
import { PHRASES, ONSEN_GUIDE, PACKING } from '../data/static.js';
import { placeById, taxiCard } from '../places.js';
import { forgetKeys, getKeys } from '../secrets.js';
import { infoSheet } from './plan.js';
import { prepSheet, prepCount } from './prep.js';
import { installApp, isInstalled } from '../install.js';

const rate = () => store.state.trip?.rate || 0; // won per 100 yen

function phrasesSheet() {
  sheet('보여주는 일본어', h('div', { class: 'stack' },
    h('p', { class: 'muted' }, '문장을 누르면 크게 보입니다. 화면을 그대로 보여주세요.'),
    PHRASES.map((g) => h('section', null,
      h('h3', { class: 'sub' }, g.group),
      g.items.map((p) => h('button', { class: 'phrase', onclick: () => sheet(p.ko, h('div', { class: 'phrase big' },
        h('p', { class: 'phrase-ja', lang: 'ja' }, p.ja), h('p', { class: 'phrase-say' }, p.say), h('p', { class: 'muted' }, p.ko)), { full: true }) },
        h('span', { class: 'phrase-ko' }, p.ko),
        h('span', { class: 'phrase-ja', lang: 'ja' }, p.ja),
        h('span', { class: 'phrase-say' }, p.say)))))), { full: true });
}

function moneySheet() {
  const body = h('div', { class: 'stack' });
  const draw = () => {
    const r = rate();
    const out = h('p', { class: 'calc-out' }, r ? '0원' : '환율을 먼저 넣어 주세요');
    const input = h('input', { class: 'input calc-in', type: 'number', inputmode: 'numeric', placeholder: '엔화 금액', oninput: () => {
      const v = Number(input.value) || 0;
      out.textContent = r ? won((v * r) / 100) : '환율을 먼저 넣어 주세요';
    } });
    const rateIn = h('input', { class: 'input', type: 'number', inputmode: 'decimal', value: r || '', placeholder: '예: 930' });
    const memo = h('input', { class: 'input', type: 'text', placeholder: '무엇에 썼나요? 예: 점심 우동' });
    const exps = list('expenses').sort((a, b) => (b.at || 0) - (a.at || 0));
    const total = exps.reduce((s, e) => s + (e.yen || 0), 0);
    body.replaceChildren(
      h('section', { class: 'card' },
        h('p', { class: 'eyebrow' }, '엔화 → 원화'),
        input, out,
        h('div', { class: 'row gap wrap' }, [500, 1000, 3000, 5000, 10000].map((v) => h('button', { class: 'chip', onclick: () => { input.value = v; input.dispatchEvent(new Event('input')); } }, yen(v)))),
        memo,
        h('button', { class: 'btn primary', onclick: () => {
          const v = Number(input.value);
          if (!v) return toast('금액을 넣어 주세요');
          put('expenses', { yen: v, memo: memo.value.trim() || '지출', who: ls.get('ft.me') || '', at: Date.now(), day: todayStr() });
          toast('지출을 기록했습니다');
          draw();
        } }, '이 금액을 지출로 기록'),
      ),
      h('section', { class: 'card' },
        h('p', { class: 'eyebrow' }, '환율 (100엔에 몇 원)'),
        h('div', { class: 'row gap' }, rateIn, h('button', { class: 'btn', onclick: () => {
          const v = Number(rateIn.value);
          if (!v) return toast('환율을 숫자로 넣어 주세요');
          update((s) => { s.trip = { ...s.trip, rate: v, u: Date.now() }; });
          toast('환율을 저장했습니다');
          draw();
        } }, '환율 저장')),
        h('p', { class: 'muted small' }, '환전할 때 받은 환율을 넣으면 실제 쓴 돈과 맞습니다. 가족 모두에게 적용됩니다.'),
      ),
      h('section', null,
        h('h3', { class: 'sub' }, `쓴 돈 ${yen(total)}${r ? ` · 약 ${won((total * r) / 100)}` : ''}`),
        exps.length ? h('ul', { class: 'exps' }, exps.map((e) => h('li', null,
          h('span', null, h('span', { class: 'strong' }, e.memo), h('span', { class: 'muted small' }, ` ${e.day ? dayLabel(e.day).md : ''} ${e.who || ''}`)),
          h('span', { class: 'row gap' }, h('b', null, yen(e.yen)), h('button', { class: 'icon-btn', 'aria-label': '지우기', onclick: () => { remove('expenses', e.id); draw(); } }, '✕')))))
          : h('p', { class: 'muted' }, '아직 기록한 지출이 없습니다.'),
      ),
    );
  };
  draw();
  sheet('엔화 계산기 · 쓴 돈', body, { full: true });
}

function packingSheet() {
  const checked = new Set(ls.get('ft.pack', []));
  const extra = ls.get('ft.packExtra', []);
  const body = h('div', { class: 'stack' });
  const draw = () => {
    const groups = [...PACKING, ...(extra.length ? [{ group: '내가 추가한 것', items: extra }] : [])];
    const totalN = groups.reduce((n, g) => n + g.items.length, 0);
    const add = h('input', { class: 'input', type: 'text', placeholder: '추가할 물건' });
    body.replaceChildren(
      h('p', { class: 'muted' }, `${checked.size} / ${totalN} 개 챙김 · 위탁수하물은 1인 15kg까지입니다. 이 목록은 내 폰에만 저장됩니다.`),
      ...groups.map((g) => h('section', null, h('h3', { class: 'sub' }, g.group),
        g.items.map((it) => h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: checked.has(it), onchange: (e) => {
            e.target.checked ? checked.add(it) : checked.delete(it);
            ls.set('ft.pack', [...checked]);
            draw();
          } }), h('span', null, it))))),
      h('form', { class: 'row gap', onsubmit: (e) => {
        e.preventDefault();
        if (!add.value.trim()) return;
        extra.push(add.value.trim());
        ls.set('ft.packExtra', extra);
        draw();
      } }, add, h('button', { class: 'btn', type: 'submit' }, '추가')),
    );
  };
  draw();
  sheet('짐 체크리스트', body, { full: true });
}

function taxiHelpSheet() {
  sheet('택시 부르는 법', h('div', { class: 'stack' },
    h('ol', { class: 'guide' },
      h('li', null, h('p', { class: 'strong' }, '카카오 T로 부르기'), h('p', { class: 'muted' }, '카카오 T 앱의 "해외 차량 호출"에서 한국어로 목적지를 찾아 부릅니다. 한국에서 등록해 둔 카드로 원화 결제됩니다. 출발 전에 결제 카드를 꼭 등록해 두세요.')),
      h('li', null, h('p', { class: 'strong' }, '호텔이나 가게에 부탁하기'), h('p', { class: 'muted' }, '프런트나 식당 직원에게 "타쿠시-오 욘데 쿠다사이"(택시 불러 주세요)라고 하면 불러 줍니다.')),
      h('li', null, h('p', { class: 'strong' }, '길에서 잡기'), h('p', { class: 'muted' }, '앞 유리에 빨간 글씨 空車(빈 차)가 켜진 택시를 손을 들어 잡습니다. 뒷문은 자동으로 열리고 닫히니 손대지 않습니다.')),
      h('li', null, h('p', { class: 'strong' }, '목적지 보여주기'), h('p', { class: 'muted' }, '장소마다 있는 "택시 카드"를 열어 기사님께 화면을 보여주세요.')),
    ),
    h('p', { class: 'muted small' }, '예비로 GO 앱이나 Uber 앱도 후쿠오카에서 쓸 수 있습니다. 해외 카드 결제가 됩니다.'),
  ), { full: true });
}

function onsenSheet() {
  sheet('온천 이용법', h('div', { class: 'stack' },
    h('p', { class: 'muted' }, '들어가기 전에 한 번 읽어 두면 편해요.'),
    h('ol', { class: 'guide' }, ONSEN_GUIDE.map((s) => h('li', null, h('p', { class: 'strong' }, s.t), h('p', { class: 'muted' }, s.d)))),
  ), { full: true });
}

function settingsSheet(rerender) {
  const members = store.state.trip?.members || [];
  const me = ls.get('ft.me') || '';
  const font = ls.get('ft.font') || 'm';
  const statusText = {
    ok: '가족과 공유 중', syncing: '맞추는 중…', offline: '인터넷 없음 — 연결되면 자동으로 맞춥니다',
    error: `문제가 있습니다: ${store.error}`, local: '이 기기에만 저장 중', idle: '대기 중',
  }[store.status];
  const close = sheet('설정', h('div', { class: 'stack' },
    h('section', { class: 'card' },
      h('p', { class: 'eyebrow' }, '글씨 크기'),
      h('div', { class: 'seg wide' }, [['m', '보통'], ['l', '크게'], ['xl', '아주 크게']].map(([id, label]) =>
        h('button', { class: font === id ? 'on' : '', onclick: () => { ls.set('ft.font', id); document.documentElement.dataset.font = id; close(); settingsSheet(rerender); } }, label)))),
    members.length ? h('section', { class: 'card' },
      h('p', { class: 'eyebrow' }, '나는 누구인가요'),
      h('div', { class: 'row gap wrap' }, members.map((m) => h('button', { class: `chip ${me === m ? 'on' : ''}`, onclick: () => { ls.set('ft.me', m); close(); settingsSheet(rerender); } }, m))),
      h('p', { class: 'muted small' }, '지출과 미션에 누가 했는지 표시됩니다.')) : null,
    h('section', { class: 'card' },
      h('p', { class: 'eyebrow' }, '가족 공유'),
      h('p', null, statusText),
      store.lastSync ? h('p', { class: 'muted small' }, `마지막으로 맞춘 시각 ${new Date(store.lastSync).toLocaleTimeString('ko-KR')}`) : null,
      getKeys() ? h('button', { class: 'btn', onclick: async () => { await sync(); toast(store.status === 'ok' ? '최신 상태입니다' : store.error || '맞추지 못했습니다'); close(); settingsSheet(rerender); } }, '지금 맞추기') : null,
      getKeys() ? h('button', { class: 'btn danger ghost', onclick: () => confirmSheet('이 폰 잠그기', '이 폰에서 가족 암호를 다시 입력해야 앱을 쓸 수 있게 됩니다. 일정과 기록은 지워지지 않습니다.', '잠그기', () => { forgetKeys(); location.reload(); }) }, '이 폰 잠그기') : null),
  ), { full: true });
}

export function renderMore(root) {
  const trip = store.state.trip;
  const hotel = placeById('hotel');
  const pc = prepCount();
  const rows = [
    ['✅', '출발 전 체크', `${pc.done} / ${pc.total} 개 확인`, () => prepSheet(() => renderMore(root))],
    hotel ? ['🚕', '호텔로 가는 택시 카드', '기사님께 보여주는 일본어 주소', () => taxiCard(hotel)] : null,
    ['🙋', '택시 부르는 법', '카카오 T, 호텔에 부탁하기', taxiHelpSheet],
    ['🗣', '보여주는 일본어', '식당, 택시, 온천, 급할 때', phrasesSheet],
    ['💴', '엔화 계산기 · 쓴 돈', rate() ? `100엔 = ${won(rate())}` : '환율을 넣으면 원화로 바로 보여요', moneySheet],
    trip ? ['✈', '항공 · 호텔 정보', '편명, 시간, 체크인', () => infoSheet(trip)] : null,
    ['♨', '온천 이용법', '들어가는 순서와 예절', onsenSheet],
    ['🧳', '짐 체크리스트', '출발 전 준비물', packingSheet],
    isInstalled() ? null : ['📲', '홈 화면에 바로가기 만들기', '아이콘으로 앱처럼 열기', installApp],
    ['⚙', '설정', '글씨 크기, 가족 공유 상태', () => settingsSheet(() => renderMore(root))],
  ].filter(Boolean);
  mount(root, 
    h('h1', { class: 'page-title' }, '더보기'),
    h('ul', { class: 'menu-list' }, rows.map(([ico, title, desc, fn]) =>
      h('li', null, h('button', { onclick: fn },
        h('span', { class: 'menu-ico' }, ico),
        h('span', { class: 'menu-text' }, h('span', { class: 'strong' }, title), h('span', { class: 'muted' }, desc)),
        h('span', { class: 'chev' }, '›'))))),
  );
}
