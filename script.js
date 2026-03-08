/**
 * LiveScape – script.js
 * Main controller: storage, clock, wallpaper management,
 * settings panel, shortcuts, animation engine coordination.
 */

'use strict';

/* ════════════════════════════════════════════════════════
   STORAGE KEYS
   ════════════════════════════════════════════════════════ */
const STORAGE_KEYS = {
  MODE: 'ls_display_mode',       // 'fullscreen' | 'blur'
  WALLPAPER_TYPE: 'ls_wallpaper_type',     // 'video' | 'gif' | 'animation'
  ANIMATION_STYLE: 'ls_animation_style',    // 'particles' | 'matrix' | 'nebula' | 'aurora'
  PERF_PAUSE: 'ls_perf_pause',         // bool
  REDUCE_PARTICLES: 'ls_reduce_particles',   // bool
  SHOW_CLOCK: 'ls_show_clock',         // bool
  CLOCK_24H: 'ls_clock_24h',          // bool
  OVERLAY_OPACITY: 'ls_overlay_opacity',    // 0–80
  HAS_VIDEO: 'ls_has_video',          // bool (video file in IndexedDB)
  GIF_DATA_KEY: 'ls_gif_data',           // base64 data URL
  SHORTCUTS: 'ls_shortcuts',          // JSON array
  WIDGET_POSITIONS: 'ls_widget_positions',// JSON object mapping component ID to coordinates
  AUTO_ROTATE: 'ls_auto_rotate',      // bool
  ROTATE_INTERVAL: 'ls_rotate_interval', // ms (300000 | 600000 | 1800000 | 3600000)
  DYNAMIC_WIDGETS: 'ls_dynamic_widgets', // JSON array tracking custom dynamically spawned widgets
  WIDGET_VISIBILITY: 'ls_widget_visibility', // JSON dict mapping widget toggles
  THEME: 'ls_theme', // string key for preset theme
};

/* ════════════════════════════════════════════════════════
   THEME PRESETS
   ════════════════════════════════════════════════════════ */
const THEMES = {
  cyberpunk: { overlay: 45, blur: 30, accent: "#00f7ff", widgetOpacity: 0.85 },
  minimal: { overlay: 20, blur: 10, accent: "#ffffff", widgetOpacity: 0.95 },
  glass: { overlay: 30, blur: 40, accent: "#6fb8ff", widgetOpacity: 0.9 },
  dark: { overlay: 55, blur: 20, accent: "#4c8fff", widgetOpacity: 0.85 }
};

/* ════════════════════════════════════════════════════════
   STATE
   ════════════════════════════════════════════════════════ */
const state = {
  mode: 'animation',  // current wallpaper type: 'video'|'gif'|'animation'
  displayMode: 'fullscreen', // 'fullscreen' | 'blur'
  animationStyle: 'particles',
  perfPause: true,
  reduceParticles: false,
  showClock: true,
  clock24h: false,
  overlayOpacity: 30,
  engine: null,         // ParticleEngine instance
  clockInterval: null,
  isVisible: true,
  currentVideoUrl: null,         // memory reference to blob URL for cleanup
  autoRotate: false,
  rotateInterval: 600000,        // 10 minutes default
  rotateTimer: null,             // setInterval handle
  rotateIndex: 0,                // current wallpaper index in rotation list
  dynamicWidgets: [],            // Array of parsed { id, type, x, y, width, height }
  widgetVisibility: {
    analogClock: true,
    calendar: true,
    weather: true,
    music: true,
    shortcutFolder: true
  },
  theme: null,
};

/* ════════════════════════════════════════════════════════
   INDEXEDDB WRAPPER FOR LARGE VIDEOS
   ════════════════════════════════════════════════════════ */
const VideoDB = {
  dbName: 'LiveScapeDB',
  storeName: 'videos',
  db: null,

  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      request.onerror = (e) => reject(e.target.error);
    });
  },

  saveVideo(blob) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('DB not initialized');
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(blob, 'bg_video');
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  },

  getVideo() {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('DB not initialized');
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get('bg_video');
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  deleteVideo() {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('DB not initialized');
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete('bg_video');
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }
};

/* ════════════════════════════════════════════════════════
   DOM REFERENCES
   ════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

const DOM = {
  body: document.body,
  wallpaperLayer: $('wallpaper-layer'),
  videoEl: $('video-wallpaper'),
  gifEl: $('gif-wallpaper'),
  canvas: $('animation-canvas'),
  overlay: $('wallpaper-overlay'),

  clockSection: $('clock-section'),
  clockTime: $('clock-time'),
  clockAmpm: $('clock-ampm'),
  clockDate: $('clock-date'),

  searchInput: $('search-input'),

  settingsToggle: $('settings-toggle'),
  settingsPanel: $('settings-panel'),
  settingsClose: $('settings-close'),
  settingsBackdrop: $('settings-backdrop'),

  modeFullscreen: $('mode-fullscreen'),
  modeBlur: $('mode-blur'),

  typeRadios: document.querySelectorAll('input[name="wallpaper-type"]'),
  uploadVideoArea: $('upload-video-area'),
  uploadGifArea: $('upload-gif-area'),
  animOptionsArea: $('animation-options-area'),

  uploadVideoInput: $('upload-video'),
  uploadGifInput: $('upload-gif'),
  videoUploadLabel: $('video-upload-label'),
  gifUploadLabel: $('gif-upload-label'),

  animStyleBtns: document.querySelectorAll('.anim-style-btn'),
  clearWallpaperBtn: $('clear-wallpaper-btn'),

  categoryBtns: document.querySelectorAll('.category-btn'),

  togglePerf: $('toggle-perf'),
  toggleReduce: $('toggle-reduce-particles'),
  toggleClock: $('toggle-clock'),
  toggle24h: $('toggle-24h'),

  movableWidgets: document.querySelectorAll('.movable-widget'),
  resetLayoutBtn: $('reset-layout-btn'),
  exportLayoutBtn: $('export-layout-btn'),
  importLayoutBtn: $('import-layout-btn'),
  layoutImportInput: $('layout-import'),

  overlayOpacity: $('overlay-opacity'),
  overlayOpacityVal: $('overlay-opacity-val'),

  footerTheme: $('footer-theme'),
  footerThemeName: $('footer-theme-name'),

  toggleRotate: $('toggle-rotate'),
  rotateIntervalSelect: $('rotate-interval'),
  rotateIntervalRow: $('rotate-interval-row'),

  shortcutsGrid: $('shortcuts-grid'),
  shortcutsContainer: $('shortcuts-container'),
  addShortcutBtn: $('add-shortcut-btn'),

  shortcutModal: $('shortcut-modal'),
  shortcutName: $('shortcut-name'),
  shortcutUrl: $('shortcut-url'),
  shortcutCancel: $('shortcut-cancel'),
  shortcutSave: $('shortcut-save'),

  toast: $('toast'),

  // Widget Library System
  openWidgetLibraryBtn: $('open-widget-library'),
  widgetLibraryOverlay: $('widget-library-overlay'),
  widgetLibraryContainer: $('widget-library-container'),
  widgetLibraryCloseBtn: $('widget-library-close'),
  widgetLayer: $('widget-layer'),

  // Theme Presets
  themeCards: document.querySelectorAll('.theme-card'),
};

/* ════════════════════════════════════════════════════════
   WIDGET LIBRARY REGISTRY
   ════════════════════════════════════════════════════════ */
const AVAILABLE_WIDGETS = {
  analogClock: {
    name: "Analog Clock",
    description: "Traditional wall-style clock widget",
    unique: false,
    create: function () {
      return createAnalogClockWidget();
    }
  },
  calendar: {
    name: "Calendar Widget",
    description: "Monthly calendar view",
    unique: true,
    create: function () {
      return createCalendarWidget();
    }
  },
  weather: {
    name: "Weather Widget",
    description: "Current weather information",
    unique: true,
    create: function () {
      return createWeatherWidget();
    }
  },
  music: {
    name: "Music Player",
    description: "Spotify / Apple Music player",
    unique: true,
    create: function (w) {
      return createMusicWidget(w);
    }
  },
  shortcutFolder: {
    name: "Shortcut Folder",
    description: "Group shortcuts into folders",
    unique: false,
    create: function (w) {
      return createShortcutFolderWidget(w);
    }
  }
};

/* ════════════════════════════════════════════════════════
   STORAGE HELPERS
   ════════════════════════════════════════════════════════ */

/**
 * Cross-browser storage wrapper.
 * Chrome MV3 uses chrome.storage.local; Firefox also supports it.
 * Falls back to localStorage if neither API is available (dev mode).
 */
const Store = {
  _api: (() => {
    if (typeof chrome !== 'undefined' && chrome.storage) return 'chrome';
    if (typeof browser !== 'undefined' && browser.storage) return 'firefox';
    return 'local';
  })(),

  get(keys) {
    return new Promise((resolve) => {
      if (this._api === 'chrome') {
        chrome.storage.local.get(keys, data => resolve(data));
      } else if (this._api === 'firefox') {
        browser.storage.local.get(keys).then(resolve);
      } else {
        const result = {};
        const keyArr = Array.isArray(keys) ? keys : Object.keys(keys);
        keyArr.forEach(k => {
          const val = localStorage.getItem(k);
          result[k] = val !== null ? JSON.parse(val) : (typeof keys === 'object' ? keys[k] : undefined);
        });
        resolve(result);
      }
    });
  },

  set(data) {
    return new Promise((resolve) => {
      if (this._api === 'chrome') {
        chrome.storage.local.set(data, resolve);
      } else if (this._api === 'firefox') {
        browser.storage.local.set(data).then(resolve);
      } else {
        Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
        resolve();
      }
    });
  },

  remove(keys) {
    return new Promise((resolve) => {
      const keyArr = Array.isArray(keys) ? keys : [keys];
      if (this._api === 'chrome') {
        chrome.storage.local.remove(keyArr, resolve);
      } else if (this._api === 'firefox') {
        browser.storage.local.remove(keyArr).then(resolve);
      } else {
        keyArr.forEach(k => localStorage.removeItem(k));
        resolve();
      }
    });
  }
};

/* ════════════════════════════════════════════════════════
   URL SAFETY HELPER
   ════════════════════════════════════════════════════════ */
