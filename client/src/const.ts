export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
// stateには現在のページのパスを含めて、ログイン後に元のページに戻れるようにする
export const getLoginUrl = (returnPath?: string) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;

  // OAuth未設定時はクラッシュしない（DEV_MODE用）
  if (!oauthPortalUrl) {
    console.warn("[Auth] VITE_OAUTH_PORTAL_URL not set. Login disabled.");
    return "/api/dev-login";
  }

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  
  // 現在のパスまたは指定されたパスをstateに含める
  const currentPath = returnPath || window.location.pathname;
  const state = currentPath;

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
