<template>
  <li class="voice-devices" @click.stop="">
    <label v-if="microphones.length">
      <span>{{ $t("voice.microphone") }}</span>
      <select
        :value="selected(microphones, voice.inputId)"
        @change="setInput"
        @keyup.stop=""
      >
        <option
          v-for="device in microphones"
          :key="device.value"
          :value="device.value"
        >
          {{ device.label }}
        </option>
      </select>
    </label>
    <label v-if="canChooseSpeaker && speakers.length">
      <span>{{ $t("voice.speaker") }}</span>
      <select
        :value="selected(speakers, voice.outputId)"
        @change="setOutput"
        @keyup.stop=""
      >
        <option
          v-for="device in speakers"
          :key="device.value"
          :value="device.value"
        >
          {{ device.label }}
        </option>
      </select>
    </label>
  </li>
</template>

<script>
import { mapState } from "vuex";

// "default" is the system's device, "communications" a second default on Windows
const listOf = (devices, kind, fallbackLabel, defaultLabel) => {
  const list = devices
    .filter(
      (device) =>
        device.kind === kind &&
        device.deviceId &&
        device.deviceId !== "communications",
    )
    .map((device, index) => ({
      value: device.deviceId === "default" ? "" : device.deviceId,
      label: device.label || `${fallbackLabel} ${index + 1}`,
    }));
  if (!list.some(({ value }) => value === "")) {
    list.unshift({ value: "", label: defaultLabel });
  }
  return list;
};

/**
 * Which microphone and speaker to use, in Settings > Audio on computers: phones
 * choose them themselves, and most can't change the speaker from a web page.
 * Browsers only name the devices once the microphone is allowed, that is once
 * in voice chat.
 */
export default {
  data() {
    return {
      microphones: [],
      speakers: [],
      canChooseSpeaker:
        typeof HTMLMediaElement !== "undefined" &&
        "setSinkId" in HTMLMediaElement.prototype,
    };
  },
  computed: {
    ...mapState(["voice"]),
  },
  mounted() {
    this.refresh();
    navigator.mediaDevices.addEventListener("devicechange", this.refresh);
  },
  beforeDestroy() {
    navigator.mediaDevices.removeEventListener("devicechange", this.refresh);
  },
  methods: {
    async refresh() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const defaultLabel = this.$t("voice.defaultDevice");
      this.microphones = listOf(
        devices,
        "audioinput",
        this.$t("voice.microphone"),
        defaultLabel,
      );
      this.speakers = listOf(
        devices,
        "audiooutput",
        this.$t("voice.speaker"),
        defaultLabel,
      );
    },
    // a device that was unplugged shows as the default one
    selected(list, deviceId) {
      return list.some(({ value }) => value === deviceId) ? deviceId : "";
    },
    async setInput({ target }) {
      const ok = await this.$store.dispatch(
        "voice/setInputDevice",
        target.value,
      );
      if (!ok)
        target.value = this.selected(this.microphones, this.voice.inputId);
    },
    async setOutput({ target }) {
      const ok = await this.$store.dispatch(
        "voice/setOutputDevice",
        target.value,
      );
      if (!ok) target.value = this.selected(this.speakers, this.voice.outputId);
    },
  },
};
</script>

<style scoped lang="scss">
.voice-devices {
  flex-direction: column;
  align-items: stretch !important;
  gap: 6px;
  padding-top: 4px !important;
  padding-bottom: 6px !important;
  cursor: default;

  label {
    display: block;
  }

  span {
    display: block;
    font-size: 80%;
    color: #bbb;
  }

  select {
    width: 100%;
    padding: 3px 4px;
    color: white;
    background: #222;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    font-size: 80%;
    cursor: pointer;
  }
}
</style>
