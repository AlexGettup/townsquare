<template>
  <Modal
    class="changelog"
    v-if="modals.changelog"
    @close="toggleModal('changelog')"
  >
    <h3>{{ $t("modals.changelog.title") }}</h3>
    <div class="versions">
      <section v-for="(release, index) in releases" :key="release.version">
        <h4>
          {{ release.title }}
          <em v-if="index === 0">{{ $t("modals.changelog.current") }}</em>
        </h4>
        <p class="version">
          {{ $t("modals.changelog.version", { version: release.version }) }}
          · {{ formatDate(release.date) }}
        </p>
        <ul>
          <li v-for="(item, i) in release.items" :key="i">
            {{ item.text }}
            <ul v-if="item.items.length">
              <li v-for="(sub, j) in item.items" :key="j">{{ sub }}</li>
            </ul>
          </li>
        </ul>
      </section>
    </div>
  </Modal>
</template>

<script>
import { mapMutations, mapState } from "vuex";
import Modal from "./Modal";
import changelog from "../../changelog.json";

/**
 * What's new: the changes of each version of this app (src/changelog.json,
 * newest first), in the language of the app.
 */
export default {
  components: { Modal },
  computed: {
    releases: function () {
      const locale = this.grimoire.locale;
      return changelog.map((release) => ({
        ...release,
        title: release.title ? release.title[locale] || release.title.en : "",
        items: (release[locale] || release.en).map((item) =>
          typeof item === "string"
            ? { text: item, items: [] }
            : { text: item.text, items: item.items || [] },
        ),
      }));
    },
    ...mapState(["modals", "grimoire"]),
  },
  methods: {
    formatDate(date) {
      if (!date) return "";
      return new Date(date + "T12:00:00").toLocaleDateString(
        this.grimoire.locale,
        { day: "numeric", month: "long", year: "numeric" },
      );
    },
    ...mapMutations(["toggleModal"]),
  },
};
</script>

<style scoped lang="scss">
@import "../../vars.scss";

.changelog :deep(.modal) {
  width: 700px;
  overflow-y: auto;
  overflow-x: hidden;
}

h3 {
  margin: 0 0 10px;
}

.versions {
  text-align: left;
}

section {
  margin-bottom: 15px;
}

h4 {
  font-family: "Roboto Condensed", sans-serif;
  color: $fabled;
  margin: 0 0 4px;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  font-size: 115%;
  em {
    font-style: normal;
    font-size: 65%;
    color: black;
    background: $fabled;
    border-radius: 8px;
    padding: 0 6px;
  }
}

.version {
  margin: 0 0 4px;
  font-size: 80%;
  color: gray;
}

// the base modal styles lists as centered flex rows; these are plain lists
.versions ul {
  display: block;
  list-style: disc;
  padding-left: 20px;
  line-height: 1.35;
  li {
    margin-bottom: 3px;
  }
  ul {
    list-style: circle;
    margin-top: 3px;
  }
}
</style>
