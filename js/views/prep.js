// 출발 전 체크: one thing at a time. Confirming an item moves on to the next one.
// The checks are shared, so the family sees who has already taken care of what.
import { store, put } from '../store.js';
import { h, mount, sheet, ls, daysUntil } from '../util.js';
import { PREP } from '../data/prep.js';

const ALL = PREP.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group })));
const isDone = (id) => !!store.state.prep?.[id]?.done;
const setDone = (id, done) => put('prep', { id, done, by: done ? ls.get('ft.me') || '' : '' });
export const prepCount = () => ({ done: ALL.filter((i) => isDone(i.id)).length, total: ALL.length });
const nextItem = () => ALL.find((i) => !isDone(i.id));

function body(root) {
  const { done, total } = prepCount();
  const next = nextItem();
  mount(root,
    h('p', { class: 'book-count' }, h('b', null, done), ` / ${total} 개 확인`),
    h('div', { class: 'bar' }, h('span', { style: `width:${(done / total) * 100}%` })),
    next
      ? h('section', { class: 'prep-next' },
        h('p', { class: 'eyebrow' }, `지금 확인할 것 · ${next.group}`),
        h('h3', null, next.title),
        h('p', null, next.desc),
        h('button', { class: 'btn primary', onclick: () => { setDone(next.id, true); body(root); } }, '확인했어요, 다음으로'),
        h('button', { class: 'btn ghost', onclick: () => {
          // "Later" only changes what this phone shows next; nothing is marked done.
          ALL.push(...ALL.splice(ALL.indexOf(next), 1));
          body(root);
        } }, '나중에 할게요'))
      : h('p', { class: 'reason' }, '출발 준비를 모두 마쳤어요. 즐거운 여행 되세요!'),
    PREP.map((g) => h('section', null,
      h('h3', { class: 'sub' }, g.group),
      g.items.map((it) => {
        const rec = store.state.prep?.[it.id];
        return h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: !!rec?.done, onchange: (e) => { setDone(it.id, e.target.checked); body(root); } }),
          h('span', null, it.title, rec?.done && rec.by ? h('small', { class: 'muted' }, ` · ${rec.by}`) : null));
      }))),
  );
}

export function prepSheet(onClose) {
  const root = h('div', { class: 'stack' });
  body(root);
  sheet('출발 전 체크', root, { full: true, onClose });
}

// Shown on the home screen until the trip starts or everything is checked.
export function prepCard(trip, rerender) {
  const { done, total } = prepCount();
  if (done === total || daysUntil(trip.days[0]) < 0) return null;
  const next = nextItem();
  return h('button', { class: 'prep-card', onclick: () => prepSheet(rerender) },
    h('span', { class: 'prep-ring' }, `${done}/${total}`),
    h('span', { class: 'menu-text' },
      h('span', { class: 'strong' }, '출발 전 체크'),
      h('span', { class: 'muted' }, `다음: ${next.title}`)),
    h('span', { class: 'chev' }, '›'));
}
