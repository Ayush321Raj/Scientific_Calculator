# 🧮 Smart Scientific Calculator

**Fast • Accurate • Modern**

A fully responsive, premium-looking Scientific Calculator web application built with pure HTML5, CSS3, and Vanilla JavaScript (ES6).

---

## ✨ Features

### Calculator Modes
| Feature | Basic | Scientific |
|---|---|---|
| Arithmetic (+, −, ×, ÷) | ✅ | ✅ |
| Percentage, Sign toggle | ✅ | ✅ |
| Square, Square Root | ✅ | ✅ |
| Backspace, Clear, AC | ✅ | ✅ |
| sin, cos, tan (+ inverses) | — | ✅ |
| log, ln, exp, 10ˣ, eˣ | — | ✅ |
| √, ∛, x², x³, xʸ | — | ✅ |
| abs, factorial, mod | — | ✅ |
| π, e, Random, Round, Floor, Ceil | — | ✅ |
| Memory (MC/MR/MS/M+/M−) | — | ✅ |
| DEG / RAD toggle | — | ✅ |

### UI & Design
- 🎨 **7 Themes**: Dark, Light, Cyberpunk, Ocean, Sunset, Forest, Midnight
- 🌊 Animated gradient background with floating blobs
- 🔮 Glassmorphism + Neumorphism styling
- 💫 Button ripple, glow, hover & scale effects
- 📱 Fully responsive (mobile / tablet / desktop)

### History & Stats
- 📜 Full calculation history with timestamps
- 🔍 Search within history
- 📌 Pin important calculations
- 🗑️ Delete individual entries or clear all
- 📤 Export history as `.txt` file
- 📊 Live statistics: count, average, max, min

### Other
- ⌨️ Full keyboard support (0–9, operators, Enter, Backspace, Escape)
- 🔊 Optional click sound (Web Audio API)
- 💾 LocalStorage: theme, mode, history, memory, sound preference
- 🕐 Live date & time clock
- ♿ ARIA labels, visible focus states, screen-reader friendly
- 🎮 Floating Action Button (FAB) with quick Clear, Copy, Tips
- 🍞 Animated toast notifications (no browser alerts)
- 💡 Tips modal

---

## 📁 Folder Structure

```
Scientific_Calculator/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── script.js
├── assets/
│   ├── icons/
│   └── sounds/
└── README.md
```

---

## 🚀 Getting Started

1. Clone or download the project
2. Open `index.html` in any modern browser
3. No installation, no build step, no server required

```bash
# Or serve locally
npx serve .
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `0–9` | Digits |
| `+` `-` `*` `/` | Operators |
| `.` | Decimal |
| `Enter` or `=` | Evaluate |
| `Backspace` | Delete last digit |
| `Delete` / `Escape` | All Clear |
| `%` | Percentage |

---

## 🏗️ Architecture

The JavaScript is split into six clean modules all contained in `script.js`:

| Module | Responsibility |
|---|---|
| `State` | Single source of truth + LocalStorage persistence |
| `MathEngine` | Pure math: safe eval, scientific functions, formatting |
| `AudioEngine` | Web Audio API click sounds |
| `HistoryManager` | CRUD for calculation history |
| `Calculator` | Core calculator state machine (input, operators, evaluate) |
| `UI` | All DOM manipulation & rendering |
| `EventManager` | All event bindings (buttons, keyboard, FAB, history) |
| `App` | Bootstrap / init sequence |

---

## 🖼️ Themes Preview

| Theme | Colors |
|---|---|
| Dark | Purple → Indigo → Navy |
| Light | Lavender → Mint → Rose |
| Cyberpunk | Black → Magenta → Cyan |
| Ocean | Deep Navy → Teal |
| Sunset | Dark Blue → Orange → Pink |
| Forest | Dark → Deep Green |
| Midnight | Pure Black → Indigo |

---

## 📦 Technology Stack

- **HTML5** – Semantic markup, ARIA accessibility
- **CSS3** – Custom properties, Grid, Flexbox, animations, glassmorphism
- **Vanilla JavaScript ES6** – Modules pattern, closures, no frameworks

---

## 📄 License

MIT — free for personal and commercial use.

---

*Version 1.0 · Created with ❤️*