function isSafeUrl(url) { // SECURITY FIX: javascript:/data: scheme injection
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

/* ════════════════════════════════════════════════════════
   CLOCK
   ════════════════════════════════════════════════════════ */
function updateClock() {
  const now = new Date();
  let hours = now.getHours();
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  let ampm = '';

  if (!state.clock24h) {
    ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
  }

  DOM.clockTime.textContent = `${String(hours).padStart(2, '0')}:${mins}:${secs}`;
  DOM.clockAmpm.textContent = ampm;

  // Date line
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  DOM.clockDate.textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

function startClock() {
  updateClock();
  if (state.clockInterval) clearInterval(state.clockInterval);
  state.clockInterval = setInterval(updateClock, 1000);
}

/* ════════════════════════════════════════════════════════
   WALLPAPER MANAGEMENT
   ════════════════════════════════════════════════════════ */
function updateFooterTheme() {
  if (!DOM.footerThemeName) return;
  if (state.mode === 'video') {
    DOM.footerThemeName.textContent = 'Video';
  } else if (state.mode === 'gif') {
    DOM.footerThemeName.textContent = 'GIF';
  } else {
    // Show category name (e.g. 'particles' -> 'Particles')
    DOM.footerThemeName.textContent = state.animationStyle || 'Canvas';
  }
}

function hideAllWallpapers() {
  DOM.videoEl.classList.add('hidden');
  DOM.gifEl.classList.add('hidden');
  DOM.canvas.classList.add('hidden');
  DOM.videoEl.pause();
}

function showVideoWallpaper(dataUrl) {
  hideAllWallpapers();

  // If we already have a blob URL in memory that's different from the new one, revoke it
  if (state.currentVideoUrl && state.currentVideoUrl !== dataUrl) {
    URL.revokeObjectURL(state.currentVideoUrl);
  }
  state.currentVideoUrl = dataUrl;

  DOM.videoEl.src = dataUrl;
  DOM.videoEl.classList.remove('hidden');
  DOM.videoEl.play().catch(() => { });

  updateFooterTheme();
}

function showGifWallpaper(dataUrl) {
  hideAllWallpapers();
  DOM.gifEl.src = dataUrl;
  DOM.gifEl.classList.remove('hidden');

  updateFooterTheme();
}

function showAnimationWallpaper(style) {
  hideAllWallpapers();
  DOM.canvas.classList.remove('hidden');

  // Destroy existing engine
  if (state.engine) {
    state.engine.destroy();
    state.engine = null;
  }

  // Paint static base first
  CanvasBackground.paint(DOM.canvas, style);

  // Create and start engine
  state.engine = new ParticleEngine(DOM.canvas);
  state.engine.init(style, state.reduceParticles);
  state.engine.start();

  updateFooterTheme();
}

function applyOverlayOpacity(value) {
  DOM.overlay.style.background = `rgba(0, 0, 0, ${value / 100})`;
}

/* ════════════════════════════════════════════════════════
   THEME MANAGEMENT
   ════════════════════════════════════════════════════════ */
function applyTheme(themeKey) {
  const theme = THEMES[themeKey];
  if (!theme) return;

  state.theme = themeKey;
  Store.set({ [STORAGE_KEYS.THEME]: themeKey });

  // Update overlay
  state.overlayOpacity = theme.overlay;
  DOM.overlayOpacity.value = theme.overlay;
  DOM.overlayOpacityVal.textContent = theme.overlay + '%';
  applyOverlayOpacity(theme.overlay);
  Store.set({ [STORAGE_KEYS.OVERLAY_OPACITY]: theme.overlay });

  // Apply CSS variables dynamically to body
  DOM.body.style.setProperty('--blur-md', theme.blur + 'px');
  DOM.body.style.setProperty('--color-primary', theme.accent);
  DOM.body.style.setProperty('--widget-opacity', theme.widgetOpacity);

  // Update widget styling immediately if they use widgetOpacity variable
  // For widgets, we rely on CSS var --widget-opacity which we will add in style.css

  // Visual feedback: highlight active theme card
  DOM.themeCards.forEach(card => {
    card.classList.toggle('active', card.dataset.theme === themeKey);
  });
}

/* ════════════════════════════════════════════════════════
   DISPLAY MODE
   ════════════════════════════════════════════════════════ */
function setDisplayMode(mode) {
  state.displayMode = mode;
  DOM.body.classList.toggle('mode-blur', mode === 'blur');
  DOM.modeFullscreen.classList.toggle('active', mode === 'fullscreen');
  DOM.modeBlur.classList.toggle('active', mode === 'blur');
  Store.set({ [STORAGE_KEYS.MODE]: mode });
}

/* ════════════════════════════════════════════════════════
   SETTINGS PANEL OPEN/CLOSE
   ════════════════════════════════════════════════════════ */
function openSettings() {
  DOM.settingsPanel.classList.add('open');
  DOM.settingsPanel.setAttribute('aria-hidden', 'false');
  DOM.settingsBackdrop.classList.remove('hidden');
}

function closeSettings() {
  DOM.settingsPanel.classList.remove('open');
  DOM.settingsPanel.setAttribute('aria-hidden', 'true');
  DOM.settingsBackdrop.classList.add('hidden');
}

/* ════════════════════════════════════════════════════════
   UPLOAD HANDLERS
   ════════════════════════════════════════════════════════ */
async function handleVideoUpload(file) {
  if (!file) return;
  if (!['video/mp4', 'video/webm'].includes(file.type)) {
    showToast('Please upload an MP4 or WebM file.', 'error');
    return;
  }

  // Calculate sizes in MB for display context
  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);

  // Check file size (max ~1GB)
  if (file.size > 1073741824) { // 1024 * 1024 * 1024 = 1GB
    showToast(`Video too large (${fileSizeMB} MB). Max allowed is 1024 MB.`, 'error');
    return;
  }

  // Warn if extremely large, but don't prevent saving
  if (file.size > 524288000) { // 500 MB
    showToast(`Large video (${fileSizeMB} MB) selected. This may take longer to load and use more memory.`, 'warning');
  }

  try {
    showToast('Saving video, please wait...', 'warning');

    // Make sure DB is initialized before using (in case the browser didn't call init yet)
    if (!VideoDB.db) {
      await VideoDB.init();
    }

    // Save directly to IndexedDB
    await VideoDB.saveVideo(file);

    // Save configuration settings
    await Store.set({ [STORAGE_KEYS.HAS_VIDEO]: true, [STORAGE_KEYS.WALLPAPER_TYPE]: 'video' });

    // Revoke any old video data URLs if they exist
    // Then set the video source via the new Blob URL
    const blobUrl = URL.createObjectURL(file);

    state.mode = 'video';
    showVideoWallpaper(blobUrl);

    // UI Updates
    DOM.videoUploadLabel.classList.add('has-file');
    DOM.videoUploadLabel.querySelector('span').textContent = `${file.name} (${fileSizeMB} MB)`;
    DOM.clearWallpaperBtn.classList.remove('hidden');
    showToast('Video wallpaper applied! 🎬', 'success');

  } catch (err) {
    showToast('Failed to save large video database.', 'error');
    console.error('LiveScape IndexedDB error:', err);
  }
}

function handleGifUpload(file) {
  if (!file) return;
  if (file.type !== 'image/gif') {
    showToast('Please upload a GIF file.', 'error');
    return;
  }

  if (file.size > 20_971_520) {
    showToast('GIF too large (max 20 MB).', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    try {
      await Store.set({ [STORAGE_KEYS.GIF_DATA_KEY]: dataUrl, [STORAGE_KEYS.WALLPAPER_TYPE]: 'gif' });
      state.mode = 'gif';
      showGifWallpaper(dataUrl);
      DOM.gifUploadLabel.classList.add('has-file');
      DOM.gifUploadLabel.querySelector('span').textContent = file.name;
      DOM.clearWallpaperBtn.classList.remove('hidden');
      showToast('GIF wallpaper applied! 🖼️', 'success');
    } catch (err) {
      showToast('Storage error – file may be too large.', 'error');
      console.error('LiveScape storage error:', err);
    }
  };
  reader.readAsDataURL(file);
}

async function clearWallpaper() {
  await Store.remove([STORAGE_KEYS.HAS_VIDEO, STORAGE_KEYS.GIF_DATA_KEY]);
  await Store.set({ [STORAGE_KEYS.WALLPAPER_TYPE]: 'animation' });

  try {
    if (VideoDB.db) {
      await VideoDB.deleteVideo();
    }
  } catch (e) {
    console.warn('Could not clear video from IndexedDB:', e);
  }

  // Revoke object URL from memory just in case we are abandoning a video
  if (state.currentVideoUrl) {
    URL.revokeObjectURL(state.currentVideoUrl);
    state.currentVideoUrl = null;
  }

  state.mode = 'animation';
  DOM.videoUploadLabel.classList.remove('has-file');
  DOM.videoUploadLabel.querySelector('span').textContent = 'Upload Video';
  DOM.gifUploadLabel.classList.remove('has-file');
  DOM.gifUploadLabel.querySelector('span').textContent = 'Upload GIF';
  DOM.clearWallpaperBtn.classList.add('hidden');

  // Reset radio
  document.getElementById('type-animation').checked = true;
  updateUploadUI('animation');

  showAnimationWallpaper(state.animationStyle);
  showToast('Wallpaper cleared.', 'success');
}

/* ════════════════════════════════════════════════════════
   UPLOAD UI TOGGLING
   ════════════════════════════════════════════════════════ */
function updateUploadUI(type) {
  DOM.uploadVideoArea.classList.toggle('hidden', type !== 'video');
  DOM.uploadGifArea.classList.toggle('hidden', type !== 'gif');
  DOM.animOptionsArea.classList.toggle('hidden', type !== 'animation');
}

/* ════════════════════════════════════════════════════════
   LAYOUT EXPORT / IMPORT
   ════════════════════════════════════════════════════════ */
async function exportLayout() {
  const allData = await Store.get(Object.values(STORAGE_KEYS));
  const dynamicWidgetsStr = allData[STORAGE_KEYS.DYNAMIC_WIDGETS] || '[]';
  const shortcutsStr = allData[STORAGE_KEYS.SHORTCUTS] || '[]';
  const positionsStr = allData[STORAGE_KEYS.WIDGET_POSITIONS] || '{}';
  const visibilityVal = allData[STORAGE_KEYS.WIDGET_VISIBILITY] || '{}';

  const layout = {
    version: "1.0.0",
    widgets: {
      dynamic: JSON.parse(typeof dynamicWidgetsStr === 'string' ? dynamicWidgetsStr : '[]'),
      positions: JSON.parse(typeof positionsStr === 'string' ? positionsStr : '{}')
    },
    shortcuts: JSON.parse(typeof shortcutsStr === 'string' ? shortcutsStr : '[]'),
    widgetFolders: [], // Placeholder if we expand folders
    settings: {
      mode: allData[STORAGE_KEYS.MODE],
      wallpaperType: allData[STORAGE_KEYS.WALLPAPER_TYPE],
      animationStyle: allData[STORAGE_KEYS.ANIMATION_STYLE],
      perfPause: allData[STORAGE_KEYS.PERF_PAUSE],
      reduceParticles: allData[STORAGE_KEYS.REDUCE_PARTICLES],
      showClock: allData[STORAGE_KEYS.SHOW_CLOCK],
      clock24h: allData[STORAGE_KEYS.CLOCK_24H],
      overlayOpacity: allData[STORAGE_KEYS.OVERLAY_OPACITY],
      autoRotate: allData[STORAGE_KEYS.AUTO_ROTATE],
      rotateInterval: allData[STORAGE_KEYS.ROTATE_INTERVAL],
      theme: allData[STORAGE_KEYS.THEME]
    },
    widgetVisibility: typeof visibilityVal === 'string' ? JSON.parse(visibilityVal) : visibilityVal
  };

  const json = JSON.stringify(layout, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'livescape-layout.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Layout exported successfully', 'success');
}

function importLayout(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const layout = JSON.parse(e.target.result);
      if (!layout.version || (!layout.settings && !layout.widgets)) {
        showToast('Invalid layout file', 'error');
        return;
      }

      if (confirm('Importing a layout will overwrite your current dashboard.\nContinue?')) {
        if (layout.version !== "1.0.0") {
          console.warn(`Importing layout from different version (File: ${layout.version}, Current: 1.0.0)`);
        }

        if (Array.isArray(layout.shortcuts)) {
          layout.shortcuts = layout.shortcuts.filter(sc =>
            typeof sc.name === 'string' &&
            typeof sc.url === 'string' &&
            isSafeUrl(sc.url)
          );
        } // SECURITY FIX: unsafe URLs in imported layout

        if (layout.settings?.overlayOpacity !== undefined) {
          layout.settings.overlayOpacity = Math.max(0, Math.min(80,
            Number(layout.settings.overlayOpacity) || 30));
        } // SECURITY FIX: Infinity/NaN in imported numeric values

        const updates = {};
        if (layout.widgets) {
          if (layout.widgets.dynamic) updates[STORAGE_KEYS.DYNAMIC_WIDGETS] = JSON.stringify(layout.widgets.dynamic);
          if (layout.widgets.positions) updates[STORAGE_KEYS.WIDGET_POSITIONS] = JSON.stringify(layout.widgets.positions);
        }
        if (layout.shortcuts) {
          updates[STORAGE_KEYS.SHORTCUTS] = JSON.stringify(layout.shortcuts);
        }
        if (layout.widgetVisibility) {
          updates[STORAGE_KEYS.WIDGET_VISIBILITY] = JSON.stringify(layout.widgetVisibility);
        }
        if (layout.settings) {
          if (layout.settings.mode !== undefined) updates[STORAGE_KEYS.MODE] = layout.settings.mode;

          const mapping = {
            wallpaperType: STORAGE_KEYS.WALLPAPER_TYPE,
            animationStyle: STORAGE_KEYS.ANIMATION_STYLE,
            perfPause: STORAGE_KEYS.PERF_PAUSE,
            reduceParticles: STORAGE_KEYS.REDUCE_PARTICLES,
            showClock: STORAGE_KEYS.SHOW_CLOCK,
            clock24h: STORAGE_KEYS.CLOCK_24H,
            overlayOpacity: STORAGE_KEYS.OVERLAY_OPACITY,
            autoRotate: STORAGE_KEYS.AUTO_ROTATE,
            rotateInterval: STORAGE_KEYS.ROTATE_INTERVAL,
            theme: STORAGE_KEYS.THEME
          };
          for (const [k, key] of Object.entries(mapping)) {
            if (layout.settings[k] !== undefined) updates[key] = layout.settings[k];
          }
        }

        await Store.set(updates);
        showToast('Layout imported successfully', 'success');

        // Reload to apply
        setTimeout(() => location.reload(), 1000);
      }
    } catch (err) {
      console.error(err);
      showToast('Invalid layout file', 'error');
    }
  };
  reader.readAsText(file);
  // Reset input
  if (DOM.layoutImportInput) DOM.layoutImportInput.value = '';
}

