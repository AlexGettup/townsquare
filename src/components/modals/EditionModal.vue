<template>
  <Modal class="editions" v-if="modals.edition" @close="toggleModal('edition')">
    <div v-if="!isCustom">
      <h3>{{ $t("modals.edition.select") }}</h3>
      <ul class="editions">
        <li
          v-for="edition in editions"
          class="edition"
          :class="['edition-' + edition.id]"
          :style="{
            backgroundImage: `url(${require(
              '../../assets/editions/' + edition.id + '.webp',
            )})`,
          }"
          :key="edition.id"
          @click="loadOfficial(edition)"
        >
          {{ edition.name }}
        </li>
        <li
          class="edition edition-custom"
          @click="isCustom = true"
          :style="{
            backgroundImage: `url(${require('../../assets/editions/custom.webp')})`,
          }"
        >
          {{ $t("modals.edition.custom") }}
        </li>
      </ul>
    </div>
    <div class="custom" v-else>
      <h3>{{ $t("modals.edition.loadCustom") }}</h3>
      <i18n path="modals.edition.customIntro" tag="span">
        <template #scriptTool>
          <a href="https://script.bloodontheclocktower.com/" target="_blank">{{
            $t("modals.edition.scriptTool")
          }}</a>
        </template>
        <template #botcScripts>
          <a href="https://botcscripts.com/?sort=num_favs" target="_blank"
            >botcscripts.com</a
          >
        </template>
      </i18n>
      <br />
      <br />
      <i18n path="modals.edition.homebrew" tag="span">
        <template #documentation>
          <a
            href="https://github.com/AlexGettup/townsquare#custom-character-support"
            target="_blank"
            >{{ $t("modals.edition.documentation") }}</a
          >
        </template>
      </i18n>
      <b>{{ $t("modals.edition.trustWarning") }}</b>
      <h3>{{ $t("modals.edition.popularScripts") }}</h3>
      <ul class="scripts">
        <li
          v-for="(script, index) in customs.teensyville"
          :key="index"
          @click="parseRoles(script)"
        >
          {{
            $t("modals.edition.scriptByAuthor", {
              name: script[0].name,
              author: script[0].author,
            })
          }}
          ({{ $t("modals.edition.teensyville") }})
        </li>
        <li
          v-for="(script, index) in customs.standard"
          :key="index + customs.teensyville.length"
          @click="parseRoles(script)"
        >
          {{
            $t("modals.edition.scriptByAuthor", {
              name: script[0].name,
              author: script[0].author,
            })
          }}
        </li>
      </ul>
      <input
        type="file"
        ref="upload"
        accept="application/json"
        @change="handleUpload"
      />
      <div class="button-group">
        <div class="button" @click="openUpload">
          <font-awesome-icon icon="file-upload" />
          {{ $t("modals.edition.uploadJson") }}
        </div>
        <div class="button" @click="promptURL">
          <font-awesome-icon icon="link" /> {{ $t("modals.edition.enterUrl") }}
        </div>
        <div class="button" @click="readFromClipboard">
          <font-awesome-icon icon="clipboard" />
          {{ $t("modals.edition.useClipboard") }}
        </div>
        <div class="button" @click="isCustom = false">
          <font-awesome-icon icon="undo" /> {{ $t("modals.edition.back") }}
        </div>
      </div>
    </div>
  </Modal>
</template>

<script>
import customsJSON from "../../customs";
import editionJSON from "../../editions";
import { mapMutations, mapState } from "vuex";
import Modal from "./Modal";

export default {
  components: {
    Modal,
  },
  data: function () {
    return {
      customs: customsJSON,
      editions: editionJSON,
      isCustom: false,
    };
  },
  computed: mapState(["roles", "modals", "edition"]),
  methods: {
    openUpload() {
      this.$refs.upload.click();
    },
    handleUpload() {
      const file = this.$refs.upload.files[0];
      if (file && file.size) {
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          try {
            const roles = JSON.parse(reader.result);
            this.parseRoles(roles);
          } catch (e) {
            console.log(e);
            alert(this.$t("dialogs.errorReadingScript", { error: e.message }));
          }
          this.$refs.upload.value = "";
        });
        reader.readAsText(file);
      }
    },
    promptURL() {
      const url = prompt(this.$t("dialogs.scriptUrl"));
      if (url) {
        this.handleURL(url);
      }
    },
    async handleURL(url) {
      const res = await fetch(url);
      if (res && res.json) {
        try {
          const script = await res.json();
          this.parseRoles(script);
        } catch (e) {
          console.log(e);
          alert(this.$t("dialogs.errorLoadingScript", { error: e.message }));
        }
      }
    },
    async readFromClipboard() {
      const text = await navigator.clipboard.readText();
      try {
        const roles = JSON.parse(text);
        this.parseRoles(roles);
      } catch (e) {
        console.log(e);
        alert(this.$t("dialogs.errorReadingScript", { error: e.message }));
      }
    },
    loadOfficial(edition) {
      this.$store.commit("setNpcs", {});
      this.$store.commit("setEdition", edition);
    },
    parseRoles(roles) {
      if (!roles || !roles.length) return;
      roles = roles.map((role) =>
        typeof role === "string" ? { id: role } : role,
      );
      const metaIndex = roles.findIndex(({ id }) => id === "_meta");
      let meta = {};
      if (metaIndex > -1) {
        meta = roles.splice(metaIndex, 1).pop();
      }
      if (meta.firstNight) {
        meta.firstNight = meta.firstNight.map((id) =>
          this.$store.getters.clean(id),
        );
      }
      if (meta.otherNight) {
        meta.otherNight = meta.otherNight.map((id) =>
          this.$store.getters.clean(id),
        );
      }
      this.$store.commit("setNpcs", []);
      this.$store.commit("setCustomRoles", roles);
      this.$store.commit(
        "setEdition",
        Object.assign({}, meta, { id: "custom" }),
      );
      this.isCustom = false;
    },
    ...mapMutations(["toggleModal"]),
  },
};
</script>

<style scoped lang="scss">
ul.editions .edition {
  font-family: PiratesBay, sans-serif;
  letter-spacing: 1px;
  text-align: center;
  padding-top: 20%;
  background-position: center center;
  background-size: 80% auto;
  background-repeat: no-repeat;
  width: 45%;
  margin: 5px;
  font-size: 120%;
  text-shadow:
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000,
    0 0 5px rgba(0, 0, 0, 0.75);
  cursor: pointer;
  &:hover {
    color: red;
  }
}

.custom {
  text-align: center;
  input[type="file"] {
    display: none;
  }
  .scripts {
    list-style-type: disc;
    font-size: 120%;
    cursor: pointer;
    display: block;
    width: 50%;
    text-align: left;
    margin: 10px auto;
    li:hover {
      color: red;
    }
  }
}
</style>
