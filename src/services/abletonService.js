import { Ableton } from "../../../ableton.js";
import { ROLES, autoDetectRole } from "../data/roles.js";
import { store, clamp } from "../store.js";
import { bindReturnAReverb, paramToNorm, normToParam } from "../adapters/deviceAdapters.js";
import { MasterLoudnessTracker } from "../engine/psychoacoustics.js";

function normalizeAbletonColor(c) {
  if (typeof c === "number") {
    return "#" + (c & 0xffffff).toString(16).padStart(6, "0");
  }
  const str = String(c?.hex ?? c?.numberVal ?? c ?? "#3b82f6").trim();
  if (/^\d+$/.test(str)) {
    return "#" + (parseInt(str, 10) & 0xffffff).toString(16).padStart(6, "0");
  }
  const clean = str.replace(/^#+/, "");
  return /^[0-9a-f]{6}$/i.test(clean) ? "#" + clean.toLowerCase() : "#3b82f6";
}

function createThrottledSetter(fn, ms = 35) {
  let last = 0;
  let timer = null;
  return (val, immediate = false) => {
    const now = performance.now();
    clearTimeout(timer);
    if (immediate || now - last >= ms) {
      last = now;
      fn(val);
    } else {
      timer = setTimeout(() => {
        last = performance.now();
        fn(val);
      }, ms);
    }
  };
}

class AbletonService {
  constructor() {
    this.ableton = new Ableton();
    this.unsubs = [];
    this.reverbSetDecayLive = null;
    this.reverbSetPredelayLive = null;
    this.masterTracker = new MasterLoudnessTracker(3000);
    this.masterLeft = 0;
    this.masterRight = 0;
    this.lastMasterEmit = 0;
  }

  async connect() {
    await this.ableton.start();
    store.isPlaying = Boolean(await this.ableton.song.get("is_playing"));
    store.emit("playstate", store.isPlaying);

    await this.ableton.song.addListener("is_playing", (v) => {
      store.isPlaying = Boolean(v);
      if (!store.isPlaying) {
        this.masterTracker.reset();
        store.masterStats.shortTermLufs = -Infinity;
        store.masterStats.clipping = false;
        store.emit("master-meter");
      }
      store.emit("playstate", store.isPlaying);
    });
  }

  clearListeners() {
    this.unsubs.forEach((u) => { try { u(); } catch {} });
    this.unsubs = [];
  }

  async scanAll() {
    this.clearListeners();
    const prevById = new Map(store.tracks.map((t) => [t.id, t]));
    const tracks = await this.ableton.song.get("tracks");
    const nextTracks = [];

    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const id = String(t.raw.id);
      const name = t.raw.name || `Track ${i + 1}`;
      const colorHex = normalizeAbletonColor(t.raw.color);

      let isGroup = false;
      let isGrouped = false;
      try {
        isGroup = Boolean(await t.get("is_foldable"));
        isGrouped = Boolean(await t.get("is_grouped"));
      } catch {}

      let groupId = null;
      if (isGrouped) {
        try {
          const gt = await t.get("group_track");
          groupId = gt?.raw?.id ?? gt?.id ?? null;
        } catch {}
      }

      let mixer, volParam, panParam, sends, sendAParam;
      try {
        mixer = await t.get("mixer_device");
        volParam = await mixer.get("volume");
        panParam = await mixer.get("panning");
        sends = await mixer.get("sends");
        sendAParam = sends && sends.length > 0 ? sends[0] : null;
      } catch {
        continue;
      }

      const vol = await volParam.get("value");
      const pan = await panParam.get("value");
      const sendA = sendAParam ? await sendAParam.get("value") : 0;
      const mute = Boolean(await t.get("mute"));
      const solo = Boolean(await t.get("solo"));

      const prev = prevById.get(id);
      const role = prev ? prev.role : autoDetectRole(name, isGroup);
      const roleCfg = ROLES[role] || ROLES.other;

      const item = {
        id,
        index: i,
        name,
        colorHex,
        isGroup,
        isGrouped,
        groupId: groupId !== null ? String(groupId) : null,
        vGroupId: prev?.vGroupId || null,
        role,
        shape: prev?.shape || roleCfg.shape || "sphere",
        sizeScale: prev?.sizeScale ?? 1.0,
        pan,
        vol,
        sendA,
        y: prev ? prev.y : roleCfg.defaultY,
        mute,
        solo,
        hidden: prev?.hidden || false,
        locked: prev?.locked || false,
        meter: 0,
        smoothMeter: 0,
        isDragging: false,
        _ableton: {
          track: t,
          volParam,
          panParam,
          sendAParam,
          setPanLive: createThrottledSetter((v) => panParam.set("value", clamp(v, -1, 1))),
          setVolLive: createThrottledSetter((v) => volParam.set("value", clamp(v, 0, 1))),
          setSendALive: createThrottledSetter((v) => sendAParam && sendAParam.set("value", clamp(v, 0, 1))),
        },
      };

      nextTracks.push(item);

      try {
        const uPan = await panParam.addListener("value", (v) => {
          if (!item.isDragging) { item.pan = v; store.emit("track-changed", item); }
        });
        const uVol = await volParam.addListener("value", (v) => {
          if (!item.isDragging) { item.vol = v; store.emit("track-changed", item); }
        });
        this.unsubs.push(uPan, uVol);

        if (sendAParam) {
          const uSend = await sendAParam.addListener("value", (v) => {
            if (!item.isDragging) { item.sendA = v; store.emit("track-changed", item); }
          });
          this.unsubs.push(uSend);
        }

        const uMute = await t.addListener("mute", (v) => {
          item.mute = Boolean(v);
          store.emit("mute-solo");
        });
        const uSolo = await t.addListener("solo", (v) => {
          item.solo = Boolean(v);
          store.emit("mute-solo");
        });
        const uName = await t.addListener("name", (v) => {
          if (v && v !== item.name) { item.name = v; store.emit("track-renamed", item); }
        });
        const uColor = await t.addListener("color", (c) => {
          const hex = normalizeAbletonColor(c);
          if (hex !== item.colorHex.toLowerCase()) {
            item.colorHex = hex;
            store.emit("track-color-changed", item);
          }
        });
        this.unsubs.push(uMute, uSolo, uName, uColor);

        if (t.raw.has_audio_output !== false) {
          const uMeter = await t.addListener("output_meter_left", (lvl) => {
            item.meter = lvl || 0;
          });
          this.unsubs.push(uMeter);
        }
      } catch (err) {
        console.warn("Listener omitido en", name, err);
      }
    }

    store.tracks = nextTracks;
    await this.scanReturnAReverb();
    await this.bindMasterMeter();
    store.emit("tracks-loaded");
  }

  async bindMasterMeter() {
    try {
      const master = await this.ableton.song.get("master_track");
      if (!master) return;
      this.masterTracker.reset();
      store.masterStats.connected = true;

      const onSample = () => {
        this.masterTracker.pushMeter(this.masterLeft, this.masterRight);
        const now = performance.now();
        if (now - this.lastMasterEmit > 110) {
          this.lastMasterEmit = now;
          store.masterStats.shortTermLufs = this.masterTracker.shortTermLufs;
          store.masterStats.peakDb = this.masterTracker.peakDb;
          store.masterStats.clipping = this.masterTracker.clipping;
          store.emit("master-meter");
        }
      };

      const uL = await master.addListener("output_meter_left", (v) => {
        this.masterLeft = v || 0;
        onSample();
      });
      const uR = await master.addListener("output_meter_right", (v) => {
        this.masterRight = v || 0;
      });
      this.unsubs.push(uL, uR);
    } catch (err) {
      store.masterStats.connected = false;
      console.warn("No se pudo suscribir al Master Meter:", err);
    }
  }

  async scanReturnAReverb() {
    try {
      const returns = await this.ableton.song.get("return_tracks");
      const retA = returns && returns.length > 0 ? returns[0] : null;
      const bound = await bindReturnAReverb(retA);

      if (!bound) {
        store.reverbInfo = {
          connected: false,
          deviceName: retA ? "Sin Reverb en Return A" : "Sin Return A",
          adapterName: null,
          decay: 0.45,
          predelay: 0.2,
          decayParam: null,
          predelayParam: null,
        };
        store.emit("reverb-changed");
        return;
      }

      const rawDecay = bound.decayParam ? await bound.decayParam.get("value") : 0.45;
      const rawPre = bound.predelayParam ? await bound.predelayParam.get("value") : 0.2;

      store.reverbInfo = {
        connected: true,
        deviceName: bound.deviceName,
        adapterName: bound.adapterName,
        decay: bound.decayParam ? paramToNorm(bound.decayParam, rawDecay) : 0.45,
        predelay: bound.predelayParam ? paramToNorm(bound.predelayParam, rawPre) : 0.2,
        decayParam: bound.decayParam,
        predelayParam: bound.predelayParam,
      };

      this.reverbSetDecayLive = bound.decayParam
        ? createThrottledSetter((n) => bound.decayParam.set("value", normToParam(bound.decayParam, n)))
        : null;
      this.reverbSetPredelayLive = bound.predelayParam
        ? createThrottledSetter((n) => bound.predelayParam.set("value", normToParam(bound.predelayParam, n)))
        : null;

      if (bound.decayParam) {
        const uD = await bound.decayParam.addListener("value", (v) => {
          store.reverbInfo.decay = paramToNorm(bound.decayParam, v);
          store.emit("reverb-changed");
        });
        this.unsubs.push(uD);
      }
      if (bound.predelayParam) {
        const uP = await bound.predelayParam.addListener("value", (v) => {
          store.reverbInfo.predelay = paramToNorm(bound.predelayParam, v);
          store.emit("reverb-changed");
        });
        this.unsubs.push(uP);
      }
      store.emit("reverb-changed");
    } catch (err) {
      console.warn("No se pudo leer Return A:", err);
    }
  }

  setReverbDecay(norm01, immediate = false) {
    store.reverbInfo.decay = clamp(norm01, 0, 1);
    if (this.reverbSetDecayLive) this.reverbSetDecayLive(store.reverbInfo.decay, immediate);
    store.emit("reverb-changed");
  }

  setReverbPredelay(norm01, immediate = false) {
    store.reverbInfo.predelay = clamp(norm01, 0, 1);
    if (this.reverbSetPredelayLive) this.reverbSetPredelayLive(store.reverbInfo.predelay, immediate);
    store.emit("reverb-changed");
  }

  async togglePlay(continueMode = false) {
    try {
      if (store.isPlaying) {
        await this.ableton.song.stopPlaying();
      } else if (continueMode && typeof this.ableton.song.continuePlaying === "function") {
        await this.ableton.song.continuePlaying();
      } else {
        await this.ableton.song.startPlaying();
      }
    } catch (err) {
      console.error("Error en Play/Pause:", err);
    }
  }

  async renameTrack(item, newName) {
    const clean = (newName || "").trim();
    if (!clean || clean === item.name) return;
    const before = store.captureSnapshot();
    item.name = clean;
    store.pushHistory(before);
    store.emit("track-renamed", item);
    try {
      await item._ableton.track.set("name", clean);
    } catch (err) {
      console.error("No se pudo renombrar en Ableton:", err);
    }
  }

  async setTrackColor(item, hexColor, recordHistory = true) {
    const clean = normalizeAbletonColor(hexColor);
    if (clean === item.colorHex.toLowerCase()) return;
    if (recordHistory) store.pushHistory(store.captureSnapshot());
    item.colorHex = clean;
    store.emit("track-color-changed", item);
    try {
      await item._ableton.track.set("color", parseInt(clean.slice(1), 16));
    } catch (err) {
      console.error("No se pudo cambiar color en Ableton:", err);
    }
  }

  async setMute(item, val, recordHistory = true) {
    if (recordHistory) store.pushHistory(store.captureSnapshot());
    item.mute = Boolean(val);
    store.emit("mute-solo");
    await item._ableton.track.set("mute", item.mute);
  }

  async setSolo(item, val, recordHistory = true) {
    if (recordHistory) store.pushHistory(store.captureSnapshot());
    item.solo = Boolean(val);
    store.emit("mute-solo");
    await item._ableton.track.set("solo", item.solo);
  }

  async applySnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.tracks)) return;
    if (Array.isArray(snapshot.virtualGroups)) {
      store.virtualGroups = snapshot.virtualGroups.map((g) => ({ ...g }));
    }

    for (const s of snapshot.tracks) {
      const item =
        store.getTrackById(s.id) ||
        store.tracks.find((t) => t.index === s.index) ||
        store.tracks.find((t) => t.name === s.name);
      if (!item) continue;

      const nameChanged = s.name && s.name !== item.name;
      const colorChanged = s.colorHex && normalizeAbletonColor(s.colorHex) !== item.colorHex.toLowerCase();

      item.pan = s.pan ?? item.pan;
      item.vol = s.vol ?? item.vol;
      item.sendA = s.sendA ?? item.sendA;
      item.y = s.y ?? item.y;
      item.mute = s.mute ?? item.mute;
      item.solo = s.solo ?? item.solo;
      item.role = s.role ?? item.role;
      item.shape = s.shape ?? item.shape;
      item.sizeScale = s.sizeScale ?? item.sizeScale ?? 1.0;
      item.hidden = s.hidden ?? item.hidden;
      item.locked = s.locked ?? item.locked;
      item.vGroupId = s.vGroupId ?? null;
      if (nameChanged) item.name = s.name;
      if (colorChanged) item.colorHex = normalizeAbletonColor(s.colorHex);

      await item._ableton.panParam.set("value", clamp(item.pan, -1, 1));
      await item._ableton.volParam.set("value", clamp(item.vol, 0, 1));
      if (item._ableton.sendAParam) {
        await item._ableton.sendAParam.set("value", clamp(item.sendA, 0, 1));
      }
      await item._ableton.track.set("mute", item.mute);
      await item._ableton.track.set("solo", item.solo);
      if (nameChanged) { try { await item._ableton.track.set("name", item.name); } catch {} }
      if (colorChanged) { try { await item._ableton.track.set("color", parseInt(item.colorHex.slice(1), 16)); } catch {} }
    }

    store.emit("snapshot-applied");
  }
}

export const abletonService = new AbletonService();