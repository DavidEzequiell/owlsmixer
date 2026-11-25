import { LUFS_TARGETS, formatFreq } from "../engine/psychoacoustics.js";
import { store } from "../store.js";

export class PsychoPanelUI {
  constructor() {
    this.selTarget = document.getElementById("sel-lufs-target");
    this.valMasterLufs = document.getElementById("val-master-lufs");
    this.badgeClip = document.getElementById("badge-clip");
    this.valSpacePct = document.getElementById("val-space-pct");
    this.badgeZone = document.getElementById("badge-density-zone");
    this.barSpaceFill = document.getElementById("bar-space-fill");
    this.valLowEnd = document.getElementById("val-lowend-pct");
    this.collisionList = document.getElementById("collision-list");

    Object.entries(LUFS_TARGETS).forEach(([key, cfg]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = cfg.label;
      if (key === store.settings.lufsTarget) opt.selected = true;
      this.selTarget.appendChild(opt);
    });

    this.selTarget.addEventListener("change", () => {
      this.selTarget.blur();
      store.updateSettings({ lufsTarget: this.selTarget.value });
    });
  }

  updateMasterMeter() {
    const m = store.masterStats;
    const target = LUFS_TARGETS[store.settings.lufsTarget]?.targetLufs ?? -10;

    if (!m.connected || !Number.isFinite(m.shortTermLufs) || m.shortTermLufs < -55) {
      this.valMasterLufs.textContent = "-- LUFS";
      this.valMasterLufs.style.color = "";
    } else {
      this.valMasterLufs.textContent = `${m.shortTermLufs.toFixed(1)} LUFS`;
      const diff = m.shortTermLufs - target;
      // Verde cerca del target, ámbar si pasa +2 dB, rojo si pasa +4 dB
      this.valMasterLufs.style.color =
        diff > 3.5 ? "var(--danger)" : diff > 1.5 ? "var(--warn)" : "var(--ok)";
    }

    this.badgeClip.classList.toggle("hidden", !m.clipping);
  }

  updateAnalysis() {
    const a = store.mixAnalysis;
    this.selTarget.value = store.settings.lufsTarget;

    this.valSpacePct.textContent = `${a.occupancyPct}%`;
    this.badgeZone.textContent = a.densityZone;
    this.badgeZone.className = `pill-info ${a.densityClass}`;

    this.barSpaceFill.style.width = `${Math.min(100, a.occupancyPct)}%`;
    this.barSpaceFill.className = `space-bar-fill ${a.densityClass}`;

    this.valLowEnd.textContent = `${a.lowEndPct}%`;
    this.valLowEnd.style.color = a.lowEndPct > 48 ? "var(--warn)" : "";

    // Lista clicable de colisiones ("Solar Eclipse", Visual 23)
    this.collisionList.innerHTML = "";
    if (a.collisions.length === 0) {
      this.collisionList.innerHTML = `<div class="collision-ok">✓ Sin enmascaramiento crítico detectado</div>`;
      return;
    }

    a.collisions.slice(0, 4).forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "collision-item" + (c.isLowMud ? " is-mud" : "");
      btn.title = "Clic para seleccionar ambas pistas y separarlas en X (Pan), Y (Freq) o Z (Vol)";
      const mudTag = c.isLowMud ? " · Barro" : "";
      btn.innerHTML =
        `<span class="col-names">⚠ ${c.a.name} ↔ ${c.b.name}</span>` +
        `<span class="col-meta">${c.overlapPct}% · ${formatFreq(c.avgHz)}${mudTag}</span>`;
      btn.addEventListener("click", () => {
        btn.blur();
        store.setSelection([c.a.id, c.b.id]);
      });
      this.collisionList.appendChild(btn);
    });
  }
}