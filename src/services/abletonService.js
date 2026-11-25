import { Ableton } from "../../../ableton.js";
import { ROLES, autoDetectRole } from "../data/roles.js";
import { store, clamp, HALF_H } from "../store.js";
import { computeEqYShift, computeEqLowCutScale, pickCarveBandSlot } from "../data/eqBands.js";
import {
  bindReturnAReverb, findTrackEqDevice, bindEqDevice, createDefaultEqBands,
  paramToNorm, normToParam, eqNormToHz, hzToEqNorm, EQ_FILTER_TYPES,
} from "../adapters/deviceAdapters.js";
import { MasterLoudnessTracker, computeCarvePlan, abletonVolToDb } from "../engine/psychoacoustics.js";

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
        store.lastSceneRuleId = null;
        
      }
      store.emit("playstate", store.isPlaying);
    });
    try {
      await this.ableton.song.addListener("current_song_time", (beats) => {
        store.currentSongBeat = Number(beats) || 0;
        const now = performance.now();
        if (now - (this._lastSongTimeEmit || 0) > 120) {
          this._lastSongTimeEmit = now;
          store.emit("song-time", store.currentSongBeat);
        }

        if (store.scenesAutoEnabled && store.isPlaying && !store.isDryBypass && !this._bankBusy) {
          const rule = store.getActiveSceneForBeat(store.currentSongBeat);
          if (rule && rule.id !== store.lastSceneRuleId) {
            store.lastSceneRuleId = rule.id;
            if (store.activeBank !== rule.bank && store.banks[rule.bank]) {
              this.applySceneBank(rule.bank);
            }
          }
        }
      });
    } catch (err) {
      console.warn("Listener current_song_time omitido:", err);
    }
  }
  

  clearListeners() {
    this.unsubs.forEach((u) => { try { u(); } catch {} });
    this.unsubs = [];
    for (const t of store.tracks) {
      if (Array.isArray(t._ableton?.eqUnsubs)) {
        t._ableton.eqUnsubs.forEach((u) => { try { u(); } catch {} });
        t._ableton.eqUnsubs = [];
      }
    }
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
      const eqMeta = await findTrackEqDevice(t);

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
        peakEnv: 0,
        rmsEnv: 0,
        crestScale: 1.0,
        _eqLowCutScale: 1.0,
        eqCuts: [],
        isDragging: false,
        eq: {
          hasDevice: Boolean(eqMeta),
          bound: false,
          loading: false,
          deviceName: eqMeta?.deviceName || null,
          adapterName: eqMeta?.adapter?.label || null,
          bands: createDefaultEqBands(8),
        },
        _ableton: {
          track: t,
          volParam,
          panParam,
          sendAParam,
          eqDevice: eqMeta?.device || null,
          eqAdapter: eqMeta?.adapter || null,
          eqBinding: null,
          eqBandSetters: [],
          eqUnsubs: [],
          setPanLive: createThrottledSetter((v) => panParam.set("value", clamp(v, -1, 1))),
          setVolLive: createThrottledSetter((v) => volParam.set("value", clamp(v, 0, 1))),
          setSendALive: createThrottledSetter((v) => sendAParam && sendAParam.set("value", clamp(v, 0, 1))),
        },
      };

      nextTracks.push(item);

      try {
        const uPan = await panParam.addListener("value", (v) => {
          if (!item.isDragging && performance.now() >= (item._mixWriteUntil || 0)) {
            item.pan = v;
            store.emit("track-changed", item);
          }
        });
        const uVol = await volParam.addListener("value", (v) => {
          if (!item.isDragging && performance.now() >= (item._mixWriteUntil || 0)) {
            item.vol = v;
            store.emit("track-changed", item);
          }
        });
        this.unsubs.push(uPan, uVol);

        if (sendAParam) {
          const uSend = await sendAParam.addListener("value", (v) => {
            if (!item.isDragging && performance.now() >= (item._mixWriteUntil || 0)) {
              item.sendA = v;
              store.emit("track-changed", item);
            }
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
    if (Object.values(store.banks).every((b) => !b) && store.tracks.length > 0) {
      store.saveBank("A");
    }

    // Si ya había pistas seleccionadas tras un rescan, bindea su EQ on-demand
    for (const sel of store.getSelectedTracks()) {
      if (sel.eq.hasDevice) this.ensureEqBound(sel);
    }
  }

  // =========================================================================
  // EQ EIGHT / EQ ADAPTER (Carga y suscripción On-Demand por pista)
  // =========================================================================
  async ensureEqBound(item) {
    if (!item || !item._ableton?.track) return false;
    if (item.eq.bound) return true;
    if (item.eq.loading) return false;

    item.eq.loading = true;
    try {
      // Si el usuario agregó el EQ Eight después de escanear, lo buscamos una vez
      if (!item._ableton.eqDevice) {
        const eqMeta = await findTrackEqDevice(item._ableton.track);
        if (!eqMeta) {
          item.eq.hasDevice = false;
          return false;
        }
        item._ableton.eqDevice = eqMeta.device;
        item._ableton.eqAdapter = eqMeta.adapter;
        item.eq.hasDevice = true;
        item.eq.deviceName = eqMeta.deviceName;
        item.eq.adapterName = eqMeta.adapter.label;
      }

      const binding = await bindEqDevice(item._ableton.eqDevice, item._ableton.eqAdapter);
      if (!binding) return false;

      item._ableton.eqBinding = binding;
      item._ableton.eqBandSetters = [];

      const safeSet = async (param, val) => {
        try { await param.set("value", val); } catch (e) { console.warn("EQ set error:", e); }
      };

      for (let i = 0; i < binding.bands.length; i++) {
        const bp = binding.bands[i];
        const bandState = item.eq.bands[i];

        const [rawOn, rawType, rawFreq, rawGain, rawQ] = await Promise.all([
          bp.onParam ? bp.onParam.get("value") : 0,
          bp.typeParam ? bp.typeParam.get("value") : bandState.type,
          bp.freqParam ? bp.freqParam.get("value") : 0.5,
          bp.gainParam ? bp.gainParam.get("value") : 0,
          bp.qParam ? bp.qParam.get("value") : 0.38,
        ]);

        bandState.on = Boolean(rawOn >= 0.5);
        bandState.type = Math.round(rawType ?? bandState.type);
        bandState.freqHz = bp.freqParam
          ? binding.adapter.normToFreq(paramToNorm(bp.freqParam, rawFreq))
          : bandState.freqHz;
        bandState.gainDb = bp.gainParam ? Number(rawGain) || 0 : 0;
        bandState.q = bp.qParam ? paramToNorm(bp.qParam, rawQ) : 0.38;

        item._ableton.eqBandSetters.push({
          setFreq: bp.freqParam
            ? createThrottledSetter((hz) => {
                const n = binding.adapter.freqToNorm(hz);
                safeSet(bp.freqParam, normToParam(bp.freqParam, n));
              })
            : null,
          setGain: bp.gainParam
            ? createThrottledSetter((db) => {
                const min = bp.gainParam._bounds?.min ?? -15;
                const max = bp.gainParam._bounds?.max ?? 15;
                safeSet(bp.gainParam, clamp(db, min, max));
              })
            : null,
          setQ: bp.qParam
            ? createThrottledSetter((q01) => safeSet(bp.qParam, normToParam(bp.qParam, q01)))
            : null,
        });

        // Listeners bidireccionales desde Live -> UI
        const attach = async (param, onVal) => {
          if (!param) return;
          try {
            const u = await param.addListener("value", (v) => {
              if (performance.now() < bandState._localWriteUntil) return;
              onVal(v);
              this.syncEqToTrackY(item);
              store.emit("eq-changed", item);
            });
            item._ableton.eqUnsubs.push(u);
          } catch {}
        };

        await attach(bp.onParam, (v) => { bandState.on = Boolean(v >= 0.5); });
        await attach(bp.typeParam, (v) => { bandState.type = Math.round(v); });
        await attach(bp.freqParam, (v) => {
          bandState.freqHz = binding.adapter.normToFreq(paramToNorm(bp.freqParam, v));
        });
        await attach(bp.gainParam, (v) => { bandState.gainDb = Number(v) || 0; });
        await attach(bp.qParam, (v) => { bandState.q = paramToNorm(bp.qParam, v); });
      }

      item.eq.bound = true;
      store.backfillBankEq(item);
      this.syncEqToTrackY(item);
      store.emit("eq-changed", item);
      return true;
    } catch (err) {
      console.warn("No se pudo bindear EQ en", item.name, err);
      return false;
    } finally {
      item.eq.loading = false;
      
    }
    
  }

  async setEqBand(item, bandIndex, patch, { immediate = false, recordHistory = false, force = false } = {}) {
    if (!item || (item.locked && !force)) return;
    if (!item.eq.bound) {
      const ok = await this.ensureEqBound(item);
      if (!ok) return;
    }

    const bp = item._ableton.eqBinding?.bands?.[bandIndex];
    const setters = item._ableton.eqBandSetters?.[bandIndex];
    const band = item.eq.bands?.[bandIndex];
    if (!bp || !band) return;

    if (recordHistory) store.pushHistory(store.captureSnapshot());

    band._localWriteUntil = performance.now() + (force ? 950 : 280);

    if (typeof patch.on === "boolean") {
      band.on = patch.on;
      if (bp.onParam) await bp.onParam.set("value", band.on ? 1 : 0).catch(() => {});
    }
    if (typeof patch.type === "number") {
      band.type = Math.round(clamp(patch.type, 0, 7));
      if (bp.typeParam) await bp.typeParam.set("value", band.type).catch(() => {});
    }
    if (typeof patch.freqHz === "number") {
      band.freqHz = clamp(patch.freqHz, 10, 22000);
      if (immediate && bp.freqParam) {
        const n = item._ableton.eqBinding.adapter.freqToNorm(band.freqHz);
        await bp.freqParam.set("value", normToParam(bp.freqParam, n)).catch(() => {});
      } else {
        setters?.setFreq?.(band.freqHz, false);
      }
    }
    if (typeof patch.gainDb === "number") {
      const min = bp.gainParam?._bounds?.min ?? -15;
      const max = bp.gainParam?._bounds?.max ?? 15;
      band.gainDb = clamp(patch.gainDb, min, max);
      if (immediate && bp.gainParam) {
        await bp.gainParam.set("value", band.gainDb).catch(() => {});
      } else {
        setters?.setGain?.(band.gainDb, false);
      }
    }
    if (typeof patch.q === "number") {
      band.q = clamp(patch.q, 0, 1);
      if (immediate && bp.qParam) {
        await bp.qParam.set("value", normToParam(bp.qParam, band.q)).catch(() => {});
      } else {
        setters?.setQ?.(band.q, false);
      }
    }

    if (!force) {
      this.syncEqToTrackY(item);
      store.emit("eq-changed", item);
    }
  }

  async applyEqPreset(item, bandConfigs, recordHistory = true) {
    if (!item || item.locked || !Array.isArray(bandConfigs)) return false;
    const ok = await this.ensureEqBound(item);
    if (!ok) return false;

    if (recordHistory) store.pushHistory(store.captureSnapshot());

    for (const cfg of bandConfigs) {
      const idx = (cfg.bandNum ?? 1) - 1;
      if (idx < 0 || idx >= 8) continue;
      await this.setEqBand(item, idx, cfg, { immediate: true, recordHistory: false });
    }
    return true;
  }
  async carveCollision(winner, loser, collision) {
    if (!winner || !loser || loser.locked) return false;
    const plan = computeCarvePlan(winner, loser, collision);

    // Si tiene EQ Eight, aplicamos recorte quirúrgico en la banda adecuada
    if (loser.eq?.hasDevice) {
      const ok = await this.ensureEqBound(loser);
      if (ok) {
        const bandIdx = pickCarveBandSlot(loser.eq.bands, plan.freqHz);
        const cur = loser.eq.bands[bandIdx];
        const nextGain =
          cur?.on && cur.gainDb < -0.5 && Math.abs(Math.log2(cur.freqHz / plan.freqHz)) < 0.45
            ? clamp(cur.gainDb - 2.0, -7.5, -1.5)
            : plan.gainDb;

        await this.setEqBand(
          loser,
          bandIdx,
          {
            on: true,
            type: EQ_FILTER_TYPES.BELL,
            freqHz: plan.freqHz,
            gainDb: nextGain,
            q: plan.q,
          },
          { immediate: true, recordHistory: true }
        );
        return true;
      }
    }

    // Fallback si la pista no tiene EQ Eight: separa levemente en Pan (X)
    store.pushHistory(store.captureSnapshot());
    const dir = loser.pan === winner.pan ? (loser.index % 2 === 0 ? -1 : 1) : Math.sign(loser.pan - winner.pan);
    loser.pan = clamp(loser.pan + dir * 0.22, -1, 1);
    await loser._ableton.panParam.set("value", loser.pan);
    store.emit("track-changed", loser);
    return true;
  }
  syncEqToTrackY(item) {
    if (!item?.eq?.bound) return;
    item._eqLowCutScale = computeEqLowCutScale(item.eq.bands);
    item.eqCuts = item.eq.bands
      .filter((b) => b.on && b.gainDb < -0.5 && b.type >= 2 && b.type <= 5)
      .map((b) => ({ freqHz: b.freqHz, gainDb: b.gainDb }));

    const nextShift = computeEqYShift(item.eq.bands);
    const prevShift = item._lastEqYShift || 0;

    // Si el usuario está moviendo el Eje Y ahora mismo, no reescribimos item.y para evitar feedback loop
    if (item.isDragging || performance.now() < (item._yTiltLockUntil || 0)) {
      item._lastEqYShift = nextShift;
      return;
    }

    if (Math.abs(nextShift - prevShift) > 0.005) {
      item.y = clamp(item.y - prevShift + nextShift, -HALF_H + 0.3, HALF_H - 0.3);
      item._lastEqYShift = nextShift;
    }
    store.emit("track-changed", item);
  }

  // Eje Y -> Tilt EQ tonal real en Ableton (Banda 6 Low-Shelf @ 220Hz + Banda 7 High-Shelf @ 3.5kHz)
  async applyYAxisTiltEq(item, { immediate = false } = {}) {
    if (!item || item.locked || !item.eq?.hasDevice) return false;
    item._yTiltLockUntil = performance.now() + 450;

    if (!item.eq.bound) {
      const ok = await this.ensureEqBound(item);
      if (!ok) return false;
    }

    const baseY = ROLES[item.role]?.defaultY ?? 0;
    const deltaY = item.y - baseY;
    let tiltDb = Math.round(clamp(deltaY * 3.0, -7.5, 7.5) * 10) / 10;
    if (Math.abs(tiltDb) < 0.25) tiltDb = 0;

    const bLow = item.eq.bands[5];
    const bHigh = item.eq.bands[6];
    if (!bLow || !bHigh) return false;

    const lowPatch = { gainDb: -tiltDb };
    if (!bLow.on) lowPatch.on = true;
    if (bLow.type !== EQ_FILTER_TYPES.LOW_SHELF) lowPatch.type = EQ_FILTER_TYPES.LOW_SHELF;
    if (Math.abs((bLow.freqHz || 0) - 220) > 12) lowPatch.freqHz = 220;
    if (Math.abs((bLow.q || 0) - 0.38) > 0.05) lowPatch.q = 0.38;

    const highPatch = { gainDb: tiltDb };
    if (!bHigh.on) highPatch.on = true;
    if (bHigh.type !== EQ_FILTER_TYPES.HIGH_SHELF) highPatch.type = EQ_FILTER_TYPES.HIGH_SHELF;
    if (Math.abs((bHigh.freqHz || 0) - 3500) > 80) highPatch.freqHz = 3500;
    if (Math.abs((bHigh.q || 0) - 0.38) > 0.05) highPatch.q = 0.38;

    await this.setEqBand(item, 5, lowPatch, { immediate, recordHistory: false });
    await this.setEqBand(item, 6, highPatch, { immediate, recordHistory: false });
    return true;
  }

  // =========================================================================
  // MASTER METER & RETURN A REVERB
  // =========================================================================
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

    const touched = [];
    const lockUntil = performance.now() + 1000;
    try {
      for (const s of snapshot.tracks) {
        const item =
          store.getTrackById(s.id) ||
          store.tracks.find((t) => t.index === s.index) ||
          store.tracks.find((t) => t.name === s.name);
        if (!item) continue;

        item.isDragging = true;
        item._mixWriteUntil = lockUntil;
        item._yTiltLockUntil = lockUntil;
        touched.push(item);

        const nextPan = clamp(s.pan ?? item.pan, -1, 1);
        const nextVol = clamp(s.vol ?? item.vol, 0, 1);
        const nextSend = clamp(s.sendA ?? item.sendA, 0, 1);
        const nextMute = Boolean(s.mute ?? item.mute);
        const nextSolo = Boolean(s.solo ?? item.solo);
        const nameChanged = Boolean(s.name && s.name !== item.name);
        const nextColor = s.colorHex ? normalizeAbletonColor(s.colorHex) : item.colorHex;
        const colorChanged = nextColor.toLowerCase() !== item.colorHex.toLowerCase();

        const panChanged = Math.abs(nextPan - item.pan) > 0.002;
        const volChanged = Math.abs(nextVol - item.vol) > 0.002;
        const sendChanged = Math.abs(nextSend - item.sendA) > 0.002;
        const muteChanged = nextMute !== item.mute;
        const soloChanged = nextSolo !== item.solo;

        item.pan = nextPan;
        item.vol = nextVol;
        item.sendA = nextSend;
        item.y = s.y ?? item.y;
        item.mute = nextMute;
        item.solo = nextSolo;
        item.role = s.role ?? item.role;
        item.shape = s.shape ?? item.shape;
        item.sizeScale = s.sizeScale ?? item.sizeScale ?? 1.0;
        item.hidden = s.hidden ?? item.hidden;
        item.locked = s.locked ?? item.locked;
        item.vGroupId = s.vGroupId ?? null;
        if (nameChanged) item.name = s.name;
        if (colorChanged) item.colorHex = nextColor;

        if (panChanged) await item._ableton.panParam.set("value", item.pan).catch(() => {});
        if (volChanged) await item._ableton.volParam.set("value", item.vol).catch(() => {});
        if (sendChanged && item._ableton.sendAParam) {
          await item._ableton.sendAParam.set("value", item.sendA).catch(() => {});
        }
        if (muteChanged) await item._ableton.track.set("mute", item.mute).catch(() => {});
        if (soloChanged) await item._ableton.track.set("solo", item.solo).catch(() => {});
        if (nameChanged) await item._ableton.track.set("name", item.name).catch(() => {});
        if (colorChanged) {
          await item._ableton.track.set("color", parseInt(item.colorHex.slice(1), 16)).catch(() => {});
        }

        if (Array.isArray(s.eqBands) && item.eq?.hasDevice) {
          if (!item.eq.bound) await this.ensureEqBound(item);
          if (item.eq.bound) {
            for (const cfg of s.eqBands) {
              const idx = (cfg.bandNum ?? 1) - 1;
              const cur = item.eq.bands[idx];
              if (!cur) continue;
              const bandDiff =
                cur.on !== Boolean(cfg.on) ||
                (cfg.on && (
                  cur.type !== cfg.type ||
                  Math.abs(cur.freqHz - (cfg.freqHz ?? cur.freqHz)) > 1 ||
                  Math.abs(cur.gainDb - (cfg.gainDb ?? cur.gainDb)) > 0.05 ||
                  Math.abs(cur.q - (cfg.q ?? cur.q)) > 0.01
                ));
              if (bandDiff) {
                await this.setEqBand(item, idx, cfg, { immediate: true, recordHistory: false, force: true });
              }
            }
            item._lastEqYShift = computeEqYShift(item.eq.bands);
            item._eqLowCutScale = computeEqLowCutScale(item.eq.bands);
            item.eqCuts = item.eq.bands
              .filter((b) => b.on && b.gainDb < -0.5 && b.type >= 2 && b.type <= 5)
              .map((b) => ({ freqHz: b.freqHz, gainDb: b.gainDb }));
            item.y = s.y ?? item.y;
          }
        }
      }

      if (snapshot.reverb && store.reverbInfo.connected) {
        if (typeof snapshot.reverb.decay === "number" && Math.abs(snapshot.reverb.decay - store.reverbInfo.decay) > 0.005) {
          this.setReverbDecay(snapshot.reverb.decay, true);
        }
        if (typeof snapshot.reverb.predelay === "number" && Math.abs(snapshot.reverb.predelay - store.reverbInfo.predelay) > 0.005) {
          this.setReverbPredelay(snapshot.reverb.predelay, true);
        }
      }
    } finally {
      const postGuard = performance.now() + 900;
      for (const item of touched) {
        item._mixWriteUntil = postGuard;
        item._yTiltLockUntil = postGuard;
        item.isDragging = false;
      }
    }

    store.emit("snapshot-applied");
    store.emit("eq-changed");
  }
 async handleBankAction(slot, forceSave = false) {
    if (!["A", "B", "C", "D"].includes(slot)) return;
    if (this._bankBusy) return;
    this._bankBusy = true;

    try {
      if (store.isDryBypass) {
        store.isDryBypass = false;
        store.dryReturnSnapshot = null;
      }

      // Shift+Clic, Clic derecho, o clic directo sobre el banco YA activo -> guarda explícitamente
      if (forceSave || store.activeBank === slot) {
        store.saveBank(slot);
        store.emit("bank-saved-flash", slot);
        return;
      }

      // Auto-guarda el banco del que estás saliendo (si había uno activo)
      if (store.activeBank && store.activeBank !== slot) {
        store.banks[store.activeBank] = store.captureSnapshot();
      }

      // Si el banco destino está vacío, lo crea desde la mezcla actual
      if (!store.banks[slot]) {
        store.saveBank(slot);
        store.emit("bank-saved-flash", slot);
        return;
      }

      // Si el banco destino ya tiene datos, lo carga en Ableton
      store.pushHistory(store.captureSnapshot());
      store.activeBank = slot;
      await this.applySnapshot(store.banks[slot]);
      store.emit("banks-changed");
    } finally {
      this._bankBusy = false;
    }
  }

  async toggleDryBypass() {
    if (this._bankBusy) return;
    this._bankBusy = true;
    try {
      if (store.isDryBypass) {
        const backSnap = store.dryReturnSnapshot;
        store.isDryBypass = false;
        store.dryReturnSnapshot = null;
        if (backSnap) await this.applySnapshot(backSnap);
        store.emit("banks-changed");
        return;
      }

      // Bindea solo las pistas con EQ Eight antes del primer DRY
      for (const t of store.tracks) {
        if (t.eq?.hasDevice && !t.eq.bound) await this.ensureEqBound(t);
      }

      const baseSnap = store.captureSnapshot();
      store.dryReturnSnapshot = baseSnap;
      store.isDryBypass = true;
      await this.applySnapshot(store.buildDrySnapshot(baseSnap));
      store.emit("banks-changed");
    } finally {
      this._bankBusy = false;
    }
  }
  // Cambio limpio por Timeline (no ensucia Ctrl+Z ni sobreescribe el banco anterior)
  async applySceneBank(slot) {
    if (this._bankBusy || !store.banks[slot]) return;
    this._bankBusy = true;
    try {
      store.activeBank = slot;
      await this.applySnapshot(store.banks[slot]);
      store.emit("banks-changed");
    } finally {
      this._bankBusy = false;
    }
  }

  async importCueLocators() {
    try {
      const cues = await this.ableton.song.get("cue_points");
      if (!Array.isArray(cues) || cues.length === 0) return 0;
      const bankOrder = ["A", "B", "C", "D"];
      const sorted = [...cues].sort((a, b) => (a.raw?.time ?? 0) - (b.raw?.time ?? 0));

      store.scenes = [];
      sorted.forEach((c, idx) => {
        const beat = Number(c.raw?.time) || 0;
        const name = (c.raw?.name || "").trim() || `Sección ${idx + 1}`;
        store.addSceneRule(beat, bankOrder[idx % bankOrder.length], name);
      });
      return sorted.length;
    } catch (err) {
      console.warn("No se pudieron leer Locators:", err);
      return 0;
    }
  }

  // Modo True Depth: ajusta aire en High-Shelf (Banda 8) según profundidad Z sin pisar LPFs existentes
  async applyTrueDepthAir(item) {
    if (!item || item.locked || !item.eq?.hasDevice) return;
    const ok = await this.ensureEqBound(item);
    if (!ok) return;

    const b8 = item.eq.bands[7];
    if (!b8 || (b8.on && b8.type !== EQ_FILTER_TYPES.HIGH_SHELF)) return;

    const db = abletonVolToDb(item.vol);
    const clampedDb = Number.isFinite(db) ? clamp(db, -36, 6) : -36;
    const zNorm01 = (clampedDb + 36) / 42;
    const airDb = Math.round((-3.0 + zNorm01 * 5.0) * 10) / 10; // -3.0dB atrás -> +2.0dB frente

    await this.setEqBand(
      item,
      7,
      {
        on: true,
        type: EQ_FILTER_TYPES.HIGH_SHELF,
        freqHz: b8.on ? b8.freqHz : 8500,
        gainDb: clamp(airDb, -3.5, 2.5),
        q: 0.38,
      },
      { immediate: true, recordHistory: false }
    );
  }
}

export const abletonService = new AbletonService();