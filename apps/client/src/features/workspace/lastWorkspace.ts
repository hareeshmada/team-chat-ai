// Remembers the last opened workspace for "/app". Storage can be blocked (private mode,
// disabled site data), so every access is wrapped; without it we simply open the first one.
const KEY = 'tc-last-workspace';

export function getLastWorkspace(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setLastWorkspace(workspaceId: string): void {
  try {
    localStorage.setItem(KEY, workspaceId);
  } catch {
    // ignore
  }
}
