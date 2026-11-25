# 🦉 Owls 3D Mixer — *The Art of Mixing* for Ableton Live (v0.0.5)

Mezclador espacial 3D en tiempo real para **Ableton Live 12 Suite**, inspirado en el **Virtual Mixer** y los diagramas psicoacústicos de *The Art of Mixing* (David Gibson, 4th Ed.).

Permite visualizar y controlar **Paneo (X)**, **Frecuencia / EQ Eight (Y)**, **Volumen Aparente / Reverb (Z)**, enmascaramiento 3D (*Solar Eclipse*) y telemetría **LUFS** en vivo, directamente desde el navegador sin build step.

---

## ✨ Características actuales (v0.0.5)

* **Mapa 3D Psicoacústico (Three.js):**
  * **Eje X:** Paneo estéreo (`50L ↔ C ↔ 50R`).
  * **Eje Y:** Frecuencia logarítmica (`20 Hz → 20 kHz`) sincronizada con **EQ Eight** (los cortes/boosts desplazan el centro tonal en Y).
  * **Eje Z:** Modo **Gibson** (6 Niveles de Volumen Aparente en escala dB real `-36 dB .. +6 dB`) o Modo **Espacial** (`Send A Reverb`).
  * **Formas de Gibson:** Esferas (mono puntual), Elipsoides (estéreo / fattening `<30ms`) y Cubos translúcidos de Reverb en Return A.
* **EQ Window 3D + EQ Eight Adapter (Nuevo en v0.0.5):**
  * Vista dedicada **`EQ Window`** (tecla `E` o Dock inferior) con las **7 franjas horizontales de Gibson** (`40–100 Hz` a `10k–20k Hz`), **Cut (-) izquierda / Boost (+) derecha**, nodos numerados de las 8 bandas reales de Ableton y **barras fantasma de pistas en colisión**.
  * **⚡ Quick EQ de Gibson (Chart 5/6):** aplica la curva base recomendada según el rol de cada pista directo sobre el `EQ Eight` en Live.
  * Historial completo (`Ctrl+Z` / `Ctrl+Y`) incluyendo cambios de EQ, color, nombre, grupos y mezcla.
* **Analizador Psicoacústico (US-08):**
  * Medidor **Master Short-Term LUFS (3s)** + alerta `CLIP` + objetivos por género (`-14 / -10 / -8 / -16 LUFS`).
  * Ocupación geométrica de la caja 3D (`Sparse → Balanced → Wall of Sound → Mudd City!`) y porcentaje de `Low-End (<250 Hz)`.
  * **Detector de Colisiones (*Solar Eclipse*):** alerta visual en 3D y lista clicable cuando dos pistas se enmascaran.
* **Workflow de Mezcla:**
  * Sincronización bidireccional en vivo con Ableton (Pan, Vol, Send A, Mute, Solo, Nombre, Color, Return A Reverb, EQ Eight).
  * Grupos de Ableton (`Ctrl+G` / Buses) + **Grupos Virtuales** con drag & drop y sliders de bloque (incluye **Spread estéreo**).
  * **Presets del libro** en ventana flotante arrastrable con visor PDF integrado en la página exacta (`assets/art_of_mixing.pdf`).
  * Exportación e importación de Snapshots completos (`.json`).
* **3 Skins visuales:**
  * `Gibson Dark (Moderno)`
  * `Art of Mixing '97 (Win98 / SGI)` (con cielo de nubes procedural y piso azul retro)
  * `Winamp 2.91 Classic (LCD)` *(Nuevo en v0.0.5)*

---

## 🛠️ Requisitos e Instalación

1. **Ableton Live 12 Suite** con el Remote Script **AbletonJS v5** instalado y activo en Preferencias → Link, Tempo & MIDI.
2. Servidor local de AbletonJS escuchando en `ws://127.0.0.1:39031` (sirviendo `/static/owlsmixer/`).
3. *(Opcional)* Copiar el PDF del libro en `owlsmixer/assets/art_of_mixing.pdf` para abrir los diagramas desde los Presets.
4. Abrir en el navegador:
   ```text
   http://127.0.0.1:39031/static/owlsmixer/
   ```
   *(Vanilla ES Modules + Three.js r170 por CDN — no requiere `npm install` ni bundler).*

