export function shouldForceRefresh(currentVersion, latestVersion) {
  return !currentVersion || currentVersion !== latestVersion;
}

export function buildCacheBustUrl(url) {
  const baseOrigin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost';
  const parsedUrl = new URL(url, baseOrigin);
  parsedUrl.searchParams.set('t', String(Date.now()));
  return parsedUrl.pathname + parsedUrl.search;
}
