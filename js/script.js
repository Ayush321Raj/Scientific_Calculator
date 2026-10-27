/**
 * Smart Scientific Calculator – script.js
 * Modular ES6 Vanilla JS — no external libraries
 */

/* ============================================================
   1. STATE
   ============================================================ */
const State = (() => {
  const defaults = {
    theme:        'dark',
    mode:         'basic',       // 'basic' | 'scientific'
    angleDeg:     true,          // true = degrees, false = radians
    sound:        true,
    memory:       0,
    history:      [],            // [{id, expr, result, time, pinned}]
    expression:   '',
    result:       '0',
    pendingOp:    null,          // for sequential basic ops
    pendingVal:   null,
    freshResult:  false,         // after pressing =, next digit starts fresh
    awaitingPow:  false,         // waiting for exponent input for xʸ
    pendingPowBase: null,
  };

  let s = Object.assign({}, defaults);

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem('calc_state') || '{}');
      if (saved.theme)   s.theme   = saved.theme;
      if (saved.mode)    s.mode    = saved.mode;
      if (typeof saved.angleDeg === 'boolean') s.angleDeg = saved.angleDeg;
      if (typeof saved.sound    === 'boolean') s.sound    = saved.sound;
      if (typeof saved.memory   === 'number')  s.memory   = saved.memory;
      if (Array.isArray(saved.history)) s.history = saved.history;
    } catch (e) { /* ignore */ }
  }

  function persist() {
    try {
      localStorage.setItem('calc_state', JSON.stringify({
        theme: s.theme, mode: s.mode, angleDeg: s.angleDeg,
        sound: s.sound, memory: s.memory, history: s.history,
      }));
    } catch (e) { /* ignore */ }
  }

  function get(key)        { return s[key]; }
  function set(key, val)   { s[key] = val; persist(); }
  function getAll()        { return s; }

  return { load, persist, get, set, getAll };
})();

/* ============================================================
   2. MATH ENGINE
   ============================================================ */
const MathEngine = (() => {

  /** Convert value between degrees and radians for trig */
  function toRad(val, angleDeg) { return angleDeg ? (val * Math.PI / 180) : val; }
  function toDeg(val, angleDeg) { return angleDeg ? (val * 180 / Math.PI) : val; }

  /** Safely parse expression – only allow safe chars */
  function safeEval(expr) {
    const sanitized = expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/π/g, '(' + Math.PI + ')')
      .replace(/\^/g, '**');

    if (!/^[0-9+\-*/().%e\s]*$/.test(sanitized)) return null;
    // eslint-disable-next-line no-new-func
    return Function('"use strict"; return (' + sanitized + ')')();
  }

  function factorial(n) {
    n = Math.floor(n);
    if (n < 0)  throw new Error('Negative factorial');
    if (n > 170) throw new Error('Too large for factorial');
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  /**
   * Apply a scientific operation to currentVal (the current display number).
   * Returns the new value or throws.
   */
  function applyScientific(action, currentVal, angleDeg) {
    const v = parseFloat(currentVal);
    if (isNaN(v)) throw new Error('Invalid input');

    switch (action) {
      case 'sin':   return Math.sin(toRad(v, angleDeg));
      case 'cos':   return Math.cos(toRad(v, angleDeg));
      case 'tan': {
        const r = toRad(v, angleDeg);
        // tan(90°) is undefined
        if (angleDeg && Math.abs(v % 180) === 90) throw new Error('Undefined');
        return Math.tan(r);
      }
      case 'asin': {
        if (v < -1 || v > 1) throw new Error('Domain error');
        return toDeg(Math.asin(v), angleDeg);
      }
      case 'acos': {
        if (v < -1 || v > 1) throw new Error('Domain error');
        return toDeg(Math.acos(v), angleDeg);
      }
      case 'atan':  return toDeg(Math.atan(v), angleDeg);
      case 'log': {
        if (v <= 0) throw new Error('log of non-positive');
        return Math.log10(v);
      }
      case 'ln': {
        if (v <= 0) throw new Error('ln of non-positive');
        return Math.log(v);
      }
      case 'exp':   return Math.exp(v);
      case 'tenx':  return Math.pow(10, v);
      case 'sqrt': {
        if (v < 0) throw new Error('Square root of negative');
        return Math.sqrt(v);
      }
      case 'cbrt':  return Math.cbrt(v);
      case 'x2':    return v * v;
      case 'x3':    return v * v * v;
      case 'abs':   return Math.abs(v);
      case 'fact':  return factorial(v);
      case 'pi':    return Math.PI;
      case 'euler': return Math.E;
      case 'rand':  return Math.random();
      case 'round': return Math.round(v);
      case 'floor': return Math.floor(v);
      case 'ceil':  return Math.ceil(v);
      default: throw new Error('Unknown function: ' + action);
    }
  }

  /** Format result: trim floating point noise, max 10 significant digits */
  function formatResult(val) {
    if (!isFinite(val)) return val > 0 ? 'Infinity' : '-Infinity';
    if (isNaN(val)) return 'NaN';
    // Round to eliminate floating-point noise at ~12th digit
    const rounded = parseFloat(val.toPrecision(12));
    // Use toPrecision for display but remove trailing zeros
    const str = String(rounded);
    if (str.length > 14) return val.toExponential(6);
    return str;
  }

  return { applyScientific, safeEval, factorial, formatResult };
})();

