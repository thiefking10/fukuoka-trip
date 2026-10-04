// Home-screen shortcut. Chrome hands over an install prompt when it is ready;
// other browsers get step-by-step instructions instead.
import { h, ls, sheet, toast } from './util.js';

let deferred = null;
const listeners = new Set();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  listeners.forEach((fn) => fn());
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  ls.set('ft.installed', true);
  toast('홈 화면에 바로가기를 만들었습니다');
  listeners.forEach((fn) => fn());
});

export const onInstallChange = (fn) => listeners.add(fn);

export const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function howTo() {
  sheet('홈 화면에 바로가기 만들기', h('div', { class: 'stack' },
    h('p', { class: 'muted' }, '쓰는 브라우저에 맞는 방법을 따라 하세요. 한 번만 하면 앱처럼 아이콘으로 열 수 있습니다.'),
    h('ol', { class: 'guide' },
      h('li', null, h('p', { class: 'strong' }, '크롬'), h('p', { class: 'muted' }, '오른쪽 위 점 세 개(⋮)를 누르고 "홈 화면에 추가"를 누른 다음 "설치"를 누릅니다.')),
      h('li', null, h('p', { class: 'strong' }, '삼성 인터넷'), h('p', { class: 'muted' }, '아래쪽 줄 세 개(≡)를 누르고 "현재 페이지 추가"에서 "홈 화면"을 고릅니다.')),
      h('li', null, h('p', { class: 'strong' }, '카카오톡에서 연 경우'), h('p', { class: 'muted' }, '오른쪽 위 메뉴에서 "다른 브라우저로 열기"를 눌러 크롬으로 연 뒤 위 방법을 따릅니다.')),
    ),
  ), { full: true });
}

export async function installApp() {
  if (!deferred) return howTo();
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  if (outcome === 'accepted') deferred = null;
}

// A one-time nudge on the home screen; it disappears once installed or dismissed.
export function installCard(rerender) {
  if (isInstalled() || ls.get('ft.installed') || ls.get('ft.installLater')) return null;
  return h('div', { class: 'install-card' },
    h('img', { src: 'icons/icon-192.png', alt: '', width: 48, height: 48 }),
    h('span', { class: 'menu-text' },
      h('span', { class: 'strong' }, '홈 화면에 바로가기 만들기'),
      h('span', { class: 'muted' }, '아이콘을 눌러 앱처럼 바로 엽니다')),
    h('div', { class: 'row gap' },
      h('button', { class: 'btn small primary', onclick: installApp }, '만들기'),
      h('button', { class: 'icon-btn', 'aria-label': '닫기', onclick: () => { ls.set('ft.installLater', true); rerender(); } }, '✕')));
}
