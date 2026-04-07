export function createAppEventHandlers(actions) {
  return {
    click(event) {
      const actionTarget = event.target.closest("[data-action]");
      if (!actionTarget) return;
      const { action } = actionTarget.dataset;
      if (!action || typeof actions[action] !== "function") return;
      actions[action](actionTarget.dataset, event);
    },
    input(event) {
      const inputTarget = event.target.closest("[data-input]");
      if (!inputTarget) return;
      const { input } = inputTarget.dataset;
      if (!input || typeof actions[input] !== "function") return;
      actions[input](inputTarget.dataset, inputTarget.value, event);
    },
    change(event) {
      const changeTarget = event.target.closest("[data-change]");
      if (!changeTarget) return;
      const { change } = changeTarget.dataset;
      if (!change || typeof actions[change] !== "function") return;
      const value = changeTarget.type === "checkbox" ? changeTarget.checked : changeTarget.value;
      actions[change](changeTarget.dataset, value, event);
    },
  };
}
