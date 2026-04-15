import { createInitialState } from "../state/initial-state.js";

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function loadStateFromApi(apiBaseUrl) {
  const payload = await fetchJson(`${apiBaseUrl}/bootstrap`);
  const imports = payload?.items?.imports || [];
  const suppliers = payload?.items?.suppliers || [];
  const clients = payload?.items?.clients || [];
  
  const state = createInitialState({ imports, suppliers, clients }, {
    dataSource: "local-api",
    dataSourceLabel: `локальный backend (${apiBaseUrl})`,
    bootstrapMode: "api",
  });
  state.runtime.apiBaseUrl = apiBaseUrl;
  return state;
}
