// 찍어서 물어보기: photograph a sign, menu, machine or product and get it explained.
import { h, mount, ls, shrinkImage, toast } from '../util.js';
import { askPhoto, hasAI } from '../gemini.js';

const MODES = [
  ['sign', '표지판·안내문', '🪧'],
  ['menu', '메뉴판', '📋'],
  ['machine', '기계·버튼', '🎛'],
  ['product', '상품', '🧴'],
];

let mode = 'sign';
let current = null; // { thumb, result } | { error }
let busy = false;

function resultView(res) {
  if (!res) return null;
  return h('div', { class: 'answer' },
    h('h2', null, res.title || '사진 설명'),
    res.translation ? h('p', { class: 'answer-tr' }, res.translation) : null,
    res.what_to_do ? h('div', { class: 'todo' }, h('p', { class: 'eyebrow' }, '이렇게 하세요'), h('p', null, res.what_to_do)) : null,
    res.steps?.length ? h('ol', { class: 'steps' }, res.steps.map((s) => h('li', null, s))) : null,
    res.items?.length ? h('ul', { class: 'menu' }, res.items.map((it) =>
      h('li', { class: `${it.raw ? 'is-raw' : ''} ${it.pick ? 'is-pick' : ''}` },
        h('div', { class: 'menu-top' },
          h('span', { class: 'strong' }, it.ko),
          it.price ? h('span', { class: 'price' }, it.price) : null),
        h('p', { class: 'ja', lang: 'ja' }, it.ja),
        it.desc ? h('p', { class: 'muted' }, it.desc) : null,
        h('div', { class: 'tags' },
          it.pick ? h('span', { class: 'tag tag-pick' }, '추천') : null,
          it.raw ? h('span', { class: 'tag tag-warn' }, '날것') : null,
          it.kid ? h('span', { class: 'tag' }, '아이도 OK') : null),
      ))) : null,
    res.warnings?.length ? h('div', { class: 'note-warn' }, res.warnings.map((w) => h('p', null, w))) : null,
  );
}

export function renderCamera(root) {
  const rerender = () => renderCamera(root);
  const question = h('input', { class: 'input', type: 'text', placeholder: '궁금한 점 (선택) 예: 어린이 요금은 얼마야?' });
  const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const pick = h('input', { type: 'file', accept: 'image/*', hidden: true });

  const handle = async (f) => {
    if (!f) return;
    if (!hasAI()) return toast('이 기능은 가족 암호로 잠금을 푼 뒤에 쓸 수 있습니다');
    busy = true;
    current = null;
    const q = question.value.trim();
    rerender();
    try {
      const img = await shrinkImage(f, 1400, 0.85);
      current = { thumb: img.dataUrl };
      rerender();
      const result = await askPhoto(mode, q, img.base64);
      current = { thumb: img.dataUrl, result };
      const hist = ls.get('ft.cam', []);
      hist.unshift({ at: Date.now(), mode, result });
      ls.set('ft.cam', hist.slice(0, 8));
    } catch (e) {
      current = { ...(current || {}), error: e.message };
    }
    busy = false;
    rerender();
  };
  file.addEventListener('change', () => handle(file.files[0]));
  pick.addEventListener('change', () => handle(pick.files[0]));

  const hist = ls.get('ft.cam', []);
  mount(root, 
    h('h1', { class: 'page-title' }, '찍어서 물어보기'),
    h('p', { class: 'muted' }, '번역만이 아니라, 그래서 무엇을 하면 되는지까지 알려드려요.'),
    h('div', { class: 'modes' }, MODES.map(([id, label, ico]) =>
      h('button', { class: `mode ${mode === id ? 'on' : ''}`, onclick: () => { mode = id; rerender(); } }, h('span', { class: 'cat-ico' }, ico), label))),
    question,
    h('button', { class: 'shutter', disabled: busy, onclick: () => file.click() }, h('span', { class: 'shutter-ring' }), busy ? '읽는 중…' : '사진 찍기'),
    h('button', { class: 'btn ghost', disabled: busy, onclick: () => pick.click() }, '앨범에서 고르기'),
    file, pick,
    current?.thumb ? h('img', { class: 'shot', src: current.thumb, alt: '방금 찍은 사진' }) : null,
    busy ? h('p', { class: 'loading' }, '사진 속 글자를 읽고 있어요…') : null,
    current?.error ? h('p', { class: 'note-warn' }, current.error) : null,
    resultView(current?.result),
    !current && hist.length ? h('section', { class: 'panel' },
      h('h2', { class: 'q' }, '최근에 물어본 것'),
      hist.map((x) => h('details', { class: 'hist' },
        h('summary', null, x.result.title || '사진 설명', h('span', { class: 'muted' }, ` · ${new Date(x.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`)),
        resultView(x.result)))) : null,
    h('p', { class: 'muted small' }, '여권이나 카드처럼 개인정보가 보이는 것은 찍지 마세요. 사진은 구글 AI로 전송됩니다.'),
  );
}
