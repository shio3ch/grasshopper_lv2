export function getTagPath(tag: string): string {
  return `/tags/${encodeURI(tag)}/`;
}

export function getTagRouteParam(tag: string): string {
  return tag;
}

export function normalizeTagParam(tagParam: string): string {
  return decodeURIComponent(tagParam);
}
