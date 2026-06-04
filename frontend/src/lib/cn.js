// Tiny classNames joiner (truthy strings only).
export function cn(...parts) {
  return parts.flat().filter(Boolean).join(' ');
}
