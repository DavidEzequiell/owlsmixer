# 🦉 Owls 3D Mixer — *The Art of Mixing* para Ableton Live

Interfaz de mezcla espacial en **3D en tiempo real** para **Ableton Live 12**, inspirada en el *Virtual Mixer* de David Gibson (*"The Art of Mixing"*). Conectada bidireccionalmente vía **AbletonJS v5** (`ws://127.0.0.1:39031`), sin build step (Vanilla ES Modules + Three.js r170) [1.1].

> **Estado actual:** `v0.0.5` + branch `MixEngine` (camino a `v0.0.6` UI/UX polish)

---

## ✨ Qué hace hoy

### 🎛️ Mapa 3D Psicoacústico (`Mix 3D`)
* **Eje X (Paneo):** Izquierda ↔ Derecha en tiempo real.
* **Eje Y (Frecuencia):** `20 Hz` → `20 kHz` logarítmico (`Shift + Drag`). Se recalcula dinámicamente con los cambios en `EQ Eight` (`computeEqYShift()`).
* **Eje Z (3 Modos):**
  * **Volumen (Gibson):** 6 niveles de volumen aparente (`-36 dB` a `+6 dB`).
  * **True Depth:** Al acercar/alejar en Z combina **Volumen + Send A Reverb inverso + High-Shelf Aire** en Banda 8 de `EQ Eight`.
  * **Reverb (Espacial):** Mapea profundidad directo al `Send A`.
* **Auto-Size por Energía Real:** Escala visualmente las esferas combinando **Crest Factor** (relación pico/RMS en vivo desde los meters) y **recortes `<300 Hz`** en `EQ Eight`.
* **Formas de Gibson:** Esferas (mono puntual), Elipsoides (estéreo / fattening) y Cubos translúcidos de Reverb vinculados a *Return A*.
* **Micro-UX:** Tooltip flotante proyectado sobre la sombra/cursor al arrastrar, botón **⚡ Flash** para congelar meters y **Modo Focus (`F`) / Pantalla completa** para ocultar la sidebar.

### 🔬 Analizador *Espacio & LUFS* + *Solar Eclipse* (`Carve EQ`)
* Medidor **Master Short-Term LUFS (3s)** + detector de **CLIP** con objetivos por género (`Streaming -14`, `Indie -10`, `Wall -8`, `Acoustic -16`).
* Ocupación volumétrica de la caja (`Sparse` → `Balanced` → `Wall of Sound` → `Mudd City!`) y porcentaje de Low-End (`<250 Hz`).
* **Detector de Colisiones con Escala Bark (Zwicker):** Detecta enmascaramiento en bandas críticas del oído humano y distingue barro real (`<400 Hz` en ambas pistas).
* **Resolución en 1 clic (`✂ Priorizar`):** Aplica un recorte paramétrico `Bell` quirúrgico (`-2.5` a `-3.5 dB`) en el `EQ Eight` de la pista rival (o separación en Pan si no tiene EQ).

### 🎚️ Bancos A/B/C/D, Bypass `DRY` y Escenas por Timeline
* **Bancos rápidos `A / B / C / D`:** Comparación instantánea dentro de Ableton (auto-guarda `A` al conectar, auto-guarda al cambiar de banco y realiza *backfill* automático de EQs).
* **Toggle `DRY`:** Apaga temporalmente Pan, Reverb Send A y bandas activas de EQ sin alterar los faders de volumen.
* **Escenas / Timeline (`Auto: ON/OFF`):** Lee `current_song_time` y *Locators* (`cue_points`) de Ableton para cambiar automáticamente entre Bancos según el compás (ej. `Verso → A`, `Estribillo → B`).

### 🎛️ `EQ Window 3D` + Presets del Libro + Skins
* Vista frontal de las 7 franjas de Gibson sincronizada con las 8 bandas reales de `EQ Eight` + barras fantasma de pistas en colisión y **⚡ Quick EQ Gibson** por rol (`19` categorías).
* Presets calibrados del libro con visor de PDF integrado en la página exacta de cada diagrama (`assets/art_of_mixing.pdf`) [1.1].
* **4 Skins visuales:** `Gibson Dark`, `Art of Mixing '97 (Win98)`, `Winamp 2.91 Classic (LCD)` y `Ableton Live 12 (Dark)`.

---

## ⌨️ Atajos de Teclado

| Tecla | Acción |
| :--- | :--- |
| `Space` / `Shift+Space` | Play / Pause (o Continue) en Ableton |
| `E` | Alternar entre `Mix 3D` y `EQ Window` |
| `F` | Ocultar / Mostrar panel lateral (Modo Focus) |
| `M` / `S` / `U` | Mute / Solo selección / Quitar todos los Solos |
| `Ctrl+Z` / `Ctrl+Y` | Deshacer / Rehacer (40 niveles) |
| `Shift + Drag` | Mover en Eje Y (Frecuencia) |
| `Ctrl+Click` / `Alt+Click` | Mute / Solo rápido sobre esfera |

---

## 🗺️ Roadmap

### `v0.0.6` — Limpieza UI/UX & Persistencia
* [ ] Reducir ruido visual en Sidebar (pestañas `Mezcla` / `Engine & FX` para liberar altura en la lista de pistas).
* [ ] Compactar barra superior (mover selector de Skin a `⚙ Opciones`) y agrupar toggles del Dock en menú `Capas`.
* [ ] Persistir Bancos `A / B / C / D` dentro del `.json` exportado (para cargar Verso/Estribillo completos de una).

### `v0.1.0+` — Arquitectura Multi-DAW & Dinámicas
* [ ] Mantener `src/engine/` 100% agnóstico del DAW para futuros adapters (OSC/Reaper o plugin nativo **JUCE 8 WebView** VST3/AU/CLAP).
* [ ] **FFT real por canal** (vía micro bridge Max for Live o PCM en plugin nativo) para dejar de estimar frecuencias solo por rol.
* [ ] Adaptadores de **`Compressor`** y **`Utility`** (sidechain / ducking automático desde *Solar Eclipse*).