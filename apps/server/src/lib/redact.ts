/** Query parameters that are credentials and must never reach the logs. */
const SECRET_PARAMS = ['ticket'];

/** "/api/notifications/stream?ticket=abc&x=1" → "/api/notifications/stream?ticket=[REDACTED]&x=1" */
export function redactUrl(url: string | undefined): string | undefined {
  if (!url || !url.includes('?')) return url;
  const [path, query] = url.split('?', 2) as [string, string];
  const params = new URLSearchParams(query);
  for (const name of SECRET_PARAMS) if (params.has(name)) params.set(name, '[REDACTED]');
  return `${path}?${params.toString().replaceAll('%5BREDACTED%5D', '[REDACTED]')}`;
}
