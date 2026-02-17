export const WORKSPACE_COOKIE_NAME = "koso_workspace_id";
export const WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function setActiveWorkspaceCookie(workspaceId: string): void {
  document.cookie = `${WORKSPACE_COOKIE_NAME}=${workspaceId}; path=/; max-age=${WORKSPACE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function getActiveWorkspaceCookie(): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${WORKSPACE_COOKIE_NAME}=([^;]*)`)
  );
  return match ? match[1] : null;
}

export function clearActiveWorkspaceCookie(): void {
  document.cookie = `${WORKSPACE_COOKIE_NAME}=; path=/; max-age=0`;
}