/* ════════════════════════════════════════════════════════
   PAGE VISIBILITY (PERFORMANCE)
   ════════════════════════════════════════════════════════ */
document.addEventListener('visibilitychange', () => {
  state.isVisible = document.visibilityState === 'visible';

  if (!state.perfPause) return;

  if (state.isVisible) {
    // Resume
    if (state.engine && !state.engine.running) state.engine.start();
    if (state.mode === 'video') DOM.videoEl.play().catch(() => { });
  } else {
    // Pause
    if (state.engine && state.engine.running) state.engine.stop();
    if (state.mode === 'video') DOM.videoEl.pause();
  }
});

/* ════════════════════════════════════════════════════════
   SHORTCUTS
   ════════════════════════════════════════════════════════ */
// Track the index being edited, -1 means creating a new shortcut
let _editingShortcutIndex = -1;
let _draggedShortcut = null;
let _shortcutPlaceholder = null;

function renderShortcuts(shortcuts) {
  if (!DOM.shortcutsContainer) return;
  DOM.shortcutsContainer.innerHTML = '';

  shortcuts.forEach((sc, index) => {
    const el = document.createElement('a');
    el.className = 'shortcut-item shortcut-custom';
    el.href = sc.url;
    el.target = '_blank';
    el.dataset.label = sc.name;

    // Generate dynamic favicon directly from Google's S2 API
    let domain = '';
    try {
      domain = new URL(sc.url).hostname;
    } catch (e) {
      domain = sc.url;
    }
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

    // Build element with safe static HTML first, then patch name fields
    el.innerHTML = `
      <div class="shortcut-icon" style="position: relative;">
        <img src="${faviconUrl}" class="shortcut-icon-img" alt="" />
        <span class="fallback-icon" style="display:none;font-size:1.2rem;font-weight:700;color:var(--color-primary)"></span>
        <div class="delete-shortcut-btn" title="Delete Shortcut" data-index="${index}">×</div>
      </div>
      <span class="shortcut-label"></span>
    `;
    el.querySelector('.fallback-icon').textContent = (sc.name || '?')[0].toUpperCase();
    el.querySelector('.shortcut-label').textContent = sc.name;
    // SECURITY FIX: XSS via sc.name in innerHTML

    // Strict CSP-compliant error handler for icon loading fallback
    const imgEl = el.querySelector('.shortcut-icon-img');
    const fallbackEl = el.querySelector('.fallback-icon');
    if (imgEl && fallbackEl) {
      imgEl.addEventListener('error', () => {
        imgEl.style.display = 'none';
        fallbackEl.style.display = 'block';
      });
    }

    // Overriding click functionality for Edit Mode
    el.addEventListener('click', (e) => {
      // 1. If clicking the delete button (visible only in edit mode), remove it
      if (e.target.classList.contains('delete-shortcut-btn')) {
        e.preventDefault();
        e.stopPropagation();
        deleteShortcut(index);
        return;
      }

      // 2. If edit mode is active, opening the app triggers the editor instead
      if (typeof WidgetManager !== 'undefined' && WidgetManager.isEditMode) {
        e.preventDefault();
        openEditShortcutModal(index, sc);
      }
    });

    // --- HTML5 Drag and Drop for Reordering ---
    el.draggable = true;

    el.addEventListener('dragstart', (e) => {
      if (typeof WidgetManager === 'undefined' || !WidgetManager.isEditMode) {
        e.preventDefault(); // Stop dragging natively if out of edit mode
        return;
      }
      e.stopPropagation(); // Shield from WidgetManager

      _draggedShortcut = el;
      el.classList.add('dragging');

      if (!_shortcutPlaceholder) {
        _shortcutPlaceholder = document.createElement('div');
        _shortcutPlaceholder.className = 'shortcut-placeholder';
      }

      e.dataTransfer.effectAllowed = 'move';
      // Firefox requires dataTransfer data explicitly set to allow dragging
      e.dataTransfer.setData('text/plain', sc.name);
    });

    el.addEventListener('dragover', (e) => {
      if (typeof WidgetManager === 'undefined' || !WidgetManager.isEditMode || !_draggedShortcut || _draggedShortcut === el) return;
      e.preventDefault(); // Must be prevented to allow dropping
      e.stopPropagation();

      const rect = el.getBoundingClientRect();
      const isPastCenter = (e.clientX - rect.left) > (rect.width / 2);

      if (isPastCenter) {
        el.parentNode.insertBefore(_shortcutPlaceholder, el.nextSibling);
      } else {
        el.parentNode.insertBefore(_shortcutPlaceholder, el);
      }
    });

    el.addEventListener('drop', (e) => {
      if (typeof WidgetManager === 'undefined' || !WidgetManager.isEditMode || !_draggedShortcut) return;
      e.preventDefault();
      e.stopPropagation();
    });

    el.addEventListener('dragend', (e) => {
      if (typeof WidgetManager === 'undefined' || !WidgetManager.isEditMode || !_draggedShortcut) return;
      e.stopPropagation();

      el.classList.remove('dragging');

      // Drop actual element into final placeholder spot
      if (_shortcutPlaceholder && _shortcutPlaceholder.parentNode) {
        _shortcutPlaceholder.parentNode.insertBefore(_draggedShortcut, _shortcutPlaceholder);
        _shortcutPlaceholder.remove();
      }

      _draggedShortcut = null;

      // Map new DOM order accurately back to array and persist
      const newArrayOrdered = [];
      const currentNodes = DOM.shortcutsContainer.querySelectorAll('.shortcut-item:not(.shortcut-add)');

      currentNodes.forEach(node => {
        const name = node.dataset.label;
        const url = node.href;
        const matchedObj = _customShortcuts.find(item => item.name === name && item.url === url);
        if (matchedObj) newArrayOrdered.push(matchedObj);
      });

      if (newArrayOrdered.length === _customShortcuts.length) {
        _customShortcuts = newArrayOrdered;
        saveAndRenderShortcuts(_customShortcuts);
      }
    });

    DOM.shortcutsContainer.appendChild(el);
  });
}

function openEditShortcutModal(index, sc) {
  _editingShortcutIndex = index;
  DOM.shortcutName.value = sc.name;
  DOM.shortcutUrl.value = sc.url;
  DOM.shortcutSave.textContent = 'Save Changes';
  DOM.shortcutModal.classList.remove('hidden');
  DOM.shortcutName.focus();
}

function deleteShortcut(index) {
  const removedName = _customShortcuts[index].name;
  _customShortcuts.splice(index, 1);
  saveAndRenderShortcuts(_customShortcuts);
  showToast(`"${removedName}" deleted`, 'success');
}

async function saveAndRenderShortcuts(shortcuts) {
  await Store.set({ [STORAGE_KEYS.SHORTCUTS]: JSON.stringify(shortcuts) });
  renderShortcuts(shortcuts);
}

let _customShortcuts = [];

const DEFAULT_SHORTCUTS = [
  { name: "Gmail", url: "https://gmail.com" },
  { name: "YouTube", url: "https://youtube.com" },
  { name: "Twitter", url: "https://twitter.com" },
  { name: "Instagram", url: "https://instagram.com" },
  { name: "Developer 1", url: "https://chanukyachintada.vercel.app" },
  { name: "Developer 2", url: "https://linkedin.com/in/sreecharan-lavudiya/" }
];

async function loadShortcuts() {
  const data = await Store.get([STORAGE_KEYS.SHORTCUTS]);

  if (!data[STORAGE_KEYS.SHORTCUTS]) {
    // Populate defaults if nothing is mapped
    _customShortcuts = [...DEFAULT_SHORTCUTS];
    await saveAndRenderShortcuts(_customShortcuts);
    return;
  }

  try {
    _customShortcuts = JSON.parse(data[STORAGE_KEYS.SHORTCUTS]);

    // Migrate old developer URLs to the new working links
    let updated = false;
    _customShortcuts.forEach(sc => {
      if (sc.name === "Developer 1" && (sc.url === "https://chanukya.xyz" || sc.url === "https://yourwebsite.com")) {
        sc.url = "https://chanukyachintada.vercel.app";
        updated = true;
      }
      if (sc.name === "Developer 2" && (sc.url === "https://chanukya.xyz" || sc.url === "https://yourwebsite.com")) {
        sc.url = "https://linkedin.com/in/sreecharan-lavudiya/";
        updated = true;
      }
    });

    if (updated) {
      await Store.set({ [STORAGE_KEYS.SHORTCUTS]: JSON.stringify(_customShortcuts) });
    }

  } catch {
    _customShortcuts = [...DEFAULT_SHORTCUTS];
  }
  renderShortcuts(_customShortcuts);
}

/* ════════════════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════════════════ */
let _toastTimer = null;

