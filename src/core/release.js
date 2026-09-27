// The publishing script stamps this on the document, keeping code and assets together.
export const RELEASE = globalThis.document?.documentElement?.dataset?.release || '';

export function releaseAssetUrl(url, release = RELEASE) {
  if (!release || !url.startsWith('assets/')) return url;
  const [resource, fragment] = url.split('#', 2), split = resource.indexOf('?');
  const path = split < 0 ? resource : resource.slice(0, split);
  const params = new URLSearchParams(split < 0 ? '' : resource.slice(split + 1));
  params.set('v', release);
  return `${path}?${params}${fragment === undefined ? '' : `#${fragment}`}`;
}
