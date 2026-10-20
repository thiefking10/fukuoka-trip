// 짐 체크리스트: a tab for shared family gear plus one tab per traveller.
// Checks are shared, so anyone can see what is still missing in someone's bag.
import { store, put, list } from '../store.js';
import { h, mount, sheet, ls, toast } from '../util.js';
import { FAMILY, EACH, ROLE_EXTRA, roleOf } from '../data/packing.js';

const FAMILY_TAB = '공동';
let tab = null;

function groupsFor(who) {
  const base = who === FAMILY_TAB ? FAMILY : [...(ROLE_EXTRA[roleOf(who)] || []), ...EACH];
  const custom = list('pack').filter((r) => r.custom && r.tab === who).map((r) => ({ id: r.id, t: r.title, custom: true }));
  return custom.length ? [...base, { group: '직접 추가한 것', items: custom }] : base;
}

// Built-in items are keyed per tab so each person's passport is checked separately.
const keyOf = (who, item) => (item.custom ? item.id : `${who}:${item.id}`);

function progress(who) {
  const items = groupsFor(who).flatMap((g) => g.items);
  const done = items.filter((it) => store.state.pack?.[keyOf(who, it)]?.done).length;
  return { done, total: items.length };
}

function body(root) {
  const members = store.state.trip?.members || [];
  const tabs = [FAMILY_TAB, ...members];
  if (!tab || !tabs.includes(tab)) tab = members.includes(ls.get('ft.me')) ? ls.get('ft.me') : FAMILY_TAB;
  const { done, total } = progress(tab);
  const add = h('input', { class: 'input', type: 'text', placeholder: `${tab === FAMILY_TAB ? '가족 공용' : tab}에 추가할 물건` });

  mount(root,
    h('div', { class: 'pack-tabs' }, tabs.map((t) => {
      const p = progress(t);
      return h('button', { class: `pack-tab ${t === tab ? 'on' : ''} ${p.done === p.total ? 'all' : ''}`, onclick: () => { tab = t; body(root); } },
        h('span', { class: 'strong' }, t), h('span', { class: 'small' }, `${p.done}/${p.total}`));
    })),
    h('p', { class: 'muted' }, tab === FAMILY_TAB
      ? '가족 모두가 같이 쓰는 물건입니다. 한 사람이 챙기면 됩니다.'
      : `${tab}의 가방에 넣을 것입니다. 위탁수하물은 한 사람 15kg까지입니다.`),
    h('div', { class: 'bar' }, h('span', { style: `width:${total ? (done / total) * 100 : 0}%` })),
    groupsFor(tab).map((g) => h('section', null,
      h('h3', { class: 'sub' }, g.group),
      g.items.map((it) => {
        const key = keyOf(tab, it);
        const rec = store.state.pack?.[key];
        return h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: !!rec?.done, onchange: (e) => {
            put('pack', { id: key, done: e.target.checked, by: e.target.checked ? ls.get('ft.me') || '' : '' });
            body(root);
          } }),
          h('span', { class: 'check-text' },
            h('span', null, it.t, rec?.done && rec.by ? h('small', { class: 'muted' }, ` · ${rec.by}`) : null),
            it.note ? h('small', { class: 'muted' }, it.note) : null));
      }))),
    h('form', { class: 'row gap', onsubmit: (e) => {
      e.preventDefault();
      const t = add.value.trim();
      if (!t) return;
      put('pack', { custom: true, tab, title: t, done: false });
      toast('목록에 추가했습니다');
      body(root);
    } }, add, h('button', { class: 'btn', type: 'submit' }, '추가')),
  );
}

export function packingSheet(onClose) {
  const root = h('div', { class: 'stack' });
  body(root);
  sheet('짐 체크리스트', root, { full: true, onClose });
}