function showToast(message, type = '') {
  DOM.toast.textContent = message;
  DOM.toast.className = type ? `show ${type}` : 'show';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    DOM.toast.className = '';
  }, 2800);
}

/* ════════════════════════════════════════════════════════
   WALLPAPER AUTO-ROTATION ENGINE
   ════════════════════════════════════════════════════════ */
let _rotationQueue = [];  // flat shuffled list of all wallpapers across all categories

async function buildRotationQueue() {
  const catalog = await fetchWallpaperCatalog();
  if (!catalog || catalog.length === 0) return [];

  // Shuffle all wallpapers using Fisher-Yates
  const shuffled = [...catalog];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function startRotationTimer() {
  // Always clear any existing timer first
  if (state.rotateTimer) {
    clearInterval(state.rotateTimer);
    state.rotateTimer = null;
  }

  if (!state.autoRotate) return;

  // Build the initial rotation queue
  _rotationQueue = await buildRotationQueue();
  if (_rotationQueue.length === 0) {
    showToast('No wallpapers found in catalog for rotation.', 'error');
    return;
  }

  // Apply the very first wallpaper immediately on enable
  const first = _rotationQueue[state.rotateIndex % _rotationQueue.length];
  const firstUrl = chrome.runtime.getURL(`wallpapers/${first.folder}/${first.file}`);
  applyCategoryWallpaper(first, firstUrl);

  state.rotateTimer = setInterval(async () => {
    if (_rotationQueue.length === 0) {
      _rotationQueue = await buildRotationQueue();
      if (_rotationQueue.length === 0) return;
    }

    state.rotateIndex = (state.rotateIndex + 1) % _rotationQueue.length;

    // Reshuffle and restart when we've gone through the whole list
    if (state.rotateIndex === 0) {
      _rotationQueue = await buildRotationQueue();
    }

    const wp = _rotationQueue[state.rotateIndex];
    const url = chrome.runtime.getURL(`wallpapers/${wp.folder}/${wp.file}`);
    applyCategoryWallpaper(wp, url);
  }, state.rotateInterval);
}

function stopRotationTimer() {
  if (state.rotateTimer) {
    clearInterval(state.rotateTimer);
    state.rotateTimer = null;
  }
}

/* ════════════════════════════════════════════════════════
   CATEGORY WALLPAPER BROWSER
   ════════════════════════════════════════════════════════ */
let _wallpaperCatalog = null; // cached copy of wallpapers.json
let _activeWallpaperFile = null; // track what is currently set

async function fetchWallpaperCatalog() {
  if (_wallpaperCatalog) return _wallpaperCatalog;
  try {
    const url = chrome.runtime.getURL('wallpapers/wallpapers.json');
    const res = await fetch(url);
    _wallpaperCatalog = await res.json();
  } catch (e) {
    console.error('Failed to load wallpapers catalog:', e);
    _wallpaperCatalog = [];
  }
  return _wallpaperCatalog;
}

async function openCategoryModal(category) {
  const catalog = await fetchWallpaperCatalog();
  const items = catalog.filter(w => w.category === category);

  // Set modal title
  const titleEl = document.getElementById('category-modal-title');
  const countEl = document.getElementById('category-modal-count');
  const gridEl = document.getElementById('category-wallpaper-grid');

  titleEl.textContent = category.charAt(0).toUpperCase() + category.slice(1);
  countEl.textContent = items.length ? `${items.length} wallpaper${items.length === 1 ? '' : 's'}` : '';
  gridEl.innerHTML = '';

  if (items.length === 0) {
    gridEl.innerHTML = `
      <div class="category-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <p>No wallpapers in this category yet.<br>Add images to <code>wallpapers/${getFolderForCategory(catalog, category)}/</code></p>
      </div>`;
  } else {
    items.forEach(wp => {
      const thumb = document.createElement('div');
      thumb.className = 'wallpaper-thumb';
      const isActive = _activeWallpaperFile === wp.file;
      if (isActive) thumb.classList.add('active');

      const imgSrc = chrome.runtime.getURL(`wallpapers/${wp.folder}/${wp.file}`);

      thumb.innerHTML = `
        <img src="${imgSrc}" alt="" loading="lazy" />
        <div class="wallpaper-thumb-label"></div>
        <div class="wallpaper-thumb-active-badge">✓ Active</div>
      `;
      thumb.querySelector('.wallpaper-thumb-label').textContent = wp.name;
      // SECURITY FIX: XSS via wp.name in wallpaper thumbnail innerHTML

      thumb.addEventListener('click', () => {
        applyCategoryWallpaper(wp, imgSrc);
        closeCategoryModal();
      });

      gridEl.appendChild(thumb);
    });
  }

  document.getElementById('category-modal').classList.remove('hidden');
}

function getFolderForCategory(catalog, category) {
  const match = catalog.find(w => w.category === category);
  return match ? match.folder : category;
}

function closeCategoryModal() {
  document.getElementById('category-modal').classList.add('hidden');
}

function applyCategoryWallpaper(wp, resolvedUrl) {
  _activeWallpaperFile = wp.file;

  // Stop any existing wallpapers
  if (state.engine) {
    state.engine.stop();
    state.engine = null;
  }
  DOM.videoEl.pause();
  DOM.videoEl.src = '';
  DOM.videoEl.parentElement.classList.add('hidden');
  DOM.gifEl.src = '';
  DOM.gifEl.classList.add('hidden');
  DOM.canvas.classList.add('hidden');

  // Apply image as CSS background on the body overlay
  document.body.style.setProperty('--custom-wallpaper', `url("${resolvedUrl}")`);
  document.body.classList.add('custom-image-wallpaper');

  state.mode = 'image';
  state.animationStyle = '';

  // Update footer theme label
  if (DOM.footerThemeName) {
    DOM.footerThemeName.textContent = wp.name;
  }

  showToast(`"${wp.name}" applied ✨`, 'success');
}

/* ════════════════════════════════════════════════════════
   CATEGORY HANDLER (Demo – sets animation style by category theme)
   ════════════════════════════════════════════════════════ */
const CATEGORY_STYLES = {
  cyberpunk: 'particles',
  nature: 'aurora',
  space: 'nebula',
  anime: 'particles',
  cars: 'nebula',
  games: 'matrix',
  marvel: 'particles',
};

function handleCategory(category) {
  // Open the category wallpaper browser modal — user picks from real images
  openCategoryModal(category);
}

/* ════════════════════════════════════════════════════════
   WIDGET MANAGER (DRAG AND DROP)
   ════════════════════════════════════════════════════════ */
const WidgetManager = {
  isEditMode: false,
  positions: {}, // { "clock-widget": { x: 520, y: 180 }, ... }
  dragState: {
    el: null,
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  },
  resizeState: {
    el: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    minW: 0,
    minH: 0,
  },

  async init() {
    // 1. Load saved positions
    const data = await Store.get([STORAGE_KEYS.WIDGET_POSITIONS]);
    if (data[STORAGE_KEYS.WIDGET_POSITIONS]) {
      try {
        this.positions = JSON.parse(data[STORAGE_KEYS.WIDGET_POSITIONS]);
      } catch (e) {
        this.positions = {};
      }
    }

    // 2. Apply positions & bind drag events
    DOM.movableWidgets.forEach(widget => {
      const id = widget.id;
      if (this.positions[id]) {
        this.applyPosition(widget, this.positions[id].x, this.positions[id].y, this.positions[id].width, this.positions[id].height);
      }
      this.bindEvents(widget);
    });

    // 3. Bind bounds on resize to prevent elements falling off-screen
    window.addEventListener('resize', this.clampAll.bind(this));
  },

  applyPosition(el, x, y, width, height) {
    el.classList.add('is-absolute');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (width) el.style.width = `${width}px`;
    if (height) el.style.height = `${height}px`;
    // Clean up bottom/right tracking if we've switched modes
    el.style.bottom = 'auto';
    el.style.right = 'auto';
    el.style.transform = 'none'; // Overkill the flexbox translateX if any
  },

  bindEvents(widget) {
    widget.addEventListener('mousedown', (e) => this.onDragStart(e, widget));
    // Also support touch
    widget.addEventListener('touchstart', (e) => this.onDragStart(e, widget), { passive: false });
  },

  onDragStart(e, widget) {
    if (!this.isEditMode) return; // Prevent any grabbing unless explicitly in edit mode

    // Prevent drag if clicking the resize handle
    if (e.target.closest('.widget-resize-handle')) {
      return this.onResizeStart(e, widget);
    }

    // Prevent drag if clicking an interactive element
    const tagName = e.target.tagName.toLowerCase();
    if (['input', 'button', 'a'].includes(tagName) || e.target.closest('button, a, input')) {
      return;
    }

    // Capture start points
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    // Convert from flex layout offset to absolute if this is the first move
    const rect = widget.getBoundingClientRect();

    // Ensure the element snaps to absolute positioned bounds perfectly right where it sits
    this.applyPosition(widget, rect.left, rect.top);

    this.dragState = {
      el: widget,
      startX: clientX,
      startY: clientY,
      initX: rect.left,
      initY: rect.top
    };

    widget.classList.add('dragging');

    // Bind window-level move and end handlers securely
    this._onMove = this.onDragMove.bind(this);
    this._onEnd = this.onDragEnd.bind(this);

    window.addEventListener('mousemove', this._onMove, { passive: false });
    window.addEventListener('mouseup', this._onEnd);
    window.addEventListener('touchmove', this._onMove, { passive: false });
    window.addEventListener('touchend', this._onEnd);
  },

  onDragMove(e) {
    if (!this.dragState.el) return;
    e.preventDefault();

    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    const dx = clientX - this.dragState.startX;
    const dy = clientY - this.dragState.startY;

    let targetX = this.dragState.initX + dx;
    let targetY = this.dragState.initY + dy;

    // Viewport clamping math (prevent broken layouts off-screen)
    const rect = this.dragState.el.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    targetX = Math.max(0, Math.min(targetX, maxX));
    targetY = Math.max(0, Math.min(targetY, maxY));

    this.dragState.el.style.left = `${targetX}px`;
    this.dragState.el.style.top = `${targetY}px`;
  },

  onDragEnd(e) {
    if (!this.dragState.el) return;

    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('mouseup', this._onEnd);
    window.removeEventListener('touchmove', this._onMove);
    window.removeEventListener('touchend', this._onEnd);

    const el = this.dragState.el;
    el.classList.remove('dragging');

    // ── Snap-To-Grid After Final Position ──
    const GRID_SIZE = 20;

    // Use widget's current absolute layout offset Left/Top natively
    let snappedX = Math.round(el.offsetLeft / GRID_SIZE) * GRID_SIZE;
    let snappedY = Math.round(el.offsetTop / GRID_SIZE) * GRID_SIZE;

    // Viewport bound clamping (respecting widget dimensions accurately on snap)
    const maxW = window.innerWidth - el.offsetWidth;
    const maxH = window.innerHeight - el.offsetHeight;

    snappedX = Math.max(0, Math.min(snappedX, maxW));
    snappedY = Math.max(0, Math.min(snappedY, maxH));

    // Apply the mathematically snapped constraints
    el.style.left = `${snappedX}px`;
    el.style.top = `${snappedY}px`;

    // Save final validated position
    this.positions[el.id] = { ...this.positions[el.id], x: snappedX, y: snappedY, width: el.offsetWidth, height: el.offsetHeight };
    this.save();

    this.dragState.el = null;
  },

  onResizeStart(e, widget) {
    e.preventDefault();
    e.stopPropagation();

    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    const rect = widget.getBoundingClientRect();

    // Map min sizes based on widget ID
    let minW = 200, minH = 100;
    if (widget.id === 'clock-widget') { minW = 250; minH = 120; }
    else if (widget.id === 'search-widget') { minW = 350; minH = 80; }
    else if (widget.id === 'shortcuts-widget') { minW = 400; minH = 120; }

    this.resizeState = {
      el: widget,
      startX: clientX,
      startY: clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      minW,
      minH
    };

    this._onResMove = this.onResizeMove.bind(this);
    this._onResEnd = this.onResizeEnd.bind(this);

    window.addEventListener('mousemove', this._onResMove, { passive: false });
    window.addEventListener('mouseup', this._onResEnd);
    window.addEventListener('touchmove', this._onResMove, { passive: false });
    window.addEventListener('touchend', this._onResEnd);
  },

  onResizeMove(e) {
    if (!this.resizeState.el) return;
    if (this._resizeRAF) cancelAnimationFrame(this._resizeRAF);

    // Evaluate event coordinates synchronously
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    this._resizeRAF = requestAnimationFrame(() => {
      const dx = clientX - this.resizeState.startX;
      const dy = clientY - this.resizeState.startY;

      let newWidth = this.resizeState.startWidth + dx;
      let newHeight = this.resizeState.startHeight + dy;

      const el = this.resizeState.el;
      const rect = el.getBoundingClientRect();

      // Clamp max size to screen bounds constraints relative to widget's top left anchor
      const maxW = window.innerWidth - rect.left;
      const maxH = window.innerHeight - rect.top;

      newWidth = Math.max(this.resizeState.minW, Math.min(newWidth, maxW));
      newHeight = Math.max(this.resizeState.minH, Math.min(newHeight, maxH));

      el.style.width = `${newWidth}px`;
      el.style.height = `${newHeight}px`;
    });
  },

  onResizeEnd(e) {
    if (!this.resizeState.el) return;
    if (this._resizeRAF) cancelAnimationFrame(this._resizeRAF);

    window.removeEventListener('mousemove', this._onResMove);
    window.removeEventListener('mouseup', this._onResEnd);
    window.removeEventListener('touchmove', this._onResMove);
    window.removeEventListener('touchend', this._onResEnd);

    const el = this.resizeState.el;

    // Save final width/height along with current position
    const rect = el.getBoundingClientRect();
    this.positions[el.id] = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
    this.save();

    this.resizeState.el = null;
  },

  clampAll() {
    // If the window shrinks, snap widgets back into boundaries if they fall out
    const allWidgets = document.querySelectorAll('.movable-widget');
    allWidgets.forEach(widget => {
      if (widget.classList.contains('is-absolute')) {
        const rect = widget.getBoundingClientRect();
        let targetX = rect.left;
        let targetY = rect.top;

        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        let needsClamp = false;
        if (targetX < 0) { targetX = 0; needsClamp = true; }
        if (targetY < 0) { targetY = 0; needsClamp = true; }
        if (targetX > maxX) { targetX = maxX; needsClamp = true; }
        if (targetY > maxY) { targetY = maxY; needsClamp = true; }

        if (needsClamp && maxX > 0 && maxY > 0) {
          this.positions[widget.id] = { x: targetX, y: targetY };
          this.applyPosition(widget, targetX, targetY);
          this.save();
        }
      }
    });
  },

  async save() {
    await Store.set({ [STORAGE_KEYS.WIDGET_POSITIONS]: JSON.stringify(this.positions) });
  },

  async resetLayout() {
    this.positions = {};
    await Store.remove(STORAGE_KEYS.WIDGET_POSITIONS);

    // Strip classes and inline styles to return to vanilla CSS layout
    const allWidgets = document.querySelectorAll('.movable-widget');
    allWidgets.forEach(widget => {
      widget.classList.remove('is-absolute');
      widget.style.left = '';
      widget.style.top = '';
      widget.style.width = '';
      widget.style.height = '';
      widget.style.bottom = '';
      widget.style.right = '';
      widget.style.transform = '';
    });
    showToast('Layout reset', 'success');
  }
};

/* ════════════════════════════════════════════════════════
   INIT – LOAD SAVED STATE
   ════════════════════════════════════════════════════════ */
async function init() {
  // Load all settings from storage
  const data = await Store.get({
    [STORAGE_KEYS.MODE]: 'fullscreen',
    [STORAGE_KEYS.WALLPAPER_TYPE]: 'animation',
    [STORAGE_KEYS.ANIMATION_STYLE]: 'particles',
    [STORAGE_KEYS.PERF_PAUSE]: true,
    [STORAGE_KEYS.REDUCE_PARTICLES]: false,
    [STORAGE_KEYS.SHOW_CLOCK]: true,
    [STORAGE_KEYS.CLOCK_24H]: false,
    [STORAGE_KEYS.OVERLAY_OPACITY]: 30,
    [STORAGE_KEYS.HAS_VIDEO]: false,
    [STORAGE_KEYS.GIF_DATA_KEY]: null,
    [STORAGE_KEYS.AUTO_ROTATE]: false,
    [STORAGE_KEYS.ROTATE_INTERVAL]: 600000,
    [STORAGE_KEYS.DYNAMIC_WIDGETS]: '[]',
    [STORAGE_KEYS.WIDGET_VISIBILITY]: null,
    [STORAGE_KEYS.THEME]: null,
  });

  // Apply state
  state.displayMode = data[STORAGE_KEYS.MODE];
  state.mode = data[STORAGE_KEYS.WALLPAPER_TYPE];
  state.animationStyle = data[STORAGE_KEYS.ANIMATION_STYLE];
  state.perfPause = data[STORAGE_KEYS.PERF_PAUSE] !== false;
  state.reduceParticles = !!data[STORAGE_KEYS.REDUCE_PARTICLES];
  state.showClock = data[STORAGE_KEYS.SHOW_CLOCK] !== false;
  state.clock24h = !!data[STORAGE_KEYS.CLOCK_24H];
  state.overlayOpacity = Number(data[STORAGE_KEYS.OVERLAY_OPACITY]) || 30;

  const wv = data[STORAGE_KEYS.WIDGET_VISIBILITY];
  if (wv) {
    state.widgetVisibility = (typeof wv === 'string') ? JSON.parse(wv) : wv;
  }
  state.theme = data[STORAGE_KEYS.THEME];

  // ── Apply display mode ──
  DOM.body.classList.toggle('mode-blur', state.displayMode === 'blur');
  DOM.modeFullscreen.classList.toggle('active', state.displayMode === 'fullscreen');
  DOM.modeBlur.classList.toggle('active', state.displayMode === 'blur');

  // ── Apply clock settings ──
  DOM.clockSection.classList.toggle('hidden', !state.showClock);
  DOM.body.classList.toggle('clock-24h', state.clock24h);

  // ── Apply overlay opacity ──
  applyOverlayOpacity(state.overlayOpacity);
  DOM.overlayOpacity.value = state.overlayOpacity;
  DOM.overlayOpacityVal.textContent = state.overlayOpacity + '%';

  // ── Sync toggles ──
  DOM.togglePerf.checked = state.perfPause;
  DOM.toggleReduce.checked = state.reduceParticles;
  DOM.toggleClock.checked = state.showClock;
  DOM.toggle24h.checked = state.clock24h;

  // ── Sync Widget Visibility Toggles ──
  document.querySelectorAll('input[data-widget]').forEach(toggle => {
    const type = toggle.getAttribute('data-widget');
    if (typeof state.widgetVisibility[type] !== 'undefined') {
      toggle.checked = state.widgetVisibility[type];
    }
    toggle.addEventListener('change', (e) => {
      state.widgetVisibility[type] = e.target.checked;
      Store.set({ [STORAGE_KEYS.WIDGET_VISIBILITY]: JSON.stringify(state.widgetVisibility) });
      applyWidgetVisibility(type);
    });
  });

  // ── Restore auto-rotate settings ──
  state.autoRotate = !!data[STORAGE_KEYS.AUTO_ROTATE];
  state.rotateInterval = Number(data[STORAGE_KEYS.ROTATE_INTERVAL]) || 600000;
  DOM.toggleRotate.checked = state.autoRotate;
  DOM.rotateIntervalSelect.value = String(state.rotateInterval);
  DOM.rotateIntervalRow.classList.toggle('hidden', !state.autoRotate);
  if (state.autoRotate) startRotationTimer();

  // ── Sync radio ──
  const typeRadio = document.getElementById(`type-${state.mode}`);
  if (typeRadio) typeRadio.checked = true;
  updateUploadUI(state.mode);

  // ── Sync animation style buttons ──
  DOM.animStyleBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.style === state.animationStyle);
  });

  // Initialize DB ahead of time
  try {
    await VideoDB.init();
  } catch (e) {
    console.error('Failed to initialize VideoDB', e);
  }

  // ── Apply wallpaper ──
  const hasVideo = data[STORAGE_KEYS.HAS_VIDEO];
  const gifData = data[STORAGE_KEYS.GIF_DATA_KEY];

  if (state.mode === 'video' && hasVideo) {
    DOM.videoUploadLabel.classList.add('has-file');
    DOM.videoUploadLabel.querySelector('span').textContent = 'Loading video...';

    try {
      const blob = await VideoDB.getVideo();
      if (blob) {
        // Calculate sizes in MB for display context
        const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(1);
        const fileName = blob.name || 'Stored Video';

        const blobUrl = URL.createObjectURL(blob);
        showVideoWallpaper(blobUrl);

        DOM.videoUploadLabel.querySelector('span').textContent = `${fileName} (${fileSizeMB} MB)`;
        DOM.clearWallpaperBtn.classList.remove('hidden');
      } else {
        throw new Error('Video blob not found in IndexedDB');
      }
    } catch (err) {
      console.error('Failed to load video from IndexedDB:', err);
      // Fallback
      state.mode = 'animation';
      showAnimationWallpaper(state.animationStyle);
      DOM.videoUploadLabel.classList.remove('has-file');
      DOM.videoUploadLabel.querySelector('span').textContent = 'Upload Video';
      await Store.set({ [STORAGE_KEYS.WALLPAPER_TYPE]: 'animation', [STORAGE_KEYS.HAS_VIDEO]: false });
      showToast('Stored video lost. Defaulting to animation.', 'error');
    }
  } else if (state.mode === 'gif' && gifData) {
    showGifWallpaper(gifData);
    DOM.gifUploadLabel.classList.add('has-file');
    DOM.gifUploadLabel.querySelector('span').textContent = 'GIF loaded ✓';
    DOM.clearWallpaperBtn.classList.remove('hidden');
  } else {
    // Default to animation
    state.mode = 'animation';
    showAnimationWallpaper(state.animationStyle);
  }

  // ── Load custom dynamic widgets ──
  try {
    state.dynamicWidgets = JSON.parse(data[STORAGE_KEYS.DYNAMIC_WIDGETS] || '[]');
  } catch (e) {
    state.dynamicWidgets = [];
  }

  state.dynamicWidgets.forEach(w => {
    restoreDynamicWidget(w, true);
  });

  // ── Apply theme if set ──
  if (state.theme && THEMES[state.theme]) {
    applyTheme(state.theme);
  }

  // ── Load shortcuts ──
  await loadShortcuts();

  // ── Start clock ──
  startClock();

  // ── Init Movable Widgets ──
  await WidgetManager.init();

  // Run initial visibility map
  Object.keys(state.widgetVisibility).forEach(type => {
    applyWidgetVisibility(type);
  });

  // ── Bind events ──
  bindEvents();
}

