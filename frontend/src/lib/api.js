function stripTrailingSlash(url) {
  if (!url) return url;
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export const API_BASE = (() => {
  const envUrlRaw = stripTrailingSlash(process.env.REACT_APP_BACKEND_URL);
  const envUrl =
    envUrlRaw && envUrlRaw !== "undefined" && envUrlRaw !== "null" ? envUrlRaw : "";

  const originRaw =
    typeof window !== "undefined" ? stripTrailingSlash(window.location?.origin || "") : "";
  const origin = originRaw && originRaw !== "undefined" && originRaw !== "null" ? originRaw : "";

  const base = envUrl || origin;
  if (base) return `${base}/api`;
  return "/api";
})();

export function apiUrl(path) {
  if (!path) return API_BASE;
  if (path.startsWith("/")) return `${API_BASE}${path}`;
  return `${API_BASE}/${path}`;
}
