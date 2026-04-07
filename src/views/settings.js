import { escapeHtml } from "../utils/format.js";

export function renderSettings(state) {
  const theme = state.settings.theme || "dark";
  const users = state.settings.users || [];
  return `
    <section class="view-stack settings-view">
      <article class="panel">
        <div class="panel-header">
          <div>
            <h2>Настройки</h2>
            <p>Единое место для оформления интерфейса, пользователей и рабочих параметров проекта.</p>
          </div>
        </div>
        <div class="feature-grid settings-grid">
          <div class="feature-card">
            <h3>Тема интерфейса</h3>
            <p>Переключение между рабочей тёмной и светлой темой для менеджера.</p>
            <div class="segmented-control settings-theme-switch" role="tablist" aria-label="Тема интерфейса">
              <button type="button" class="segmented-option ${theme === "dark" ? "is-active" : ""}" data-action="setTheme" data-theme="dark">Тёмная тема</button>
              <button type="button" class="segmented-option ${theme === "light" ? "is-active" : ""}" data-action="setTheme" data-theme="light">Светлая тема</button>
            </div>
            <div class="hint">Тема применяется ко всем экранам: импорт, позиции, КП и настройки.</div>
          </div>
          <div class="feature-card">
            <h3>Интеграции</h3>
            <p>Endpoint: <code class="settings-code">${escapeHtml(state.settings.workflow_endpoint)}</code></p>
            <div class="hint">Сюда подключается обработка импорта, разбор файлов и дальнейший export flow.</div>
          </div>
          <div class="feature-card">
            <h3>Каталог</h3>
            <p>Источник: <code class="settings-code">${escapeHtml(state.settings.catalog_source)}</code></p>
            <div class="hint">Позиции уже живут в общей таблице, поэтому каталог можно подмешивать без отдельного экрана.</div>
          </div>
          <div class="feature-card">
            <h3>Экспорт</h3>
            <p>Формат по умолчанию: <code class="settings-code">${escapeHtml(state.settings.export_format)}</code></p>
            <div class="hint">Google авторизацию позже добавим сюда же, пока это подготовленный блок под дальнейшее подключение.</div>
          </div>
        </div>
      </article>
      <article class="panel">
        <div class="panel-header">
          <div>
            <h2>Пользователи</h2>
            <p>Базовая таблица доступа для команды. Позже сюда подключим Google авторизацию и реальные роли.</p>
          </div>
          <div class="toolbar-actions">
            <span class="pill pill-accent">Google auth later</span>
            <button class="ghost-btn" type="button">Добавить пользователя</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="compact-table users-table">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Доступ</th>
                <th>Авторизация</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              ${users.map((user) => `
                <tr>
                  <td><div class="table-title">${escapeHtml(user.name)}</div></td>
                  <td>${escapeHtml(user.email)}</td>
                  <td>${escapeHtml(user.role)}</td>
                  <td>${escapeHtml(user.scope)}</td>
                  <td><span class="pill">${escapeHtml(user.auth)}</span></td>
                  <td><span class="pill ${user.status === "Активен" ? "pill-good" : "pill-warn"}">${escapeHtml(user.status)}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `;
}