/* ════════════════════════════════════════════════════════
   EVENT BINDING
   ════════════════════════════════════════════════════════ */
function bindEvents() {

  initWidgetLibrary();

  /* Footer Theme Click */
  DOM.footerTheme.addEventListener('click', () => {
    if (state.mode === 'video') {
      DOM.uploadVideoInput.click();
    } else if (state.mode === 'gif') {
      DOM.uploadGifInput.click();
    } else {
      openSettings();
    }
  });

  /* Settings panel toggle */
  DOM.settingsToggle.addEventListener('click', openSettings);
  DOM.settingsClose.addEventListener('click', closeSettings);
  DOM.settingsBackdrop.addEventListener('click', closeSettings);

  /* Category browser modal close */
  document.getElementById('category-modal-close').addEventListener('click', closeCategoryModal);
  document.getElementById('category-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCategoryModal();
  });

  /* Escape key closes settings + category modal */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSettings();
  });

  /* Display mode buttons */
  DOM.modeFullscreen.addEventListener('click', () => setDisplayMode('fullscreen'));
  DOM.modeBlur.addEventListener('click', () => setDisplayMode('blur'));

  /* Wallpaper type radios */
  DOM.typeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const type = radio.value;
      updateUploadUI(type);

      if (type === 'animation') {
        state.mode = 'animation';
        showAnimationWallpaper(state.animationStyle);
        Store.set({ [STORAGE_KEYS.WALLPAPER_TYPE]: 'animation' });
      }
    });
  });

  /* Video upload */
  DOM.uploadVideoInput.addEventListener('change', e => {
    handleVideoUpload(e.target.files[0]);
  });

  /* Drag-and-drop for video */
  DOM.uploadVideoArea.addEventListener('dragover', e => {
    e.preventDefault();
    DOM.uploadVideoArea.style.borderColor = 'var(--color-primary)';
  });
  DOM.uploadVideoArea.addEventListener('dragleave', () => {
    DOM.uploadVideoArea.style.borderColor = '';
  });
  DOM.uploadVideoArea.addEventListener('drop', e => {
    e.preventDefault();
    DOM.uploadVideoArea.style.borderColor = '';
    handleVideoUpload(e.dataTransfer.files[0]);
  });

  /* GIF upload */
  DOM.uploadGifInput.addEventListener('change', e => {
    handleGifUpload(e.target.files[0]);
  });

  /* Drag-and-drop for GIF */
  DOM.uploadGifArea.addEventListener('dragover', e => {
    e.preventDefault();
    DOM.uploadGifArea.style.borderColor = 'var(--color-primary)';
  });
  DOM.uploadGifArea.addEventListener('dragleave', () => {
    DOM.uploadGifArea.style.borderColor = '';
  });
  DOM.uploadGifArea.addEventListener('drop', e => {
    e.preventDefault();
    DOM.uploadGifArea.style.borderColor = '';
    handleGifUpload(e.dataTransfer.files[0]);
  });

  /* Animation style buttons */
  DOM.animStyleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.animStyleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const style = btn.dataset.style;
      state.animationStyle = style;
      Store.set({ [STORAGE_KEYS.ANIMATION_STYLE]: style });

      if (state.mode === 'animation') {
        showAnimationWallpaper(style);
      }
    });
  });

  /* Clear wallpaper */
  DOM.clearWallpaperBtn.addEventListener('click', clearWallpaper);

  /* Reset Layout */
  DOM.resetLayoutBtn.addEventListener('click', () => {
    WidgetManager.resetLayout();
  });

  /* Category buttons */
  DOM.categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.categoryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      handleCategory(btn.dataset.category);
    });
  });

  /* Theme cards */
  DOM.themeCards.forEach(card => {
    card.addEventListener('click', () => {
      applyTheme(card.dataset.theme);
    });
  });

  /* Layout Export / Import */
  if (DOM.exportLayoutBtn) {
    DOM.exportLayoutBtn.addEventListener('click', exportLayout);
  }
  if (DOM.importLayoutBtn) {
    DOM.importLayoutBtn.addEventListener('click', () => {
      DOM.layoutImportInput.click();
    });
  }
  if (DOM.layoutImportInput) {
    DOM.layoutImportInput.addEventListener('change', e => {
      if (e.target.files.length > 0) {
        importLayout(e.target.files[0]);
      }
    });
  }

  /* Performance toggles */
  DOM.togglePerf.addEventListener('change', () => {
    state.perfPause = DOM.togglePerf.checked;
    Store.set({ [STORAGE_KEYS.PERF_PAUSE]: state.perfPause });
  });

  DOM.toggleReduce.addEventListener('change', () => {
    state.reduceParticles = DOM.toggleReduce.checked;
    Store.set({ [STORAGE_KEYS.REDUCE_PARTICLES]: state.reduceParticles });
    if (state.engine) {
      state.engine.setReduced(state.reduceParticles);
    }
    showToast(state.reduceParticles ? 'Reduced particles on.' : 'Full particles on.');
  });

  DOM.toggleClock.addEventListener('change', () => {
    state.showClock = DOM.toggleClock.checked;
    DOM.clockSection.classList.toggle('hidden', !state.showClock);
    Store.set({ [STORAGE_KEYS.SHOW_CLOCK]: state.showClock });
  });

  DOM.toggle24h.addEventListener('change', () => {
    state.clock24h = DOM.toggle24h.checked;
    DOM.body.classList.toggle('clock-24h', state.clock24h);
    Store.set({ [STORAGE_KEYS.CLOCK_24H]: state.clock24h });
    updateClock();
  });

  /* Auto-rotate wallpapers */
  DOM.toggleRotate.addEventListener('change', () => {
    state.autoRotate = DOM.toggleRotate.checked;
    Store.set({ [STORAGE_KEYS.AUTO_ROTATE]: state.autoRotate });
    DOM.rotateIntervalRow.classList.toggle('hidden', !state.autoRotate);

    if (state.autoRotate) {
      startRotationTimer();
      showToast('Auto-rotation enabled 🔄', 'success');
    } else {
      stopRotationTimer();
      showToast('Auto-rotation disabled.', '');
    }
  });

  DOM.rotateIntervalSelect.addEventListener('change', () => {
    state.rotateInterval = Number(DOM.rotateIntervalSelect.value);
    Store.set({ [STORAGE_KEYS.ROTATE_INTERVAL]: state.rotateInterval });
    if (state.autoRotate) {
      startRotationTimer(); // Restart timer with the new interval
      showToast('Rotation interval updated.', 'success');
    }
  });

  /* Overlay opacity */
  DOM.overlayOpacity.addEventListener('input', () => {
    const val = Number(DOM.overlayOpacity.value);
    state.overlayOpacity = val;
    DOM.overlayOpacityVal.textContent = val + '%';
    applyOverlayOpacity(val);
  });

  DOM.overlayOpacity.addEventListener('change', () => {
    Store.set({ [STORAGE_KEYS.OVERLAY_OPACITY]: state.overlayOpacity });
  });

  /* ── Shortcuts modal ── */
  DOM.addShortcutBtn.addEventListener('click', () => {
    if (_customShortcuts.length >= 10) {
      showToast('Maximum of 10 shortcuts reached.', 'error');
      return;
    }

    // Reset to creation mode
    _editingShortcutIndex = -1;
    DOM.shortcutName.value = '';
    DOM.shortcutUrl.value = '';
    DOM.shortcutSave.textContent = 'Add Shortcut';

    DOM.shortcutModal.classList.remove('hidden');
    DOM.shortcutName.focus();
  });

  DOM.shortcutCancel.addEventListener('click', closeShortcutModal);
  DOM.shortcutModal.addEventListener('click', e => {
    if (e.target === DOM.shortcutModal) closeShortcutModal();
  });

  DOM.shortcutSave.addEventListener('click', saveShortcut);

  DOM.shortcutName.addEventListener('keydown', e => {
    if (e.key === 'Enter') DOM.shortcutUrl.focus();
  });

  DOM.shortcutUrl.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveShortcut();
  });

  /* Search form */
  DOM.searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && DOM.searchInput.value.trim()) {
      e.preventDefault();
      const q = DOM.searchInput.value.trim();
      // If it looks like a URL, navigate directly
      const isUrl = /^https?:\/\//.test(q) || /^www\./.test(q) || /\.[a-z]{2,}(\/|$)/.test(q);
      if (isUrl) {
        const url = q.startsWith('http') ? q : `https://${q}`;
        window.open(url, '_blank');
      } else {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank');
      }
    }
  });
}

