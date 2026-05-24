export function forceHttpsWhenPageIsHttps(url) {
  if (!url) return url;
  if (typeof window === 'undefined') return url;
  if (window.location?.protocol !== 'https:') return url;
  if (url.startsWith('http://')) return `https://${url.slice('http://'.length)}`;
  return url;
}
