/**
 * State Layer: the single in-memory app state and controlled persistence flow.
 * Modules may mutate domain objects, but saving goes through this store.
 */
const AppState = (() => {
  let state = null;
  const listeners = new Set();

  function notify() {
    listeners.forEach((listener) => listener(state));
  }

  function init(initialState) {
    state = initialState;
    notify();
    return state;
  }

  function get() {
    return state;
  }

  function commit(mutator = null, { persist = true } = {}) {
    if (!state) throw new Error('AppState has not been initialized.');
    if (typeof mutator === 'function') mutator(state);
    if (persist) Storage.save(state);
    notify();
    return state;
  }

  function replace(nextState, { persist = true } = {}) {
    state = nextState;
    if (persist) Storage.save(state);
    notify();
    return state;
  }

  function reset() {
    return replace(Storage.reset());
  }

  function subscribe(listener) {
    listeners.add(listener);
    if (state) listener(state);
    return () => listeners.delete(listener);
  }

  return { init, get, commit, replace, reset, subscribe };
})();