/* ════════════════════════════════════════════════════════
   WIDGET LIBRARY SYSTEM
   ════════════════════════════════════════════════════════ */
function initWidgetLibrary() {
  DOM.openWidgetLibraryBtn.addEventListener('click', () => {
    DOM.widgetLibraryOverlay.classList.remove('hidden');
  });

  DOM.widgetLibraryCloseBtn.addEventListener('click', () => {
    DOM.widgetLibraryOverlay.classList.add('hidden');
  });

  DOM.widgetLibraryOverlay.addEventListener('click', (e) => {
    if (e.target === DOM.widgetLibraryOverlay) {
      DOM.widgetLibraryOverlay.classList.add('hidden');
    }
  });

  document.querySelectorAll('.add-widget-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const card = e.target.closest('.widget-card');
      if (!card) return;

      const type = card.dataset.widgetType;
      const config = AVAILABLE_WIDGETS[type];

      if (!config) return;
      if (typeof state.widgetVisibility[type] !== 'undefined' && !state.widgetVisibility[type]) return;

      // Enforce duplicate logic natively mapping unique boolean state flags
      if (config.unique) {
        const exists = state.dynamicWidgets.find(w => w.type === type);
        if (exists) {
          showToast(`Only one ${config.name} allows instance explicitly!`, 'error');
          return;
        }
      }

      const id = 'widget_' + type + '_' + Date.now();
      const defaultX = Math.max(100, window.innerWidth / 2 - 150);
      const defaultY = Math.max(100, window.innerHeight / 3);

      const widgetData = {
        id,
        type,
        x: defaultX,
        y: defaultY,
        width: 320,
        height: 200
      };

      state.dynamicWidgets.push(widgetData);
      await Store.set({ [STORAGE_KEYS.DYNAMIC_WIDGETS]: JSON.stringify(state.dynamicWidgets) });

      restoreDynamicWidget(widgetData);

      DOM.widgetLibraryOverlay.classList.add('hidden');
      showToast(`${config.name} added!`, 'success');
    });
  });
}

