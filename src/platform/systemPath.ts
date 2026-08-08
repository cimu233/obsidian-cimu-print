export function joinSystemPath(base: string, ...parts: string[]): string {
  const separator = usesWindowsSeparator(base) ? '\\' : '/';
  const normalizedBase = base.replace(/[\\/]+$/u, '');
  const normalizedParts = parts
    .map((part) => part.replace(/^[\\/]+|[\\/]+$/gu, '').replace(/[\\/]+/gu, separator))
    .filter((part) => part.length > 0);
  return [normalizedBase, ...normalizedParts].join(separator);
}

export function dirnameSystemPath(path: string): string {
  const separator = usesWindowsSeparator(path) ? '\\' : '/';
  const lastSeparator = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  if (lastSeparator < 0) {
    return '.';
  }
  if (lastSeparator === 0) {
    return separator;
  }
  return path.slice(0, lastSeparator);
}

function usesWindowsSeparator(path: string): boolean {
  return /^[A-Za-z]:\\/u.test(path) || (path.includes('\\') && !path.includes('/'));
}
