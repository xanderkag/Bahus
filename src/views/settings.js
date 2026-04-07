import { escapeHtml } from "../utils/format.js";

export function renderSettings(state) {
  const theme = state.settings.theme || "dark";
  const users = state.settings.users || [];
  return `
    <section class="view-stack settings-view">
      <article class="panel">
        <div class="panel-header">
          <div>
            <h2>Пользователи</h2>
            <p>Состав команды, роли и уровень доступа. Этого достаточно для текущего прототипа.</p>
          </div>
          <div class="toolbar-actions">
            <button class="ghost-btn" type="button" data-action="addSettingsUser">Добавить пользователя</button>
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
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${users.map((user) => `
                <tr>
                  <td><div class="table-title">${escapeHtml(user.name)}</div></td>
                  <td>${escapeHtml(user.email)}</td>
                  <td><button class="ghost-btn compact-action-btn settings-user-chip" data-action="cycleSettingsUserRole" data-user-id="${user.id}">${escapeHtml(user.role)}</button></td>
                  <td><button class="ghost-btn compact-action-btn settings-user-chip" data-action="cycleSettingsUserScope" data-user-id="${user.id}">${escapeHtml(user.scope)}</button></td>
                  <td><button class="ghost-btn compact-action-btn settings-user-chip ${user.status === "Активен" ? "is-good" : "is-warn"}" data-action="toggleSettingsUserStatus" data-user-id="${user.id}">${escapeHtml(user.status)}</button></td>
                  <td><div class="settings-user-actions"><button class="ghost-btn compact-action-btn" data-action="removeSettingsUser" data-user-id="${user.id}">Удалить</button></div></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
      <article class="panel settings-theme-panel">
        <div class="panel-header">
          <div>
            <h2>Тема интерфейса</h2>
            <p>Переключение между рабочей тёмной и светлой темой для всех экранов.</p>
          </div>
        </div>
        <div class="settings-theme-block">
          <div class="settings-theme-toggle" role="tablist" aria-label="Тема интерфейса">
            <button type="button" class="settings-theme-option ${theme === "dark" ? "is-active" : ""}" data-action="setTheme" data-theme="dark">
              <span class="settings-theme-dot"></span>
              <span>Тёмная тема</span>
            </button>
            <button type="button" class="settings-theme-option ${theme === "light" ? "is-active" : ""}" data-action="setTheme" data-theme="light">
              <span class="settings-theme-dot"></span>
              <span>Светлая тема</span>
            </button>
          </div>
          <div class="hint">Тема применяется ко всем экранам: импорт, позиции, КП и настройки.</div>
        </div>
      </article>
    </section>
  `;
}
