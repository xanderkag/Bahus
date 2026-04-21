function queryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function getStoredSidebarCollapsed() {
  return window.localStorage.getItem("bahus:sidebarCollapsed") === "1";
}

export function getStoredTheme() {
  const stored = window.localStorage.getItem("bahus:theme");
  if (stored) return stored;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function getBootstrapConfig() {
  const requestedSource = queryParam("dataSource") || window.localStorage.getItem("bahus:dataSource") || "auto";

  let defaultApiBase = `${window.location.origin}/api`;
  if (window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost") {
    defaultApiBase = "https://bahus-production.up.railway.app/api";
  }

  return {
    requestedSource,
    apiBaseUrl: queryParam("apiBaseUrl") || defaultApiBase,
  };
}

export function persistDataSource(source) {
  window.localStorage.setItem("bahus:dataSource", source);
}

export function persistSidebarCollapsed(collapsed) {
  window.localStorage.setItem("bahus:sidebarCollapsed", collapsed ? "1" : "0");
}

export function persistTheme(theme) {
  window.localStorage.setItem("bahus:theme", theme);
}