---

## ⌨️ Controles y Atajos

| Acción | Mix 3D | EQ Window (`E`) |
|---|---|---|
| **Arrastrar Izq** | Pan (X) + Volumen o Send A (Z) | Cut `(-)` / Boost `(+)` en la franja |
| **Shift + Arrastrar** | Altura de Frecuencia (Y) *(cursor `↕`)* | Frecuencia exacta (Hz) + Gain (dB) |
| **Rueda del mouse** | Reverb Send A (o Volumen) | Q / Resonance de la banda |
| **Clic Derecho** | Orbitar / Panear cámara | Prender / Apagar banda en EQ Eight |
| **Ctrl + Clic / `M`** | Mute | Mute |
| **Alt + Clic / `S`** | Solo | Solo |
| **`U`** | Quitar todos los Solos | Quitar todos los Solos |
| **`E`** | Alternar Mix 3D ↔ EQ Window | Alternar EQ Window ↔ Mix 3D |
| **`Space`** | Play / Pause en Ableton | Play / Pause en Ableton |
| **`Ctrl+Z` / `Ctrl+Y`** | Deshacer / Rehacer (incluye EQ) | Deshacer / Rehacer (incluye EQ) |
| **`Esc`** | Cerrar modales / Limpiar selección | Cerrar modales / Limpiar selección |

---

## 📋 Changelog

### `v0.0.5` (Sprint B — EQ Window, EQ Eight Adapter & Winamp Skin)
* **Nuevo — `EQ Eight` Adapter (`src/adapters/deviceAdapters.js`):**
  * Detección liviana de `EQ Eight` en `scanAll()` y carga/suscripción **on-demand** al seleccionar pista o abrir `EQ Window`.
  * Conversión logarítmica exacta calibrada en Live 12 (`10 Hz .. 22.000 Hz`: `hz = 10 * 2200^norm`).
  * Hidratación real de `min/max` vía `param.get("min")` / `param.get("max")` (corrige también rangos en plugins de Reverb del Adapter).
* **Nuevo — Vista `EQ Window` en 3D (`src/scene/EqWindow3D.js`, `src/data/eqBands.js`):**
  * Switch `Mix 3D ↔ EQ Window` en el Dock inferior y atajo `E`.
  * 7 franjas horizontales de Gibson interactivas, nodos numerados de las 8 bandas, edición en tiempo real de Gain/Freq/Q/On-Off y fantasmas translúcidos de pistas rivales en colisión (*Solar Eclipse*).
* **Nuevo — ⚡ Quick EQ de Gibson (Chart 5/6) + Conexión EQ → Eje Y:**
  * Botones `⚡ Quick EQ Gibson` y `🎛️ EQ Window` en el Inspector individual.
  * Recetas por rol para las 19 categorías de `roles.js`, compatibles con `Ctrl+Z` / `Ctrl+Y` y exportación JSON.
  * `computeEqYShift()` desplaza automáticamente el Eje Y de la esfera en Mix 3D según los filtros HPF/LPF y cortes/boosts del `EQ Eight`.
* **Nuevo — Skin `Winamp 2.91 Classic (LCD)`** en `skins.js` y `styles.css`.
* **Fixes desde `v0.0.4`:**
  * Corregido crash en `SidebarUI.js` por referencias faltantes `valVol` / `valY` y `return;` faltante en `updateInspector()` (que mostraba "Conjunto activo" con 1 pista).
  * `valY` ahora muestra frecuencia real en Hz (`440 Hz · Mid`) y `valVol` conserva el nivel aparente `L1..L6` de Gibson.
  * Corregida interferencia de `OrbitControls` al usar `Shift + Arrastrar` en Eje Y (captura prioritaria en `viewportEl` + soporte para apretar `Shift` a mitad del drag + cursor `↕`).
  * Corregido `runMixAnalysis()` en `snapshot-applied`, `onTrackVisualChanged` y protección para no limpiar colisiones mientras se está en `EQ Window`.
  * Eliminada `centerLine` duplicada en `Stage3D.js` y claves duplicadas en `store.js`.

