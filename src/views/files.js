import { escapeHtml, formatValue } from "../utils/format.js";

export function renderFiles(state) {
  const resource = state.runtime?.resources?.imports;
  const apiRows = resource?.items || [];
  const useApiRows = state.runtime?.dataSource === "local-api" && apiRows.length;
  const rows = (useApiRows ? apiRows : state.entities.importOrder.map((importId) => state.entities.importsById[importId])).map((importRecord, index) => {
    const supplier = useApiRows
      ? importRecord.supplier
      : state.entities.suppliersById[importRecord.supplier_id];
    const importId = importRecord.id;
    return `
      <tr class="${state.ui.selectedImportId === importId ? "is-active" : ""}">
        <td>${index + 1}</td>
        <td>
          <button class="row-link" data-action="selectImport" data-import-id="${importId}">
            ${escapeHtml(importRecord.meta.source_file)}
          </button>
        </td>
        <td>${escapeHtml(importRecord.meta.import_date)}</td>
        <td>${escapeHtml(importRecord.meta.source_format.toUpperCase())}</td>
        <td>${escapeHtml(formatValue(supplier?.name))}</td>
        <td>${escapeHtml(importRecord.meta.document_type)}</td>
        <td>${escapeHtml(importRecord.source)}</td>
        <td>${escapeHtml(importRecord.created_by)}</td>
        <td><span class="pill">${importRecord.status}</span></td>
      </tr>
    `;
  });

  return `
    <section class="view-stack">
      <article class="panel">
        <div class="panel-header">
          <div>
            <h2>Files</h2>
            <p>Локальная история загрузок и будущая точка входа для реальных файлов, Telegram-бота и n8n pipelines.</p>
          </div>
          <div class="toolbar-actions">
            <button class="primary-btn" data-action="openUploadFilesModal">Загрузить файлы</button>
            ${
              state.runtime?.dataSource === "local-api"
                ? `<button class="ghost-btn" data-action="refreshRemoteData">Синхронизировать API</button>`
                : ""
            }
            <button class="primary-btn" data-action="setView" data-view="overview">Вернуться в review</button>
          </div>
        </div>
        ${
          state.runtime?.dataSource === "local-api"
            ? `<div class="resource-banner">
                <span class="pill">imports api: ${resource?.status || "idle"}</span>
                ${resource?.error ? `<span class="pill pill-bad">${escapeHtml(resource.error)}</span>` : ""}
              </div>`
            : ""
        }
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Файл</th>
                <th>Дата</th>
                <th>Формат</th>
                <th>Поставщик</th>
                <th>Тип</th>
                <th>Источник</th>
                <th>Создатель</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>${rows.join("")}</tbody>
          </table>
        </div>
      </article>
      <article class="panel">
        <div class="panel-header">
          <div>
            <h2>Загрузка</h2>
            <p>Через интерфейс можно добавить новые supplier files и сразу отправить их в рабочий контур review.</p>
          </div>
          <button class="ghost-btn" data-action="openUploadFilesModal">Открыть форму загрузки</button>
        </div>
        <div class="hint">
          Поддерживаемый локальный сценарий сейчас такой: выбираете поставщика, тип файла и сами файлы. После подтверждения они появятся в таблице выше как новые imports.
        </div>
      </article>
      <article class="panel feature-grid">
        <div class="feature-card">
          <h3>Live upload</h3>
          <p>В структуре уже выделена сущность import и слой supplier. Реальные загрузки можно будет подключить без переработки вкладок.</p>
        </div>
        <div class="feature-card">
          <h3>Ассистенты</h3>
          <p>Для n8n заложен отдельный endpoint в settings. UI уже разделяет file ingestion и review workspace.</p>
        </div>
        <div class="feature-card">
          <h3>Audit trail</h3>
          <p>Следующий шаг: хранить parsing steps, re-run статусы и историю ручных исправлений прямо на import-level.</p>
        </div>
      </article>
    </section>
  `;
}
