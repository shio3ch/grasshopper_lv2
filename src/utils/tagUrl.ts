export function getTagPath(tag: string): string {
  return `/tags/${encodeURIComponent(tag)}/`;
}

export function normalizeTagParam(tagParam: string): string {
  return decodeURIComponent(tagParam);
}
