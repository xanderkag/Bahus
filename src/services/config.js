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

  return {
    requestedSource,
    apiBaseUrl: queryParam("apiBaseUrl") || `${window.location.origin}/api`,
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
