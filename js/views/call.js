// 가족에게 전화: one tap opens the phone's default calling app (A. when it is set as the
// default phone app). Numbers live only in the private trip data, never in the public code.
import { store } from '../store.js';
import { h, ls, sheet } from '../util.js';
import { EMERGENCY } from '../data/static.js';

// Korean mobiles dialed from Japan need the country code: 010-1234-5678 -> +821012345678.
const intl = (num) => `+82${num.replace(/\D/g, '').replace(/^0/, '')}`;

export const hasContacts = () => !!store.state.trip?.contacts?.length;

function emergencyList() {
  return h('div', { class: 'stack' }, EMERGENCY.map((e, i) =>
    h('div', { class: `call-card emergency ${i < 2 ? 'urgent' : ''}` },
      h('div', { class: 'call-who' },
        h('span', { class: 'call-name' }, e.name, h('span', { class: 'call-num' }, ` ${e.num}`)),
        h('span', { class: 'muted' }, e.desc),
        e.ja ? h('span', { class: 'call-ja', lang: 'ja' }, e.ja, h('small', { class: 'muted' }, ` · ${e.jaKo}`)) : null),
      h('a', { class: `btn call-btn ${i < 2 ? 'danger' : 'primary'}`, href: `tel:${e.dial}` }, '📞 전화'))));
}

export function emergencySheet() {
  sheet('긴급 전화', h('div', { class: 'stack' },
    h('p', { class: 'note-warn' }, '110·119는 일본어로 받습니다. 말이 어려우면 "칸코쿠진데스(한국인입니다)"라고 말하고, 호텔이나 주변 일본인에게 전화를 바꿔 달라고 하세요. 한국어 상담은 Japan Visitor Hotline이나 영사콜센터로 거세요.'),
    emergencyList(),
    h('p', { class: 'muted small' }, '현재 위치를 묻는 경우가 많습니다. 호텔 주소는 더보기 > 호텔로 가는 택시 카드에 있습니다.'),
  ), { full: true });
}

export function callSheet() {
  const contacts = store.state.trip?.contacts || [];
  const me = ls.get('ft.me');
  sheet('가족에게 전화', h('div', { class: 'stack' },
    contacts.length
      ? contacts.map((c) => h('div', { class: `call-card ${c.member === me ? 'is-me' : ''}` },
        h('div', { class: 'call-who' },
          h('span', { class: 'call-name' }, c.name, c.member === me ? h('small', { class: 'muted' }, ' · 나') : null),
          h('span', { class: 'muted' }, `${c.role} · ${c.tel}`)),
        h('div', { class: 'row gap' },
          h('a', { class: 'btn primary call-btn', href: `tel:${intl(c.tel)}` }, '📞 전화'),
          h('a', { class: 'btn small', href: `sms:${intl(c.tel)}` }, '문자'))))
      : h('p', { class: 'muted' }, '가족 연락처를 아직 불러오지 못했습니다. 인터넷에 연결된 상태에서 다시 열어 주세요.'),
    h('h3', { class: 'sub' }, '긴급 전화'),
    emergencyList(),
    h('p', { class: 'muted small' }, '"전화"를 누르면 폰의 기본 전화 앱이 열립니다. 에이닷(A.)을 기본 전화 앱으로 해 두면 에이닷으로 걸립니다. 해외에서 일반 전화는 로밍 요금이 나올 수 있으니, 길게 통화할 때는 카카오톡 보이스톡이 편합니다.'),
  ), { full: true });
}