// ── Appends widget dynamically checking constraints ── //
function restoreDynamicWidget(w, isInitPhase = false) {
  const config = AVAILABLE_WIDGETS[w.type];
  if (!config) return;

  const el = document.createElement('div');
  el.id = w.id;
  el.dataset.widgetType = w.type;
  el.className = 'movable-widget custom-widget'; // Tag clearly separating structural custom ones

  const innerEl = config.create(w);
  el.resizeObserver = innerEl.resizeObserver || null; // SECURITY FIX: propagate observer reference from innerEl to outer el for cleanup
  el.appendChild(innerEl);

  const handle = document.createElement('div');
  handle.className = 'widget-resize-handle';
  el.appendChild(handle);

  if (w?.id) {
    el.dataset.widgetId = w.id;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'widget-remove-btn';
    removeBtn.innerHTML = '✕';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (el.resizeObserver) {
        el.resizeObserver.disconnect();
      } // SECURITY FIX: ResizeObserver memory leak on widget removal
      if (el.cleanup) el.cleanup();
      if (innerEl.cleanup) innerEl.cleanup();
      removeDynamicWidget(w.id);
      el.remove();
    });
    el.appendChild(removeBtn);
  }

  if (DOM.widgetLayer) {
    DOM.widgetLayer.appendChild(el);
  } else {
    DOM.body.appendChild(el);
  }

  // Track dynamically mapping via existing WidgetManager framework effortlessly
  WidgetManager.applyPosition(el, w.x, w.y, w.width, w.height);

  if (!isInitPhase) {
    WidgetManager.bindEvents(el);
  }

  // Reassign static variables keeping them accurate
  DOM.movableWidgets = document.querySelectorAll('.movable-widget');

  // Immediately apply visibility correctly enforcing toggles 
  applyWidgetVisibility(w.type);
}

function removeDynamicWidget(widgetId) {
  state.dynamicWidgets = state.dynamicWidgets.filter(w => w.id !== widgetId);
  Store.set({ [STORAGE_KEYS.DYNAMIC_WIDGETS]: JSON.stringify(state.dynamicWidgets) });
  DOM.movableWidgets = document.querySelectorAll('.movable-widget');
}

function applyWidgetVisibility(type) {
  const widgets = document.querySelectorAll(`.movable-widget[data-widget-type="${type}"]`);
  widgets.forEach(widget => {
    if (!state.widgetVisibility[type]) {
      widget.classList.add('widget-hidden');
    } else {
      widget.classList.remove('widget-hidden');
    }
  });
}

function createAnalogClockWidget() {
  const el = document.createElement('div');
  el.className = 'analog-clock-widget-container';
  el.style.width = '100%';
  el.style.height = '100%';
  el.style.display = 'flex';
  el.style.justifyContent = 'center';
  el.style.alignItems = 'center';
  el.style.position = 'relative';

  const canvas = document.createElement('canvas');
  canvas.className = 'analog-clock-canvas';
  el.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let animationFrameId;

  function drawClock() {
    // Memory leak protection - stop rendering if widget is destroyed/removed
    if (!document.body.contains(el)) {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      return;
    }

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h / 2;
    const radius = Math.min(centerX, centerY) * 0.9;

    // Draw Face
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    // Draw Center Dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.05, 0, 2 * Math.PI);
    ctx.fillStyle = 'var(--color-primary)';
    ctx.fill();

    const now = new Date();
    const hr = now.getHours();
    const min = now.getMinutes();
    const sec = now.getSeconds();

    // Draw Hands Helper
    function drawHand(pos, length, width, color) {
      ctx.beginPath();
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(pos) * length, centerY + Math.sin(pos) * length);
      ctx.stroke();
    }

    // Positions mapping math (offsetting -90 degrees)
    const hrPos = (hr % 12 + min / 60) * (Math.PI / 6) - (Math.PI / 2);
    const minPos = (min + sec / 60) * (Math.PI / 30) - (Math.PI / 2);
    const secPos = sec * (Math.PI / 30) - (Math.PI / 2);

    // Draw Hands
    drawHand(hrPos, radius * 0.5, 6, 'rgba(255,255,255,0.9)');
    drawHand(minPos, radius * 0.75, 4, 'rgba(255,255,255,0.7)');
    drawHand(secPos, radius * 0.85, 2, 'var(--color-primary)');

    // Sync to next second cleanly preventing drift instead of naive setInterval
    const msUntilNextSecond = 1000 - now.getMilliseconds();
    setTimeout(() => {
      animationFrameId = requestAnimationFrame(drawClock);
    }, msUntilNextSecond);
  }

  // Efficient Resizing Observer cleanly matching DPI bounds scaling logic
  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const rect = entry.contentRect;
      if (rect.width > 0 && rect.height > 0) {
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width;
          canvas.height = rect.height;
          // Initial trigger / forceful redraw mapping sync frame
          if (animationFrameId) cancelAnimationFrame(animationFrameId);
          drawClock();
        }
      }
    }
  });

  resizeObserver.observe(el);
  el.resizeObserver = resizeObserver;
  // SECURITY FIX: expose observer for cleanup on removal

  return el;
}

function createCalendarWidget() {
  const el = document.createElement('div');
  el.className = 'calendar-widget-container';

  const header = document.createElement('div');
  header.className = 'calendar-header';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'calendar-nav-btn';
  prevBtn.innerHTML = '&#10094;'; // <

  const title = document.createElement('a');
  title.className = 'calendar-title';
  title.href = 'https://calendar.google.com';
  title.target = '_blank';
  title.title = 'Open Google Calendar';

  const nextBtn = document.createElement('button');
  nextBtn.className = 'calendar-nav-btn';
  nextBtn.innerHTML = '&#10095;'; // >

  header.appendChild(prevBtn);
  header.appendChild(title);
  header.appendChild(nextBtn);

  const grid = document.createElement('div');
  grid.className = 'calendar-grid';

  el.appendChild(header);
  el.appendChild(grid);

  // State Management
  const today = new Date();
  let currentMonth = today.getMonth();
  let currentYear = today.getFullYear();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function renderCalendar() {
    title.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    grid.innerHTML = ''; // clear

    // Weekday headers
    weekdays.forEach(day => {
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-weekday';
      dayEl.textContent = day;
      grid.appendChild(dayEl);
    });

    // Days math
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Blank offsets mapping grid constraints flawlessly 
    for (let i = 0; i < firstDayIndex; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar-day empty';
      grid.appendChild(empty);
    }

    for (let i = 1; i <= lastDate; i++) {
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day';
      dayEl.textContent = i;

      // Today Highlighting matching real clock
      const realToday = new Date();
      if (i === realToday.getDate() && currentMonth === realToday.getMonth() && currentYear === realToday.getFullYear()) {
        dayEl.classList.add('calendar-today');
      }

      grid.appendChild(dayEl);
    }
  }

  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // prevent drag
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar();
  });

  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // prevent drag
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar();
  });

  // Base render
  renderCalendar();

  // Resize Observer for dynamic font-size relative scaling seamlessly
  const ro = new ResizeObserver(entries => {
    for (const entry of entries) {
      const w = entry.contentRect.width;
      const h = entry.contentRect.height;
      if (w > 0 && h > 0) {
        // Scale linearly avoiding overflow boundaries cleanly
        const minDimension = Math.min(w, h);
        el.style.fontSize = Math.max(10, minDimension * 0.05) + 'px';
      }
    }
  });
  ro.observe(el);
  el.resizeObserver = ro;
  // SECURITY FIX: expose observer for cleanup on removal

  return el;
}

function createWeatherWidget() {
  const el = document.createElement('div');
  el.className = 'weather-widget-container';

  const iconEl = document.createElement('div');
  iconEl.className = 'weather-icon';
  iconEl.textContent = '⏳';

  const tempEl = document.createElement('div');
  tempEl.className = 'weather-temp';
  tempEl.textContent = '--°C';

  const descEl = document.createElement('div');
  descEl.className = 'weather-description';
  descEl.textContent = 'Loading...';

  const locEl = document.createElement('div');
  locEl.className = 'weather-location';
  locEl.textContent = 'Fetching location...';

  el.appendChild(iconEl);
  el.appendChild(tempEl);
  el.appendChild(descEl);
  el.appendChild(locEl);

  const WEATHER_ICONS = {
    0: '☀️',
    1: '🌤', 2: '⛅', 3: '☁️',
    45: '🌫️', 48: '🌫️',
    51: '🌦️', 53: '🌦️', 55: '🌧️',
    61: '🌧', 63: '🌧', 65: '🌧',
    71: '❄️', 73: '❄️', 75: '❄️',
    95: '⛈', 96: '⛈', 99: '⛈'
  };

  const WEATHER_DESC = {
    0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing Rime Fog', 51: 'Light Drizzle', 53: 'Moderate Drizzle', 55: 'Dense Drizzle',
    61: 'Slight Rain', 63: 'Moderate Rain', 65: 'Heavy Rain', 71: 'Slight Snow', 73: 'Moderate Snow', 75: 'Heavy Snow',
    95: 'Thunderstorm', 96: 'Thunderstorm w/ Hail', 99: 'Heavy Thunderstorm'
  };

  let cachedCoords = null;

  async function fetchWeather() {
    if (!document.body.contains(el)) return;

    try {
      if (!cachedCoords) {
        try {
          // Fast, permissionless IP geolocation
          const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json', { cache: 'no-store' });
          if (!geoRes.ok) throw new Error('IP Geo failed');
          const geoData = await geoRes.json();
          cachedCoords = {
            lat: parseFloat(geoData.latitude),
            lon: parseFloat(geoData.longitude),
            city: geoData.city || 'Unknown Location'
          };
        } catch (ipErr) {
          // Native browser geolocation fallback with strict timeouts
          const pos = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Geolocation Timeout')), 4000);
            navigator.geolocation.getCurrentPosition(
              (p) => { clearTimeout(timer); resolve(p); },
              (e) => { clearTimeout(timer); reject(e); },
              { timeout: 4000, maximumAge: 3600000 }
            );
          });
          cachedCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        }
      }

      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${cachedCoords.lat}&longitude=${cachedCoords.lon}&current_weather=true`);
      if (!res.ok) throw new Error('API fetch failed');
      const data = await res.json();

      // Attempt reverse Geocoding only if city isn't cached from IP Geo
      if (!cachedCoords.city) {
        try {
          const revRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${cachedCoords.lat}&longitude=${cachedCoords.lon}&localityLanguage=en`);
          if (revRes.ok) {
            const revData = await revRes.json();
            cachedCoords.city = revData.city || revData.locality || 'Unknown Location';
          } else {
            cachedCoords.city = `Lat: ${cachedCoords.lat.toFixed(2)}, Lon: ${cachedCoords.lon.toFixed(2)}`;
          }
        } catch (e) {
          cachedCoords.city = `Lat: ${cachedCoords.lat.toFixed(2)}, Lon: ${cachedCoords.lon.toFixed(2)}`;
        }
      }

      locEl.textContent = cachedCoords.city;

      const cw = data.current_weather;
      tempEl.textContent = Math.round(cw.temperature) + '°C';

      const code = cw.weathercode;
      iconEl.textContent = WEATHER_ICONS[code] || '🌡️';
      descEl.textContent = WEATHER_DESC[code] || 'Unknown Weather';

    } catch (err) {
      console.error('Weather fetching error:', err);
      iconEl.textContent = '❌';
      descEl.textContent = 'Weather unavailable';
      tempEl.textContent = '--°C';
      if (!cachedCoords) {
        locEl.textContent = 'Location unavailable';
      }
    }
  }

  fetchWeather();
  const weatherInterval = setInterval(() => {
    if (!document.body.contains(el)) {
      clearInterval(weatherInterval);
    } else {
      fetchWeather();
    }
  }, 600000); // 10 minutes

  const ro = new ResizeObserver(entries => {
    for (const entry of entries) {
      const w = entry.contentRect.width;
      const h = entry.contentRect.height;
      if (w > 0 && h > 0) {
        const minDimension = Math.min(w, h);
        el.style.fontSize = Math.max(12, minDimension * 0.08) + 'px';
      }
    }
  });
  ro.observe(el);
  el.resizeObserver = ro;
  // SECURITY FIX: expose observer for cleanup on removal

  return el;
}