/* ============================================================
   3. AUDIO ENGINE
   ============================================================ */
const AudioEngine = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function playClick(type = 'num') {
    if (!State.get('sound')) return;
    try {
      const ac = getCtx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      const freq = type === 'eq' ? 880 : type === 'op' ? 660 : 440;
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(.12, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, ac.currentTime + .12);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + .12);
    } catch (e) { /* silently fail */ }
  }

  return { playClick };
})();

/* ============================================================
   4. HISTORY MANAGER
   ============================================================ */
const HistoryManager = (() => {
  let idCounter = Date.now();

  function add(expr, result) {
    const entry = {
      id: ++idCounter,
      expr,
      result,
      time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      pinned: false,
    };
    const history = State.get('history');
    history.unshift(entry);
    // Cap at 200 entries (preserve pinned)
    if (history.length > 200) {
      // findLastIndex polyfill for broader browser support
      let idx = -1;
      for (let i = history.length - 1; i >= 0; i--) {
        if (!history[i].pinned) { idx = i; break; }
      }
      if (idx !== -1) history.splice(idx, 1);
    }
    State.set('history', history);
    UI.renderHistory();
    UI.updateStats();
  }

  function remove(id) {
    State.set('history', State.get('history').filter(h => h.id !== id));
    UI.renderHistory();
    UI.updateStats();
  }

  function clearAll() {
    State.set('history', []);
    UI.renderHistory();
    UI.updateStats();
  }

  function togglePin(id) {
    const history = State.get('history');
    const item = history.find(h => h.id === id);
    if (item) item.pinned = !item.pinned;
    State.set('history', history);
    UI.renderHistory();
  }

  function exportTxt() {
    const history = State.get('history');
    if (!history.length) { UI.showToast('No history to export'); return; }
    const lines = history.map(h => `[${h.time}] ${h.expr} = ${h.result}`).join('\n');
    const blob = new Blob([lines], {type: 'text/plain'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'calculator_history.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    UI.showToast('History exported!');
  }

  function getFiltered(query) {
    const q = query.toLowerCase().trim();
    const history = State.get('history');
    if (!q) return history;
    return history.filter(h =>
      h.expr.toLowerCase().includes(q) || String(h.result).includes(q)
    );
  }

  return { add, remove, clearAll, togglePin, exportTxt, getFiltered };
})();

/* ============================================================
   5. CALCULATOR ENGINE
   ============================================================ */
const Calculator = (() => {

  /** Current number being built as a string */
  let current = '0';
  let operator = null;    // pending operator (+,-,×,÷)
  let prevVal = null;     // previous value before operator
  let justEvaled = false; // did we just press =?
  let awaitPow = false;   // waiting for exponent for xʸ
  let powBase = null;

  function getCurrent() { return current; }

  function reset() {
    current = '0'; operator = null; prevVal = null;
    justEvaled = false; awaitPow = false; powBase = null;
    State.set('expression', '');
    State.set('result', '0');
  }

  function clearEntry() {
    current = '0';
    State.set('result', '0');
  }

  /** Append a digit or decimal to current */
  function appendDigit(d) {
    if (justEvaled) { current = '0'; justEvaled = false; }
    if (d === '.' && current.includes('.')) return;
    if (d === '.' && current === '0') { current = '0.'; return; }
    if (current === '0' && d !== '.') { current = d; return; }
    if (current.length >= 15) return; // prevent overflow
    current += d;
  }

  function backspace() {
    if (justEvaled) return;
    if (current.length <= 1) { current = '0'; return; }
    current = current.slice(0, -1);
  }

  function toggleSign() {
    const v = parseFloat(current);
    if (isNaN(v)) return;
    current = MathEngine.formatResult(-v);
  }

  function percent() {
    const v = parseFloat(current);
    if (isNaN(v)) return;
    if (prevVal !== null && operator) {
      // e.g. 200 + 10% → 200 + (200 * 0.1)
      current = MathEngine.formatResult(prevVal * v / 100);
    } else {
      current = MathEngine.formatResult(v / 100);
    }
  }

  /** Apply a binary operator */
  function applyOperator(op) {
    const v = parseFloat(current);
    if (prevVal !== null && operator && !justEvaled) {
      const res = compute(prevVal, v, operator);
      if (res === null) return;
      current = MathEngine.formatResult(res);
      prevVal = res;
    } else {
      prevVal = isNaN(v) ? 0 : v;
    }
    operator  = op;
    justEvaled = false;
    State.set('expression', MathEngine.formatResult(prevVal) + ' ' + displayOp(op));
    State.set('result', current);
  }

  function displayOp(op) {
    const map = { '+':'+', '−':'−', '×':'×', '÷':'÷', 'mod':'mod', 'xy':'^' };
    return map[op] || op;
  }

  /** Execute = */
  function evaluate() {
    if (prevVal === null || !operator) {
      // Scientific one-arg result – just display
      const expr = State.get('expression');
      if (expr) HistoryManager.add(expr, current);
      justEvaled = true;
      return current;
    }
    const v = parseFloat(current);
    const expr = State.get('expression') + ' ' + current;
    const res = compute(prevVal, v, operator);
    if (res === null) return current;

    const formatted = MathEngine.formatResult(res);
    HistoryManager.add(expr, formatted);

    State.set('expression', expr + ' =');
    State.set('result', formatted);
    current = formatted;
    prevVal = null; operator = null;
    justEvaled = true;
    return formatted;
  }

  function compute(a, b, op) {
    let res;
    switch (op) {
      case '+':   res = a + b; break;
      case '−':   res = a - b; break;
      case '×':   res = a * b; break;
      case '÷':
        if (b === 0) { UI.showToast('Cannot divide by zero', 'error'); return null; }
        res = a / b; break;
      case 'mod':
        if (b === 0) { UI.showToast('Cannot mod by zero', 'error'); return null; }
        res = a % b; break;
      case 'xy':  res = Math.pow(a, b); break;
      default: return null;
    }
    if (!isFinite(res)) { UI.showToast('Result is Infinity', 'error'); return null; }
    return res;
  }

  /** Handle scientific single-arg functions */
  function applyScientific(action) {
    if (action === 'xy') {
      awaitPow = true;
      powBase   = parseFloat(current);
      State.set('expression', current + '^');
      current = '0';
      return;
    }
    if (action === 'mod') {
      applyOperator('mod'); return;
    }
    // Constants that replace current
    if (action === 'pi')    { current = MathEngine.formatResult(Math.PI); return; }
    if (action === 'euler') { current = MathEngine.formatResult(Math.E);  return; }
    if (action === 'rand')  { current = MathEngine.formatResult(Math.random()); return; }

    const oldVal = current;
    const angleDeg = State.get('angleDeg');
    try {
      const res = MathEngine.applyScientific(action, current, angleDeg);
      const formatted = MathEngine.formatResult(res);
      const label = sciLabel(action);
      State.set('expression', label + '(' + oldVal + ')');
      current = formatted;
      justEvaled = false;
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  }

  function sciLabel(action) {
    const map = {
      sin:'sin', cos:'cos', tan:'tan', asin:'sin⁻¹', acos:'cos⁻¹', atan:'tan⁻¹',
      log:'log', ln:'ln', exp:'eˣ', tenx:'10ˣ', sqrt:'√', cbrt:'∛',
      x2:'sqr', x3:'cube', abs:'|·|', fact:'!', round:'round', floor:'⌊⌋', ceil:'⌈⌉',
    };
    return map[action] || action;
  }

  /** Memory ops */
  function memOp(action) {
    const v = parseFloat(current);
    const m = State.get('memory');
    switch (action) {
      case 'mc':    State.set('memory', 0); UI.updateMemLabel(); break;
      case 'mr':    current = MathEngine.formatResult(m); break;
      case 'ms':    State.set('memory', isNaN(v) ? 0 : v); UI.updateMemLabel(); UI.showToast('Saved to memory'); break;
      case 'mplus': State.set('memory', m + (isNaN(v) ? 0 : v)); UI.updateMemLabel(); break;
      case 'mminus':State.set('memory', m - (isNaN(v) ? 0 : v)); UI.updateMemLabel(); break;
    }
  }

  /** Handle a parenthesis – append to expression */
  function appendParen(p) {
    if (justEvaled) { current = '0'; justEvaled = false; }
    // Simple approach: treat ( as start of a sub-expression string
    // For basic mode we just show it in expression and handle in safeEval
    const expr = State.get('expression');
    if (p === '(') {
      State.set('expression', expr + '(');
    }
  }

  /** Is xʸ waiting for exponent? */
  function isAwaitingPow() { return awaitPow; }
  function resolvePow() {
    if (!awaitPow || powBase === null) return;
    const exp = parseFloat(current);
    const res = MathEngine.formatResult(Math.pow(powBase, exp));
    const expr = MathEngine.formatResult(powBase) + '^' + current;
    State.set('expression', expr);
    current = res;
    awaitPow = false; powBase = null;
    justEvaled = true;
    HistoryManager.add(expr, res);
  }

  return {
    getCurrent, reset, clearEntry, appendDigit, backspace,
    toggleSign, percent, applyOperator, evaluate,
    applyScientific, memOp, appendParen, isAwaitingPow, resolvePow,
  };
})();

/* ============================================================
   6. UI CONTROLLER
   ============================================================ */
const UI = (() => {

  /* DOM refs */
  const $ = id => document.getElementById(id);
  const els = {
    displayExpr:   $('display-expression'),
    displayResult: $('display-result'),
    displayMode:   $('display-mode-label'),
    displayAngle:  $('display-angle-label'),
    displayMem:    $('display-memory-label'),
    basicKeypad:   $('basic-keypad'),
    sciPanel:      $('scientific-panel'),
    btnBasic:      $('btn-basic'),
    btnSci:        $('btn-scientific'),
    modeSlider:    document.querySelector('.mode-slider'),
    btnAngle:      $('btn-angle'),
    btnCopy:       $('btn-copy-result'),
    btnSound:      $('btn-sound'),
    iconSoundOn:   $('icon-sound-on'),
    iconSoundOff:  $('icon-sound-off'),
    historyList:   $('history-list'),
    historySearch: $('history-search'),
    btnClearHist:  $('btn-clear-history'),
    btnExportHist: $('btn-export-history'),
    statCount:     $('stat-count'),
    statAvg:       $('stat-avg'),
    statMax:       $('stat-max'),
    statMin:       $('stat-min'),
    liveDate:      $('live-date'),
    liveTime:      $('live-time'),
    toast:         $('toast'),
    fabMain:       $('fab-main'),
    fabMenu:       $('fab-menu'),
  };

  let toastTimer = null;

  /* ── Toast ─────────────────────────────────────────────── */
  function showToast(msg, type = 'info') {
    els.toast.textContent = msg;
    els.toast.className = 'toast show' + (type === 'error' ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.className = 'toast'; }, 2400);
  }

  /* ── Display refresh ────────────────────────────────────── */
  function refreshDisplay() {
    const result = Calculator.getCurrent();
    const expr   = State.get('expression');

    els.displayExpr.textContent = expr;
    els.displayResult.textContent = result;

    // Auto-shrink large numbers
    const len = result.length;
    els.displayResult.classList.toggle('small-text', len > 12);

    // Flash animation
    els.displayResult.classList.remove('flash');
    void els.displayResult.offsetWidth; // reflow trick
    els.displayResult.classList.add('flash');
  }

  /* ── Mode switch ────────────────────────────────────────── */
  function setMode(mode) {
    State.set('mode', mode);
    const isSci = mode === 'scientific';
    els.sciPanel.hidden = !isSci;
    els.btnBasic.classList.toggle('active', !isSci);
    els.btnSci.classList.toggle('active',   isSci);
    els.btnBasic.setAttribute('aria-pressed', String(!isSci));
    els.btnSci.setAttribute('aria-pressed',   String(isSci));
    els.modeSlider.classList.toggle('sci', isSci);
    els.displayMode.textContent = isSci ? 'SCI' : 'BASIC';
  }

  /* ── Angle toggle ───────────────────────────────────────── */
  function updateAngleLabel() {
    const deg = State.get('angleDeg');
    els.btnAngle.textContent = deg ? 'DEG' : 'RAD';
    els.displayAngle.textContent = deg ? 'DEG' : 'RAD';
  }

  /* ── Memory label ───────────────────────────────────────── */
  function updateMemLabel() {
    const m = State.get('memory');
    els.displayMem.textContent = m !== 0 ? 'M=' + MathEngine.formatResult(m) : '';
  }

  /* ── Theme ──────────────────────────────────────────────── */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    State.set('theme', theme);
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  }

  /* ── Sound toggle ───────────────────────────────────────── */
  function updateSoundUI() {
    const on = State.get('sound');
    els.iconSoundOn.style.display  = on ? '' : 'none';
    els.iconSoundOff.style.display = on ? 'none' : '';
  }

  /* ── History ────────────────────────────────────────────── */
  function renderHistory(query) {
    const q = (query !== undefined) ? query : els.historySearch.value;
    const items = HistoryManager.getFiltered(q);

    if (!items.length) {
      els.historyList.innerHTML = '<li class="history-empty">No calculations yet</li>';
      return;
    }

    els.historyList.innerHTML = items.map(item => `
      <li class="history-item ${item.pinned ? 'pinned' : ''}"
          data-id="${item.id}"
          tabindex="0"
          aria-label="${item.expr} = ${item.result}">
        <div class="history-item-text">
          <div class="history-expr">${escHtml(item.expr)}</div>
          <div class="history-result">${escHtml(String(item.result))}</div>
          <div class="history-time">${escHtml(item.time)}</div>
        </div>
        <div class="history-item-actions">
          <button class="pin-btn ${item.pinned ? 'active' : ''}" data-id="${item.id}" aria-label="${item.pinned ? 'Unpin' : 'Pin'}" title="${item.pinned ? 'Unpin' : 'Pin'}">
            <svg viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
          </button>
          <button class="copy-hist-btn" data-val="${escHtml(String(item.result))}" aria-label="Copy" title="Copy">
            <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </button>
          <button class="del-btn" data-id="${item.id}" aria-label="Delete" title="Delete">
            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </li>
    `).join('');
  }

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Stats ──────────────────────────────────────────────── */
  function updateStats() {
    const history = State.get('history');
    els.statCount.textContent = history.length;
    const nums = history.map(h => parseFloat(h.result)).filter(n => isFinite(n));
    if (!nums.length) {
      els.statAvg.textContent = '—';
      els.statMax.textContent = '—';
      els.statMin.textContent = '—';
      return;
    }
    const avg = nums.reduce((a,b) => a+b, 0) / nums.length;
    els.statAvg.textContent = MathEngine.formatResult(avg);
    els.statMax.textContent = MathEngine.formatResult(Math.max(...nums));
    els.statMin.textContent = MathEngine.formatResult(Math.min(...nums));
  }

  /* ── Clock ──────────────────────────────────────────────── */
  function startClock() {
    function tick() {
      const now = new Date();
      els.liveDate.textContent = now.toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'});
      els.liveTime.textContent = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ── Ripple effect on buttons ───────────────────────────── */
  function addRipple(btn, e) {
    const r = document.createElement('span');
    r.className = 'ripple';
    const rect = btn.getBoundingClientRect();
    r.style.left = (e.clientX - rect.left) + 'px';
    r.style.top  = (e.clientY - rect.top)  + 'px';
    btn.appendChild(r);
    r.addEventListener('animationend', () => r.remove());
  }

  /* ── Tips Modal ─────────────────────────────────────────── */
  function showTipsModal() {
    // Create modal if not present
    let overlay = document.getElementById('tips-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = 'tips-modal';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Calculator tips');
      overlay.innerHTML = `
        <div class="modal">
          <h4>💡 Calculator Tips</h4>
          <ul>
            <li>Use keyboard: 0–9, +, −, *, /, Enter, Backspace, Escape</li>
            <li>Press <b>AC</b> to clear everything</li>
            <li>Press <b>CE</b> to clear current entry only</li>
            <li>Use <b>xʸ</b> to raise a number to any power</li>
            <li>Toggle <b>DEG/RAD</b> for trig functions</li>
            <li>Memory: <b>MS</b> stores, <b>MR</b> recalls, <b>M+/M−</b> adds/subtracts</li>
            <li>Pin important calculations in history ⬆️</li>
            <li>Export history as a .txt file anytime</li>
            <li>7 themes available — try Cyberpunk! 🎮</li>
            <li>Click a history item to re-use its result</li>
          </ul>
          <button class="modal-close" id="tips-close">Got it!</button>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', e => {
        if (e.target === overlay || e.target.id === 'tips-close') closeTipsModal();
      });
    }
    overlay.classList.add('open');
  }

  function closeTipsModal() {
    const overlay = document.getElementById('tips-modal');
    if (overlay) overlay.classList.remove('open');
  }

  return {
    els, showToast, refreshDisplay, setMode, updateAngleLabel,
    updateMemLabel, applyTheme, updateSoundUI,
    renderHistory, updateStats, startClock, addRipple, showTipsModal,
  };
})();

/* ============================================================
   7. EVENT MANAGER
   ============================================================ */
const EventManager = (() => {

  function handleButtonAction(action, btnEl, event) {
    // Ripple
    if (event) UI.addRipple(btnEl, event);

    // Sound type
    const soundType = btnEl && btnEl.classList.contains('eq-btn') ? 'eq'
                    : btnEl && btnEl.classList.contains('op-btn') ? 'op' : 'num';
    AudioEngine.playClick(soundType);

    // Awaiting power exponent
    if (Calculator.isAwaitingPow()) {
      if (/^[0-9.]$/.test(action)) {
        Calculator.appendDigit(action);
        UI.refreshDisplay(); return;
      }
      if (action === '=') {
        Calculator.resolvePow();
        UI.refreshDisplay(); return;
      }
    }

    switch (action) {
      /* Digits & Decimal */
      case '0': case '1': case '2': case '3': case '4':
      case '5': case '6': case '7': case '8': case '9':
      case '.':
        Calculator.appendDigit(action); break;

      /* Basic operators */
      case '+': case '−': case '×': case '÷':
        Calculator.applyOperator(action); break;

      /* Special */
      case '=':          Calculator.evaluate(); break;
      case 'ac':         Calculator.reset(); break;
      case 'ce':         Calculator.clearEntry(); break;
      case 'backspace':  Calculator.backspace(); break;
      case 'sign':       Calculator.toggleSign(); break;
      case 'percent':    Calculator.percent(); break;
      case '(':          Calculator.appendParen('('); break;

      /* Memory */
      case 'mc': case 'mr': case 'ms': case 'mplus': case 'mminus':
        Calculator.memOp(action); break;

      /* Angle toggle */
      case 'toggleAngle': {
        State.set('angleDeg', !State.get('angleDeg'));
        UI.updateAngleLabel();
        break;
      }

      /* Scientific functions */
      default:
        Calculator.applyScientific(action); break;
    }

    UI.refreshDisplay();
  }

  function bindButtons() {
    document.querySelectorAll('.btn[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        handleButtonAction(btn.dataset.action, btn, e);
      });
    });
  }

  function bindModeToggle() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => UI.setMode(btn.dataset.mode));
    });
  }

  function bindTheme() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => UI.applyTheme(btn.dataset.theme));
    });
  }

  function bindSound() {
    UI.els.btnSound.addEventListener('click', () => {
      State.set('sound', !State.get('sound'));
      UI.updateSoundUI();
      UI.showToast(State.get('sound') ? 'Sound on' : 'Sound off');
    });
  }

  function bindCopy() {
    UI.els.btnCopy.addEventListener('click', () => {
      const txt = Calculator.getCurrent();
      navigator.clipboard.writeText(txt).then(() => UI.showToast('Copied: ' + txt))
                                        .catch(() => UI.showToast('Copy failed', 'error'));
    });
  }

  function bindHistory() {
    // History item interactions via delegation
    UI.els.historyList.addEventListener('click', e => {
      const item   = e.target.closest('.history-item');
      const pinBtn = e.target.closest('.pin-btn');
      const delBtn = e.target.closest('.del-btn');
      const cpBtn  = e.target.closest('.copy-hist-btn');

      if (pinBtn) {
        e.stopPropagation();
        HistoryManager.togglePin(Number(pinBtn.dataset.id));
        return;
      }
      if (delBtn) {
        e.stopPropagation();
        HistoryManager.remove(Number(delBtn.dataset.id));
        return;
      }
      if (cpBtn) {
        e.stopPropagation();
        navigator.clipboard.writeText(cpBtn.dataset.val)
          .then(() => UI.showToast('Copied!'))
          .catch(() => {});
        return;
      }
      // Click on item body → load result
      if (item) {
        const entry = State.get('history').find(h => h.id === Number(item.dataset.id));
        if (entry && isFinite(parseFloat(entry.result))) {
          // Inject into calculator as current value
          Calculator.reset();
          const v = parseFloat(entry.result);
          // feed digits
          entry.result.split('').forEach(ch => {
            if (ch === '-') Calculator.toggleSign();
            else Calculator.appendDigit(ch);
          });
          UI.refreshDisplay();
          UI.showToast('Loaded: ' + entry.result);
        }
      }
    });

    UI.els.historyList.addEventListener('keydown', e => {
      if (e.key === 'Enter') e.target.click();
    });

    UI.els.historySearch.addEventListener('input', e => UI.renderHistory(e.target.value));
    UI.els.btnClearHist.addEventListener('click',  () => {
      if (confirm('Clear all history?')) HistoryManager.clearAll();
    });
    UI.els.btnExportHist.addEventListener('click', () => HistoryManager.exportTxt());
  }

  function bindKeyboard() {
    document.addEventListener('keydown', e => {
      // Ignore if focus is in search box
      if (document.activeElement === UI.els.historySearch) return;

      const key = e.key;
      const map = {
        '0':'0','1':'1','2':'2','3':'3','4':'4',
        '5':'5','6':'6','7':'7','8':'8','9':'9',
        '.':'.', '+':'+', '-':'−', '*':'×', '/':'÷',
        'Enter':'=', '=':'=',
        'Backspace':'backspace', 'Delete':'ac', 'Escape':'ac',
        '%':'percent',
      };

      if (map[key]) {
        e.preventDefault();
        // Find matching button for ripple (optional)
        const btn = document.querySelector(`.btn[data-action="${map[key]}"]`);
        handleButtonAction(map[key], btn, null);
        if (btn) { btn.classList.add('key-active'); setTimeout(() => btn.classList.remove('key-active'), 120); }
      }
    });
  }

  function bindFAB() {
    UI.els.fabMain.addEventListener('click', () => {
      const open = UI.els.fabMenu.classList.toggle('open');
      UI.els.fabMain.classList.toggle('open', open);
      UI.els.fabMain.setAttribute('aria-expanded', String(open));
      UI.els.fabMenu.setAttribute('aria-hidden', String(!open));
    });

    document.querySelectorAll('.fab-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.fab;
        if (act === 'clear') {
          Calculator.reset();
          UI.refreshDisplay();
          UI.showToast('Cleared!');
        } else if (act === 'copy') {
          const txt = Calculator.getCurrent();
          navigator.clipboard.writeText(txt).then(() => UI.showToast('Copied: ' + txt));
        } else if (act === 'tips') {
          UI.showTipsModal();
        }
        // Close fab
        UI.els.fabMenu.classList.remove('open');
        UI.els.fabMain.classList.remove('open');
      });
    });

    // Close FAB on outside click
    document.addEventListener('click', e => {
      if (!e.target.closest('.fab-container')) {
        UI.els.fabMenu.classList.remove('open');
        UI.els.fabMain.classList.remove('open');
      }
    });
  }

  // Add key-active style for keyboard feedback
  const kbStyle = document.createElement('style');
  kbStyle.textContent = '.btn.key-active { transform: scale(.93); filter: brightness(1.3); }';
  document.head.appendChild(kbStyle);

  function init() {
    bindButtons();
    bindModeToggle();
    bindTheme();
    bindSound();
    bindCopy();
    bindHistory();
    bindKeyboard();
    bindFAB();
  }

  return { init, handleButtonAction };
})();

/* ============================================================
   8. APP BOOTSTRAP
   ============================================================ */
const App = (() => {

  function init() {
    // Load persisted state
    State.load();

    // Apply theme
    UI.applyTheme(State.get('theme'));

    // Apply mode
    UI.setMode(State.get('mode'));

    // Apply angle
    UI.updateAngleLabel();

    // Sound UI
    UI.updateSoundUI();

    // Memory label
    UI.updateMemLabel();

    // Render history & stats
    UI.renderHistory();
    UI.updateStats();

    // Start clock
    UI.startClock();

    // Bind all events
    EventManager.init();

    // Initial display
    UI.refreshDisplay();
  }

  return { init };
})();

/* Start the app when DOM is ready */
document.addEventListener('DOMContentLoaded', App.init);
