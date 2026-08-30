/** Turn stored logo URLs (localhost / backend:8080 / absolute) into a same-origin path. */
export function publicFileUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = '/api/storage/files/';
  const idx = url.indexOf(marker);
  if (idx >= 0) return url.slice(idx);
  return url;
}
