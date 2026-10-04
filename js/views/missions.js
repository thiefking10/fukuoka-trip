// 미션북: the child's stamp book. A finished mission gets an inked stamp and an optional photo.
import { store, put, remove, list, savePhoto, photoUrl } from '../store.js';
import { h, mount, sheet, toast, shrinkImage, uid, ls } from '../util.js';

const sorted = () => list('missions').sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.title.localeCompare(b.title));

// Looks like the rubber stamps Japanese stations keep for travellers.
function stamp(m) {
  const d = new Date(m.doneAt || Date.now());
  const date = `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`;
  const tilt = ((m.id.charCodeAt(m.id.length - 1) % 9) - 4) * 2.5;
  const id = `arc-${m.id}`;
  return h('div', { class: 'stamp', style: `--tilt:${tilt}deg`, html: `
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <defs><path id="${id}" d="M60,60 m-41,0 a41,41 0 1,1 82,0 a41,41 0 1,1 -82,0"/></defs>
      <circle cx="60" cy="60" r="55" fill="none" stroke="currentColor" stroke-width="3.5"/>
      <circle cx="60" cy="60" r="30" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <text font-size="11.5" font-weight="700" letter-spacing="2.2" fill="currentColor"><textPath href="#${id}" startOffset="3%">FUKUOKA · 福岡 · MISSION CLEAR ·</textPath></text>
      <text x="60" y="57" text-anchor="middle" font-size="19" font-weight="800" fill="currentColor">${date}</text>
      <text x="60" y="73" text-anchor="middle" font-size="10" font-weight="700" letter-spacing="1" fill="currentColor">완료</text>
    </svg>` });
}

function missionCard(m) {
  const img = h('img', { class: 'mission-photo', alt: `${m.title} 사진`, hidden: true });
  if (m.photo) photoUrl(m.photo).then((u) => { if (u) { img.src = u; img.hidden = false; } }).catch(() => {});
  return h('li', { class: `mission ${m.done ? 'done' : ''}` },
    h('button', { class: 'mission-main', onclick: () => openMission(m) },
      h('span', { class: 'mission-ico' }, m.icon || '⭐'),
      h('span', { class: 'mission-text' },
        h('span', { class: 'strong' }, m.title),
        m.hint ? h('span', { class: 'muted' }, m.hint) : null,
        m.done && m.by ? h('span', { class: 'muted small' }, `${m.by}와(과) 함께 완료`) : null),
      m.done ? stamp(m) : h('span', { class: 'stamp-slot' }, '도장')),
    img,
  );
}

function openMission(m) {
  const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const status = h('p', { class: 'muted' });
  const finish = async (photoFile) => {
    try {
      let photo = m.photo || null;
      if (photoFile) {
        status.textContent = '사진을 저장하는 중…';
        const img = await shrinkImage(photoFile, 1000, 0.8);
        photo = await savePhoto(`${m.id}-${uid()}`, img.base64);
      }
      put('missions', { id: m.id, done: true, doneAt: m.doneAt || Date.now(), by: ls.get('ft.me') || '', photo });
      close();
      toast('도장 쾅! 미션 완료');
    } catch (e) {
      status.textContent = e.message;
    }
  };
  file.addEventListener('change', () => finish(file.files[0]));
  const close = sheet(m.title, h('div', { class: 'form' },
    h('p', { class: 'mission-big' }, m.icon || '⭐'),
    m.hint ? h('p', { class: 'center' }, m.hint) : null,
    m.done
      ? [
        h('button', { class: 'btn', onclick: () => file.click() }, m.photo ? '사진 다시 찍기' : '사진 붙이기'),
        h('button', { class: 'btn ghost', onclick: () => { put('missions', { id: m.id, done: false, doneAt: null, photo: null }); close(); } }, '도장 지우기'),
      ]
      : [
        h('button', { class: 'btn primary', onclick: () => file.click() }, '사진 찍고 도장 찍기'),
        h('button', { class: 'btn', onclick: () => finish(null) }, '사진 없이 도장 찍기'),
      ],
    h('button', { class: 'btn ghost', onclick: () => { close(); editMission(m); } }, '미션 고치기'),
    file, status,
  ));
}

function editMission(m = {}) {
  const title = h('input', { class: 'input', type: 'text', value: m.title || '', placeholder: '예: 일본 편의점에서 간식 고르기' });
  const hint = h('input', { class: 'input', type: 'text', value: m.hint || '', placeholder: '어떻게 하면 되는지 (선택)' });
  const icon = h('input', { class: 'input', type: 'text', value: m.icon || '⭐', maxlength: 4 });
  const close = sheet(m.id ? '미션 고치기' : '새 미션 만들기', h('div', { class: 'form' },
    h('label', null, '미션', title),
    h('label', null, '설명', hint),
    h('label', null, '그림 (이모지 하나)', icon),
    h('button', { class: 'btn primary', onclick: () => {
      if (!title.value.trim()) return toast('미션 이름을 적어 주세요');
      put('missions', { ...(m.id ? { id: m.id } : { order: 99 }), title: title.value.trim(), hint: hint.value.trim(), icon: icon.value.trim() || '⭐' });
      close();
    } }, m.id ? '고친 내용 저장' : '미션 추가'),
    m.id ? h('button', { class: 'btn danger ghost', onclick: () => { remove('missions', m.id); close(); } }, '이 미션 지우기') : null,
  ));
}

export function renderMissions(root) {
  const all = sorted();
  const done = all.filter((m) => m.done).length;
  mount(root, 
    h('header', { class: 'book-head' },
      h('p', { class: 'eyebrow' }, '후쿠오카 탐험대'),
      h('h1', { class: 'page-title' }, '미션북'),
      h('p', { class: 'book-count' }, h('b', null, done), ` / ${all.length} 개 완료`),
      h('div', { class: 'bar' }, h('span', { style: `width:${all.length ? (done / all.length) * 100 : 0}%` })),
      all.length && done === all.length ? h('p', { class: 'reason' }, '모든 미션 완료! 후쿠오카 탐험대장으로 임명합니다.') : null,
    ),
    all.length
      ? h('ul', { class: 'missions' }, all.map(missionCard))
      : h('div', { class: 'empty' }, h('p', null, '아직 미션이 없어요.'), h('p', { class: 'muted' }, '아래 버튼으로 첫 미션을 만들어 보세요.')),
    h('button', { class: 'btn', onclick: () => editMission() }, '+ 새 미션 만들기'),
    store.status === 'local' ? h('p', { class: 'muted small' }, '지금은 이 기기에만 저장됩니다.') : null,
  );
}
