<div align="center">

<img src="assets/icons/icon128.png" alt="LiveScape Logo" width="100"/>

# 🌿 LiveScape

**Transform your browser's new tab into a dynamic, interactive dashboard.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-v0.3.6-blue.svg)](manifest.json)
[![Platform](https://img.shields.io/badge/platform-Chrome-yellow.svg)](https://www.google.com/chrome/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#-contributing)
[![Made with JS](https://img.shields.io/badge/built%20with-JavaScript%20%7C%20CSS%20%7C%20HTML-orange.svg)](#)

</div>

---

## 📖 What is LiveScape?

**LiveScape** is a customizable browser New Tab extension that transforms your default browser start page into a **dynamic, interactive dashboard**.

It combines **live wallpapers**, **movable widgets**, **customizable shortcuts**, and a **modern glassmorphism interface** to create a visually rich and productivity-focused browsing experience. Users can personalize their dashboard with animated wallpapers, drag-and-drop widgets, shortcut folders, and useful tools like weather forecasts, calendars, clocks, and music players.

LiveScape is designed to be **lightweight, flexible, and fully customizable** while maintaining smooth performance — similar to dashboard-style productivity tools, but living right inside your browser.

---

## ✨ Features

### 🎬 Live Wallpapers
- Support for **Video**, **GIF**, and **Canvas-based** animated wallpapers
- Wallpaper **categories** for organized browsing
- **Auto-rotation** to cycle through wallpapers automatically

### 🧩 Widget System
- **Movable and resizable** widgets — drag them anywhere on the screen
- **Widget Library** to add, remove, and manage widgets on demand
- Widget layout and positions persist across sessions via local storage

### 🕐 Analog Clock Widget
- Classic analog clock rendered directly on the dashboard

### 📅 Calendar Widget
- Interactive calendar widget displayed on the new tab page

### 🌤️ Weather Widget
- Live weather information displayed as a draggable dashboard widget

### 🎵 Music Player Widget
- Built-in music player widget for ambient listening while browsing

### 🔗 Shortcut Management
- Add, edit, and remove **custom website shortcuts**
- **Shortcut Folder System** to group and organize your links
- Full **drag-and-drop** reordering of shortcuts and folders

### 📐 Snap-to-Grid Layout
- **Snap-to-grid** system for precise widget and shortcut alignment
- **Layout reset** option to restore default positioning instantly

### 🎨 Glassmorphism UI
- Modern **glassmorphism design language** throughout the entire interface
- Frosted glass panels, soft shadows, and translucent overlays

### 💾 Local Storage
- All preferences, layouts, and settings stored **locally in your browser**
- No account required — completely offline-capable

---

## 📸 Screenshots

> _Have a great screenshot? Open a PR and add it here!_

| Dashboard | Widgets | Wallpaper Selection |
|:-:|:-:|:-:|
| ![Dashboard](assets/screenshots/dashboard.png) | ![Widgets](assets/screenshots/widgets.png) | ![Wallpapers](assets/screenshots/wallpapers.png) |

---

## 🚀 Installation

LiveScape is not yet on the Chrome Web Store. Install it manually in just a few steps:

**1. Clone or download the repository:**

```bash
git clone https://github.com/chanukyachintada06/LiveScape.git
```

Or click **Code → Download ZIP** on the [repository page](https://github.com/chanukyachintada06/LiveScape) and extract it.

**2. Open Chrome and navigate to:**

```
chrome://extensions
```

**3. Enable Developer Mode** using the toggle in the top-right corner.

**4. Click "Load Unpacked"** and select the extracted `LiveScape` folder.

**5. Open a new tab** — LiveScape is now live! 🎉

> ⚠️ After updating source files, click the **refresh icon** on the extension card at `chrome://extensions` to reload your changes.

---

## 📁 Project Structure

```
LiveScape/
│
├── animations/          # Canvas & CSS animation engines for live wallpapers
│
├── assets/
│   └── icons/           # Extension icons (16px, 48px, 128px)
│
├── wallpapers/          # Bundled wallpaper assets (video, GIF, static images)
│
├── newtab.html          # New tab page — the main UI entry point
├── script.js            # Core JS — widgets, drag/drop, shortcuts, storage logic
├── style.css            # Global styles — glassmorphism, layout, theming
├── manifest.json        # Chrome Extension manifest — permissions, version, config
│
├── privacy.html         # In-extension privacy policy page
├── PRIVACY.md           # Privacy policy (Markdown format)
│
└── README.md            # Project documentation
```

### File Roles at a Glance

| File / Folder | Role |
|---|---|
| `newtab.html` | The HTML page Chrome loads on every new tab. Contains the full UI structure: wallpaper layer, widget containers, shortcut grid, and modal hooks. |
| `script.js` | The brain of LiveScape. Handles widget drag/resize, shortcut management, wallpaper switching, snap-to-grid, and local storage persistence. |
| `style.css` | All visual styling — glassmorphism panels, widget layouts, animation layers, and responsive rules. |
| `manifest.json` | Chrome extension config — declares the `chrome_url_overrides` for new tab, icon paths, permissions, and current version. |
| `animations/` | Animation scripts and definitions powering live canvas and CSS wallpaper effects. |
| `wallpapers/` | Locally bundled wallpaper files served without any external network requests. |

---

## 🛣️ Roadmap

LiveScape is actively in development. Here's what's planned:

| Status | Version | Feature |
|--------|---------|---------|
| 🔜 Next Up | v0.4.01 | Settings Panel |
| 🔜 Next Up | v0.4.01 | Widget Visibility Controls |
| 📋 Planned | Future | Theme Presets |
| 📋 Planned | Future | Import / Export Layout |
| 📋 Planned | Future | Performance Optimizations |
| 📋 Planned | Future | Chrome Web Store Release |

---

## 🤝 Contributing

LiveScape is fully open source and **all contributions are welcome** — bug reports, feature ideas, code, design improvements, new wallpapers, or documentation fixes.

### How to Contribute

1. **Fork** this repository
2. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** and commit them:
   ```bash
   git commit -m "feat: describe what you added or fixed"
   ```
4. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
5. **Open a Pull Request** — describe your changes clearly and it'll be reviewed promptly!

### Ideas for Contributions
- 🔧 Fix a bug or implement a roadmap feature
- 🖼️ Submit new wallpaper or animation presets
- 🧩 Build a new widget type
- ♿ Improve accessibility
- 📝 Improve documentation or add screenshots
- 🌐 Help port LiveScape to Firefox

---

## 🔒 Privacy Policy

LiveScape is built with privacy as a core principle:

- ✅ All user data (settings, shortcuts, layouts) stored **locally** in `localStorage` / `chrome.storage`
- ✅ **No data collected**, transmitted, or sent to any server — ever
- ✅ **No analytics, no telemetry, no tracking** of any kind
- ✅ All wallpapers and assets are **bundled locally** — no external network requests at runtime
- ✅ Only the minimum permissions declared in `manifest.json` are requested

Full policy: [`PRIVACY.md`](PRIVACY.md)

---

## 📦 Current Version

```
LiveScape v0.3.6
```

> ⚡ Settings system and widget visibility controls are arriving in **v0.4.01**

---

## 📄 License

This project is open source under the **[MIT License](LICENSE)**.

You are free to **use, copy, modify, merge, publish, distribute, sublicense, and/or sell** copies of this software. See [`LICENSE`](LICENSE) for the full terms.

---

<div align="center">

Made with ❤️ by [chanukyachintada06](https://github.com/chanukyachintada06)

⭐ **Star this repo if you find LiveScape useful — it means a lot!**

[Report a Bug](https://github.com/chanukyachintada06/LiveScape/issues) · [Request a Feature](https://github.com/chanukyachintada06/LiveScape/issues) · [Submit a PR](https://github.com/chanukyachintada06/LiveScape/pulls)

</div>
