function queryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function getStoredSidebarCollapsed() {
  return window.localStorage.getItem("bakhus:sidebarCollapsed") === "1";
}

export function getStoredTheme() {
  return window.localStorage.getItem("bakhus:theme") || "dark";
}

export function getBootstrapConfig() {
  const requestedSource = queryParam("dataSource") || window.localStorage.getItem("bakhus:dataSource") || "auto";

  return {
    requestedSource,
    apiBaseUrl: queryParam("apiBaseUrl") || `${window.location.origin}/api`,
  };
}

export function persistDataSource(source) {
  window.localStorage.setItem("bakhus:dataSource", source);
}

export function persistSidebarCollapsed(collapsed) {
  window.localStorage.setItem("bakhus:sidebarCollapsed", collapsed ? "1" : "0");
}

export function persistTheme(theme) {
  window.localStorage.setItem("bakhus:theme", theme);
}
