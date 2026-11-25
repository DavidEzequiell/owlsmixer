import { APP_VERSION } from "../store.js";

function inferHint(err, context = "") {
  const raw = `${context} ${err?.message || err || ""}`.toLowerCase();

  if (raw.includes("webgl") || raw.includes("context")) {
    return "No se pudo iniciar el motor 3D (WebGL). Probá recargar la página o activar la aceleración por hardware en tu navegador.";
  }
  if (raw.includes("json") || raw.includes("snapshot") || raw.includes("formato")) {
    return "El archivo de mezcla está incompleto o tiene un formato inválido. Revisá que sea un .json exportado por Owls 3D Mixer.";
  }
  if (
    raw.includes("websocket") ||
    raw.includes("ableton") ||
    raw.includes("connect") ||
    raw.includes("socket") ||
    raw.includes("failed to fetch") ||
    raw.includes("timeout")
  ) {
    return "Verificá que Ableton Live esté abierto y que el Remote Script 'AbletonJS' esté activo en Preferencias → Link, Tempo & MIDI.";
  }
  return "Podés reintentar la operación o resetear las preferencias guardadas si el problema persiste.";
}

export class ErrorHandlerUI {
  constructor() {
    this.overlay = document.getElementById("error-overlay");
    this.titleEl = document.getElementById("error-title");
    this.msgEl = document.getElementById("error-message");
    this.hintEl = document.getElementById("error-hint");
    this.detailsEl = document.getElementById("error-details");
    this.btnRetry = document.getElementById("btn-error-retry");
    this.btnReset = document.getElementById("btn-error-reset");
    this.btnCopy = document.getElementById("btn-error-copy");
    this.btnDismiss = document.getElementById("btn-error-dismiss");
    this.loadingOverlay = document.getElementById("loading-overlay");

    this.retryHandler = null;
    this.lastDiagnostic = "";

    this.bindEvents();
    this.installGlobalHooks();
  }

  bindEvents() {
    this.btnRetry?.addEventListener("click", async () => {
      this.btnRetry.blur();
      const fn = this.retryHandler;
      this.hide();
      if (typeof fn === "function") {
        await fn();
      } else {
        window.location.reload();
      }
    });

    this.btnReset?.addEventListener("click", () => {
      this.btnReset.blur();
      const ok = confirm("¿Borrar las preferencias visuales guardadas (skin, ancho de sidebar, capas) y recargar?");
      if (!ok) return;
      Object.keys(localStorage)
        .filter((k) => k.startsWith("owls3d_"))
        .forEach((k) => localStorage.removeItem(k));
      window.location.reload();
    });

    this.btnCopy?.addEventListener("click", async () => {
      this.btnCopy.blur();
      try {
        await navigator.clipboard.writeText(this.lastDiagnostic);
        this.btnCopy.textContent = "✓ Copiado";
        setTimeout(() => { this.btnCopy.textContent = "📋 Copiar log"; }, 1600);
      } catch {
        prompt("Copiá el detalle técnico:", this.lastDiagnostic);
      }
    });

    this.btnDismiss?.addEventListener("click", () => {
      this.btnDismiss.blur();
      this.hide();
    });
  }

  installGlobalHooks() {
    window.addEventListener("error", (e) => {
      if (this.isOpen()) return;
      this.show({
        title: "Error inesperado en la aplicación",
        message: e.message || "Ocurrió un error en tiempo de ejecución.",
        error: e.error || e.message,
      });
    });

    window.addEventListener("unhandledrejection", (e) => {
      if (this.isOpen()) return;
      const reason = e.reason;
      this.show({
        title: "Error asíncrono no controlado",
        message: reason?.message || String(reason || "Promesa rechazada"),
        error: reason,
      });
    });
  }

  isOpen() {
    return Boolean(this.overlay && !this.overlay.classList.contains("hidden"));
  }

  show({ title = "No se pudo cargar el proyecto", message = "", hint = "", error = null, onRetry = null } = {}) {
    if (!this.overlay) return;
    this.loadingOverlay?.classList.add("hidden");

    const errMsg = message || error?.message || String(error || "Error desconocido");
    const stack = error?.stack ? String(error.stack) : String(error || errMsg);

    this.retryHandler = onRetry;
    this.titleEl.textContent = title;
    this.msgEl.textContent = errMsg;
    this.hintEl.textContent = hint || inferHint(error || errMsg, title);
    this.detailsEl.textContent = stack;

    this.lastDiagnostic =
      `Owls 3D Mixer v${APP_VERSION}\n` +
      `Fecha: ${new Date().toISOString()}\n` +
      `Título: ${title}\n` +
      `Mensaje: ${errMsg}\n` +
      `Detalle:\n${stack}`;

    this.overlay.classList.remove("hidden");
  }

  hide() {
    this.overlay?.classList.add("hidden");
  }
}