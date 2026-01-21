export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  
  if (!oauthPortalUrl || oauthPortalUrl === "") {
    return "/api/oauth/dev-login";
  }

  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

export const PAGE_DIALOG_CLASSNAME = "w-[96vw] max-w-[1400px] h-[90vh] p-0 bg-background/95 backdrop-blur-xl overflow-hidden";
export const DEFAULT_PROJECT_ID = "1";
export const LAST_PROJECT_ID_KEY = "last-project-id";
export const getProjectEntryPath = () => {
  const lastProjectId = localStorage.getItem(LAST_PROJECT_ID_KEY);
  return `/project/${lastProjectId || DEFAULT_PROJECT_ID}`;
};
