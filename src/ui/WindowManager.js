const STORAGE_KEY = "owls3d_windows_v1";

const DEFAULT_STATE = {
  windows: {
    presets: { open: false, left: 16, top: 64 },
    psycho:  { open: false, left: 16, top: 64 },
    reverb:  { open: false, left: 372, top: 64 },
    scenes:  { open: false, left: 16, top: 340 },
  },
  sidebarPanels: {
    groups: true,
    inspector: true,
  },
};

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      windows: {
        ...DEFAULT_STATE.windows,
        ...(raw.windows || {}),
      },
      sidebarPanels: {
        ...DEFAULT_STATE.sidebarPanels,
        ...(raw.sidebarPanels || {}),
      },
    };
  } catch {
    return {
      windows: { ...DEFAULT_STATE.windows },
      sidebarPanels: { ...DEFAULT_STATE.sidebarPanels },
    };
  }
}

export class WindowManager {
  constructor() {
    this.state = loadState();
    this.windows = new Map();
    this.sidebarPanels = new Map();
    this.topZ = 42;
    this.onChange = null;

    window.addEventListener("resize", () => this.clampAllToViewport());
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {}
  }

  clampPosition(el, left, top) {
    const w = el.offsetWidth || 340;
    const maxX = Math.max(8, window.innerWidth - w - 8);
    const maxY = Math.max(54, window.innerHeight - 64);
    return {
      left: Math.max(8, Math.min(maxX, Number(left) || 16)),
      top: Math.max(54, Math.min(maxY, Number(top) || 64)),
    };
  }

  clampAllToViewport() {
    this.windows.forEach((entry, key) => {
      if (entry.el.classList.contains("hidden")) return;
      const saved = this.state.windows[key] || entry.defaultPos;
      const pos = this.clampPosition(entry.el, saved.left, saved.top);
      entry.el.style.left = `${pos.left}px`;
      entry.el.style.top = `${pos.top}px`;
    });
  }

  bringToFront(key) {
    const entry = this.windows.get(key);
    if (!entry) return;
    if (this.topZ >= 78) {
      // Compacta z-index para quedar siempre debajo de los menús (90) y modales (120)
      this.topZ = 42;
      this.windows.forEach((w) => { w.el.style.zIndex = String(this.topZ); });
    }
    this.topZ += 1;
    entry.el.style.zIndex = String(this.topZ);
  }

  registerWindow(key, { el, handleEl, closeBtn, defaultPos = { left: 16, top: 64 }, onOpen = null }) {
    if (!el) return;
    const saved = { ...defaultPos, ...(this.state.windows[key] || {}) };
    this.state.windows[key] = saved;

    const entry = { el, handleEl, closeBtn, defaultPos, onOpen };
    this.windows.set(key, entry);

    el.style.left = `${saved.left}px`;
    el.style.top = `${saved.top}px`;
    el.classList.toggle("hidden", !saved.open);
    if (saved.open) {
      this.bringToFront(key);
      const pos = this.clampPosition(el, saved.left, saved.top);
      el.style.left = `${pos.left}px`;
      el.style.top = `${pos.top}px`;
    }

    el.addEventListener("pointerdown", () => this.bringToFront(key));

    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeBtn.blur();
        this.setWindowOpen(key, false);
      });
    }

    if (handleEl) {
      let dragging = false;
      let offX = 0;
      let offY = 0;

      handleEl.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button, input, select, .help-icon")) return;
        dragging = true;
        this.bringToFront(key);
        const rect = el.getBoundingClientRect();
        offX = e.clientX - rect.left;
        offY = e.clientY - rect.top;
        handleEl.setPointerCapture(e.pointerId);
      });

      handleEl.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const pos = this.clampPosition(el, e.clientX - offX, e.clientY - offY);
        el.style.left = `${pos.left}px`;
        el.style.top = `${pos.top}px`;
        this.state.windows[key].left = pos.left;
        this.state.windows[key].top = pos.top;
      });

      handleEl.addEventListener("pointerup", () => {
        if (!dragging) return;
        dragging = false;
        this.saveState();
      });
    }
  }

  registerSidebarPanel(key, el) {
    if (!el) return;
    this.sidebarPanels.set(key, el);
    const visible = this.state.sidebarPanels[key] !== false;
    this.state.sidebarPanels[key] = visible;
    el.classList.toggle("hidden", !visible);
  }

  isWindowOpen(key) {
    const entry = this.windows.get(key);
    return Boolean(entry && !entry.el.classList.contains("hidden"));
  }

  setWindowOpen(key, open) {
    const entry = this.windows.get(key);
    if (!entry) return;
    const isOpen = Boolean(open);
    entry.el.classList.toggle("hidden", !isOpen);
    this.state.windows[key] = { ...entry.defaultPos, ...(this.state.windows[key] || {}), open: isOpen };

    if (isOpen) {
      entry.onOpen?.();
      this.bringToFront(key);
      const pos = this.clampPosition(entry.el, this.state.windows[key].left, this.state.windows[key].top);
      entry.el.style.left = `${pos.left}px`;
      entry.el.style.top = `${pos.top}px`;
      this.state.windows[key].left = pos.left;
      this.state.windows[key].top = pos.top;
    }

    this.saveState();
    this.onChange?.();
  }

  toggleWindow(key) {
    this.setWindowOpen(key, !this.isWindowOpen(key));
  }

  isSidebarPanelVisible(key) {
    return this.state.sidebarPanels[key] !== false;
  }

  setSidebarPanelVisible(key, visible) {
    const el = this.sidebarPanels.get(key);
    if (!el) return;
    const isVis = Boolean(visible);
    el.classList.toggle("hidden", !isVis);
    this.state.sidebarPanels[key] = isVis;
    this.saveState();
    this.onChange?.();
  }

  resetPositions() {
    this.windows.forEach((entry, key) => {
      const pos = this.clampPosition(entry.el, entry.defaultPos.left, entry.defaultPos.top);
      this.state.windows[key] = { ...(this.state.windows[key] || {}), left: pos.left, top: pos.top };
      entry.el.style.left = `${pos.left}px`;
      entry.el.style.top = `${pos.top}px`;
    });
    this.saveState();
  }
}