### `v0.0.4` (Base previa)
* Motor psicoacústico US-08 (`psychoacoustics.js`), escala Z logarítmica en dB, medidor Master Short-Term LUFS, ocupación de caja 3D y detector *Solar Eclipse*.
* Sincronización de colores con Ableton, Return A Reverb Adapter, Grupos Virtuales, Presets con visor PDF y Skin retro `Art of Mixing '97`.

---

## 🗺️ Roadmap & Próximos Sprints

### 🔜 Sprint C — Micro-UX del Virtual Mixer + Auto-Size + Skins
* [ ] **Tooltip en vivo sobre la sombra al arrastrar (Gibson p. 47):** badge flotante pegado a la esfera/sombra (`-11.4 dB · 22L` / `420 Hz`) para no desviar la vista a la sidebar.
* [ ] **Botón `FLASH` (Gibson p. 44):** toggle rápido en el Dock para prender/apagar el pulso en tiempo real de los meters (congelar esferas al acomodar con precisión).
* [ ] **Bancos rápidos `A / B / C / D` (Gibson p. 44):** 4 slots en memoria para comparar variantes de mezcla en 1 clic sin exportar JSONs.
* [ ] **Toggle Esferas vs Íconos de instrumento (Gibson p. 47):** mostrar opcionalmente íconos (`🎸`, `🥁`, `🎤`, `🎹`) sobre las esferas.
* [ ] **Tamaño visual `Auto / Manual` (Crest Factor + EQ Eight):**
  * Calcular densidad por *Crest Factor* (relación RMS/Pico desde `output_meter_left` para diferenciar sonidos comprimidos/distorsionados vs transientes secos) y vincular la reducción de tamaño al cortar barro (`<300 Hz`) en `EQ Eight`.
  * Convertir el slider *"Tamaño visual esfera"* en modo **Auto** por defecto con toggle a **Manual (override)** + botón reset `1.0x`.
* [ ] **Presets extra del artículo (p. 12, 24–27):** *Sledgehammer* (Peter Gabriel), *Babylon Sisters* (Steely Dan), *Big Band*, *Bluegrass*.
* [ ] **Nuevas Skins:** *Analog SSL*, *Cyberpunk*, *Owls & Sticks*.

### 🔮 Sprint D — Effects Window & Multi-Return Drag & Drop (Gibson p. 49)
* [ ] Escanear **todos los Return Tracks** de Ableton (`Return A: Reverb`, `Return B: Delay`, `Return C: Chorus/Fattening`, etc.) usando `deviceAdapters.js`.
* [ ] Mostrar paletas laterales de efectos en el viewport 3D.
* [ ] **Drag & Drop de Efectos:** arrastrar una caja de efecto (`DELAY`, `REVERB`, `CHORUS`) y soltarla sobre una esfera para subir/asignar ese Send en tiempo real.
* [ ] Adaptadores extra en `deviceAdapters.js`: `FabFilter Pro-Q 3`, `Channel EQ`, `Ableton Delay / Echo`, `Chorus-Ensemble`.

---

## 🧠 Notas Técnicas & Arquitectura (Contexto de Desarrollo / AI Handoff)

> *Esta sección resume las reglas y hallazgos verificados en Ableton Live 12 + `ableton-js` v5 para acelerar futuras sesiones de desarrollo o debug.*

