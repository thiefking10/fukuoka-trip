import { h, ls, toast } from './util.js';
import { store, onChange, startSync, seedLocalIfEmpty } from './store.js';
import { getKeys, fetchLockedFile, unlock } from './secrets.js';
import { renderPlan } from './views/plan.js';
import { renderRecommend } from './views/recommend.js';
import { renderCamera } from './views/camera.js';
import { renderMissions } from './views/missions.js';
import { renderMore } from './views/more.js';

const TABS = [
  { id: 'plan', label: '일정', icon: '🗓', render: renderPlan },
  { id: 'rec', label: '추천', icon: '🍜', render: renderRecommend },
  { id: 'cam', label: '물어보기', icon: '📷', render: renderCamera },
  { id: 'book', label: '미션북', icon: '💮', render: renderMissions },
  { id: 'more', label: '더보기', icon: '☰', render: renderMore },
];

const app = document.getElementById('app');
const isLocalPreview = ['localhost', '127.0.0.1'].includes(location.hostname);
let tab = ls.get('ft.tab') || 'plan';
let view;
let nav;
let syncDot;

document.documentElement.dataset.font = ls.get('ft.font') || 'm';

function draw() {
  const t = TABS.find((x) => x.id === tab) || TABS[0];
  t.render(view);
  for (const b of nav.children) b.classList.toggle('on', b.dataset.tab === t.id);
  syncDot.dataset.status = store.status;
  syncDot.title = { ok: '가족과 공유 중', syncing: '맞추는 중', offline: '인터넷 없음', error: '공유에 문제가 있습니다', local: '이 기기에만 저장 중' }[store.status] || '';
}

function shell() {
  view = h('main', { class: 'view', id: 'view' });
  syncDot = h('span', { class: 'sync-dot' });
  nav = h('nav', { class: 'tabbar', 'aria-label': '메뉴' }, TABS.map((t) =>
    h('button', { 'data-tab': t.id, class: t.id === 'cam' ? 'tab tab-cam' : 'tab', onclick: () => {
      tab = t.id;
      ls.set('ft.tab', tab);
      draw();
      window.scrollTo(0, 0);
    } }, h('span', { class: 'tab-ico' }, t.icon), h('span', null, t.label))));
  app.replaceChildren(syncDot, view, nav);
  // Only the visible tab is redrawn when shared data changes, and never while a sheet is open
  // (a redraw would not touch the sheet, but it keeps typing in the view from being lost).
  onChange(() => {
    if (document.activeElement && view.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      syncDot.dataset.status = store.status;
      return;
    }
    draw();
  });
  draw();
  setInterval(() => tab === 'plan' && !document.querySelector('.sheet-wrap') && draw(), 60000);
}

function lockScreen(locked) {
  const input = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: '가족 암호' });
  const msg = h('p', { class: 'note-warn', hidden: true });
  const btn = h('button', { class: 'btn primary', type: 'submit' }, '열기');
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    btn.disabled = true;
    btn.textContent = '확인하는 중…';
    try {
      await unlock(locked, input.value);
      shell();
      startSync();
    } catch (err) {
      msg.hidden = false;
      msg.textContent = err.message;
      btn.disabled = false;
      btn.textContent = '열기';
    }
  } }, input, btn, msg);
  app.replaceChildren(h('div', { class: 'lock-screen' },
    h('div', { class: 'lock-mark' }, '福'),
    h('h1', null, '후쿠오카 가족여행'),
    locked
      ? [h('p', { class: 'muted' }, '가족 암호를 한 번만 입력하면 이 폰에서 계속 쓸 수 있어요.'), form]
      : h('p', { class: 'muted' }, '아직 준비 중입니다. 설정이 끝나면 이 화면에서 가족 암호를 입력할 수 있어요.'),
  ));
}

async function boot() {
  if ('serviceWorker' in navigator && !isLocalPreview) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (getKeys()) {
    shell();
    startSync();
    return;
  }
  if (isLocalPreview) {
    await seedLocalIfEmpty();
    shell();
    startSync();
    return;
  }
  lockScreen(await fetchLockedFile());
}

window.addEventListener('offline', () => toast('인터넷이 끊겼습니다. 일정과 카드는 그대로 볼 수 있어요'));
boot();
