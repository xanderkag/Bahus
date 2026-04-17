import { loadStateFromApi } from "./api.js";

async function fetchJson(url, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    Accept: "application/json",
    ...options.headers,
  };

  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}


export function createBackend(apiBaseUrl) {
  return {
    apiBaseUrl,
    loadBootstrap() {
      return loadStateFromApi(apiBaseUrl);
    },
    loadImports() {
      return fetchJson(`${apiBaseUrl}/imports`);
    },
    createImport(payload, onProgress) {
      if (!onProgress) {
        return fetchJson(`${apiBaseUrl}/imports`, {
          method: "POST",
          body: payload instanceof FormData ? payload : JSON.stringify(payload),
        });
      }

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${apiBaseUrl}/imports`);
        xhr.setRequestHeader("Accept", "application/json");
        if (!(payload instanceof FormData)) {
          xhr.setRequestHeader("Content-Type", "application/json");
        }

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded * 100) / event.total));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (e) {
              resolve(xhr.responseText);
            }
          } else {
            reject(new Error(`Request failed: ${xhr.status} ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network Error"));
        xhr.send(payload instanceof FormData ? payload : JSON.stringify(payload));
      });
    },
    deleteImport(importId) {
      return fetchJson(`${apiBaseUrl}/imports/${encodeURIComponent(importId)}`, {
        method: "DELETE",
      });
    },
    dispatchImport(importId, payload = {}) {
      return fetchJson(`${apiBaseUrl}/imports/${encodeURIComponent(importId)}/dispatch`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    loadImportStatus(importId) {
      return fetchJson(`${apiBaseUrl}/imports/${encodeURIComponent(importId)}/status`);
    },
    loadCatalog() {
      return fetchJson(`${apiBaseUrl}/catalog`);
    },
    loadProducts(importId = "") {
      const suffix = importId ? `?import_id=${encodeURIComponent(importId)}` : "";
      return fetchJson(`${apiBaseUrl}/products${suffix}`);
    },
    loadJobs() {
      return fetchJson(`${apiBaseUrl}/jobs`);
    },
    triggerJob(payload) {
      return fetchJson(`${apiBaseUrl}/jobs/trigger`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    updateReviewRows(payload) {
      return fetchJson(`${apiBaseUrl}/review/rows`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    saveManualNormalization(payload) {
      return fetchJson(`${apiBaseUrl}/review/normalize`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    saveManualMatch(payload) {
      return fetchJson(`${apiBaseUrl}/review/match`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    loadQuoteDraft() {
      return fetchJson(`${apiBaseUrl}/quote-draft`);
    },
    saveQuoteDraft(payload) {
      return fetchJson(`${apiBaseUrl}/quote-draft`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    loadQuotes() {
      return fetchJson(`${apiBaseUrl}/quotes`);
    },
    createQuote(payload) {
      return fetchJson(`${apiBaseUrl}/quotes`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    saveQuote(quoteId, payload) {
      return fetchJson(`${apiBaseUrl}/quotes/${encodeURIComponent(quoteId)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
  };
}
