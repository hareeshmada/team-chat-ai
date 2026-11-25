/** "220 KB", "1.8 MB", "14.2 MB" (1 KB = 1024 bytes, the same unit as the 10 MB limit). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "3.1 of 5.0 MB" while uploading (small files: "120 KB of 220 KB"). */
export function formatProgress(loaded: number, total: number): string {
  const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);
  return total < 1024 * 1024
    ? `${formatBytes(loaded)} of ${formatBytes(total)}`
    : `${mb(loaded)} of ${mb(total)} MB`;
}
