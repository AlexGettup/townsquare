let nextId = 1;

/**
 * On-screen notices for the player: [{ id, key, params, icon }].
 * Filled by the alerts plugin (store/alerts.js).
 */
const state = () => ({
  notices: [],
});

const mutations = {
  add(state, notice) {
    // one notice of each kind at a time: the newest replaces the old one
    state.notices = [
      ...state.notices.filter(({ key }) => key !== notice.key),
      { id: nextId++, ...notice },
    ];
  },
  remove(state, id) {
    state.notices = state.notices.filter((notice) => notice.id !== id);
  },
};

export default {
  namespaced: true,
  state,
  mutations,
};