function createShortcutFolderWidget(w) {
  const el = document.createElement('div');
  el.className = 'shortcut-folder-widget-container';

  const header = document.createElement('div');
  header.className = 'folder-header';
  header.textContent = 'Shortcut Folder';

  const grid = document.createElement('div');
  grid.className = 'folder-grid';

  el.appendChild(header);
  el.appendChild(grid);

  let items = w?.items || [];

  function saveItems() {
    const idx = state.dynamicWidgets.findIndex(wid => wid.id === w.id);
    if (idx !== -1) {
      state.dynamicWidgets[idx].items = items;
      Store.set({ [STORAGE_KEYS.DYNAMIC_WIDGETS]: JSON.stringify(state.dynamicWidgets) });
    }
  }

  function renderItems() {
    grid.innerHTML = '';

    items.forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'folder-item';
      itemEl.dataset.index = index;

      const isEditMode = document.body.classList.contains('edit-mode');
      itemEl.draggable = isEditMode;

      const icon = document.createElement('img');
      icon.className = 'folder-item-icon';
      let domain = '';
      try { domain = new URL(item.url).hostname; } catch (e) { }
      icon.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      icon.onerror = () => {
        icon.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="10" stroke="white" stroke-width="2" fill="none"/></svg>';
      };

      const title = document.createElement('div');
      title.className = 'folder-item-title';
      title.textContent = item.name;

      itemEl.appendChild(icon);
      itemEl.appendChild(title);

      if (isEditMode) {
        const delBtn = document.createElement('div');
        delBtn.className = 'folder-item-del';
        delBtn.innerHTML = '×';
        delBtn.title = 'Delete Shortcut';
        delBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          items.splice(index, 1);
          saveItems();
          renderItems();
        });
        itemEl.appendChild(delBtn);
      }

      itemEl.addEventListener('dragstart', (e) => {
        if (!document.body.classList.contains('edit-mode')) return;
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', index);
        itemEl.classList.add('dragging');
      });

      itemEl.addEventListener('dragover', (e) => {
        if (!document.body.classList.contains('edit-mode')) return;
        e.stopPropagation();
        e.preventDefault();

        const draggingEl = grid.querySelector('.dragging');
        if (draggingEl && draggingEl !== itemEl) {
          const rect = itemEl.getBoundingClientRect();
          const offset = e.clientX - rect.left - rect.width / 2;
          if (offset > 0) {
            grid.insertBefore(draggingEl, itemEl.nextSibling);
          } else {
            grid.insertBefore(draggingEl, itemEl);
          }
        }
      });

      itemEl.addEventListener('drop', (e) => {
        if (!document.body.classList.contains('edit-mode')) return;
        e.stopPropagation();
        e.preventDefault();
      });

      itemEl.addEventListener('dragend', (e) => {
        if (!document.body.classList.contains('edit-mode')) return;
        e.stopPropagation();
        itemEl.classList.remove('dragging');

        const currentNodes = Array.from(grid.querySelectorAll('.folder-item:not(.folder-add-btn)'));
        const reordered = currentNodes.map(node => {
          const origIndex = parseInt(node.dataset.index, 10);
          return items[origIndex];
        });

        items = reordered.filter(Boolean);
        saveItems();
        renderItems();
      });

      grid.appendChild(itemEl);
    });

    if (document.body.classList.contains('edit-mode')) {
      const addBtn = document.createElement('div');
      addBtn.className = 'folder-item folder-add-btn';
      addBtn.innerHTML = '<div class="folder-add-icon">+</div><div class="folder-item-title">Add Shortcut</div>';

      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = prompt("Shortcut Name:");
        if (!name) return;
        const urlStr = prompt("Shortcut URL:");
        if (!urlStr) return;

        let url = urlStr;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        if (!isSafeUrl(url)) {
          alert('Invalid URL. Only http and https are allowed.');
          return;
        } // SECURITY FIX: javascript:/data: scheme injection in folder prompt

        items.push({ name, url });
        saveItems();
        renderItems();
      });

      grid.appendChild(addBtn);
    }
  }

  // Track edit mode toggles seamlessly to redraw standard/edit layouts
  const obs = new MutationObserver(() => {
    renderItems();
  });
  obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  renderItems();

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (document.body.classList.contains('edit-mode')) return;
    if (e.target.closest('.widget-resize-handle')) return; // ignore resize hooks purely mapped internally

    // Popup Modal Implementation (Isolated overlay)
    const overlay = document.createElement('div');
    overlay.className = 'folder-modal-overlay';

    const container = document.createElement('div');
    container.className = 'folder-modal-container';

    // Stop propagation so clicking inside container doesn't close overlay
    container.addEventListener('click', (ev) => ev.stopPropagation());

    const mHeader = document.createElement('div');
    mHeader.className = 'folder-modal-header';
    mHeader.innerHTML = `<h3>Shortcut Folder</h3><button class="folder-modal-close" aria-label="Close">×</button>`;

    const mGrid = document.createElement('div');
    mGrid.className = 'folder-modal-grid';

    items.forEach(item => {
      const a = document.createElement('a');
      a.className = 'folder-modal-item';
      a.href = item.url;
      a.target = '_blank';

      const icon = document.createElement('img');
      icon.className = 'folder-item-icon';
      try {
        icon.src = `https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}&sz=128`;
      } catch (err) { }
      icon.onerror = () => { icon.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="10" stroke="white" stroke-width="2" fill="none"/></svg>'; };

      const title = document.createElement('div');
      title.className = 'folder-item-title';
      title.textContent = item.name;

      a.appendChild(icon);
      a.appendChild(title);
      mGrid.appendChild(a);
    });

    container.appendChild(mHeader);
    container.appendChild(mGrid);
    overlay.appendChild(container);

    document.body.appendChild(overlay);

    const closeBtn = mHeader.querySelector('.folder-modal-close');
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        overlay.remove();
      }
    });
  });

  return el;
}

function createMusicWidget(w) {
  const el = document.createElement('div');
  el.className = 'music-widget-container';

  let service = w?.service || 'spotify';

  function saveService() {
    const idx = state.dynamicWidgets.findIndex(wid => wid.id === w?.id);
    if (idx !== -1) {
      state.dynamicWidgets[idx].service = service;
      Store.set({ [STORAGE_KEYS.DYNAMIC_WIDGETS]: JSON.stringify(state.dynamicWidgets) });
    }
  }

  const header = document.createElement('div');
  header.className = 'music-header';
  header.textContent = 'Music Player';

  const selector = document.createElement('div');
  selector.className = 'music-service-selector';

  const services = [
    { id: 'spotify', name: 'Spotify', embed: 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M', external: 'https://open.spotify.com' },
    { id: 'apple', name: 'Apple Music', embed: 'https://embed.music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb', external: 'https://music.apple.com' },
    { id: 'youtube', name: 'YouTube Music', embed: null, external: 'https://music.youtube.com' },
    { id: 'jiosaavn', name: 'JioSaavn', embed: null, external: 'https://www.jiosaavn.com' }
  ];

  const playerContainer = document.createElement('div');
  playerContainer.className = 'music-player';

  function renderPlayer() {
    playerContainer.innerHTML = '';
    const s = services.find(sv => sv.id === service);
    if (!s) return;

    if (s.embed) {
      const iframe = document.createElement('iframe');
      iframe.src = s.embed;
      iframe.width = "100%";
      iframe.height = "100%";
      iframe.frameBorder = "0";
      iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
      iframe.sandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";
      // SECURITY FIX: music iframes missing sandbox attribute
      iframe.loading = "lazy";
      playerContainer.appendChild(iframe);
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'music-fallback';
      fallback.innerHTML = `<div class="music-fallback-title">${s.name}</div><p>Embed not supported.</p>`;

      const btn = document.createElement('button');
      btn.className = 'music-launch-btn';
      btn.textContent = 'Open Player';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(s.external, '_blank');
      });

      fallback.appendChild(btn);
      playerContainer.appendChild(fallback);
    }
  }

  function renderSelector() {
    selector.innerHTML = '';
    services.forEach(s => {
      const btn = document.createElement('button');
      btn.className = `service-btn ${service === s.id ? 'active' : ''}`;
      btn.textContent = s.name;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (document.body.classList.contains('edit-mode')) return;
        service = s.id;
        saveService();
        renderSelector();
        renderPlayer();
      });
      selector.appendChild(btn);
    });
  }

  el.appendChild(header);
  el.appendChild(selector);
  el.appendChild(playerContainer);

  const ro = new ResizeObserver(() => {
    // Responsive scaling handled naturally via flex & iframe percentages,
    // but we can ensure minimum dimensions are strictly maintained
    if (el.offsetWidth < 300) el.style.minWidth = '300px';
    if (el.offsetHeight < 200) el.style.minHeight = '200px';
  });
  ro.observe(el);
  el.resizeObserver = ro;
  // SECURITY FIX: expose observer for cleanup on removal

  renderSelector();
  renderPlayer();

  return el;
}

function closeShortcutModal() {
  DOM.shortcutModal.classList.add('hidden');
  DOM.shortcutName.value = '';
  DOM.shortcutUrl.value = '';
  _editingShortcutIndex = -1;
}

async function saveShortcut() {
  const name = DOM.shortcutName.value.trim();
  let url = DOM.shortcutUrl.value.trim();

  if (!name || !url) {
    showToast('Please fill in both fields.', 'error');
    return;
  }

  if (!url.startsWith('http')) url = 'https://' + url;
  if (!isSafeUrl(url)) {
    showToast('Invalid URL. Only http and https are allowed.', 'error');
    return;
  } // SECURITY FIX: javascript:/data: scheme injection

  if (_editingShortcutIndex !== -1) {
    // Edit existing shortcut
    _customShortcuts[_editingShortcutIndex] = { name, url };
    showToast(`"${name}" updated!`, 'success');
  } else {
    // Create new shortcut
    _customShortcuts.push({ name, url });
    showToast(`"${name}" shortcut added! 🔗`, 'success');
  }

  await saveAndRenderShortcuts(_customShortcuts);
  closeShortcutModal();
}

/* ════════════════════════════════════════════════════════
   KICK OFF
   ════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", function () {
  const editBtn = document.getElementById("edit-layout-btn");

  if (!editBtn) {
    console.error("Edit layout button not found in DOM");
  } else {
    editBtn.addEventListener("click", toggleEditMode);
  }

  init();
});

function toggleEditMode() {
  const body = document.body;
  const btn = document.getElementById("edit-layout-btn");

  body.classList.toggle("edit-mode");

  if (body.classList.contains("edit-mode")) {
    btn.textContent = "✓";
    btn.setAttribute("title", "Save Layout");
    WidgetManager.isEditMode = true;
    showToast("Edit Mode Active", "success");
  } else {
    btn.textContent = "+";
    btn.setAttribute("title", "Edit Widget Layout");
    WidgetManager.isEditMode = false;
    WidgetManager.save();
    showToast("Layout Saved", "success");
  }
}
