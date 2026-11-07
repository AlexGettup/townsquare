<template>
  <div class="intro">
    <img src="static/apple-icon.png" alt="" class="logo" />
    <div>
      <i18n path="intro.welcome" tag="span">
        <template #title>
          <b>{{ $t("intro.title") }}</b>
        </template>
        <template #menu>
          <span class="button" @click="toggleMenu">
            <font-awesome-icon icon="cog" /> {{ $t("intro.menu") }}
          </span>
        </template>
        <template #keyAdd><b>[A]</b></template>
        <template #keyJoin><b>[J]</b></template>
      </i18n>
      <br />
      <i18n path="intro.footer" tag="div" class="footer">
        <template #github>
          <a href="https://github.com/AlexGettup/townsquare" target="_blank"
            >GitHub</a
          >
        </template>
      </i18n>
    </div>
    <img src="../assets/community-created-content.webp" alt="" class="ccc" />
    <a
      class="redirect"
      v-if="language === 'zh-CN'"
      href="https://clocktower.gstonegames.com"
    >
      <img src="../assets/gstone.webp" class="gstone" alt="" />
      你想使用中文版魔典吗？
    </a>
  </div>
</template>

<script>
import { mapMutations } from "vuex";

export default {
  data() {
    return {
      language: window.navigator.userLanguage || window.navigator.language,
    };
  },
  methods: mapMutations(["toggleMenu"]),
};
</script>

<style scoped lang="scss">
.intro {
  text-align: center;
  width: 50%;
  font-size: 120%;
  position: absolute;
  padding: 10px;
  background: rgba(0, 0, 0, 0.5);
  border: 3px solid black;
  border-radius: 10px;
  z-index: 3;
  display: flex;
  justify-content: center;
  a {
    color: white;
  }
  a.redirect {
    display: block;
    text-decoration: none;
    position: absolute;
    top: 100%;
    margin-top: 2vh;
    padding: 10px;
    background: rgba(0, 0, 0, 0.5);
    border: 3px solid black;
    border-radius: 10px;

    &:hover {
      color: red;
    }
    img {
      width: 120px;
      display: block;
      margin: auto auto 1vh;
    }
  }

  img.logo {
    position: absolute;
    bottom: 100%;
    width: 25vh;
    margin-bottom: 2vh;
    max-width: 192px;
    border-radius: 50%;
    box-shadow: 0 0 10px black;
    border: 3px solid black;
  }

  img.ccc {
    position: absolute;
    top: 100%;
    width: 25vh;
    margin-top: 2vh;
    max-width: 192px;
    filter: drop-shadow(0 0 10px black);
  }

  .footer {
    font-size: 60%;
    opacity: 0.75;
  }
}
</style>