### Estructura de archivos
```text
owlsmixer/
├── index.html                  # Layout, Dock inferior, Modales (Presets, PDF, Opciones)
├── styles.css                  # Temas CSS variables + overrides por body[data-skin="..."]
├── assets/art_of_mixing.pdf    # Recurso estático opcional para referencias de Presets
└── src/
    ├── main.js                 # Bootstrap, eventos del store, resizer, tooltips, runMixAnalysis()
    ├── store.js                 # EventTarget singleton: tracks, viewMode, settings, undo/redo (MAX 40)
    ├── adapters/
    │   └── deviceAdapters.js   # REVERB_ADAPTERS, EQ_ADAPTERS, hydrateParamBounds(), eqNormToHz()
    ├── data/
    │   ├── eqBands.js          # 7 franjas Gibson, QUICK_EQ_PRESETS por rol, computeEqYShift()
    │   ├── presets.js          # Presets calibrados del libro con pdfPage
    │   ├── roles.js            # 19 roles (defaultY, sizeFactor, shape, keywords, eqTip)
    │   └── skins.js            # Config UI + Three.js de cada skin
    ├── engine/
    │   └── psychoacoustics.js  # Curva fader Live, escala log Z/Y, K-Weighting, analyzeMixSpace, LUFS
    ├── scene/
    │   ├── Stage3D.js          # Escena Three.js, cámara, luces, grids, switch Mix/EQ, loop RAF
    │   ├── TrackOrb.js         # Esfera/Elipsoide, cubo Reverb, sombra, dropLine, label sprite
    │   ├── EqWindow3D.js       # 7 franjas 3D interactivas, barras Boost/Cut, nodos y fantasmas
    │   └── Interaction3D.js    # Raycasting Mix/EQ, drag capture-phase (evita OrbitControls), atajos
    ├── services/
    │   └── abletonService.js   # Conexión WS AbletonJS, listeners bidireccionales, EQ on-demand
    └── ui/
        ├── HudUI.js            # Barra superior, Dock inferior, switch Mix/EQ, banner EQ
        ├── SidebarUI.js        # Reverb, Grupos, Inspector (1 pista / bloque), lista drag & drop
        ├── PsychoPanelUI.js    # Panel US-08 (LUFS, ocupación 3D, lista de colisiones)
        ├── PresetsModalUI.js   # Ventana flotante arrastrable de presets + visor PDF
        └── SettingsModalUI.js  # Modal de preferencias y guía rápida de Gibson
```

### Hallazgos verificados en Ableton Live 12 + `ableton-js` v5
1. **Sin build step:** Vanilla ES Modules (`import * as THREE from "three"` vía `importmap` en `index.html`). Mantener dependencias de módulos sin ciclos (`deviceAdapters.js` y `psychoacoustics.js` son hojas).
2. **`min` / `max` NO vienen en `param.raw`:** En `ableton-js` v5, `param.raw` solo devuelve `{ id, name, value, is_quantized }`. Siempre hidratar con `await hydrateParamBounds(param)` (`param.get("min")` / `param.get("max")`) una vez al bindear.
3. **Parámetros exactos de `EQ Eight` (canal Stereo `A`):**
   * Globales: `Device On`, `Output Gain`, `Scale`, `Adaptive Q`.
   * Bandas `n = 1..8`: `n Filter On A` (`0/1`), `n Filter Type A` (`0..7`: `0=HP48, 1=HP12, 2=LowShelf, 3=Bell, 4=Notch, 5=HighShelf, 6=LP12, 7=LP48`), `n Frequency A` (`0..1`), `n Gain A` (`-15..+15`), `n Resonance A` (`0..1`).
   * **Conversión exacta de Frecuencia:** `hz = 10 * Math.pow(2200, norm)` y `norm = Math.log(hz / 10) / Math.log(2200)` (validado: `0.14274713... = 30.00 Hz`, `0.18012683... = 40.00 Hz`).
   * **Performance WebSocket:** Nunca suscribir las 8 bandas × 5 params de todas las pistas en `scanAll()`. Solo detectar `findTrackEqDevice()` en `scanAll()` y ejecutar `ensureEqBound()` **on-demand** al seleccionar pista o abrir `EQ Window`.
4. **Anti-eco local:** Al escribir desde la UI hacia Ableton, se usa `isDragging` (en mixer) o `_localWriteUntil` (ventana de `260 ms` por banda en EQ) para que el callback del listener no pelee contra el arrastre.
5. **Análisis psicoacústico en modo EQ:** `runMixAnalysis()` hace early-return cuando `store.viewMode !== "mix"` para evitar que ocultar las esferas borre `store.mixAnalysis.collisions` (necesario para renderizar fantasmas en `EqWindow3D`).