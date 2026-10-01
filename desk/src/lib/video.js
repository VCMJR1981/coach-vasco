// Clip timestamps. Only YouTube can open a video at a given second, so
// links are built for YouTube and every other host shows the time as text.

// "1:23", "01:02:03", "83", "83s" -> seconds, or null if it isn't a time
export function toSeconds(text) {
  const t = String(text ?? '').trim().replace(/s$/i, '');
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return null;
  return t.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
}

export function youtubeId(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/);
    if (m) return m[2];
  }
  return null;
}

export function timestampLink(url, time) {
  const id = youtubeId(url);
  const s = toSeconds(time);
  if (!id || s === null) return null;
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}&t=${s}s`;
}

export function hostName(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
