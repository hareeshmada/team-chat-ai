/** "acme-studio" → "as", "Karthik S" → "ks", "zed" → "ze". */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toLowerCase();
  return (words[0] ?? '?').slice(0, 2).toLowerCase();
}
