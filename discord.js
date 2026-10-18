'use strict';
// JALTRON Discord: "talk to staff for a subscription" banner + live server card built from the public guild widget JSON.
// Needs "Server Settings > Widget > Enable server widget" in Discord, otherwise the card falls back to a plain join card.
(function () {
  const GUILD = '1503297362246897694';
  const API = `https://discord.com/api/guilds/${GUILD}/widget.json`;
  const FALLBACK = `https://discord.com/channels/${GUILD}`;
  const LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>';
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const safeUrl = (u, fb) => /^https:\/\/(cdn\.discordapp\.com|discord\.gg|discord\.com|[\w-]+\.discordapp\.(com|net))\//.test(u || '') ? u : fb;

  document.querySelectorAll('.dc-logo').forEach(el => { el.innerHTML = LOGO; });

  const box = document.getElementById('dc-embed');
  if (!box) return;
  const state = { invite: FALLBACK };

  function render(d) {
    const invite = safeUrl(d && d.instant_invite, FALLBACK);
    state.invite = invite;
    const members = ((d && d.members) || []).slice(0, 12);
    const online = d && d.presence_count != null ? d.presence_count : null;
    const chans = ((d && d.channels) || []).slice(0, 3);
    const avatars = members.map(m => `<span class="dc-av ${esc(m.status || 'online')}" title="${esc(m.username)}"><img src="${esc(safeUrl(m.avatar_url, ''))}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`).join('');
    box.innerHTML = `
      <div class="dc-top">
        <span class="dc-badge dc-logo">${LOGO}</span>
        <div class="dc-name"><strong>${esc((d && d.name) || 'JALTRON Discord')}</strong>
          <span class="sub">${online != null ? `<i class="dc-dot"></i>${online} online` : 'Official community and staff'}</span></div>
        <a class="btn primary dc-join" href="${esc(invite)}" target="_blank" rel="noopener noreferrer">Join</a>
      </div>
      ${avatars ? `<div class="dc-avs" aria-label="Members online">${avatars}</div>` : ''}
      ${chans.length ? `<ul class="dc-chans">${chans.map(c => `<li># ${esc(c.name)}</li>`).join('')}</ul>` : ''}
      <p class="dc-foot sub">Open a ticket or message staff to get your subscription.</p>`;
    document.querySelectorAll('[data-dc-link]').forEach(a => { a.href = invite; });
  }

  // Static card first (instant), then upgrade it with live data
  render(null);
  const ctl = new AbortController();
  setTimeout(() => ctl.abort(), 8000);
  fetch(API, { signal: ctl.signal, cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject(new Error(r.status)))
    .then(render)
    .catch(() => { /* widget disabled or offline: keep the static card */ });
})();
