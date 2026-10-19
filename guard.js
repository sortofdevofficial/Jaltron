// Deterrent only: no web page can truly lock a browser down (the menu, view-source: and JS-off still work).
// Real protection lives in firestore.rules and the api/ checks. Local development (localhost) is left alone.
(function () {
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || !location.hostname || location.protocol === 'file:') return;
  const log = console.log.bind(console), field = (e) => e.target.closest && e.target.closest('input, textarea, [contenteditable="true"], code, pre, [data-copyable]');
  document.addEventListener('contextmenu', (e) => { if (!field(e)) e.preventDefault(); }, true);   // text fields keep paste
  document.addEventListener('selectstart', (e) => { if (!field(e)) e.preventDefault(); }, true);   // block dragging cursor to select HTML text
  document.addEventListener('copy', (e) => { if (!field(e)) e.preventDefault(); }, true);          // block copying HTML text
  document.addEventListener('dragstart', (e) => {
    if (e.target && e.target.closest && (field(e) || e.target.closest('[draggable="true"], .task-item'))) return;
    e.preventDefault();
  }, true);
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase(), m = e.ctrlKey || e.metaKey;
    if (m && (k === 'c' || k === 'a') && !field(e)) { e.preventDefault(); e.stopPropagation(); }
    if (e.key === 'F12' || (m && e.shiftKey && 'ijckm'.includes(k)) || (m && e.altKey && 'ijcu'.includes(k)) || (m && !e.shiftKey && k === 'u')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  // Silence the console, then look for it opening: the page covers itself until it is closed.
  ['log', 'info', 'debug', 'warn', 'table', 'dir', 'trace'].forEach((n) => { console[n] = () => {}; });
  const wall = document.createElement('div');
  wall.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:none;place-items:center;text-align:center;padding:2rem;background:#04060f;color:#eaf0ff;font:600 1.1rem system-ui,sans-serif';
  wall.innerHTML = '<div style="font-size:3rem">🔒</div><div>Developer tools are not allowed here.<br><span style="opacity:.65;font-weight:400;font-size:.9rem">Close them to keep using JALTRON.</span></div>';
  addEventListener('DOMContentLoaded', () => document.body.appendChild(wall));
  const probe = new Image(); let seen = false;
  Object.defineProperty(probe, 'id', { get() { seen = true; return ''; } });
  const touch = matchMedia('(pointer: coarse)').matches;
  setInterval(() => {
    seen = false; log(probe); console.clear();
    const gap = !touch && (outerWidth - innerWidth > 220 || outerHeight - innerHeight > 260);
    wall.style.display = seen || gap ? 'grid' : 'none';
  }, 1000);
})();
