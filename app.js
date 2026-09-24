/**
 * FitPantry PRO - Senior Full-Stack Modular Architecture
 * Apple Design System & Aesthetic: Minimalist, Refined, Modern & Sobriety with Apple Fitness Green Accents (#30d158).
 * Seamlessly integrates 3-day and 5-day training, Aldi pantry, and clinical nutrition plans.
 */

// ============================================================================
// 1. STATE STORE & PERSISTENCE
// ============================================================================

const STORAGE_KEY = 'fitpantry_state_v2';

const state = {
  activePlan: 'plan3dias',      // 'plan3dias' | 'plan5dias'
  activeTab: 'nutrition',       // 'nutrition' | 'pantry' | 'workout' | 'settings'
  trainingLocation: 'gym',      // 'gym' | 'casa'
  selectedWeek: 1,              // 1, 2, 3, 4
  selectedWorkoutDay: '',
  selectedNutriDay: '',
  pantryView: 'athome',         // 'athome' | 'tobuy'
  selectedCategory: 'all',
  pantrySearch: '',
  shoppingMode: false,
  shoppingCart: {},

  // Active Datasets (Loaded from window.FIT_PRESETS or localStorage)
  pantryItems: [],
  workoutData: [],
  nutritionData: [],

  // Tracking Logs:
  // workoutLogs: { [`w{week}_{day}_{order}_s{set}`]: { weight, reps, rir, completed } }
  workoutLogs: {},
  // nutritionLogs: { [`${mealId}`]: true/false }
  nutritionLogs: {},

  // Rest Timer State
  timer: {
    total: 90,
    remaining: 90,
    isRunning: false,
    intervalId: null,
    label: 'Descanso'
  },

  // Sweat-proof Focus Mode State
  focus: {
    active: false,
    exercise: null,
    setIndex: 1
  },

  // Daily Pre-Workout Readiness Check-in (Feature 5)
  dailyCheckin: null, // { date: 'YYYY-MM-DD', energy: 'high'|'normal'|'low', spine: 'good'|'tight'|'pain' }

  // 100% Gluten-Free Food Swaps (Feature 2)
  nutritionSwaps: {}, // { [mealId]: { name, amount, macros } }

  // Exercise Alternatives (Feature 3)
  exerciseSwaps: {}, // { [exId]: { altName, equipment, biomechanics, barWeight } }

  // Preferences
  settings: {
    autoStartTimer: true,
    sound: true,
    vibrate: true
  }
};

function saveStateToStorage() {
  try {
    const payload = {
      activePlan: state.activePlan,
      trainingLocation: state.trainingLocation,
      selectedWeek: state.selectedWeek,
      pantryView: state.pantryView,
      pantryItems: state.pantryItems,
      workoutData: state.workoutData,
      nutritionData: state.nutritionData,
      workoutLogs: state.workoutLogs,
      nutritionLogs: state.nutritionLogs,
      dailyCheckin: state.dailyCheckin,
      nutritionSwaps: state.nutritionSwaps,
      exerciseSwaps: state.exerciseSwaps,
      settings: state.settings
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('Error saving state to localStorage:', error);
  }
}

function loadStateFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    const parsed = JSON.parse(stored);
    state.activePlan = parsed.activePlan || 'plan3dias';
    state.trainingLocation = parsed.trainingLocation || 'gym';
    state.selectedWeek = parsed.selectedWeek || 1;
    state.pantryView = parsed.pantryView || 'athome';
    state.pantryItems = parsed.pantryItems || [];
    state.workoutData = parsed.workoutData || [];
    state.nutritionData = parsed.nutritionData || [];
    state.workoutLogs = parsed.workoutLogs || {};
    state.nutritionLogs = parsed.nutritionLogs || {};
    state.dailyCheckin = parsed.dailyCheckin || null;
    state.nutritionSwaps = parsed.nutritionSwaps || {};
    state.exerciseSwaps = parsed.exerciseSwaps || {};
    if (parsed.settings) state.settings = { ...state.settings, ...parsed.settings };

    return true;
  } catch (error) {
    console.error('Error loading state from localStorage:', error);
    return false;
  }
}

function switchActivePlan(planKey) {
  if (planKey !== 'plan3dias' && planKey !== 'plan5dias') return;
  if (!window.FIT_PRESETS || !window.FIT_PRESETS[planKey]) return;

  state.activePlan = planKey;
  const preset = window.FIT_PRESETS[planKey];

  state.pantryItems = JSON.parse(JSON.stringify(preset.pantry));
  state.workoutData = JSON.parse(JSON.stringify(preset.workout));
  state.nutritionData = JSON.parse(JSON.stringify(preset.nutrition));

  // Reset default days
  const workoutDays = getAvailableWorkoutDays(state.selectedWeek);
  state.selectedWorkoutDay = workoutDays[0] || '';

  const nutriDays = getAvailableNutritionDays(state.selectedWeek);
  state.selectedNutriDay = nutriDays[0] || '';

  saveStateToStorage();
  renderApp();
  showToast(`Programa activo: ${preset.name}`, 'success');
}

function initApp() {
  const hasLoaded = loadStateFromStorage();

  // If first visit or empty dataset, initialize from bundled presets
  if (!hasLoaded || !state.pantryItems.length || !state.workoutData.length || !state.nutritionData.length) {
    if (window.FIT_PRESETS && window.FIT_PRESETS[state.activePlan]) {
      const preset = window.FIT_PRESETS[state.activePlan];
      state.pantryItems = JSON.parse(JSON.stringify(preset.pantry));
      state.workoutData = JSON.parse(JSON.stringify(preset.workout));
      state.nutritionData = JSON.parse(JSON.stringify(preset.nutrition));
      saveStateToStorage();
    }
  }

  // Set initial selected days if empty
  const workoutDays = getAvailableWorkoutDays(state.selectedWeek);
  if (!state.selectedWorkoutDay || !workoutDays.includes(state.selectedWorkoutDay)) {
    state.selectedWorkoutDay = workoutDays[0] || '';
  }

  const nutriDays = getAvailableNutritionDays(state.selectedWeek);
  if (!state.selectedNutriDay || !nutriDays.includes(state.selectedNutriDay)) {
    state.selectedNutriDay = nutriDays[0] || '';
  }

  // Attach event handlers
  setupUIEvents();
  registerPWA();
  initCloudSyncListeners();

  // Initial render
  renderApp();
  renderTimerWidget();
}

// ============================================================================
// 2. AUDIO SYNTHESIS & REST TIMER (APPLE-LIKE HARMONIC CHIMES)
// ============================================================================

let audioContextInstance = null;

function getAudioContext() {
  if (!audioContextInstance) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioContextInstance = new AudioContextClass();
  }
  if (audioContextInstance && audioContextInstance.state === 'suspended') {
    audioContextInstance.resume();
  }
  return audioContextInstance;
}

function playTone(freq = 600, duration = 0.1, type = 'sine') {
  if (!state.settings.sound) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio restriction handled
  }
}

function playCelebrationFanfare() {
  if (!state.settings.sound) return;
  // Apple Fitness style warm chime
  const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6
  notes.forEach((note, index) => {
    setTimeout(() => playTone(note, 0.32, 'triangle'), index * 120);
  });
}

function playTimerChime() {
  if (!state.settings.sound) return;
  // Harmonic E-major triad
  const chord = [659.25, 830.61, 987.77];
  chord.forEach((note, index) => {
    setTimeout(() => playTone(note, 0.35, 'sine'), index * 90);
  });
}

function startTimer(seconds, label = 'Descanso') {
  state.timer.total = seconds > 0 ? seconds : 90;
  state.timer.remaining = state.timer.total;
  state.timer.label = label;
  state.timer.isRunning = true;

  if (state.timer.intervalId) clearInterval(state.timer.intervalId);

  getAudioContext();
  renderTimerWidget();
  updateFloatingTimerUI();

  state.timer.intervalId = setInterval(() => {
    if (state.timer.remaining > 1) {
      state.timer.remaining--;
      if (state.timer.remaining <= 3) playTone(520, 0.07);
      renderTimerWidget();
      updateFloatingTimerUI();
    } else {
      state.timer.remaining = 0;
      stopTimer();
      onTimerFinished();
    }
  }, 1000);
}

function togglePlayPauseTimer() {
  if (state.timer.isRunning) {
    stopTimer();
  } else {
    if (state.timer.remaining <= 0) state.timer.remaining = state.timer.total;
    state.timer.isRunning = true;
    if (state.timer.intervalId) clearInterval(state.timer.intervalId);
    state.timer.intervalId = setInterval(() => {
      if (state.timer.remaining > 1) {
        state.timer.remaining--;
        if (state.timer.remaining <= 3) playTone(520, 0.07);
        renderTimerWidget();
        updateFloatingTimerUI();
      } else {
        state.timer.remaining = 0;
        stopTimer();
        onTimerFinished();
      }
    }, 1000);
    renderTimerWidget();
    updateFloatingTimerUI();
  }
}

function stopTimer() {
  state.timer.isRunning = false;
  if (state.timer.intervalId) {
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
  }
  renderTimerWidget();
  updateFloatingTimerUI();
}

function adjustTimer(deltaSeconds) {
  state.timer.remaining = Math.max(0, state.timer.remaining + deltaSeconds);
  state.timer.total = Math.max(state.timer.total, state.timer.remaining);
  renderTimerWidget();
  updateFloatingTimerUI();
}

function resetTimer() {
  stopTimer();
  state.timer.remaining = state.timer.total;
  renderTimerWidget();
  updateFloatingTimerUI();
}

function onTimerFinished() {
  playTimerChime();
  if (state.settings.vibrate && 'vibrate' in navigator) {
    try { navigator.vibrate([250, 100, 250, 100, 350]); } catch (e) {}
  }
  showToast(`⏱️ ¡Descanso completado: ${state.timer.label}!`, 'success');
  renderTimerWidget();
  updateFloatingTimerUI();

  // Auto-dismiss Floating HUD after 4 seconds
  setTimeout(() => {
    if (!state.timer.isRunning && state.timer.remaining <= 0) {
      const hud = document.getElementById('floating-rest-timer-hud');
      if (hud) hud.classList.add('hidden');
    }
  }, 4000);
}

function updateFloatingTimerUI() {
  const hud = document.getElementById('floating-rest-timer-hud');
  const displayEl = document.getElementById('hud-timer-countdown');
  const labelEl = document.getElementById('hud-timer-target-name');
  const toggleBtn = document.getElementById('hud-timer-toggle-btn');
  const progressFill = document.getElementById('hud-timer-progress-fill');

  if (!hud || !displayEl) return;

  if (state.timer.isRunning || state.timer.remaining > 0) {
    hud.classList.remove('hidden');
  }

  const mins = Math.floor(state.timer.remaining / 60);
  const secs = state.timer.remaining % 60;
  displayEl.textContent = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;

  if (labelEl) {
    const cleanLabel = (state.timer.label || 'Descanso').replace(/^Descanso:\s*/i, '');
    labelEl.textContent = cleanLabel;
  }

  if (progressFill && state.timer.total > 0) {
    const pct = ((state.timer.total - state.timer.remaining) / state.timer.total) * 100;
    progressFill.style.width = `${pct}%`;
  }

  if (toggleBtn) {
    toggleBtn.innerHTML = state.timer.isRunning
      ? `<i data-lucide="pause" class="w-3.5 h-3.5"></i>`
      : `<i data-lucide="play" class="w-3.5 h-3.5"></i>`;
  }

  if (window.lucide) lucide.createIcons();
}

window.adjustFloatingTimer = function(deltaSeconds) {
  adjustTimer(deltaSeconds);
};

window.toggleFloatingTimer = function() {
  togglePlayPauseTimer();
};

window.dismissFloatingTimer = function() {
  stopTimer();
  const hud = document.getElementById('floating-rest-timer-hud');
  if (hud) hud.classList.add('hidden');
};

function renderTimerWidget() {
  const labelEl = document.getElementById('timer-exercise-label');
  const displayEl = document.getElementById('timer-display');
  const playBtn = document.getElementById('timer-play-btn');
  const progressBar = document.getElementById('timer-progress-fill');
  const widget = document.getElementById('global-rest-timer');

  if (!displayEl) return;

  const mins = Math.floor(state.timer.remaining / 60);
  const secs = state.timer.remaining % 60;
  displayEl.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  if (labelEl) labelEl.textContent = state.timer.label;

  if (playBtn) {
    playBtn.innerHTML = state.timer.isRunning
      ? `<i data-lucide="pause" class="w-4 h-4 text-emerald-400"></i>`
      : `<i data-lucide="play" class="w-4 h-4 text-zinc-300"></i>`;
  }

  if (progressBar) {
    const pct = state.timer.total > 0 ? ((state.timer.total - state.timer.remaining) / state.timer.total) * 100 : 0;
    progressBar.style.width = `${pct}%`;
  }

  if (widget) {
    if (state.timer.isRunning) widget.classList.add('timer-active-glow');
    else widget.classList.remove('timer-active-glow');
  }

  if (window.lucide) lucide.createIcons();
}

// ============================================================================
// 3. TOAST NOTIFICATIONS (APPLE MINIMALIST CAPSULE)
// ============================================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' 
    ? 'bg-zinc-900/95 border border-emerald-500/40 text-emerald-100 shadow-[0_8px_30px_rgba(48, 209, 88, 0.25)]'
    : type === 'error' 
    ? 'bg-zinc-900/95 border border-red-500/40 text-red-200' 
    : 'bg-zinc-900/95 border border-white/10 text-zinc-100';

  toast.className = `${bg} backdrop-blur-2xl text-xs md:text-sm px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 transform transition-all duration-300 translate-y-2 opacity-0 font-medium z-50`;
  toast.innerHTML = message;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ============================================================================
// 4. NAVIGATION & TAB ROUTING
// ============================================================================

function switchTab(tabName) {
  state.activeTab = tabName;

  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    const isTarget = btn.dataset.tab === tabName;
    const icon = btn.querySelector('.nav-icon');
    const label = btn.querySelector('.nav-label');

    if (isTarget) {
      btn.classList.add('text-emerald-400');
      btn.classList.remove('text-zinc-400');
      if (icon) icon.classList.add('stroke-[2.2px]');
      if (label) label.classList.add('font-bold');
    } else {
      btn.classList.remove('text-emerald-400');
      btn.classList.add('text-zinc-400');
      if (icon) icon.classList.remove('stroke-[2.2px]');
      if (label) label.classList.remove('font-bold');
    }
  });

  document.querySelectorAll('.tab-panel').forEach(panel => {
    if (panel.id === `tab-${tabName}`) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  });

  if (tabName === 'workout') {
    requestScreenWakeLock();
  } else {
    releaseScreenWakeLock();
  }

  if (tabName === 'nutrition') renderNutrition();
  if (tabName === 'pantry') renderPantry();
  if (tabName === 'workout') renderWorkout();
  if (tabName === 'settings') renderSettings();

  if (window.lucide) lucide.createIcons();
}

// ============================================================================
// SCREEN WAKE LOCK API (ALWAYS ON WORKOUT SCREEN)
// ============================================================================

let wakeLockSentinel = null;

async function requestScreenWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      if (!wakeLockSentinel) {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
          updateWakeLockUI();
        });
        updateWakeLockUI();
      }
    } catch (err) {
      console.warn('Wake Lock request:', err);
    }
  }
}

async function releaseScreenWakeLock() {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    } catch (err) {
      console.warn('Wake Lock release:', err);
    }
  }
  updateWakeLockUI();
}

window.toggleScreenWakeLock = async function() {
  if (wakeLockSentinel) {
    await releaseScreenWakeLock();
    showToast('💡 Pantalla en modo apagado automático', 'info');
  } else {
    await requestScreenWakeLock();
    showToast('💡 Pantalla siempre activa durante el entreno', 'success');
  }
};

function updateWakeLockUI() {
  const dot = document.getElementById('workout-wakelock-dot');
  if (dot) {
    if (wakeLockSentinel) {
      dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-zinc-600';
    }
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.activeTab === 'workout') {
    requestScreenWakeLock();
  }
});

// ============================================================================
// VISUAL BARBELL PLATE CALCULATOR (APPLE HIG)
// ============================================================================

const plateCalcState = {
  targetWeight: 60,
  barWeight: 20,
  activeExId: null,
  activeSetIndex: null
};

window.openPlateCalculatorModal = function(exId = null, setIndex = null, initialWeight = null) {
  plateCalcState.activeExId = exId;
  plateCalcState.activeSetIndex = setIndex;

  let weight = initialWeight;
  if (weight === null || weight === undefined || isNaN(weight) || weight <= 0) {
    if (exId && setIndex) {
      const key = `${exId}_s${setIndex}`;
      weight = parseFloat(state.workoutLogs[key]?.weight) || 60;
    } else {
      weight = 60;
    }
  }
  plateCalcState.targetWeight = weight;
  const inputEl = document.getElementById('plate-calc-target-weight');
  if (inputEl) inputEl.value = weight;

  const modal = document.getElementById('modal-plate-calculator');
  if (modal) modal.classList.remove('hidden');

  calculatePlatesUI();
  if (window.lucide) lucide.createIcons();
};

window.closePlateCalculatorModal = function() {
  const modal = document.getElementById('modal-plate-calculator');
  if (modal) modal.classList.add('hidden');
};

window.setPlateCalcBar = function(barWeight) {
  plateCalcState.barWeight = barWeight;
  [20, 15, 25, 0].forEach(w => {
    const btn = document.getElementById(`plate-bar-${w}`);
    if (btn) {
      if (w === barWeight) {
        btn.className = "py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all text-center";
      } else {
        btn.className = "py-1.5 rounded-xl bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-white/[0.05] transition-all text-center";
      }
    }
  });

  const barLabel = document.getElementById('plate-calc-bar-label');
  if (barLabel) {
    const names = { 20: 'Olímpica (20 kg)', 15: 'Olímpica Mujer (15 kg)', 25: 'Trap Bar (25 kg)', 0: 'Sin Barra / Máquina (0 kg)' };
    barLabel.textContent = names[barWeight] || `${barWeight} kg`;
  }

  calculatePlatesUI();
};

window.adjustPlateCalcWeight = function(delta) {
  plateCalcState.targetWeight = Math.max(0, plateCalcState.targetWeight + delta);
  const inputEl = document.getElementById('plate-calc-target-weight');
  if (inputEl) inputEl.value = plateCalcState.targetWeight;
  calculatePlatesUI();
};

window.calculatePlatesUI = function() {
  const inputEl = document.getElementById('plate-calc-target-weight');
  if (inputEl) plateCalcState.targetWeight = Math.max(0, parseFloat(inputEl.value) || 0);

  const netWeight = Math.max(0, plateCalcState.targetWeight - plateCalcState.barWeight);
  const perSide = netWeight / 2;

  const perSideEl = document.getElementById('plate-calc-per-side');
  if (perSideEl) perSideEl.textContent = `${perSide.toFixed(2).replace(/\.00$/, '')} kg`;

  const availableDiscs = [
    { kg: 25, name: '25 kg', color: 'bg-red-500 text-white', border: 'border-red-400', heightClass: 'h-14 w-3.5', dot: 'bg-red-500' },
    { kg: 20, name: '20 kg', color: 'bg-blue-500 text-white', border: 'border-blue-400', heightClass: 'h-14 w-3.5', dot: 'bg-blue-500' },
    { kg: 15, name: '15 kg', color: 'bg-amber-400 text-zinc-950', border: 'border-amber-300', heightClass: 'h-12 w-3', dot: 'bg-amber-400' },
    { kg: 10, name: '10 kg', color: 'bg-emerald-500 text-white', border: 'border-emerald-400', heightClass: 'h-10 w-2.5', dot: 'bg-emerald-500' },
    { kg: 5, name: '5 kg', color: 'bg-zinc-100 text-zinc-950', border: 'border-white', heightClass: 'h-8 w-2.5', dot: 'bg-zinc-100' },
    { kg: 2.5, name: '2.5 kg', color: 'bg-zinc-800 text-zinc-200', border: 'border-zinc-500', heightClass: 'h-7 w-2', dot: 'bg-zinc-700' },
    { kg: 1.25, name: '1.25 kg', color: 'bg-zinc-400 text-zinc-950', border: 'border-zinc-300', heightClass: 'h-6 w-1.5', dot: 'bg-zinc-400' }
  ];

  let remaining = perSide;
  const breakdown = [];
  const visualDiscs = [];

  availableDiscs.forEach(disc => {
    let count = 0;
    while (remaining >= disc.kg - 0.001) {
      count++;
      remaining = Math.round((remaining - disc.kg) * 100) / 100;
      visualDiscs.push(disc);
    }
    if (count > 0) {
      breakdown.push({ ...disc, count });
    }
  });

  const sleeve = document.getElementById('plate-visual-sleeve');
  if (sleeve) {
    if (visualDiscs.length === 0) {
      sleeve.innerHTML = `<span class="text-[10px] text-zinc-500 italic pl-2">Manga vacía</span>`;
    } else {
      sleeve.innerHTML = visualDiscs.map(d => `
        <div class="${d.color} ${d.border} ${d.heightClass} border rounded-sm flex items-center justify-center shadow-md select-none shrink-0" title="${d.name}">
        </div>
      `).join('');
    }
  }

  const listEl = document.getElementById('plate-discs-list');
  if (listEl) {
    if (breakdown.length === 0) {
      listEl.innerHTML = `<p class="text-zinc-500 text-center py-2 text-[11px]">No se requieren discos adicionales para este peso.</p>`;
    } else {
      listEl.innerHTML = breakdown.map(item => `
        <div class="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60 border border-white/[0.04]">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full ${item.dot}"></span>
            <span class="font-bold text-zinc-200">${item.count}× Disco de ${item.kg} kg</span>
          </div>
          <span class="text-xs font-mono font-semibold text-emerald-400">+${(item.count * item.kg).toFixed(1)} kg/lado</span>
        </div>
      `).join('');
    }
  }
};

window.applyPlateCalculatorWeight = function() {
  if (plateCalcState.activeExId && plateCalcState.activeSetIndex) {
    const inputEl = document.getElementById(`input-weight-${plateCalcState.activeExId}-${plateCalcState.activeSetIndex}`);
    if (inputEl) inputEl.value = plateCalcState.targetWeight;
    saveWorkoutSetField(plateCalcState.activeExId, plateCalcState.activeSetIndex, 'weight', plateCalcState.targetWeight);
    showToast(`🏋️ Peso aplicado: ${plateCalcState.targetWeight} kg`, 'success');
  }
  closePlateCalculatorModal();
};

// ============================================================================
// 5. NUTRITION MODULE (APPLE FITNESS GREEN MINIMALISM)
// ============================================================================

function getAvailableNutritionDays(week) {
  const filtered = state.nutritionData.filter(item => item.semana === week);
  return Array.from(new Set(filtered.map(item => item.diaTipo)));
}

function renderNutrition() {
  const container = document.getElementById('nutrition-meals-list');
  const weeksContainer = document.getElementById('nutrition-weeks-selector');
  const daysContainer = document.getElementById('nutrition-days-selector');
  const macrosCard = document.getElementById('nutrition-macros-summary');

  if (!container) return;

  // 1. Render Week Pills (Apple Capsule Style)
  let weeksHtml = '';
  [1, 2, 3, 4].forEach(w => {
    const isActive = state.selectedWeek === w;
    weeksHtml += `
      <button onclick="setNutritionWeek(${w})" class="px-3.5 py-1.5 rounded-full text-xs transition-all ${
        isActive
          ? 'bg-gradient-to-r from-emerald-400 to-[#30d158] text-zinc-950 font-black shadow-md shadow-emerald-500/20'
          : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-white/[0.05]'
      }">
        Semana ${w}
      </button>
    `;
  });
  if (weeksContainer) weeksContainer.innerHTML = weeksHtml;

  // 2. Render Day Pills
  const days = getAvailableNutritionDays(state.selectedWeek);
  if (days.length > 0 && !days.includes(state.selectedNutriDay)) {
    state.selectedNutriDay = days[0];
  }

  let daysHtml = '';
  days.forEach(d => {
    const isActive = state.selectedNutriDay === d;
    daysHtml += `
      <button onclick="setNutritionDay('${encodeURIComponent(d)}')" class="px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all ${
        isActive
          ? 'bg-zinc-100 text-zinc-950 font-bold shadow-md'
          : 'bg-zinc-900/90 text-zinc-400 hover:bg-zinc-850 border border-white/[0.04]'
      }">
        ${d}
      </button>
    `;
  });
  if (daysContainer) daysContainer.innerHTML = daysHtml;

  // 3. Filter Meals for Selected Week & Day
  const meals = state.nutritionData.filter(
    item => item.semana === state.selectedWeek && item.diaTipo === state.selectedNutriDay
  );

  if (meals.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 px-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30">
        <p class="text-xs text-zinc-400">No hay registros de nutrición para este día.</p>
      </div>
    `;
    return;
  }

  // 4. Calculate Daily Macros Totals & Consumed Totals
  const totals = meals.reduce(
    (acc, m) => {
      acc.cal += m.calorias || 0;
      acc.prot += m.proteina || 0;
      acc.carbs += m.carbohidratos || 0;
      acc.fat += m.grasas || 0;
      acc.fiber += m.fibra || 0;
      return acc;
    },
    { cal: 0, prot: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  const consumed = meals.reduce(
    (acc, m) => {
      if (state.nutritionLogs[m.id]) {
        acc.cal += m.calorias || 0;
        acc.prot += m.proteina || 0;
        acc.carbs += m.carbohidratos || 0;
        acc.fat += m.grasas || 0;
        acc.count++;
      }
      return acc;
    },
    { cal: 0, prot: 0, carbs: 0, fat: 0, count: 0 }
  );

  const calPct = totals.cal > 0 ? Math.min(100, Math.round((consumed.cal / totals.cal) * 100)) : 0;
  const protPct = totals.prot > 0 ? Math.min(100, Math.round((consumed.prot / totals.prot) * 100)) : 0;
  const carbsPct = totals.carbs > 0 ? Math.min(100, Math.round((consumed.carbs / totals.carbs) * 100)) : 0;
  const fatPct = totals.fat > 0 ? Math.min(100, Math.round((consumed.fat / totals.fat) * 100)) : 0;

  if (macrosCard) {
    macrosCard.innerHTML = `
      <div class="glass-panel p-4 rounded-3xl border border-white/[0.08] bg-[#0c120e]/80 flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs font-bold">📊</span>
            <h4 class="text-xs font-extrabold text-white tracking-tight">Macros Diarios Consumidos</h4>
          </div>
          <span class="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${consumed.count === meals.length ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400'}">
            ${consumed.count} / ${meals.length} comidas
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <!-- Kcal -->
          <div class="p-2.5 rounded-2xl bg-zinc-900/80 border border-white/[0.04]">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[10px] uppercase font-bold text-emerald-400">🔥 Calorías</span>
              <span class="text-[10px] font-mono text-zinc-400">${calPct}%</span>
            </div>
            <div class="text-xs font-black font-mono text-white mb-1.5">${Math.round(consumed.cal)} <span class="text-zinc-500 text-[10px]">/ ${Math.round(totals.cal)} kcal</span></div>
            <div class="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-emerald-400 to-[#30d158] rounded-full transition-all duration-500" style="width: ${calPct}%"></div>
            </div>
          </div>

          <!-- Proteína -->
          <div class="p-2.5 rounded-2xl bg-zinc-900/80 border border-white/[0.04]">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[10px] uppercase font-bold text-blue-400">🍗 Proteína</span>
              <span class="text-[10px] font-mono text-zinc-400">${protPct}%</span>
            </div>
            <div class="text-xs font-black font-mono text-white mb-1.5">${Math.round(consumed.prot)}g <span class="text-zinc-500 text-[10px]">/ ${Math.round(totals.prot)}g</span></div>
            <div class="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transition-all duration-500" style="width: ${protPct}%"></div>
            </div>
          </div>

          <!-- Carbos -->
          <div class="p-2.5 rounded-2xl bg-zinc-900/80 border border-white/[0.04]">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[10px] uppercase font-bold text-amber-400">🍚 Carbos</span>
              <span class="text-[10px] font-mono text-zinc-400">${carbsPct}%</span>
            </div>
            <div class="text-xs font-black font-mono text-white mb-1.5">${Math.round(consumed.carbs)}g <span class="text-zinc-500 text-[10px]">/ ${Math.round(totals.carbs)}g</span></div>
            <div class="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full transition-all duration-500" style="width: ${carbsPct}%"></div>
            </div>
          </div>

          <!-- Grasas -->
          <div class="p-2.5 rounded-2xl bg-zinc-900/80 border border-white/[0.04]">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[10px] uppercase font-bold text-rose-400">🥑 Grasas</span>
              <span class="text-[10px] font-mono text-zinc-400">${fatPct}%</span>
            </div>
            <div class="text-xs font-black font-mono text-white mb-1.5">${Math.round(consumed.fat)}g <span class="text-zinc-500 text-[10px]">/ ${Math.round(totals.fat)}g</span></div>
            <div class="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-rose-400 to-pink-500 rounded-full transition-all duration-500" style="width: ${fatPct}%"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 5. Render Individual Meal Cards (Apple Frosted Card)
  let mealsHtml = '';
  meals.forEach(m => {
    const isEaten = !!state.nutritionLogs[m.id];
    const activeSwap = state.nutritionSwaps && state.nutritionSwaps[m.id];
    mealsHtml += `
      <div class="glass-panel p-4 rounded-3xl border border-white/[0.07] flex flex-col gap-2.5 transition-all ${isEaten ? 'opacity-65 bg-zinc-950/40' : ''}">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap mb-1">
              <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 tracking-wide">
                ${m.comida}
              </span>
              <span class="text-[11px] text-zinc-400 flex items-center gap-1 font-mono">
                <i data-lucide="clock" class="w-3 h-3 text-zinc-400"></i>
                ${m.horario || '-'}
              </span>
              <span class="text-[10px] text-emerald-400 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/30">
                100% Sin Gluten
              </span>
              <button type="button" onclick="openFoodSwapModal('${m.id}')" class="px-2 py-0.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-300 border border-white/[0.08] text-[10px] font-bold flex items-center gap-1 transition-all" title="Cambiar alimento por alternativa equivalente">
                <i data-lucide="refresh-cw" class="w-2.5 h-2.5 text-emerald-400"></i>
                <span>Cambiar</span>
              </button>
            </div>
            <h3 class="text-sm font-bold text-zinc-100 leading-snug tracking-tight">${m.plato}</h3>
            ${activeSwap ? `
              <div class="mt-1.5 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-2 text-xs">
                <div class="truncate text-[11px]">
                  <span class="font-bold text-emerald-400">🔄 Sustitución activa:</span>
                  <span class="text-emerald-200 font-medium ml-1">${activeSwap.name} (${activeSwap.amount})</span>
                  <span class="text-[10px] text-zinc-400 block font-mono">${activeSwap.macros}</span>
                </div>
                <button type="button" onclick="resetFoodSwap('${m.id}')" class="text-[10px] text-zinc-400 hover:text-rose-400 font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-white/[0.05]" title="Restablecer original">✕ Quitar</button>
              </div>
            ` : ''}
          </div>

          <button onclick="toggleMealEaten('${m.id}')" class="shrink-0 p-2 rounded-2xl border transition-all ${
            isEaten
              ? 'bg-gradient-to-r from-emerald-400 to-[#30d158] text-zinc-950 border-emerald-400 font-black shadow-sm shadow-emerald-500/30'
              : 'bg-zinc-900/80 text-zinc-400 hover:text-white border-white/[0.08]'
          }" title="Marcar como consumida">
            <i data-lucide="${isEaten ? 'check-circle-2' : 'circle'}" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Ingredients List with Grams -->
        <div class="bg-zinc-900/70 p-3 rounded-2xl border border-white/[0.04] text-xs text-zinc-300 leading-relaxed">
          <span class="text-[10px] font-bold uppercase text-zinc-400 tracking-wider block mb-1">Ingredientes y Gramajes (Crudo):</span>
          <p class="font-mono text-[11px] text-zinc-200">${m.ingredientes}</p>
        </div>

        <!-- Macros Grid -->
        <div class="grid grid-cols-4 gap-1.5 text-center text-xs">
          <div class="bg-zinc-900/50 p-1.5 rounded-xl border border-white/[0.03]">
            <span class="text-[9px] text-zinc-400 block uppercase">Kcal</span>
            <span class="font-mono font-bold text-emerald-300">${Math.round(m.calorias)}</span>
          </div>
          <div class="bg-zinc-900/50 p-1.5 rounded-xl border border-white/[0.03]">
            <span class="text-[9px] text-zinc-400 block uppercase">Proteína</span>
            <span class="font-mono font-bold text-zinc-200">${m.proteina}g</span>
          </div>
          <div class="bg-zinc-900/50 p-1.5 rounded-xl border border-white/[0.03]">
            <span class="text-[9px] text-zinc-400 block uppercase">Carbos</span>
            <span class="font-mono font-bold text-zinc-200">${m.carbohidratos}g</span>
          </div>
          <div class="bg-zinc-900/50 p-1.5 rounded-xl border border-white/[0.03]">
            <span class="text-[9px] text-zinc-400 block uppercase">Grasas</span>
            <span class="font-mono font-bold text-zinc-200">${m.grasas}g</span>
          </div>
        </div>

        ${m.micronutrientes ? `
          <div class="text-[11px] text-zinc-400 bg-emerald-950/20 border border-emerald-900/30 p-2.5 rounded-2xl flex items-start gap-2">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5"></i>
            <span class="leading-snug">${m.micronutrientes}</span>
          </div>
        ` : ''}
      </div>
    `;
  });

  container.innerHTML = mealsHtml;
  if (window.lucide) lucide.createIcons();
}

window.setNutritionWeek = function (w) {
  state.selectedWeek = w;
  const days = getAvailableNutritionDays(w);
  state.selectedNutriDay = days[0] || '';
  saveStateToStorage();
  renderNutrition();
};

window.setNutritionDay = function (encodedDay) {
  state.selectedNutriDay = decodeURIComponent(encodedDay);
  saveStateToStorage();
  renderNutrition();
};

window.toggleMealEaten = function (mealId) {
  state.nutritionLogs[mealId] = !state.nutritionLogs[mealId];
  saveStateToStorage();

  if (window.SyncService) {
    const m = state.nutritionData.find(item => item.id === mealId);
    window.SyncService.syncNutritionMeal({
      mealId: mealId,
      comidaTipo: m ? m.comida : 'Comida',
      platoNombre: m ? m.plato : '',
      completed: state.nutritionLogs[mealId],
      sinGluten: true,
      notas: ''
    });
  }

  renderNutrition();
  if (state.nutritionLogs[mealId]) {
    playTone(660, 0.1);
    showToast('✓ Comida registrada', 'success');
  }
};

// ============================================================================
// 6. PANTRY & ALDI SHOPPING LIST MODULE (APPLE FITNESS GREEN STYLING)
// ============================================================================

function renderPantry() {
  const container = document.getElementById('pantry-items-list');
  const countAtHome = document.getElementById('count-athome');
  const countToBuy = document.getElementById('count-tobuy');
  const categoriesContainer = document.getElementById('pantry-categories-chips');
  const btnAtHome = document.getElementById('btn-subview-athome');
  const btnToBuy = document.getElementById('btn-subview-tobuy');

  if (!container) return;

  const atHomeItems = state.pantryItems.filter(item => item.status === 'athome');
  const toBuyItems = state.pantryItems.filter(item => item.status === 'tobuy');

  if (countAtHome) countAtHome.textContent = atHomeItems.length;
  if (countToBuy) countToBuy.textContent = toBuyItems.length;

  if (state.pantryView === 'athome') {
    btnAtHome.className = 'flex-1 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-400/20 to-[#30d158]/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center gap-1.5 transition-all shadow-sm';
    btnToBuy.className = 'flex-1 py-2 text-xs font-semibold rounded-xl text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1.5 transition-all';
  } else {
    btnToBuy.className = 'flex-1 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-400/20 to-[#30d158]/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center gap-1.5 transition-all shadow-sm';
    btnAtHome.className = 'flex-1 py-2 text-xs font-semibold rounded-xl text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1.5 transition-all';
  }

  // SHOPPING MODE VIEW
  if (state.shoppingMode) {
    const checkedCount = Object.keys(state.shoppingCart).filter(id => state.shoppingCart[id]).length;
    
    // Group by Aldi aisles
    const aislesMap = {};
    toBuyItems.forEach(item => {
      const aisle = getAldiAisle(item.categoria, item.producto);
      if (!aislesMap[aisle]) aislesMap[aisle] = [];
      aislesMap[aisle].push(item);
    });

    let shoppingHtml = `
      <div class="glass-panel p-4 rounded-3xl border border-emerald-500/40 bg-emerald-950/30 shadow-xl flex flex-col gap-3 mb-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-lg border border-emerald-500/30">
              🛒
            </div>
            <div>
              <h3 class="text-sm font-black text-white tracking-tight">Supermercado Aldi</h3>
              <p class="text-[11px] text-emerald-300/80 font-mono">${checkedCount} de ${toBuyItems.length} en carrito</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <button onclick="checkoutShoppingList()" class="px-3 py-2 bg-gradient-to-r from-emerald-400 to-[#30d158] hover:opacity-90 active:scale-95 text-zinc-950 rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all">
              <i data-lucide="check" class="w-4 h-4 stroke-[3px]"></i>
              <span>Finalizar (${checkedCount})</span>
            </button>
            <button onclick="togglePantryShoppingMode()" class="p-2 text-zinc-400 hover:text-white bg-zinc-900 rounded-xl border border-white/[0.08]" title="Salir del modo supermercado">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
        <p class="text-[11px] text-zinc-400">Toca cada producto a medida que lo añades al carrito. Al finalizar, pasarán automáticamente a "En casa".</p>
      </div>
    `;

    if (toBuyItems.length === 0) {
      shoppingHtml += `
        <div class="text-center py-12 px-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30">
          <p class="text-xs text-zinc-400">¡Tu lista de la compra está vacía! Todos los productos están en casa.</p>
        </div>
      `;
    } else {
      Object.keys(aislesMap).sort().forEach(aisle => {
        const itemsInAisle = aislesMap[aisle];
        shoppingHtml += `
          <div class="mb-4">
            <h4 class="text-xs font-black text-emerald-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>${aisle}</span>
              <span class="text-[10px] text-zinc-500 font-mono">(${itemsInAisle.length})</span>
            </h4>
            <div class="space-y-2">
        `;

        itemsInAisle.forEach(item => {
          const isChecked = !!state.shoppingCart[item.id];
          shoppingHtml += `
            <div onclick="toggleShoppingItemCheck('${item.id}')"
              class="glass-panel p-3 rounded-2xl border cursor-pointer select-none transition-all flex items-center justify-between gap-3 ${
                isChecked
                  ? 'border-emerald-500/40 bg-emerald-950/20 shopping-checked'
                  : 'border-white/[0.07] hover:border-emerald-500/30 bg-zinc-900/70'
              }">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                  isChecked
                    ? 'bg-emerald-400 border-emerald-400 text-zinc-950 font-bold'
                    : 'border-white/20 bg-zinc-800/80 text-transparent'
                }">
                  <i data-lucide="check" class="w-4 h-4 stroke-[3px]"></i>
                </div>
                <div class="truncate">
                  <h4 class="text-xs font-bold text-zinc-100 truncate">${item.producto}</h4>
                  <p class="text-[11px] text-zinc-400 truncate">
                    ${item.marca ? `Marca: ${item.marca} • ` : ''}Cant: <strong class="text-emerald-300 font-mono">${item.cantidadSemanal || item.cantidadMensual || '1 ud'}</strong>
                  </p>
                </div>
              </div>
              ${item.aptoCeliaco ? `
                <span class="text-[9px] font-bold text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40 shrink-0">
                  🌾 Sin gluten
                </span>
              ` : ''}
            </div>
          `;
        });

        shoppingHtml += `
            </div>
          </div>
        `;
      });
    }

    container.innerHTML = shoppingHtml;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // STANDARD PANTRY VIEW
  // Category Chips
  const categories = Array.from(new Set(state.pantryItems.map(item => item.categoria).filter(Boolean))).sort();
  if (categoriesContainer) {
    let catHtml = `
      <button onclick="setPantryCategoryFilter('all')" class="px-3.5 py-1.5 rounded-full text-xs transition-all ${
        state.selectedCategory === 'all'
          ? 'bg-zinc-100 text-zinc-950 font-black shadow-md'
          : 'bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 border border-white/[0.05]'
      }">
        Todos (${state.pantryView === 'athome' ? atHomeItems.length : toBuyItems.length})
      </button>
    `;
    categories.forEach(cat => {
      const active = state.selectedCategory === cat;
      const count = state.pantryItems.filter(i => i.categoria === cat && i.status === state.pantryView).length;
      catHtml += `
        <button onclick="setPantryCategoryFilter('${encodeURIComponent(cat)}')" class="px-3.5 py-1.5 rounded-full text-xs transition-all ${
          active 
            ? 'bg-gradient-to-r from-emerald-400 to-[#30d158] text-zinc-950 font-black shadow-md shadow-emerald-500/20' 
            : 'bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 border border-white/[0.05]'
        }">
          ${cat} ${count > 0 ? `<span class="opacity-70 text-[10px] ml-1">(${count})</span>` : ''}
        </button>
      `;
    });
    categoriesContainer.innerHTML = catHtml;
  }

  // Filter Items
  const filtered = state.pantryItems.filter(item => {
    if (state.pantryView === 'athome' && item.status !== 'athome') return false;
    if (state.pantryView === 'tobuy' && item.status !== 'tobuy') return false;
    if (state.selectedCategory !== 'all' && item.categoria !== state.selectedCategory) return false;

    if (state.pantrySearch.trim()) {
      const q = state.pantrySearch.toLowerCase();
      const mProd = (item.producto || '').toLowerCase().includes(q);
      const mMarca = (item.marca || '').toLowerCase().includes(q);
      const mNotas = (item.notas || '').toLowerCase().includes(q);
      const mCat = (item.categoria || '').toLowerCase().includes(q);
      return mProd || mMarca || mNotas || mCat;
    }
    return true;
  });

  let topShoppingBtn = '';
  if (toBuyItems.length > 0) {
    topShoppingBtn = `
      <button onclick="togglePantryShoppingMode()" class="w-full py-2.5 px-4 mb-3 bg-gradient-to-r from-emerald-500/15 via-green-500/20 to-emerald-500/15 hover:from-emerald-500/25 hover:to-emerald-500/25 border border-emerald-500/35 rounded-2xl text-xs font-black text-emerald-300 flex items-center justify-center gap-2 shadow-sm transition-all">
        <i data-lucide="shopping-bag" class="w-4 h-4"></i>
        <span>Abrir Modo Supermercado Aldi (${toBuyItems.length} pendientes)</span>
      </button>
    `;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      ${topShoppingBtn}
      <div class="text-center py-12 px-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30">
        <p class="text-xs text-zinc-400">No hay productos en esta vista.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  let html = topShoppingBtn;
  filtered.forEach(item => {
    const isAtHome = item.status === 'athome';
    html += `
      <div class="glass-panel p-4 rounded-3xl border border-white/[0.07] hover:border-emerald-500/30 flex flex-col gap-2.5 transition-all">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap mb-1">
              <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-zinc-800/90 text-zinc-300 border border-white/[0.06]">
                ${item.categoria}
              </span>
              ${item.aptoCeliaco ? `
                <span class="text-[10px] font-semibold text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
                  🌾 ${item.aptoCeliaco}
                </span>
              ` : ''}
            </div>
            <h3 class="text-sm md:text-base font-bold text-zinc-100 truncate tracking-tight">${item.producto}</h3>
            <p class="text-xs text-zinc-400">Marca: <strong class="text-zinc-200">${item.marca || '-'}</strong> ${item.formato ? `• Formato: <span class="text-zinc-300">${item.formato}</span>` : ''}</p>
          </div>

          <button onclick="deletePantryItem('${item.id}', '${item.producto}')" class="p-1.5 text-zinc-500 hover:text-emerald-400 transition-colors" title="Eliminar">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs bg-zinc-900/70 p-2.5 rounded-2xl border border-white/[0.04]">
          <div>
            <span class="text-[10px] text-zinc-400 block font-medium uppercase tracking-wider">Cant. Semanal Aldi</span>
            <span class="font-semibold text-zinc-100 font-mono">${item.cantidadSemanal || '-'}</span>
          </div>
          <div>
            <span class="text-[10px] text-zinc-400 block font-medium uppercase tracking-wider">Cant. Mensual (x4)</span>
            <span class="font-semibold text-zinc-100 font-mono">${item.cantidadMensual || '-'}</span>
          </div>
        </div>

        ${item.notas ? `
          <p class="text-[11px] text-zinc-400 bg-zinc-900/40 p-2.5 rounded-2xl flex items-start gap-1.5 border border-white/[0.03]">
            <i data-lucide="map-pin" class="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5"></i>
            <span>${item.notas}</span>
          </p>
        ` : ''}

        <div class="flex justify-end pt-1 border-t border-white/[0.05]">
          <button onclick="togglePantryItemStatus('${item.id}')" class="badge-toggle px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            isAtHome
              ? 'bg-zinc-800/90 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-300 border border-white/[0.08]'
              : 'bg-gradient-to-r from-emerald-400/20 to-[#30d158]/20 hover:from-emerald-400/30 hover:to-[#30d158]/30 text-emerald-300 border border-emerald-500/40 shadow-sm'
          }">
            <i data-lucide="${isAtHome ? 'shopping-cart' : 'check'}" class="w-3.5 h-3.5"></i>
            <span>${isAtHome ? 'Falta / Pedir' : 'Comprado'}</span>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

window.setPantryView = function (v) {
  state.pantryView = v;
  saveStateToStorage();
  renderPantry();
};

function getAldiAisle(categoria, producto) {
  const text = `${categoria || ''} ${producto || ''}`.toLowerCase();
  if (text.includes('fruta') || text.includes('verdura') || text.includes('aguacate') || text.includes('platano') || text.includes('espinaca') || text.includes('tomate') || text.includes('patata') || text.includes('arandano') || text.includes('fresa') || text.includes('manzana')) {
    return '🥬 Frutas y Verduras Frescas';
  }
  if (text.includes('pollo') || text.includes('carne') || text.includes('ternera') || text.includes('salmon') || text.includes('atun') || text.includes('merluza') || text.includes('pavo') || text.includes('pescado')) {
    return '🥩 Carnes, Aves y Pescados';
  }
  if (text.includes('huevo') || text.includes('leche') || text.includes('queso') || text.includes('yogur') || text.includes('cottage') || text.includes('mozzarella') || text.includes('kefir')) {
    return '🥛 Lácteos, Huevos y Refrigerados';
  }
  if (text.includes('congelad') || text.includes('hielo')) {
    return '❄️ Congelados y Especialidades';
  }
  return '🥫 Despensa, Panadería y Cereales';
}

window.togglePantryShoppingMode = function () {
  state.shoppingMode = !state.shoppingMode;
  if (state.shoppingMode) {
    state.pantryView = 'tobuy';
  }
  renderPantry();
};

window.toggleShoppingItemCheck = function (itemId) {
  state.shoppingCart[itemId] = !state.shoppingCart[itemId];
  renderPantry();
};

window.checkoutShoppingList = function () {
  const checkedIds = Object.keys(state.shoppingCart).filter(id => state.shoppingCart[id]);
  if (checkedIds.length === 0) {
    showToast('Selecciona al menos un producto añadido al carrito', 'info');
    return;
  }

  checkedIds.forEach(id => {
    const item = state.pantryItems.find(i => i.id === id);
    if (item) {
      item.status = 'athome';
      if (window.SyncService) {
        window.SyncService.syncPantryItem({
          id: item.id,
          categoria: item.categoria,
          producto: item.producto,
          marca: item.marca,
          formato: item.formato,
          cantidadSemanal: item.cantidadSemanal,
          cantidadMensual: item.cantidadMensual,
          aptoCeliaco: item.aptoCeliaco,
          notas: item.notas,
          status: 'athome'
        });
      }
    }
  });

  state.shoppingCart = {};
  saveStateToStorage();
  playCelebrationFanfare();
  if (window.confetti) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  showToast(`🎉 ¡Compra finalizada! ${checkedIds.length} artículos guardados en la despensa.`, 'success');
  state.shoppingMode = false;
  state.pantryView = 'athome';
  renderPantry();
};

window.setPantryCategoryFilter = function (encodedCat) {
  state.selectedCategory = decodeURIComponent(encodedCat);
  renderPantry();
};

window.togglePantryItemStatus = function (id) {
  const item = state.pantryItems.find(i => i.id === id);
  if (!item) return;
  item.status = item.status === 'athome' ? 'tobuy' : 'athome';
  saveStateToStorage();

  if (window.SyncService) {
    window.SyncService.syncPantryItem(item);
  }

  renderPantry();
};

window.deletePantryItem = function (id, name) {
  if (confirm(`¿Eliminar "${name}" de la lista?`)) {
    state.pantryItems = state.pantryItems.filter(i => i.id !== id);
    saveStateToStorage();
    renderPantry();
    showToast(`Eliminado: ${name}`);
  }
};

window.markAllAsBought = function () {
  const toBuy = state.pantryItems.filter(i => i.status === 'tobuy');
  if (toBuy.length === 0) {
    showToast('No hay artículos pendientes en la lista de compras');
    return;
  }
  if (confirm(`¿Mover ${toBuy.length} producto(s) a "En Casa"?`)) {
    state.pantryItems.forEach(i => {
      if (i.status === 'tobuy') i.status = 'athome';
    });
    saveStateToStorage();
    renderPantry();
    showToast('🛒 ¡Lista de compras completada y guardada en casa!', 'success');
  }
};

// ============================================================================
// 7. WORKOUT MODULE (APPLE FITNESS GREEN SOBRIETY & PROGRESSIVE OVERLOAD)
// ============================================================================

function getAvailableWorkoutDays(week) {
  const filtered = state.workoutData.filter(item => item.semana === week);
  return Array.from(new Set(filtered.map(item => item.dia)));
}

function getPreviousWeekOverload(currentExercise) {
  if (state.selectedWeek <= 1) return null;
  const prevWeek = state.selectedWeek - 1;

  const prevEx = state.workoutData.find(
    e => e.semana === prevWeek && (e.patron === currentExercise.patron || e.orden === currentExercise.orden)
  );
  if (!prevEx) return null;

  const prevSets = [];
  for (let s = 1; s <= prevEx.series; s++) {
    const key = `${prevEx.id}_s${s}`;
    const log = state.workoutLogs[key];
    if (log && (log.completed || (log.weight !== '' && !isNaN(log.weight)))) {
      prevSets.push({ set: s, weight: parseFloat(log.weight) || 0, reps: parseInt(log.reps, 10) || 0, rir: log.rir });
    }
  }

  if (prevSets.length === 0) return null;
  const bestSet = prevSets.reduce((prev, curr) => (curr.weight > prev.weight ? curr : prev), prevSets[0]);

  return {
    prevWeek,
    bestSet,
    allSets: prevSets,
    targetText: `Meta: superar ${bestSet.weight} kg o hacer +1 rep`
  };
}

function getExercise4WeekTrajectory(currentExercise) {
  const patron = currentExercise.patron || '';
  const trajectory = [];
  let firstWeight = null;
  let lastWeight = null;

  for (let w = 1; w <= 4; w++) {
    const exInWeek = state.workoutData.find(e => e.semana === w && (e.patron === patron || e.orden === currentExercise.orden));
    let maxW = 0;
    if (exInWeek) {
      for (let s = 1; s <= exInWeek.series; s++) {
        const log = state.workoutLogs[`${exInWeek.id}_s${s}`];
        if (log && log.completed && parseFloat(log.weight) > maxW) {
          maxW = parseFloat(log.weight);
        }
      }
    }
    trajectory.push({ week: w, weight: maxW });
    if (maxW > 0) {
      if (firstWeight === null) firstWeight = maxW;
      lastWeight = maxW;
    }
  }

  let deltaText = '';
  if (firstWeight && lastWeight && lastWeight > firstWeight) {
    const diff = Math.round((lastWeight - firstWeight) * 10) / 10;
    const pct = Math.round((diff / firstWeight) * 100);
    deltaText = `+${diff}k (+${pct}%)`;
  }

  return { trajectory, deltaText };
}

function checkIsPersonalRecord(ex, currentWeight, currentReps) {
  const w = parseFloat(currentWeight);
  const r = parseFloat(currentReps);
  if (!w || isNaN(w) || w <= 0) return false;
  const currentE1RM = w * (1 + (r || 10) / 30);

  const patron = ex.patron || ex.varianteGym || '';
  let highestPrev1RM = 0;
  let highestPrevWeight = 0;
  let hasHistory = false;

  state.workoutData.forEach(otherEx => {
    if (otherEx.patron === patron || otherEx.orden === ex.orden) {
      for (let s = 1; s <= otherEx.series; s++) {
        const log = state.workoutLogs[`${otherEx.id}_s${s}`];
        if (log && log.completed) {
          const logW = parseFloat(log.weight);
          const logR = parseFloat(log.reps) || 10;
          if (logW > 0) {
            hasHistory = true;
            if (logW > highestPrevWeight) highestPrevWeight = logW;
            const e1rm = logW * (1 + logR / 30);
            if (e1rm > highestPrev1RM) highestPrev1RM = e1rm;
          }
        }
      }
    }
  });

  if (hasHistory && (w > highestPrevWeight || currentE1RM > highestPrev1RM * 1.005)) {
    return true;
  }
  return false;
}

function renderWorkout() {
  const container = document.getElementById('workout-exercises-list');
  const weeksContainer = document.getElementById('workout-weeks-selector');
  const daysContainer = document.getElementById('workout-days-selector');
  const progressBadge = document.getElementById('workout-progress-pct');
  const progressBar = document.getElementById('workout-progress-bar');
  const progressSummary = document.getElementById('workout-progress-summary');
  const locationToggle = document.getElementById('workout-location-toggle');

  if (!container) return;

  // 1. Render Week Selector (Apple Capsule Style)
  let weeksHtml = '';
  [1, 2, 3, 4].forEach(w => {
    const isActive = state.selectedWeek === w;
    weeksHtml += `
      <button onclick="setWorkoutWeek(${w})" class="px-3.5 py-1.5 rounded-full text-xs transition-all ${
        isActive
          ? 'bg-gradient-to-r from-emerald-400 to-[#30d158] text-zinc-950 font-black shadow-md shadow-emerald-500/20'
          : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-white/[0.05]'
      }">
        Semana ${w}
      </button>
    `;
  });
  if (weeksContainer) weeksContainer.innerHTML = weeksHtml;

  // 2. Render Day Selector
  const days = getAvailableWorkoutDays(state.selectedWeek);
  if (days.length > 0 && !days.includes(state.selectedWorkoutDay)) {
    state.selectedWorkoutDay = days[0];
  }

  let daysHtml = '';
  days.forEach(d => {
    const isActive = state.selectedWorkoutDay === d;
    daysHtml += `
      <button onclick="setWorkoutDay('${encodeURIComponent(d)}')" class="px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all ${
        isActive
          ? 'bg-zinc-100 text-zinc-950 font-bold shadow-md'
          : 'bg-zinc-900/90 text-zinc-400 hover:bg-zinc-850 border border-white/[0.04]'
      }">
        ${d}
      </button>
    `;
  });
  if (daysContainer) daysContainer.innerHTML = daysHtml;

  // 3. Location Mode Toggle & Wake Lock Indicator
  if (locationToggle) {
    locationToggle.innerHTML = `
      <div class="flex items-center gap-1.5 w-full">
        <button onclick="setTrainingLocation('gym')" class="flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
          state.trainingLocation === 'gym'
            ? 'bg-zinc-100 text-zinc-950 shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200'
        }">
          🏢 Gimnasio
        </button>
        <button onclick="setTrainingLocation('casa')" class="flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
          state.trainingLocation === 'casa'
            ? 'bg-zinc-100 text-zinc-950 shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200'
        }">
          🏠 Casa (Banco)
        </button>
        <button type="button" onclick="toggleScreenWakeLock()" id="workout-wakelock-btn" class="px-2.5 py-2 rounded-xl bg-zinc-900/90 border border-white/[0.08] hover:bg-zinc-800 text-[11px] font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-all shadow-sm" title="Pantalla siempre encendida">
          <span id="workout-wakelock-dot" class="w-2 h-2 rounded-full ${wakeLockSentinel ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}"></span>
          <i data-lucide="sun" class="w-3.5 h-3.5 text-zinc-300"></i>
        </button>
      </div>
    `;
  }

  // 4. Filter Exercises for Selected Week & Day
  const exercises = state.workoutData.filter(
    e => e.semana === state.selectedWeek && e.dia === state.selectedWorkoutDay
  );

  // 5. Calculate Progress & Spinal Telemetry
  let totalSets = 0;
  let completedSets = 0;
  let lumbarPainCount = 0;

  exercises.forEach(ex => {
    totalSets += ex.series;
    for (let s = 1; s <= ex.series; s++) {
      const log = state.workoutLogs[`${ex.id}_s${s}`];
      if (log && log.completed) completedSets++;
      if (log && log.molestia_dolor) lumbarPainCount++;
    }
  });

  const percentage = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  if (progressBadge) progressBadge.textContent = `${percentage}%`;
  if (progressBar) progressBar.style.width = `${percentage}%`;
  if (progressSummary) progressSummary.textContent = `${completedSets} de ${totalSets} series completadas`;

  if (exercises.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 px-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30">
        <p class="text-xs text-zinc-400">No hay ejercicios asignados para esta sesión.</p>
      </div>
    `;
    return;
  }

  let exHtml = '';

  // SPINAL SAFETY ALERT (FEATURE 8: SEMÁFORO RAQUÍDEO)
  if (lumbarPainCount >= 2) {
    exHtml += `
      <div class="mb-4 p-4 rounded-3xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex flex-col gap-2.5 shadow-lg shadow-amber-950/30 animate-pulse">
        <div class="flex items-center gap-2">
          <span class="p-1.5 rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm">🛡️ Semáforo Raquídeo</span>
          <span class="text-xs font-black text-amber-300 uppercase tracking-wider">Alerta Lumbar (${lumbarPainCount} avisos)</span>
        </div>
        <p class="text-xs text-amber-200/90 leading-relaxed font-medium">
          Has registrado 2 o más avisos de molestia en la sesión. Se activa el protocolo clínico de protección raquídea:
        </p>
        <ul class="text-[11px] text-amber-100/80 space-y-1 list-disc list-inside">
          <li><strong>Descompresión Axial:</strong> Cuélgate de una barra durante 30 segundos de forma pasiva.</li>
          <li><strong>Bracing Intra-abdominal:</strong> Asegura la contracción isométrica del core y mantén pelvis neutra.</li>
          <li><strong>Ajuste de Carga:</strong> Reduce el peso un 15-20% o pausa las series con compresión espinal vertical.</li>
        </ul>
      </div>
    `;
  }

  // 6. Render Exercise Cards
  exercises.forEach(ex => {
    const overload = getPreviousWeekOverload(ex);
    const trajectoryData = getExercise4WeekTrajectory(ex);
    const coachSuggestion = getSmartCoachSuggestion(ex);
    const activeSwap = state.exerciseSwaps && state.exerciseSwaps[ex.id];
    const baseVariant = state.trainingLocation === 'gym'
      ? (ex.varianteGym || ex.patron)
      : (ex.varianteCasa || ex.patron);
    const exerciseVariant = activeSwap ? activeSwap.altName : baseVariant;

    let setsTableHtml = '';
    for (let s = 1; s <= ex.series; s++) {
      const key = `${ex.id}_s${s}`;
      const log = state.workoutLogs[key] || { weight: '', reps: '', rir: '', completed: false, molestia_dolor: false, tempo_cumplido: true, notas: '' };
      const prevSet = overload ? overload.allSets.find(p => p.set === s) : null;
      const isPR = log.completed && checkIsPersonalRecord(ex, log.weight, log.reps);

      setsTableHtml += `
        <tr class="border-b border-white/[0.05] hover:bg-white/[0.02]">
          <td class="py-2 px-1 text-center font-mono">
            <div class="flex items-center justify-center gap-1">
              <span class="text-xs font-semibold text-zinc-400">#${s}</span>
              ${isPR ? `<span class="badge-pr px-1 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[8px] font-black uppercase">🏆PR</span>` : ''}
            </div>
            ${prevSet ? `
              <button type="button" onclick="copySinglePrevSet('${ex.id}', ${s}, ${prevSet.weight}, ${prevSet.reps}, '${prevSet.rir || ''}')"
                class="inline-block mt-0.5 px-1 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/25 active:scale-90 text-[9px] font-mono font-bold text-emerald-400 border border-emerald-500/20 transition-all"
                title="Tocar para copiar marca anterior: ${prevSet.weight}kg x ${prevSet.reps}reps">
                ${prevSet.weight}k
              </button>
            ` : ''}
          </td>
          <td class="py-2 px-1 text-center">
            <div class="inline-flex items-center justify-center gap-0.5">
              <button type="button" onclick="adjustWorkoutSetWeight('${ex.id}', ${s}, -2.5)"
                class="w-5 h-7 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 active:scale-90 text-[11px] font-black text-zinc-400 hover:text-white border border-white/[0.06] flex items-center justify-center transition-all select-none"
                title="Bajar 2.5 kg">
                -
              </button>
              <input type="number" step="0.5" id="input-weight-${ex.id}-${s}" placeholder="${prevSet ? prevSet.weight : 'kg'}" value="${log.weight !== undefined ? log.weight : ''}"
                onchange="saveWorkoutSetField('${ex.id}', ${s}, 'weight', this.value)"
                class="w-13 bg-zinc-900 border border-white/[0.08] rounded-lg py-1 text-xs text-center text-zinc-100 font-mono focus:border-emerald-400 focus:outline-none" />
              <button type="button" onclick="adjustWorkoutSetWeight('${ex.id}', ${s}, 2.5)"
                class="w-5 h-7 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 active:scale-90 text-[11px] font-black text-emerald-400 hover:text-emerald-300 border border-white/[0.06] flex items-center justify-center transition-all select-none"
                title="Subir 2.5 kg">
                +
              </button>
              <button type="button" onclick="openPlateCalculatorModal('${ex.id}', ${s}, document.getElementById('input-weight-${ex.id}-${s}')?.value || ${log.weight || 0})"
                class="w-6 h-7 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 active:scale-90 text-[10px] text-zinc-400 hover:text-emerald-300 border border-white/[0.06] flex items-center justify-center transition-all select-none ml-0.5"
                title="Calculadora visual de discos de barra">
                🏋️
              </button>
            </div>
          </td>
          <td class="py-2 px-1 text-center">
            <input type="number" id="input-reps-${ex.id}-${s}" placeholder="${prevSet ? prevSet.reps : (ex.reps.split('-')[0] || '10')}" value="${log.reps !== undefined ? log.reps : ''}"
              onchange="saveWorkoutSetField('${ex.id}', ${s}, 'reps', this.value)"
              class="w-11 bg-zinc-900/90 border border-white/[0.08] rounded-xl px-1 py-1 text-xs text-center text-zinc-100 font-mono focus:border-emerald-400 focus:outline-none" />
          </td>
          <td class="py-2 px-1 text-center">
            <input type="text" id="input-rir-${ex.id}-${s}" placeholder="${prevSet && prevSet.rir ? prevSet.rir : ex.rir}" value="${log.rir !== undefined ? log.rir : ''}"
              onchange="saveWorkoutSetField('${ex.id}', ${s}, 'rir', this.value)"
              class="w-10 bg-zinc-900/90 border border-white/[0.08] rounded-xl px-1 py-1 text-xs text-center text-zinc-100 font-mono focus:border-emerald-400 focus:outline-none" />
          </td>
          <td class="py-2 px-1 text-center">
            <button type="button" onclick="toggleWorkoutSetPain('${ex.id}', ${s})" class="px-2 py-1 rounded-xl text-xs transition-all ${log.molestia_dolor ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 font-bold shadow-sm' : 'text-zinc-600 hover:text-zinc-400 border border-transparent'}" title="${log.molestia_dolor ? 'Molestia registrada en serie' : 'Reportar molestia articular/lumbar'}">
              ⚠️
            </button>
          </td>
          <td class="py-2 px-2 text-center">
            <input type="checkbox" ${log.completed ? 'checked' : ''}
              onchange="toggleWorkoutSetDone('${ex.id}', ${s}, this.checked, ${ex.descanso}, '${encodeURIComponent(exerciseVariant)}')"
              class="set-checkbox" />
          </td>
        </tr>
      `;
    }

    // Trajectory indicators
    const trajectoryPills = trajectoryData.trajectory.map(t => {
      const isCur = t.week === state.selectedWeek;
      return `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono ${isCur ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 font-black' : 'bg-zinc-900 text-zinc-400'}">S${t.week}:${t.weight > 0 ? `${t.weight}k` : '-'}</span>`;
    }).join(' ');

    exHtml += `
      <div class="glass-panel p-4 rounded-3xl border border-white/[0.07] flex flex-col gap-3">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1">
            <div class="flex items-center gap-1.5 mb-1 flex-wrap">
              <span class="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black flex items-center justify-center font-mono">
                ${ex.orden}
              </span>
              <span class="text-xs font-black text-emerald-400 uppercase tracking-wider">${ex.series} Series</span>
              <span class="text-xs text-zinc-500">•</span>
              <span class="text-xs text-zinc-200 font-bold">${ex.reps} Reps</span>
              <span class="text-xs text-zinc-500">•</span>
              <span class="text-xs text-emerald-300 font-bold">RIR ${ex.rir}</span>
              <span class="text-xs text-zinc-500">•</span>
              <span class="text-[11px] font-mono text-zinc-400">${ex.tempo}</span>
            </div>
            <h3 class="text-base font-bold text-zinc-100 leading-snug tracking-tight">${exerciseVariant}</h3>
            <p class="text-[11px] text-zinc-400 mt-0.5">Patrón: <span class="text-zinc-300">${ex.patron}</span></p>

            ${activeSwap ? `
              <div class="mt-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-2 text-xs">
                <div class="truncate text-[11px]">
                  <span class="font-bold text-emerald-400">⇄ Alternativa activa:</span>
                  <span class="text-emerald-200 font-medium ml-1">${activeSwap.altName} (${activeSwap.equipment})</span>
                  <span class="text-[10px] text-zinc-400 block">${activeSwap.biomechanics}</span>
                </div>
                <button type="button" onclick="resetExerciseSwap('${ex.id}')" class="text-[10px] text-zinc-400 hover:text-rose-400 font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-white/[0.05]" title="Volver al original">✕ Quitar</button>
              </div>
            ` : ''}
          </div>

          <div class="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <button onclick="openExerciseSwapModal('${ex.id}')" class="px-2.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-300 border border-white/[0.07] text-xs font-semibold flex items-center gap-1 transition-all shadow-sm" title="Cambiar ejercicio por máquina ocupada o molestia">
              <i data-lucide="shuffle" class="w-3.5 h-3.5 text-emerald-400"></i>
              <span>Alternativa</span>
            </button>
            <button onclick="openFocusModeModal('${ex.id}')" class="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400/20 to-[#30d158]/20 hover:from-emerald-400/30 hover:to-[#30d158]/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 transition-all" title="Modo Foco Manos Sudorosas">
              <i data-lucide="zap" class="w-3.5 h-3.5"></i>
              <span>Foco</span>
            </button>
            <button onclick="startTimer(${ex.descanso}, '${encodeURIComponent(exerciseVariant)}')" class="px-2 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border border-white/[0.07] text-xs font-medium flex items-center gap-1 transition-all shadow-sm">
              <i data-lucide="timer" class="w-4 h-4 text-emerald-400"></i>
              <span>${ex.descanso}s</span>
            </button>
          </div>
        </div>

        <!-- 4-Week Strength Progression Trajectory (Feature 5) -->
        <div class="bg-zinc-900/60 p-2.5 rounded-2xl border border-white/[0.04] flex items-center justify-between gap-2 flex-wrap text-xs">
          <div class="flex items-center gap-1 flex-wrap">
            <span class="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mr-1">Progreso 4S:</span>
            ${trajectoryPills}
          </div>
          ${trajectoryData.deltaText ? `
            <span class="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 font-bold text-[10px]">
              📈 ${trajectoryData.deltaText}
            </span>
          ` : ''}
        </div>

        <!-- Smart Coach Progression Objective (Feature 4) -->
        ${coachSuggestion ? `
          <div onclick="applySmartCoachSuggestion('${ex.id}', ${coachSuggestion.weight}, ${coachSuggestion.reps})" class="cursor-pointer bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-emerald-500/5 hover:from-emerald-500/20 border border-emerald-500/25 rounded-2xl p-2.5 flex items-center justify-between gap-2 text-xs transition-all shadow-sm">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-6 h-6 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs shrink-0 font-bold">🎯</span>
              <div class="truncate">
                <span class="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">Smart Coach (S${state.selectedWeek}):</span>
                <span class="text-[11px] font-semibold text-zinc-200">${coachSuggestion.text}</span>
              </div>
            </div>
            <span class="text-[10px] font-black text-zinc-950 bg-emerald-400 hover:bg-emerald-300 px-2.5 py-1 rounded-xl shrink-0 flex items-center gap-1 shadow-sm">
              <span>Aplicar</span> ⚡
            </span>
          </div>
        ` : ''}

        ${overload ? `
          <div class="bg-gradient-to-r from-emerald-950/30 to-green-950/20 border border-emerald-500/30 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2 min-w-0">
              <span class="p-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-black text-[11px]">📈 Sem. ${overload.prevWeek}</span>
              <div class="truncate">
                <span class="font-bold text-emerald-200">${overload.bestSet.weight} kg × ${overload.bestSet.reps} reps</span>
                <span class="text-[11px] text-zinc-400 block">${overload.targetText}</span>
              </div>
            </div>
            <button onclick="copyPreviousWeekWeights('${ex.id}')" class="px-3 py-1.5 bg-gradient-to-r from-emerald-400/20 to-[#30d158]/20 hover:from-emerald-400/30 hover:to-[#30d158]/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors">
              <i data-lucide="copy" class="w-3 h-3"></i>
              <span>Copiar todo</span>
            </button>
          </div>
        ` : ''}

        ${ex.notas ? `
          <div class="text-xs text-zinc-400 bg-zinc-900/60 border border-white/[0.04] p-3 rounded-2xl flex items-start gap-2">
            <i data-lucide="info" class="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5"></i>
            <span class="text-zinc-300 leading-relaxed">${ex.notas}</span>
          </div>
        ` : ''}

        <!-- Interactive Sets Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="text-[10px] uppercase text-zinc-400 tracking-wider border-b border-white/[0.06]">
                <th class="py-1 px-1 text-center w-14">Serie</th>
                <th class="py-1 px-1 text-center w-36">Kg (+/-) 🏋️</th>
                <th class="py-1 px-1 text-center w-13">Reps</th>
                <th class="py-1 px-1 text-center w-12">RIR</th>
                <th class="py-1 px-1 text-center w-10" title="Dolor / Molestia">Alerta</th>
                <th class="py-1 px-2 text-center w-12">Hecho</th>
              </tr>
            </thead>
            <tbody>
              ${setsTableHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });

  container.innerHTML = exHtml;
  renderDailyCheckinUI();
  if (window.lucide) lucide.createIcons();
}

window.setWorkoutWeek = function (w) {
  state.selectedWeek = w;
  const days = getAvailableWorkoutDays(w);
  state.selectedWorkoutDay = days[0] || '';
  saveStateToStorage();
  renderWorkout();
};

window.setWorkoutDay = function (encodedDay) {
  state.selectedWorkoutDay = decodeURIComponent(encodedDay);
  saveStateToStorage();
  renderWorkout();
};

window.setTrainingLocation = function (loc) {
  state.trainingLocation = loc;
  saveStateToStorage();
  renderWorkout();
};

window.saveWorkoutSetField = function (exId, setIndex, field, value) {
  const key = `${exId}_s${setIndex}`;
  if (!state.workoutLogs[key]) state.workoutLogs[key] = { weight: '', reps: '', rir: '', completed: false, molestia_dolor: false, tempo_cumplido: true, notas: '' };
  state.workoutLogs[key][field] = value;
  saveStateToStorage();

  // Sincronización transparente con Supabase / IndexedDB
  if (window.SyncService) {
    const ex = state.workoutData.find(e => e.id === exId);
    window.SyncService.syncWorkoutSet({
      semana: state.selectedWeek,
      dia: state.selectedWorkoutDay,
      ejercicioId: exId,
      ejercicioNombre: ex ? (ex.varianteGym || ex.patron) : exId,
      setIndex: setIndex,
      weight: state.workoutLogs[key].weight,
      reps: state.workoutLogs[key].reps,
      rir: state.workoutLogs[key].rir,
      tempo_cumplido: state.workoutLogs[key].tempo_cumplido,
      molestia_dolor: state.workoutLogs[key].molestia_dolor,
      notas: state.workoutLogs[key].notas,
      completed: state.workoutLogs[key].completed,
      clientLogKey: key
    });
  }

  const exercises = state.workoutData.filter(e => e.semana === state.selectedWeek && e.dia === state.selectedWorkoutDay);
  let totalSets = 0;
  let completedSets = 0;
  exercises.forEach(ex => {
    totalSets += ex.series;
    for (let s = 1; s <= ex.series; s++) {
      if (state.workoutLogs[`${ex.id}_s${s}`]?.completed) completedSets++;
    }
  });
  const pct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  const badge = document.getElementById('workout-progress-pct');
  const bar = document.getElementById('workout-progress-bar');
  const sum = document.getElementById('workout-progress-summary');
  if (badge) badge.textContent = `${pct}%`;
  if (bar) bar.style.width = `${pct}%`;
  if (sum) sum.textContent = `${completedSets} de ${totalSets} series completadas`;
};

window.toggleWorkoutSetPain = function (exId, setIndex) {
  const key = `${exId}_s${setIndex}`;
  if (!state.workoutLogs[key]) state.workoutLogs[key] = { weight: '', reps: '', rir: '', completed: false, molestia_dolor: false, tempo_cumplido: true, notas: '' };
  state.workoutLogs[key].molestia_dolor = !state.workoutLogs[key].molestia_dolor;
  saveStateToStorage();

  if (window.SyncService) {
    const ex = state.workoutData.find(e => e.id === exId);
    window.SyncService.syncWorkoutSet({
      semana: state.selectedWeek,
      dia: state.selectedWorkoutDay,
      ejercicioId: exId,
      ejercicioNombre: ex ? (ex.varianteGym || ex.patron) : exId,
      setIndex: setIndex,
      weight: state.workoutLogs[key].weight,
      reps: state.workoutLogs[key].reps,
      rir: state.workoutLogs[key].rir,
      tempo_cumplido: state.workoutLogs[key].tempo_cumplido,
      molestia_dolor: state.workoutLogs[key].molestia_dolor,
      notas: state.workoutLogs[key].notas,
      completed: state.workoutLogs[key].completed,
      clientLogKey: key
    });
  }

  if (state.workoutLogs[key].molestia_dolor) {
    showToast('⚠️ Molestia registrada en serie. Cuida la alineación raquídea.', 'info');
  }
  renderWorkout();
};

window.toggleWorkoutSetDone = function (exId, setIndex, isDone, restSeconds, encodedName) {
  const key = `${exId}_s${setIndex}`;
  if (!state.workoutLogs[key]) state.workoutLogs[key] = { weight: '', reps: '', rir: '', completed: false, molestia_dolor: false, tempo_cumplido: true, notas: '' };
  state.workoutLogs[key].completed = isDone;
  saveStateToStorage();

  if (window.SyncService) {
    const ex = state.workoutData.find(e => e.id === exId);
    window.SyncService.syncWorkoutSet({
      semana: state.selectedWeek,
      dia: state.selectedWorkoutDay,
      ejercicioId: exId,
      ejercicioNombre: ex ? (ex.varianteGym || ex.patron) : exId,
      setIndex: setIndex,
      weight: state.workoutLogs[key].weight,
      reps: state.workoutLogs[key].reps,
      rir: state.workoutLogs[key].rir,
      tempo_cumplido: state.workoutLogs[key].tempo_cumplido,
      molestia_dolor: state.workoutLogs[key].molestia_dolor,
      notas: state.workoutLogs[key].notas,
      completed: isDone,
      clientLogKey: key
    });
  }

  const name = decodeURIComponent(encodedName);

  if (isDone) {
    playTone(660, 0.12);

    const ex = state.workoutData.find(e => e.id === exId);
    const weight = parseFloat(state.workoutLogs[key]?.weight);
    const reps = parseFloat(state.workoutLogs[key]?.reps);
    if (ex && weight > 0 && checkIsPersonalRecord(ex, weight, reps)) {
      playCelebrationFanfare();
      if (window.confetti) confetti({ particleCount: 95, spread: 65, origin: { y: 0.65 } });
      showToast(`🏆 ¡NUEVO RÉCORD PERSONAL! ${weight} kg × ${reps || 10} reps en ${name}`, 'success');
    }

    if (state.settings.autoStartTimer && restSeconds > 0) {
      startTimer(restSeconds, `Descanso: ${name}`);
      showToast(`⏱️ Descanso iniciado (${restSeconds}s)`, 'info');
    }

    const exercises = state.workoutData.filter(e => e.semana === state.selectedWeek && e.dia === state.selectedWorkoutDay);
    let allDone = true;
    exercises.forEach(ex => {
      for (let s = 1; s <= ex.series; s++) {
        if (!state.workoutLogs[`${ex.id}_s${s}`]?.completed) allDone = false;
      }
    });

    if (allDone && exercises.length > 0) {
      playCelebrationFanfare();
      if (window.confetti) confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      showToast('🎉 ¡Entrenamiento completado al 100%! Excelente trabajo.', 'success');
    }
  }

  renderWorkout();
};

window.copyPreviousWeekWeights = function (currentExId) {
  const currentEx = state.workoutData.find(e => e.id === currentExId);
  if (!currentEx) return;

  const overload = getPreviousWeekOverload(currentEx);
  if (!overload || overload.allSets.length === 0) {
    showToast('No hay registros previos para copiar', 'error');
    return;
  }

  overload.allSets.forEach(prevSet => {
    if (prevSet.set <= currentEx.series) {
      const key = `${currentEx.id}_s${prevSet.set}`;
      if (!state.workoutLogs[key]) state.workoutLogs[key] = { weight: '', reps: '', rir: '', completed: false, molestia_dolor: false, tempo_cumplido: true, notas: '' };
      state.workoutLogs[key].weight = prevSet.weight;
      state.workoutLogs[key].reps = prevSet.reps || '';
      state.workoutLogs[key].rir = prevSet.rir || '';

      if (window.SyncService) {
        window.SyncService.syncWorkoutSet({
          semana: state.selectedWeek,
          dia: state.selectedWorkoutDay,
          ejercicioId: currentEx.id,
          ejercicioNombre: currentEx.varianteGym || currentEx.patron,
          setIndex: prevSet.set,
          weight: prevSet.weight,
          reps: prevSet.reps || '',
          rir: prevSet.rir || '',
          tempo_cumplido: state.workoutLogs[key].tempo_cumplido,
          molestia_dolor: state.workoutLogs[key].molestia_dolor,
          notas: state.workoutLogs[key].notas,
          completed: state.workoutLogs[key].completed,
          clientLogKey: key
        });
      }
    }
  });

  saveStateToStorage();
  renderWorkout();
  showToast('📈 Pesos de la semana anterior copiados', 'success');
};

window.copySinglePrevSet = function (exId, setIndex, weight, reps, rir) {
  const key = `${exId}_s${setIndex}`;
  if (!state.workoutLogs[key]) {
    state.workoutLogs[key] = { weight: '', reps: '', rir: '', completed: false, molestia_dolor: false, tempo_cumplido: true, notas: '' };
  }
  state.workoutLogs[key].weight = weight;
  if (reps) state.workoutLogs[key].reps = reps;
  if (rir) state.workoutLogs[key].rir = rir;

  saveStateToStorage();

  const inputW = document.getElementById(`input-weight-${exId}-${setIndex}`);
  if (inputW) inputW.value = weight;
  const inputR = document.getElementById(`input-reps-${exId}-${setIndex}`);
  if (inputR && reps) inputR.value = reps;
  const inputRir = document.getElementById(`input-rir-${exId}-${setIndex}`);
  if (inputRir && rir) inputRir.value = rir;

  if (window.SyncService) {
    const ex = state.workoutData.find(e => e.id === exId);
    window.SyncService.syncWorkoutSet({
      semana: state.selectedWeek,
      dia: state.selectedWorkoutDay,
      ejercicioId: exId,
      ejercicioNombre: ex ? (ex.varianteGym || ex.patron) : exId,
      setIndex: setIndex,
      weight: weight,
      reps: state.workoutLogs[key].reps,
      rir: state.workoutLogs[key].rir,
      tempo_cumplido: state.workoutLogs[key].tempo_cumplido,
      molestia_dolor: state.workoutLogs[key].molestia_dolor,
      notas: state.workoutLogs[key].notas,
      completed: state.workoutLogs[key].completed,
      clientLogKey: key
    });
  }

  showToast(`Serie #${setIndex}: ${weight} kg × ${reps} reps copiadas`, 'info');
};

window.adjustWorkoutSetWeight = function (exId, setIndex, delta) {
  const key = `${exId}_s${setIndex}`;
  if (!state.workoutLogs[key]) {
    state.workoutLogs[key] = { weight: '', reps: '', rir: '', completed: false, molestia_dolor: false, tempo_cumplido: true, notas: '' };
  }

  let currentWeight = parseFloat(state.workoutLogs[key].weight);
  if (isNaN(currentWeight)) {
    const ex = state.workoutData.find(e => e.id === exId);
    const overload = ex ? getPreviousWeekOverload(ex) : null;
    const prevSet = overload ? overload.allSets.find(p => p.set === setIndex) : null;
    currentWeight = prevSet ? parseFloat(prevSet.weight) || 0 : 0;
  }

  const newWeight = Math.max(0, Math.round((currentWeight + delta) * 10) / 10);
  state.workoutLogs[key].weight = newWeight;
  saveStateToStorage();

  const inputEl = document.getElementById(`input-weight-${exId}-${setIndex}`);
  if (inputEl) inputEl.value = newWeight;

  if (window.SyncService) {
    const ex = state.workoutData.find(e => e.id === exId);
    window.SyncService.syncWorkoutSet({
      semana: state.selectedWeek,
      dia: state.selectedWorkoutDay,
      ejercicioId: exId,
      ejercicioNombre: ex ? (ex.varianteGym || ex.patron) : exId,
      setIndex: setIndex,
      weight: newWeight,
      reps: state.workoutLogs[key].reps,
      rir: state.workoutLogs[key].rir,
      tempo_cumplido: state.workoutLogs[key].tempo_cumplido,
      molestia_dolor: state.workoutLogs[key].molestia_dolor,
      notas: state.workoutLogs[key].notas,
      completed: state.workoutLogs[key].completed,
      clientLogKey: key
    });
  }
};

window.resetDayWorkoutPrompt = function () {
  if (confirm(`¿Reiniciar registros de hoy (${state.selectedWorkoutDay})?`)) {
    const exercises = state.workoutData.filter(e => e.semana === state.selectedWeek && e.dia === state.selectedWorkoutDay);
    exercises.forEach(ex => {
      for (let s = 1; s <= ex.series; s++) {
        delete state.workoutLogs[`${ex.id}_s${s}`];
      }
    });
    saveStateToStorage();
    renderWorkout();
    showToast('Sesión de entrenamiento reiniciada');
  }
};

// ============================================================================
// 8. SWEAT-PROOF FOCUS MODE (APPLE WATCH ULTRA LUXURY WORKOUT UI)
// ============================================================================

window.openFocusModeModal = function (exId) {
  const ex = state.workoutData.find(e => e.id === exId);
  if (!ex) return;

  let nextSet = 1;
  for (let s = 1; s <= ex.series; s++) {
    if (!state.workoutLogs[`${ex.id}_s${s}`]?.completed) {
      nextSet = s;
      break;
    }
  }

  state.focus = {
    active: true,
    exercise: ex,
    setIndex: nextSet
  };

  renderFocusModeModal();
  document.getElementById('modal-focus-mode')?.classList.remove('hidden');
};

window.closeFocusModeModal = function () {
  state.focus.active = false;
  document.getElementById('modal-focus-mode')?.classList.add('hidden');
  renderWorkout();
};

function renderFocusModeModal() {
  const modal = document.getElementById('modal-focus-mode');
  if (!modal || !state.focus.exercise) return;

  const ex = state.focus.exercise;
  const currentSet = state.focus.setIndex;
  const logKey = `${ex.id}_s${currentSet}`;
  const log = state.workoutLogs[logKey] || { weight: '', reps: '', rir: '', completed: false };

  const exerciseName = state.trainingLocation === 'gym'
    ? (ex.varianteGym || ex.patron)
    : (ex.varianteCasa || ex.patron);

  const overload = getPreviousWeekOverload(ex);
  const currentWeight = log.weight !== '' && !isNaN(log.weight)
    ? parseFloat(log.weight)
    : (overload && overload.bestSet ? overload.bestSet.weight : 50);

  const currentReps = log.reps !== '' && !isNaN(log.reps)
    ? parseInt(log.reps, 10)
    : parseInt(ex.reps.split('-')[0] || 8, 10);

  const currentRir = log.rir !== '' ? log.rir : ex.rir;

  let dotsHtml = '';
  for (let s = 1; s <= ex.series; s++) {
    const isCur = s === currentSet;
    const isDone = !!state.workoutLogs[`${ex.id}_s${s}`]?.completed;
    dotsHtml += `
      <button onclick="setFocusSetIndex(${s})" class="flex-1 py-3 rounded-2xl text-xs font-black transition-all ${
        isCur
          ? 'bg-gradient-to-r from-emerald-400 to-[#30d158] text-zinc-950 ring-2 ring-emerald-300 shadow-lg shadow-emerald-500/25'
          : isDone
          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
          : 'bg-zinc-900 text-zinc-400 border border-white/[0.05]'
      }">
        S${s} ${isDone ? '✓' : ''}
      </button>
    `;
  }

  modal.innerHTML = `
    <div class="w-full max-w-md bg-[#090d0a] border border-white/[0.08] sm:rounded-3xl p-6 flex flex-col gap-4 shadow-2xl safe-bottom min-h-screen sm:min-h-0 justify-between">
      
      <div class="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div class="flex items-center gap-2">
          <span class="w-8 h-8 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-[#30d158]/20 text-emerald-400 flex items-center justify-center font-black text-sm border border-emerald-500/30">
            ⚡
          </span>
          <div>
            <span class="text-[10px] uppercase font-bold text-emerald-400/90 tracking-wider">Modo Gimnasio • Serie ${currentSet} de ${ex.series}</span>
            <h2 class="text-base font-black text-zinc-100 truncate tracking-tight">${exerciseName}</h2>
          </div>
        </div>
        <button onclick="closeFocusModeModal()" class="p-2 bg-zinc-900/90 text-zinc-400 hover:text-white rounded-2xl border border-white/[0.08]">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <div class="flex items-center gap-1.5">
        ${dotsHtml}
      </div>

      <div class="bg-zinc-900/80 border border-emerald-500/20 p-3 rounded-2xl text-center text-xs text-zinc-200">
        ${overload && overload.bestSet
          ? `Semana anterior: <strong class="text-emerald-300">${overload.bestSet.weight} kg × ${overload.bestSet.reps} reps</strong>`
          : `Objetivo: <strong class="text-emerald-300">${ex.reps} reps @ RIR ${ex.rir} (${ex.tempo})</strong>`}
      </div>

      <!-- Massive Apple Weight Control -->
      <div class="glass-panel p-5 rounded-3xl border border-white/[0.08] flex flex-col items-center justify-center gap-2">
        <span class="text-[10px] uppercase font-bold text-emerald-300/80 tracking-wider">Peso Levantado</span>
        <div class="flex items-center justify-center gap-2">
          <span class="font-mono text-5xl sm:text-6xl font-black text-white tracking-tight">${currentWeight}</span>
          <span class="text-xl font-bold text-emerald-300/80">kg</span>
        </div>

        <div class="grid grid-cols-4 gap-2 w-full mt-3">
          <button onclick="adjustFocusWeight(-5)" class="sweat-proof-btn bg-zinc-900/90 hover:bg-zinc-800 border border-white/[0.08] rounded-2xl text-xs font-bold text-zinc-300 flex items-center justify-center shadow-sm">
            -5 kg
          </button>
          <button onclick="adjustFocusWeight(-1.25)" class="sweat-proof-btn bg-zinc-900/90 hover:bg-zinc-800 border border-white/[0.08] rounded-2xl text-xs font-bold text-zinc-300 flex items-center justify-center shadow-sm">
            -1.25 kg
          </button>
          <button onclick="adjustFocusWeight(1.25)" class="sweat-proof-btn bg-zinc-900/90 hover:bg-zinc-800 border border-emerald-500/30 rounded-2xl text-xs font-bold text-emerald-300 flex items-center justify-center shadow-sm">
            +1.25 kg
          </button>
          <button onclick="adjustFocusWeight(2.5)" class="sweat-proof-btn bg-zinc-900/90 hover:bg-zinc-800 border border-emerald-500/30 rounded-2xl text-xs font-bold text-emerald-300 flex items-center justify-center shadow-sm">
            +2.5 kg
          </button>
        </div>
      </div>

      <!-- Reps & RIR -->
      <div class="grid grid-cols-2 gap-3">
        <div class="glass-panel p-4 rounded-3xl border border-white/[0.08] flex flex-col items-center justify-center gap-2">
          <span class="text-[10px] uppercase font-bold text-emerald-300/80 tracking-wider">Reps Hechas</span>
          <div class="flex items-center justify-center gap-3 w-full">
            <button onclick="adjustFocusReps(-1)" class="sweat-proof-btn w-12 h-12 bg-zinc-900 border border-white/[0.08] rounded-2xl font-black text-xl text-zinc-300 flex items-center justify-center">
              -
            </button>
            <span class="font-mono text-3xl font-black text-emerald-300">${currentReps}</span>
            <button onclick="adjustFocusReps(1)" class="sweat-proof-btn w-12 h-12 bg-zinc-900 border border-white/[0.08] rounded-2xl font-black text-xl text-zinc-300 flex items-center justify-center">
              +
            </button>
          </div>
        </div>

        <div class="glass-panel p-4 rounded-3xl border border-white/[0.08] flex flex-col items-center justify-center gap-2">
          <span class="text-[10px] uppercase font-bold text-emerald-300/80 tracking-wider">RIR Alcanzado</span>
          <div class="grid grid-cols-3 gap-1.5 w-full">
            <button onclick="setFocusRir('0')" class="py-2.5 rounded-xl text-xs font-bold ${currentRir == '0' ? 'bg-gradient-to-r from-emerald-400 to-[#30d158] text-zinc-950 font-black shadow-md' : 'bg-zinc-900 text-zinc-400 border border-white/[0.06]'}">0</button>
            <button onclick="setFocusRir('1')" class="py-2.5 rounded-xl text-xs font-bold ${currentRir == '1' ? 'bg-gradient-to-r from-emerald-400 to-[#30d158] text-zinc-950 font-black shadow-md' : 'bg-zinc-900 text-zinc-400 border border-white/[0.06]'}">1</button>
            <button onclick="setFocusRir('2')" class="py-2.5 rounded-xl text-xs font-bold ${currentRir == '2' ? 'bg-gradient-to-r from-emerald-400 to-[#30d158] text-zinc-950 font-black shadow-md' : 'bg-zinc-900 text-zinc-400 border border-white/[0.06]'}">2</button>
          </div>
        </div>
      </div>

      <!-- Pain / Discomfort Indicator in Focus Mode -->
      <div class="flex items-center justify-between p-3 rounded-2xl border ${log.molestia_dolor ? 'bg-amber-950/30 border-amber-500/40 text-amber-300' : 'bg-zinc-900/60 border-white/[0.05] text-zinc-400'}">
        <div class="flex items-center gap-2">
          <span class="text-base">${log.molestia_dolor ? '⚠️' : '🛡️'}</span>
          <span class="text-xs font-semibold">${log.molestia_dolor ? 'Molestia lumbo-articular reportada' : 'Sin molestias articulares'}</span>
        </div>
        <button type="button" onclick="toggleFocusSetPain()" class="px-3 py-1 rounded-xl text-xs font-bold border transition-all ${log.molestia_dolor ? 'bg-amber-500/25 border-amber-500/40 text-amber-200' : 'bg-zinc-800 border-white/[0.08] text-zinc-300 hover:text-white'}">
          ${log.molestia_dolor ? 'Quitar Alerta' : 'Reportar Molestia'}
        </button>
      </div>

      <!-- HUGE COMPLETION BUTTON IN APPLE APPLE FITNESS GREEN -->
      <div class="pt-2 flex flex-col gap-2.5">
        <button onclick="completeFocusSetAction()" class="sweat-proof-btn pulse-action w-full py-4 px-6 bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-500 hover:opacity-95 text-zinc-950 font-black text-base sm:text-lg rounded-2xl shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-3">
          <i data-lucide="check-circle" class="w-6 h-6 stroke-[2.5px]"></i>
          <span>COMPLETAR SERIE Y DESCANSAR (${ex.descanso}s)</span>
        </button>

        <div class="flex items-center justify-between text-xs text-zinc-400 px-1">
          <button onclick="navigateFocusExercise(-1)" class="p-2 hover:text-zinc-200 flex items-center gap-1">
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
            <span>Ejercicio ant.</span>
          </button>
          <button onclick="navigateFocusExercise(1)" class="p-2 hover:text-zinc-200 flex items-center gap-1">
            <span>Siguiente ej.</span>
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </button>
        </div>
      </div>

    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

window.toggleFocusSetPain = function () {
  const ex = state.focus.exercise;
  const s = state.focus.setIndex;
  const key = `${ex.id}_s${s}`;
  if (!state.workoutLogs[key]) state.workoutLogs[key] = { weight: 50, reps: 8, rir: '2', completed: false, molestia_dolor: false };
  state.workoutLogs[key].molestia_dolor = !state.workoutLogs[key].molestia_dolor;
  saveStateToStorage();
  renderFocusModeModal();
};

window.setFocusSetIndex = function (idx) {
  state.focus.setIndex = idx;
  renderFocusModeModal();
};

window.adjustFocusWeight = function (delta) {
  const ex = state.focus.exercise;
  const s = state.focus.setIndex;
  const key = `${ex.id}_s${s}`;
  if (!state.workoutLogs[key]) state.workoutLogs[key] = { weight: 50, reps: 8, rir: '2', completed: false };
  let w = parseFloat(state.workoutLogs[key].weight);
  if (isNaN(w) || w <= 0) w = 50;
  w = Math.max(0, parseFloat((w + delta).toFixed(2)));
  state.workoutLogs[key].weight = w;
  saveStateToStorage();
  renderFocusModeModal();
};

window.adjustFocusReps = function (delta) {
  const ex = state.focus.exercise;
  const s = state.focus.setIndex;
  const key = `${ex.id}_s${s}`;
  if (!state.workoutLogs[key]) state.workoutLogs[key] = { weight: 50, reps: 8, rir: '2', completed: false };
  let r = parseInt(state.workoutLogs[key].reps, 10);
  if (isNaN(r)) r = 8;
  r = Math.max(1, r + delta);
  state.workoutLogs[key].reps = r;
  saveStateToStorage();
  renderFocusModeModal();
};

window.setFocusRir = function (rirVal) {
  const ex = state.focus.exercise;
  const s = state.focus.setIndex;
  const key = `${ex.id}_s${s}`;
  if (!state.workoutLogs[key]) state.workoutLogs[key] = { weight: 50, reps: 8, rir: '2', completed: false };
  state.workoutLogs[key].rir = rirVal;
  saveStateToStorage();
  renderFocusModeModal();
};

window.completeFocusSetAction = function () {
  const ex = state.focus.exercise;
  const s = state.focus.setIndex;
  const key = `${ex.id}_s${s}`;
  const log = state.workoutLogs[key] || {};

  const w = log.weight !== '' && !isNaN(log.weight) ? log.weight : 50;
  const r = log.reps !== '' && !isNaN(log.reps) ? log.reps : 8;
  const rir = log.rir !== '' ? log.rir : ex.rir;
  const molestia = !!log.molestia_dolor;
  const tempo = log.tempo_cumplido !== undefined ? !!log.tempo_cumplido : true;
  const notas = log.notas || '';

  state.workoutLogs[key] = {
    weight: w,
    reps: r,
    rir: rir,
    completed: true,
    molestia_dolor: molestia,
    tempo_cumplido: tempo,
    notas: notas
  };
  saveStateToStorage();

  if (window.SyncService) {
    const exName = state.trainingLocation === 'gym' ? (ex.varianteGym || ex.patron) : (ex.varianteCasa || ex.patron);
    window.SyncService.syncWorkoutSet({
      semana: state.selectedWeek,
      dia: state.selectedWorkoutDay,
      ejercicioId: ex.id,
      ejercicioNombre: exName,
      setIndex: s,
      weight: w,
      reps: r,
      rir: rir,
      tempo_cumplido: tempo,
      molestia_dolor: molestia,
      notas: notas,
      completed: true,
      clientLogKey: key
    });
  }

  playTone(700, 0.15);
  if ('vibrate' in navigator && state.settings.vibrate) {
    try { navigator.vibrate([200, 80, 200]); } catch (e) {}
  }

  if (state.settings.autoStartTimer && ex.descanso > 0) {
    const exName = state.trainingLocation === 'gym' ? (ex.varianteGym || ex.patron) : (ex.varianteCasa || ex.patron);
    startTimer(ex.descanso, `Descanso: ${exName}`);
  }

  showToast(`✓ Serie #${s} completada (${w}kg × ${r})`, 'success');

  if (s < ex.series) {
    state.focus.setIndex = s + 1;
    renderFocusModeModal();
  } else {
    // Advance to next exercise
    const currentExercises = state.workoutData.filter(e => e.semana === state.selectedWeek && e.dia === state.selectedWorkoutDay);
    const currIdx = currentExercises.findIndex(e => e.id === ex.id);
    if (currIdx >= 0 && currIdx < currentExercises.length - 1) {
      showToast(`💪 ¡${ex.patron} completado! Siguiente ejercicio.`, 'success');
      state.focus.exercise = currentExercises[currIdx + 1];
      state.focus.setIndex = 1;
      renderFocusModeModal();
    } else {
      showToast('🎉 ¡Entrenamiento completado al 100%!', 'success');
      closeFocusModeModal();
      playCelebrationFanfare();
      if (window.confetti) confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }
  }
};

window.navigateFocusExercise = function (delta) {
  const currentExercises = state.workoutData.filter(e => e.semana === state.selectedWeek && e.dia === state.selectedWorkoutDay);
  const currIdx = currentExercises.findIndex(e => e.id === state.focus.exercise.id);
  const nextIdx = currIdx + delta;
  if (nextIdx >= 0 && nextIdx < currentExercises.length) {
    state.focus.exercise = currentExercises[nextIdx];
    state.focus.setIndex = 1;
    renderFocusModeModal();
  }
};

// ============================================================================
// 9. SETTINGS, PREFERENCES & BACKUP
// ============================================================================

function renderSettings() {
  const planSelector = document.getElementById('settings-plan-selector');
  if (planSelector) {
    planSelector.value = state.activePlan;
  }
}

window.onPlanChangedInSettings = function (val) {
  switchActivePlan(val);
};

window.exportFullBackup = function () {
  const backup = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    state: state
  };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fitpantry_backup_${state.activePlan}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Copia de seguridad exportada', 'success');
};

window.importFullBackup = function (input) {
  if (!input.files.length) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.state) {
        Object.assign(state, data.state);
        saveStateToStorage();
        renderApp();
        showToast('Copia de seguridad restaurada con éxito', 'success');
      }
    } catch (err) {
      showToast('Error al importar copia de seguridad', 'error');
    }
  };
  reader.readAsText(file);
};

window.resetAllData = function () {
  if (confirm('⚠️ ¿Estás seguro de que quieres restablecer todos los datos a la configuración inicial?')) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
};

// ============================================================================
// 10. CSV PARSING & FILE UPLOADS (PAPAPARSE)
// ============================================================================

function setupUIEvents() {
  // Navigation tabs
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Top Plan Switcher Pills
  document.querySelectorAll('.top-plan-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const plan = pill.dataset.plan;
      switchActivePlan(plan);
      updateTopPlanPills();
    });
  });

  // Search input live filter
  const searchInput = document.getElementById('pantry-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      state.pantrySearch = e.target.value;
      renderPantry();
    });
  }

  // Timer controls
  document.getElementById('timer-play-btn')?.addEventListener('click', togglePlayPauseTimer);
  document.getElementById('timer-plus-btn')?.addEventListener('click', () => adjustTimer(30));
  document.getElementById('timer-minus-btn')?.addEventListener('click', () => adjustTimer(-30));
  document.getElementById('timer-reset-btn')?.addEventListener('click', resetTimer);

  // Settings Toggles
  const autoTimerCheck = document.getElementById('setting-auto-timer');
  if (autoTimerCheck) {
    autoTimerCheck.checked = state.settings.autoStartTimer;
    autoTimerCheck.addEventListener('change', e => {
      state.settings.autoStartTimer = e.target.checked;
      saveStateToStorage();
    });
  }

  const soundCheck = document.getElementById('setting-sound');
  if (soundCheck) {
    soundCheck.checked = state.settings.sound;
    soundCheck.addEventListener('change', e => {
      state.settings.sound = e.target.checked;
      saveStateToStorage();
      if (e.target.checked) playTone(880, 0.1);
    });
  }

  const vibrateCheck = document.getElementById('setting-vibrate');
  if (vibrateCheck) {
    vibrateCheck.checked = state.settings.vibrate;
    vibrateCheck.addEventListener('change', e => {
      state.settings.vibrate = e.target.checked;
      saveStateToStorage();
    });
  }

  // Drag & Drop for custom CSV
  const dropZone = document.getElementById('csv-drop-zone');
  const fileInput = document.getElementById('csv-file-input');
  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('border-emerald-400'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-emerald-400'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('border-emerald-400');
      if (e.dataTransfer.files.length) handleCustomCSVUpload(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', e => {
      if (e.target.files.length) handleCustomCSVUpload(e.target.files[0]);
    });
  }
}

function handleCustomCSVUpload(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showToast('Selecciona un archivo con extensión .csv', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const rawText = e.target.result.replace(/^\uFEFF/, '').trim();
      const parsed = Papa.parse(rawText, { header: true, skipEmptyLines: true });
      if (!parsed.data || parsed.data.length === 0) throw new Error('Archivo CSV vacío');

      const headers = Object.keys(parsed.data[0]).map(h => h.toLowerCase());

      if (headers.some(h => h.includes('ejercicio') || h.includes('patrón') || h.includes('patron'))) {
        state.workoutData = parsed.data.map((r, i) => ({
          id: `custom_w_${i}`,
          semana: parseInt((r['Semana'] || '1').replace(/\D/g, ''), 10) || 1,
          dia: r['Día / Sesión'] || r['Dia'] || 'Día 1',
          orden: parseInt(r['Orden'] || (i + 1), 10) || (i + 1),
          patron: r['Patrón Motor / Ejercicio'] || r['Ejercicio'] || '',
          varianteGym: r['Variante Gym'] || r['Ejercicio'] || '',
          varianteCasa: r['Variante Casa (Banco Romano/Mancuernas)'] || r['Ejercicio'] || '',
          series: parseInt(r['Series'] || '3', 10) || 3,
          reps: r['Reps Objetivo'] || r['Reps'] || '10',
          rir: r['RIR / Esfuerzo'] || r['RIR'] || '2',
          descanso: parseInt((r['Descanso (seg)'] || r['Descanso'] || '90').toString().replace(/\D/g, ''), 10) || 90,
          tempo: r['Tempo (Exc-Iso-Conc)'] || '2-0-1-0',
          notas: r['Sobrecarga Progresiva / Notas Biomecánicas'] || r['Notas'] || ''
        }));
        saveStateToStorage();
        showToast(`Rutina importada (${state.workoutData.length} ejercicios)`, 'success');
        switchTab('workout');
      } else if (headers.some(h => h.includes('plato') || h.includes('ingredientes') || h.includes('comida'))) {
        state.nutritionData = parsed.data.map((r, i) => ({
          id: `custom_n_${i}`,
          semana: parseInt((r['Semana'] || '1').replace(/\D/g, ''), 10) || 1,
          diaTipo: r['Día Tipo / Ciclo'] || 'Día 1',
          comida: r['Comida'] || 'Comida',
          horario: r['Horario Recomendado'] || '',
          plato: r['Plato / Receta (100% Sin Gluten)'] || r['Plato'] || '',
          ingredientes: r['Ingredientes y Gramajes Exactos (Pesados en Crudo)'] || r['Ingredientes'] || '',
          proteina: parseFloat(r['Proteína (g)']) || 0,
          carbohidratos: parseFloat(r['Carbohidratos (g)']) || 0,
          grasas: parseFloat(r['Grasas (g)']) || 0,
          calorias: parseFloat(r['Calorías (kcal)']) || 0,
          fibra: parseFloat(r['Fibra (g)']) || 0,
          micronutrientes: r['Micronutrientes Críticos / Indicaciones Clínicas'] || ''
        }));
        saveStateToStorage();
        showToast(`Plan nutricional importado (${state.nutritionData.length} comidas)`, 'success');
        switchTab('nutrition');
      } else if (headers.some(h => h.includes('producto') || h.includes('categoria'))) {
        state.pantryItems = parsed.data.map((r, i) => ({
          id: `custom_p_${i}`,
          categoria: r['Categoría'] || 'General',
          producto: r['Producto'] || '',
          marca: r['Marca Aldi'] || r['Marca'] || '-',
          formato: r['Formato Comercial'] || '',
          cantidadSemanal: r['Cantidad Semanal'] || '',
          cantidadMensual: r['Cantidad Mensual (x4)'] || '',
          aptoCeliaco: r['Apto Celíaco'] || '',
          notas: r['Notas / Ubicación'] || '',
          status: 'athome'
        }));
        saveStateToStorage();
        showToast(`Despensa importada (${state.pantryItems.length} productos)`, 'success');
        switchTab('pantry');
      } else {
        throw new Error('No se reconoció el formato de columnas del CSV.');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function updateTopPlanPills() {
  document.querySelectorAll('.top-plan-pill').forEach(pill => {
    if (pill.dataset.plan === state.activePlan) {
      pill.className = 'top-plan-pill px-3 py-1 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-400 to-[#30d158] text-zinc-950 shadow-sm transition-all';
    } else {
      pill.className = 'top-plan-pill px-3 py-1 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-all';
    }
  });
}

function renderApp() {
  updateTopPlanPills();
  switchTab(state.activeTab);
}

function registerPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(() => {
          const badge = document.getElementById('offline-ready-badge');
          if (badge) badge.classList.remove('hidden');
        })
        .catch(err => console.warn('SW registration warning:', err));
    });
  }
}

// ============================================================================
// 10. SUPABASE CLOUD AUTH & OFFLINE SYNC CONTROLLER
// ============================================================================

let currentAuthMode = 'login'; // 'login' | 'register'

window.openAuthModal = function (mode = 'login') {
  if (!window.FirebaseAuth || !window.FirebaseAuth.isConfigured()) {
    showToast('Vincula tu proyecto de Firebase para iniciar sesión o registrarte', 'info');
    window.openPasteFirebaseModal();
    return;
  }
  window.setAuthMode(mode);
  const modal = document.getElementById('modal-auth');
  if (modal) modal.classList.remove('hidden');
};

window.closeAuthModal = function () {
  const modal = document.getElementById('modal-auth');
  if (modal) modal.classList.add('hidden');
};

window.setAuthMode = function (mode) {
  currentAuthMode = mode;
  const tabLogin = document.getElementById('auth-tab-login');
  const tabRegister = document.getElementById('auth-tab-register');
  const nameGroup = document.getElementById('auth-name-group');
  const submitLabel = document.getElementById('auth-submit-label');
  const alertBox = document.getElementById('auth-alert-box');

  if (alertBox) alertBox.classList.add('hidden');

  if (mode === 'login') {
    tabLogin?.classList.add('bg-gradient-to-r', 'from-emerald-400', 'to-[#30d158]', 'text-zinc-950');
    tabLogin?.classList.remove('text-zinc-400');
    tabRegister?.classList.remove('bg-gradient-to-r', 'from-emerald-400', 'to-[#30d158]', 'text-zinc-950');
    tabRegister?.classList.add('text-zinc-400');
    nameGroup?.classList.add('hidden');
    if (submitLabel) submitLabel.textContent = 'Entrar a FitPantry';
  } else {
    tabRegister?.classList.add('bg-gradient-to-r', 'from-emerald-400', 'to-[#30d158]', 'text-zinc-950');
    tabRegister?.classList.remove('text-zinc-400');
    tabLogin?.classList.remove('bg-gradient-to-r', 'from-emerald-400', 'to-[#30d158]', 'text-zinc-950');
    tabLogin?.classList.add('text-zinc-400');
    nameGroup?.classList.remove('hidden');
    if (submitLabel) submitLabel.textContent = 'Crear Cuenta y Conectar';
  }
};

window.handleAuthSubmit = async function (e) {
  e.preventDefault();
  const alertBox = document.getElementById('auth-alert-box');
  const submitBtn = document.getElementById('auth-submit-btn');
  const email = (document.getElementById('auth-email-input')?.value || '').trim();
  const password = document.getElementById('auth-password-input')?.value || '';
  const name = (document.getElementById('auth-name-input')?.value || '').trim();

  if (!email || !password) return;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-60');
  }

  try {
    if (currentAuthMode === 'login') {
      await window.FirebaseAuth.signIn(email, password);
      showToast('Sesión iniciada con éxito en Firebase', 'success');
      window.closeAuthModal();
      await window.SyncService.pullFromCloud(state);
      saveStateToStorage();
      renderApp();
    } else {
      await window.FirebaseAuth.signUp(email, password, name);
      showToast('¡Cuenta creada correctamente en Firebase!', 'success');
      window.closeAuthModal();
      await window.SyncService.pullFromCloud(state);
      saveStateToStorage();
      renderApp();
    }
  } catch (err) {
    console.error('Error de autenticación:', err);
    if (alertBox) {
      alertBox.className = 'p-3 rounded-2xl text-xs font-medium border bg-rose-950/40 border-rose-500/40 text-rose-300';
      alertBox.textContent = err.message || 'Error al autenticar. Revisa tus credenciales.';
      alertBox.classList.remove('hidden');
    }
    showToast(err.message || 'Error en autenticación', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-60');
    }
  }
};

window.continueAsGuest = function () {
  sessionStorage.setItem('fitpantry_guest_dismissed', 'true');
  window.closeAuthModal();
  showToast('Continuando en Modo Local (Offline)', 'info');
};

window.logoutUser = async function () {
  if (confirm('¿Cerrar sesión en FitPantry Cloud (Firebase)? Los datos locales se conservarán.')) {
    sessionStorage.removeItem('fitpantry_guest_dismissed');
    await window.FirebaseAuth.signOut();
    showToast('Sesión cerrada correctamente');
    updateAuthUI(null);
    window.openAuthModal('login');
  }
};

window.saveFirebaseSettingsFromUI = async function () {
  const apiKey = (document.getElementById('firebase-input-apikey')?.value || '').trim();
  const authDomain = (document.getElementById('firebase-input-authdomain')?.value || '').trim();
  const projectId = (document.getElementById('firebase-input-projectid')?.value || '').trim();
  const appId = (document.getElementById('firebase-input-appid')?.value || '').trim();

  if (!apiKey || !projectId) {
    showToast('Por favor introduce al menos la API Key y el Project ID de Firebase', 'error');
    return false;
  }

  const ok = await window.FirebaseAuth.saveFirebaseConfig({
    apiKey,
    authDomain,
    projectId,
    appId
  });

  if (ok) {
    showToast('Credenciales de Firebase guardadas en el dispositivo', 'success');
    if (window.SyncService) window.SyncService.drainQueue();
    return true;
  } else {
    showToast('Error al guardar credenciales', 'error');
    return false;
  }
};

window.openPasteFirebaseModal = function () {
  const modal = document.getElementById('modal-paste-firebase');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => {
      const textarea = document.getElementById('firebase-paste-textarea');
      if (textarea) textarea.focus();
    }, 120);
  }
};

window.closePasteFirebaseModal = function () {
  const modal = document.getElementById('modal-paste-firebase');
  if (modal) modal.classList.add('hidden');
};

window.promptPasteFirebaseConfig = async function () {
  // Intentar leer directamente del portapapeles si el navegador lo permite
  if (navigator.clipboard && navigator.clipboard.readText) {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText && (clipText.includes('apiKey') || clipText.includes('projectId'))) {
        const textarea = document.getElementById('firebase-paste-textarea');
        if (textarea) textarea.value = clipText;
        await window.parseAndApplyFirebaseConfig(clipText);
        return;
      }
    } catch (err) {
      // Si el navegador bloquea la lectura automática o requiere permiso, abrir el modal
    }
  }
  window.openPasteFirebaseModal();
};

window.pasteFromClipboardDirectly = async function () {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const text = await navigator.clipboard.readText();
      if (text) {
        const textarea = document.getElementById('firebase-paste-textarea');
        if (textarea) textarea.value = text;
        showToast('Texto pegado del portapapeles', 'info');
        return;
      }
    }
    showToast('Haz clic dentro del cuadro y pulsa Ctrl+V o Pegar', 'info');
  } catch (err) {
    showToast('Haz clic dentro del cuadro y pulsa Ctrl+V o Pegar', 'info');
  }
};

window.applyPastedFirebaseConfig = function () {
  const textarea = document.getElementById('firebase-paste-textarea');
  const raw = textarea ? textarea.value.trim() : '';
  if (!raw) {
    showToast('El cuadro de texto está vacío. Pega la configuración de Firebase.', 'error');
    return;
  }
  window.parseAndApplyFirebaseConfig(raw);
};

window.parseAndApplyFirebaseConfig = async function (raw) {
  if (!raw || typeof raw !== 'string') {
    showToast('El texto proporcionado está vacío', 'error');
    return;
  }

  try {
    // Extraer valores mediante expresiones regulares flexibles (comillas simples, dobles o sin comillas)
    const apiKeyMatch = raw.match(/apiKey["']?\s*[:=]\s*["']?([^"',\s\r\n}]+)["']?/i);
    const authDomainMatch = raw.match(/authDomain["']?\s*[:=]\s*["']?([^"',\s\r\n}]+)["']?/i);
    const projectIdMatch = raw.match(/projectId["']?\s*[:=]\s*["']?([^"',\s\r\n}]+)["']?/i);
    const appIdMatch = raw.match(/appId["']?\s*[:=]\s*["']?([^"',\s\r\n}]+)["']?/i);

    const config = {
      apiKey: apiKeyMatch ? apiKeyMatch[1].trim() : '',
      authDomain: authDomainMatch ? authDomainMatch[1].trim() : '',
      projectId: projectIdMatch ? projectIdMatch[1].trim() : '',
      appId: appIdMatch ? appIdMatch[1].trim() : ''
    };

    if (!config.apiKey && !config.projectId) {
      showToast('No se encontraron claves válidas (apiKey o projectId)', 'error');
      return;
    }

    if (config.apiKey) {
      const el = document.getElementById('firebase-input-apikey');
      if (el) el.value = config.apiKey;
    }
    if (config.authDomain) {
      const el = document.getElementById('firebase-input-authdomain');
      if (el) el.value = config.authDomain;
    }
    if (config.projectId) {
      const el = document.getElementById('firebase-input-projectid');
      if (el) el.value = config.projectId;
    }
    if (config.appId) {
      const el = document.getElementById('firebase-input-appid');
      if (el) el.value = config.appId;
    }

    window.closePasteFirebaseModal();
    const saved = await window.saveFirebaseSettingsFromUI();
    if (saved) {
      showToast(`Firebase vinculado: ${config.projectId}`, 'success');
      setTimeout(async () => {
        const user = window.FirebaseAuth ? await window.FirebaseAuth.getUser() : null;
        if (!user) {
          window.openAuthModal('login');
        }
      }, 500);
    }
  } catch (e) {
    console.error('Error procesando configuración:', e);
    showToast('Error al analizar la configuración', 'error');
  }
};

window.triggerManualSync = async function () {
  const dot = document.getElementById('sync-status-dot');
  if (dot) dot.className = 'w-2 h-2 rounded-full bg-blue-400 animate-ping';
  showToast('Iniciando sincronización Cloud (Firestore)...', 'info');

  await window.SyncService.drainQueue();
  if (window.FirebaseAuth && window.FirebaseAuth.isConfigured()) {
    await window.SyncService.pullFromCloud(state);
    saveStateToStorage();
    renderApp();
  }
  showToast('Sincronización finalizada', 'success');
};

function updateAuthUI(user) {
  const userEmail = document.getElementById('settings-user-email');
  const userRole = document.getElementById('settings-user-role');
  const actionBtn = document.getElementById('settings-auth-action-btn');

  if (user) {
    if (userEmail) userEmail.textContent = user.displayName || user.email || 'Usuario Conectado';
    if (userRole) userRole.textContent = `Perfil: Hombre • ID: ${(user.uid || '').substring(0, 8)}...`;
    if (actionBtn) {
      actionBtn.textContent = 'Cerrar Sesión';
      actionBtn.className = 'shrink-0 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all';
      actionBtn.onclick = window.logoutUser;
    }
  } else {
    if (userEmail) userEmail.textContent = 'Modo Local (Invitado)';
    if (userRole) userRole.textContent = 'Sin cuenta vinculada';
    if (actionBtn) {
      actionBtn.textContent = 'Conectar';
      actionBtn.className = 'shrink-0 px-3 py-1.5 bg-gradient-to-r from-emerald-400 to-[#30d158] hover:opacity-90 text-zinc-950 rounded-xl text-xs font-black transition-all';
      actionBtn.onclick = () => window.openAuthModal('login');
    }
  }
}

function updateSyncUIStatus(status) {
  const dot = document.getElementById('sync-status-dot');
  const text = document.getElementById('sync-status-text');
  const cloudBadge = document.getElementById('cloud-badge-status');
  const queueCount = document.getElementById('settings-queue-count');

  if (queueCount) {
    queueCount.textContent = status.pendingCount > 0
      ? `${status.pendingCount} cambio(s) pendiente(s) de sincronizar`
      : 'Todos los datos al día con Firestore';
  }

  if (status.state === 'unconfigured') {
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-zinc-500';
    if (text) text.textContent = 'Local';
    if (cloudBadge) {
      cloudBadge.textContent = 'Firebase no configurado';
      cloudBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-white/[0.08]';
    }
  } else if (status.state === 'guest') {
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-400';
    if (text) text.textContent = 'Invitado';
    if (cloudBadge) {
      cloudBadge.textContent = 'Modo Local (Sin Login)';
      cloudBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30';
    }
  } else if (status.state === 'syncing') {
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-blue-400 animate-ping';
    if (text) text.textContent = 'Sincronizando...';
    if (cloudBadge) {
      cloudBadge.textContent = 'Sincronizando con Firestore...';
      cloudBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30';
    }
  } else if (status.state === 'pending' || status.state === 'pending_offline') {
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-yellow-400 animate-pulse';
    if (text) text.textContent = `${status.pendingCount} pend.`;
    if (cloudBadge) {
      cloudBadge.textContent = `${status.pendingCount} cambios en cola (Offline)`;
      cloudBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30';
    }
  } else {
    // Synced
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
    if (text) text.textContent = 'Nube OK';
    if (cloudBadge) {
      cloudBadge.textContent = 'Firestore Sincronizado';
      cloudBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25';
    }
  }
}

function initCloudSyncListeners() {
  if (window.FirebaseAuth) {
    const config = window.FirebaseAuth.getFirebaseConfig();
    if (config) {
      const apiKeyInput = document.getElementById('firebase-input-apikey');
      const authDomainInput = document.getElementById('firebase-input-authdomain');
      const projectIdInput = document.getElementById('firebase-input-projectid');
      const appIdInput = document.getElementById('firebase-input-appid');
      if (apiKeyInput && config.apiKey) apiKeyInput.value = config.apiKey;
      if (authDomainInput && config.authDomain) authDomainInput.value = config.authDomain;
      if (projectIdInput && config.projectId) projectIdInput.value = config.projectId;
      if (appIdInput && config.appId) appIdInput.value = config.appId;
    }

    window.FirebaseAuth.onAuthStateChange(async (user) => {
      updateAuthUI(user);
      if (user) {
        await window.SyncService.pullFromCloud(state);
        saveStateToStorage();
        renderApp();
      }
    });

    window.FirebaseAuth.getUser().then(user => {
      updateAuthUI(user);
      if (user) {
        window.SyncService.pullFromCloud(state).then(updated => {
          if (updated) {
            saveStateToStorage();
            renderApp();
          }
        });
      } else {
        const guestDismissed = sessionStorage.getItem('fitpantry_guest_dismissed');
        if (!guestDismissed && window.FirebaseAuth.isConfigured()) {
          setTimeout(() => {
            window.openAuthModal('login');
          }, 350);
        }
      }
    });
  }

  if (window.SyncService) {
    window.SyncService.onSyncStatusChange(updateSyncUIStatus);
    window.SyncService.getSyncStatus().then(updateSyncUIStatus);
  }
}

// ============================================================================
// 12. SMART NUTRITION & PANTRY BRIDGE (FEATURE 1: AUTO-SYNC WEEK MENU TO ALDI)
// ============================================================================

window.generateShoppingListFromWeekMenu = function () {
  const week = state.selectedWeek;
  const weekMeals = state.nutritionData.filter(item => item.semana === week);
  if (!weekMeals.length) {
    showToast(`No hay menús registrados para la Semana ${week}`, 'warning');
    return;
  }

  let addedCount = 0;
  // Match pantry products with meal ingredients or names
  state.pantryItems.forEach(pi => {
    const prodName = (pi.producto || '').toLowerCase().trim();
    if (!prodName) return;

    const isRequired = weekMeals.some(m => {
      const ing = (m.ingredientes || '').toLowerCase();
      const plato = (m.plato || '').toLowerCase();
      return ing.includes(prodName) || plato.includes(prodName) || (prodName.length > 4 && (ing.includes(prodName.slice(0, -1)) || plato.includes(prodName.slice(0, -1))));
    });

    if (isRequired && pi.status !== 'tobuy') {
      pi.status = 'tobuy';
      addedCount++;
    }
  });

  state.pantryView = 'tobuy';
  saveStateToStorage();
  renderPantry();
  if (typeof SyncService !== 'undefined') SyncService.notifyDataChange();
  playTone(700, 0.15);
  showToast(`⚡ Lista de la compra generada para Semana ${week} (${addedCount} productos añadidos a comprar)`, 'success');
};

// ============================================================================
// 13. SMART 100% GLUTEN-FREE FOOD SWAPS (FEATURE 2)
// ============================================================================

const GLUTEN_FREE_SWAPS = {
  // Proteínas Magras
  pollo: {
    category: 'Proteína Magra',
    options: [
      { name: 'Lomo de pavo a la plancha', amount: '180g', macros: '38g P · 0g C · 3g G', reason: 'Proteína limpia idéntica, digestión rápida sin gluten' },
      { name: 'Filetes de merluza o bacalao', amount: '200g', macros: '36g P · 0g C · 2g G', reason: 'Excelente biodisponibilidad y cero pesadez gástrica' },
      { name: 'Tofu firme marinado en AOVE', amount: '220g', macros: '32g P · 4g C · 12g G', reason: 'Opción 100% vegetal con isoflavonas y calcio' },
      { name: 'Claras de huevo (220ml) + 1 huevo entero', amount: '270g', macros: '34g P · 1g C · 5g G', reason: 'Puntuación DIAAS máxima en absorción proteica' }
    ]
  },
  ternera: {
    category: 'Carnes Rojas y Hierro',
    options: [
      { name: 'Solomillo de cerdo ibérico magro', amount: '170g', macros: '35g P · 0g C · 6g G', reason: 'Rico en zinc, creatina y tiamina sin gluten' },
      { name: 'Hamburguesas 100% vacuno de corral (Aldi)', amount: '2x 90g', macros: '36g P · 0g C · 8g G', reason: 'Comodidad de preparación en 4 minutos' },
      { name: 'Pechuga de pollo + 15ml Aceite Oliva Virgen Extra', amount: '180g + 15ml', macros: '38g P · 0g C · 14g G', reason: 'Mismo perfil calórico con grasas monoinsaturadas' }
    ]
  },
  salmon: {
    category: 'Pescados Grasos y Omega-3',
    options: [
      { name: 'Caballa o sardinas en AOVE (Aldi)', amount: '160g', macros: '33g P · 0g C · 16g G', reason: 'Poderoso aporte de Omega-3 EPA/DHA antiinflamatorio' },
      { name: 'Trucha arcoíris al horno', amount: '180g', macros: '34g P · 0g C · 11g G', reason: 'Pescado azul suave y de proximidad' },
      { name: 'Atún al natural (2 latas) + 20g nueces', amount: '140g + 20g', macros: '36g P · 2g C · 14g G', reason: 'Proteína pura con ácidos grasos esenciales' }
    ]
  },
  arroz: {
    category: 'Carbohidratos Complejos',
    options: [
      { name: 'Patatas cocidas o asadas con piel', amount: '320g', macros: '6g P · 64g C · 0.5g G', reason: 'Mayor índice de saciedad y potasio muscular' },
      { name: 'Boniato / batata asada al vapor', amount: '280g', macros: '4g P · 62g C · 1g G', reason: 'Menor impacto glucémico y rico en betacarotenos' },
      { name: 'Copos de avena sin gluten certificados', amount: '90g', macros: '12g P · 60g C · 6g G', reason: 'Betaglucanos para la salud cardiovascular y digestiva' },
      { name: 'Quinoa real lavada', amount: '90g en crudo', macros: '12g P · 58g C · 5g G', reason: 'Carbohidrato complejo completo sin gluten' }
    ]
  },
  yogur: {
    category: 'Lácteos y Desayunos',
    options: [
      { name: 'Queso fresco batido 0% + 15g almendras', amount: '250g + 15g', macros: '26g P · 10g C · 8g G', reason: 'Mayor concentración de caseína micelar saciante' },
      { name: 'Kéfir natural sin lactosa (Aldi)', amount: '300ml', macros: '13g P · 12g C · 8g G', reason: 'Probiótico natural para la microbiota intestinal' },
      { name: 'Skyr natural de estilo islandés', amount: '220g', macros: '24g P · 8g C · 1g G', reason: 'Cremoso, denso y ultra rico en proteína' }
    ]
  }
};

let currentSwapMealId = null;

window.openFoodSwapModal = function (mealId) {
  currentSwapMealId = mealId;
  const meal = state.nutritionData.find(m => m.id === mealId);
  if (!meal) return;

  const modal = document.getElementById('modal-food-swap');
  const nameEl = document.getElementById('swap-current-meal-name');
  const ingEl = document.getElementById('swap-current-ingredients');
  const listEl = document.getElementById('food-swap-alternatives-list');

  if (nameEl) nameEl.textContent = `${meal.comida}: ${meal.plato}`;
  if (ingEl) ingEl.textContent = meal.ingredientes;

  // Determine swap group
  const text = `${meal.plato} ${meal.ingredientes}`.toLowerCase();
  let groupKey = 'pollo';
  if (text.includes('salmón') || text.includes('salmon') || text.includes('pescado') || text.includes('trucha')) groupKey = 'salmon';
  else if (text.includes('ternera') || text.includes('carne') || text.includes('lomo')) groupKey = 'ternera';
  else if (text.includes('arroz') || text.includes('patata') || text.includes('boniato') || text.includes('avena')) groupKey = 'arroz';
  else if (text.includes('yogur') || text.includes('kéfir') || text.includes('queso') || text.includes('skyr')) groupKey = 'yogur';

  const group = GLUTEN_FREE_SWAPS[groupKey] || GLUTEN_FREE_SWAPS.pollo;

  let html = '';
  group.options.forEach((opt, idx) => {
    html += `
      <div onclick="applyFoodSwap('${encodeURIComponent(opt.name)}', '${encodeURIComponent(opt.amount)}', '${encodeURIComponent(opt.macros)}')"
        class="p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-white/[0.06] hover:border-emerald-500/40 cursor-pointer transition-all flex flex-col gap-1 text-xs">
        <div class="flex items-center justify-between">
          <span class="font-bold text-white text-xs">${opt.name}</span>
          <span class="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold">${opt.amount}</span>
        </div>
        <div class="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
          <span>${opt.macros}</span>
          <span class="text-emerald-400 font-bold">Seleccionar ➔</span>
        </div>
        <p class="text-[10px] text-zinc-400 italic">${opt.reason}</p>
      </div>
    `;
  });

  if (listEl) listEl.innerHTML = html;
  if (modal) modal.classList.remove('hidden');
};

window.closeFoodSwapModal = function () {
  const modal = document.getElementById('modal-food-swap');
  if (modal) modal.classList.add('hidden');
  currentSwapMealId = null;
};

window.applyFoodSwap = function (nameEncoded, amountEncoded, macrosEncoded) {
  if (!currentSwapMealId) return;
  const name = decodeURIComponent(nameEncoded);
  const amount = decodeURIComponent(amountEncoded);
  const macros = decodeURIComponent(macrosEncoded);

  state.nutritionSwaps = state.nutritionSwaps || {};
  state.nutritionSwaps[currentSwapMealId] = { name, amount, macros };

  saveStateToStorage();
  renderNutrition();
  if (typeof SyncService !== 'undefined') SyncService.notifyDataChange();
  playTone(880, 0.12);
  showToast(`✅ Alimento sustituido: ${name}`, 'success');
  closeFoodSwapModal();
};

window.resetFoodSwap = function (mealId) {
  if (!state.nutritionSwaps || !state.nutritionSwaps[mealId]) return;
  delete state.nutritionSwaps[mealId];
  saveStateToStorage();
  renderNutrition();
  if (typeof SyncService !== 'undefined') SyncService.notifyDataChange();
  showToast('Alimento restablecido al original', 'info');
};

window.resetFoodSwapCurrentMeal = function () {
  if (currentSwapMealId) {
    resetFoodSwap(currentSwapMealId);
    closeFoodSwapModal();
  }
};

// ============================================================================
// 14. EXERCISE ALTERNATIVES (FEATURE 3: MÁQUINA OCUPADA / MOLESTIA)
// ============================================================================

const EXERCISE_ALTERNATIVES = {
  press_banca: [
    { name: 'Press plano con mancuernas', equipment: 'Mancuernas + Banco', biomechanics: 'Mayor libertad articular en muñecas y hombros, activación pectoral simétrica', barWeight: 0 },
    { name: 'Press de pecho en máquina convergente', equipment: 'Máquina guiada', biomechanics: 'Máxima estabilidad y aislamiento sin sobrecarga en manguito rotador', barWeight: 0 },
    { name: 'Fondos en paralelas lastrados o asistidos', equipment: 'Barras paralelas', biomechanics: 'Gran estímulo en haz inferior del pectoral y tríceps', barWeight: 0 }
  ],
  press_militar: [
    { name: 'Press militar sentado con mancuernas', equipment: 'Mancuernas + Banco 75º', biomechanics: 'Cero carga axial en la columna lumbar al apoyar la espalda', barWeight: 0 },
    { name: 'Press de hombros en máquina guiada', equipment: 'Máquina sentada', biomechanics: 'Tensión constante y seguridad articular absoluta', barWeight: 0 },
    { name: 'Elevaciones laterales en polea baja', equipment: 'Polea', biomechanics: 'Aislamiento lateral puro sin compresión de discos intervertebrales', barWeight: 0 }
  ],
  sentadilla: [
    { name: 'Prensa inclinada de discos 45º', equipment: 'Prensa', biomechanics: 'Cero carga axial en la columna, ideal para fatiga lumbar o espalda sobrecargada', barWeight: 0 },
    { name: 'Sentadilla Goblet pesada con mancuerna', equipment: 'Mancuerna pesada', biomechanics: 'Posición vertical del tronco que protege charnela T11-L3 y L4-S1', barWeight: 0 },
    { name: 'Sentadilla Búlgara con mancuernas', equipment: 'Mancuernas + Banco', biomechanics: 'Gran hipertrofia unilateral sin requerir cargas pesadas axiales', barWeight: 0 }
  ],
  peso_muerto: [
    { name: 'Peso muerto con barra hexagonal (Trap Bar)', equipment: 'Trap Bar (25 kg)', biomechanics: 'Centro de gravedad alineado con caderas, menor momento flexor lumbar', barWeight: 25 },
    { name: 'Peso muerto rumano con mancuernas', equipment: 'Mancuernas', biomechanics: 'Control preciso de la bisagra de cadera y estiramiento de isquios', barWeight: 0 },
    { name: 'Hip Thrust con barra o máquina', equipment: 'Banco + Barra / Smith', biomechanics: 'Máxima activación del glúteo con compresión axial nula', barWeight: 20 }
  ],
  jalon_pecho: [
    { name: 'Dominadas con banda o máquina asistida', equipment: 'Barra dominadas', biomechanics: 'Cadena cinética cerrada para estímulo dorsal masivo', barWeight: 0 },
    { name: 'Remo en polea baja agarre neutro', equipment: 'Polea baja', biomechanics: 'Apoyo lumbar seguro y alineación de romboides y trapecio medio', barWeight: 0 },
    { name: 'Remo con mancuerna unilateral con banco', equipment: 'Mancuerna + Banco', biomechanics: 'Soporte 3 puntos que descarga por completo la columna vertebral', barWeight: 0 }
  ],
  remo: [
    { name: 'Remo en máquina con soporte pectoral', equipment: 'Máquina con apoyo', biomechanics: 'Descompresión total de erectores espinales y aislamiento dorsal', barWeight: 0 },
    { name: 'Remo con mancuernas en banco inclinado 45º', equipment: 'Mancuernas + Banco', biomechanics: 'El apoyo en esternón elimina cualquier tensión en la espalda baja', barWeight: 0 },
    { name: 'Remo en polea alta con agarre ancho', equipment: 'Polea', biomechanics: 'Excelente para deltoides posterior y dorsal superior', barWeight: 0 }
  ],
  hip_thrust: [
    { name: 'Hip Thrust en máquina Multipower / Smith', equipment: 'Máquina Smith', biomechanics: 'Fácil colocación de carga y trayectoria guiada ultra segura', barWeight: 0 },
    { name: 'Puente de glúteo unilateral con mancuerna', equipment: 'Mancuerna en suelo', biomechanics: 'Activación de glúteo medio y corrección de asimetrías de cadera', barWeight: 0 },
    { name: 'Extensión de cadera en polea con tobillera', equipment: 'Polea baja', biomechanics: 'Tensión pico en contracción isométrica máxima de glúteo', barWeight: 0 }
  ]
};

let currentSwapExId = null;

window.openExerciseSwapModal = function (exId) {
  currentSwapExId = exId;
  const ex = state.workoutData.find(e => e.id === exId);
  if (!ex) return;

  const modal = document.getElementById('modal-exercise-swap');
  const nameEl = document.getElementById('swap-current-exercise-name');
  const listEl = document.getElementById('exercise-swap-alternatives-list');

  const baseVariant = state.trainingLocation === 'gym' ? (ex.varianteGym || ex.patron) : (ex.varianteCasa || ex.patron);
  if (nameEl) nameEl.textContent = `${ex.orden}. ${baseVariant} (${ex.patron})`;

  const text = `${ex.varianteGym || ''} ${ex.varianteCasa || ''} ${ex.patron || ''}`.toLowerCase();
  let groupKey = 'press_banca';
  if (text.includes('sentadilla') || text.includes('prensa') || text.includes('cuadriceps')) groupKey = 'sentadilla';
  else if (text.includes('peso muerto') || text.includes('rumano') || text.includes('isquios')) groupKey = 'peso_muerto';
  else if (text.includes('militar') || text.includes('hombro') || text.includes('deltoides')) groupKey = 'press_militar';
  else if (text.includes('jalon') || text.includes('dominada') || text.includes('dorsal')) groupKey = 'jalon_pecho';
  else if (text.includes('remo') || text.includes('espalda')) groupKey = 'remo';
  else if (text.includes('thrust') || text.includes('gluteo') || text.includes('patada')) groupKey = 'hip_thrust';

  const alternatives = EXERCISE_ALTERNATIVES[groupKey] || EXERCISE_ALTERNATIVES.press_banca;

  let html = '';
  alternatives.forEach((alt, idx) => {
    html += `
      <div onclick="applyExerciseSwap('${encodeURIComponent(alt.name)}', '${encodeURIComponent(alt.equipment)}', '${encodeURIComponent(alt.biomechanics)}', ${alt.barWeight || 0})"
        class="p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-white/[0.06] hover:border-emerald-500/40 cursor-pointer transition-all flex flex-col gap-1 text-xs">
        <div class="flex items-center justify-between">
          <span class="font-bold text-white text-xs">${alt.name}</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-mono font-bold">${alt.equipment}</span>
        </div>
        <p class="text-[11px] text-zinc-300 leading-snug">${alt.biomechanics}</p>
        <span class="text-[10px] text-emerald-400 font-bold self-end mt-0.5">Seleccionar Variante ➔</span>
      </div>
    `;
  });

  if (listEl) listEl.innerHTML = html;
  if (modal) modal.classList.remove('hidden');
};

window.closeExerciseSwapModal = function () {
  const modal = document.getElementById('modal-exercise-swap');
  if (modal) modal.classList.add('hidden');
  currentSwapExId = null;
};

window.applyExerciseSwap = function (nameEncoded, equipEncoded, bioEncoded, barWeight) {
  if (!currentSwapExId) return;
  const altName = decodeURIComponent(nameEncoded);
  const equipment = decodeURIComponent(equipEncoded);
  const biomechanics = decodeURIComponent(bioEncoded);

  state.exerciseSwaps = state.exerciseSwaps || {};
  state.exerciseSwaps[currentSwapExId] = { altName, equipment, biomechanics, barWeight };

  saveStateToStorage();
  renderWorkout();
  if (typeof SyncService !== 'undefined') SyncService.notifyDataChange();
  playTone(880, 0.12);
  showToast(`⇄ Variante activa: ${altName}`, 'success');
  closeExerciseSwapModal();
};

window.resetExerciseSwap = function (exId) {
  if (!state.exerciseSwaps || !state.exerciseSwaps[exId]) return;
  delete state.exerciseSwaps[exId];
  saveStateToStorage();
  renderWorkout();
  if (typeof SyncService !== 'undefined') SyncService.notifyDataChange();
  showToast('Ejercicio restablecido al original', 'info');
};

window.resetCurrentExerciseSwap = function () {
  if (currentSwapExId) {
    resetExerciseSwap(currentSwapExId);
    closeExerciseSwapModal();
  }
};

// ============================================================================
// 15. SMART COACH PROGRESSION SUGGESTIONS (FEATURE 4)
// ============================================================================

function getSmartCoachSuggestion(ex) {
  if (state.selectedWeek === 1) {
    return {
      text: 'Semana 1: Calibra el peso base para dejar 2-3 reps en recámara (RIR 2-3).',
      weight: 0,
      reps: parseInt(ex.reps.split('-')[0]) || 10
    };
  }

  const prevWeek = state.selectedWeek - 1;
  const prevEx = state.workoutData.find(
    e => e.semana === prevWeek && e.orden === ex.orden && (e.dia === ex.dia || e.patron === ex.patron)
  );
  if (!prevEx) return null;

  let bestWeight = 0;
  let bestReps = 0;
  let bestRir = 2;

  for (let s = 1; s <= prevEx.series; s++) {
    const log = state.workoutLogs[`${prevEx.id}_s${s}`];
    if (log && log.completed && parseFloat(log.weight) > bestWeight) {
      bestWeight = parseFloat(log.weight);
      bestReps = parseFloat(log.reps) || 10;
      bestRir = parseFloat(log.rir) !== undefined ? parseFloat(log.rir) : 2;
    }
  }

  if (bestWeight <= 0) return null;

  if (bestRir >= 2) {
    const nextWeight = bestWeight + 2.5;
    return {
      text: `RIR holgado la semana anterior. Sugerencia: Subir a ${nextWeight} kg manteniendo ${bestReps} reps.`,
      weight: nextWeight,
      reps: bestReps
    };
  } else {
    return {
      text: `RIR ajustado (cerca del fallo). Sugerencia: Consolidar ${bestWeight} kg buscando +1 repetición (${bestReps + 1} reps).`,
      weight: bestWeight,
      reps: bestReps + 1
    };
  }
}

window.applySmartCoachSuggestion = function (exId, weight, reps) {
  const ex = state.workoutData.find(e => e.id === exId);
  if (!ex) return;

  for (let s = 1; s <= ex.series; s++) {
    const key = `${ex.id}_s${s}`;
    const cur = state.workoutLogs[key] || {};
    if (!cur.completed) {
      if (weight > 0) cur.weight = weight;
      if (reps > 0) cur.reps = reps;
      state.workoutLogs[key] = cur;

      const wInput = document.getElementById(`input-weight-${ex.id}-${s}`);
      const rInput = document.getElementById(`input-reps-${ex.id}-${s}`);
      if (wInput && weight > 0) wInput.value = weight;
      if (rInput && reps > 0) rInput.value = reps;
    }
  }

  saveStateToStorage();
  if (typeof SyncService !== 'undefined') SyncService.notifyDataChange();
  playTone(700, 0.1);
  showToast('🎯 Meta Smart Coach aplicada a las series de hoy', 'success');
};

// ============================================================================
// 16. DAILY PRE-WORKOUT READINESS CHECK-IN (FEATURE 5)
// ============================================================================

window.setDailyCheckin = function (category, value) {
  state.dailyCheckin = state.dailyCheckin || {};
  state.dailyCheckin[category] = value;
  state.dailyCheckin.date = new Date().toISOString().split('T')[0];
  saveStateToStorage();
  renderDailyCheckinUI();
  playTone(600, 0.08);
};

function renderDailyCheckinUI() {
  const checkin = state.dailyCheckin || { energy: 'normal', spine: 'good' };
  const dateEl = document.getElementById('checkin-date-label');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  ['high', 'normal', 'low'].forEach(lvl => {
    const btn = document.getElementById(`btn-checkin-energy-${lvl}`);
    if (btn) {
      const active = checkin.energy === lvl;
      btn.className = `py-1.5 rounded-xl text-[11px] font-bold transition-all ${
        active ? 'bg-gradient-to-r from-emerald-400 to-[#30d158] text-zinc-950 shadow-sm' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/[0.05]'
      }`;
    }
  });

  ['good', 'tight', 'pain'].forEach(lvl => {
    const btn = document.getElementById(`btn-checkin-spine-${lvl}`);
    if (btn) {
      const active = checkin.spine === lvl;
      btn.className = `py-1.5 rounded-xl text-[11px] font-bold transition-all ${
        active 
          ? (lvl === 'good' ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50' : (lvl === 'tight' ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50' : 'bg-rose-500/30 text-rose-300 border border-rose-500/50'))
          : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/[0.05]'
      }`;
    }
  });

  const recBox = document.getElementById('checkin-recommendation-box');
  if (recBox) {
    if (checkin.spine === 'pain') {
      recBox.innerHTML = `
        <div class="text-rose-300 flex items-start gap-1.5">
          <span class="text-sm">🔴</span>
          <div>
            <strong>Alerta Lumbar Activa:</strong> Evita ejercicios axiales con compresión vertical (sentadilla libre o peso muerto pesado). Pulsa <strong>⇄ Alternativa</strong> para cambiar a Prensa o Hip Thrust guiado.
          </div>
        </div>
      `;
    } else if (checkin.spine === 'tight') {
      recBox.innerHTML = `
        <div class="text-yellow-300 flex items-start gap-1.5">
          <span class="text-sm">🟡</span>
          <div>
            <strong>Tensión Lumbar Detectada:</strong> Realiza 3 ciclos de McGill Big 3 antes de comenzar. Mantén RIR 2-3 en compuestos y cuida el brace abdominal.
          </div>
        </div>
      `;
    } else if (checkin.energy === 'low') {
      recBox.innerHTML = `
        <div class="text-zinc-300 flex items-start gap-1.5">
          <span class="text-sm">😴</span>
          <div>
            <strong>Fatiga General:</strong> Prioriza la técnica limpia y reduce 1 serie efectiva si notas pérdida de velocidad en la barra.
          </div>
        </div>
      `;
    } else {
      recBox.innerHTML = `
        <div class="text-emerald-300 flex items-start gap-1.5">
          <span class="text-sm">🚀</span>
          <div>
            <strong>Estado Óptimo:</strong> Sistema nervioso y columna listos para la sesión. ¡Buen momento para buscar sobrecarga progresiva!
          </div>
        </div>
      `;
    }
  }
}

// ============================================================================
// 17. MCGILL CORE & SPINAL STABILITY TIMER (FEATURE 6)
// ============================================================================

let mcgillState = {
  isRunning: false,
  phase: 'work', // 'work' | 'rest'
  remaining: 10,
  cycle: 1,
  maxCycles: 5,
  workSec: 10,
  restSec: 3,
  intervalId: null
};

window.openMcGillTimerModal = function () {
  const modal = document.getElementById('modal-mcgill-timer');
  if (modal) modal.classList.remove('hidden');
  updateMcGillUI();
};

window.closeMcGillTimerModal = function () {
  const modal = document.getElementById('modal-mcgill-timer');
  if (modal) modal.classList.add('hidden');
  if (mcgillState.isRunning) toggleMcGillTimer();
};

window.setMcGillPreset = function (preset) {
  if (mcgillState.isRunning) toggleMcGillTimer();
  ['big3', 'plank', 'deadbug'].forEach(p => {
    const btn = document.getElementById(`btn-mcgill-${p}`);
    if (btn) {
      if (p === preset) {
        btn.className = 'py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all text-center';
      } else {
        btn.className = 'py-2 rounded-xl text-zinc-400 hover:text-zinc-200 transition-all text-center';
      }
    }
  });

  if (preset === 'big3') {
    mcgillState.workSec = 10;
    mcgillState.restSec = 3;
    mcgillState.maxCycles = 5;
  } else if (preset === 'plank') {
    mcgillState.workSec = 20;
    mcgillState.restSec = 10;
    mcgillState.maxCycles = 4;
  } else if (preset === 'deadbug') {
    mcgillState.workSec = 12;
    mcgillState.restSec = 4;
    mcgillState.maxCycles = 6;
  }

  resetMcGillTimer();
};

window.toggleMcGillTimer = function () {
  mcgillState.isRunning = !mcgillState.isRunning;
  const playBtn = document.getElementById('btn-mcgill-play-pause');
  const label = document.getElementById('mcgill-play-label');

  if (mcgillState.isRunning) {
    if (label) label.textContent = 'Pausar';
    if (playBtn) playBtn.className = 'flex-1 py-3 rounded-2xl bg-amber-500 hover:opacity-90 text-zinc-950 text-xs font-black shadow-lg transition-all flex items-center justify-center gap-1.5';
    playTone(880, 0.15); // Start work tone

    mcgillState.intervalId = setInterval(() => {
      mcgillState.remaining--;
      if (mcgillState.remaining <= 0) {
        if (mcgillState.phase === 'work') {
          mcgillState.phase = 'rest';
          mcgillState.remaining = mcgillState.restSec;
          playTone(440, 0.2); // Rest tone
          if (navigator.vibrate) navigator.vibrate(100);
        } else {
          mcgillState.cycle++;
          if (mcgillState.cycle > mcgillState.maxCycles) {
            // Sequence completed
            toggleMcGillTimer();
            resetMcGillTimer();
            playCelebrationFanfare();
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            showToast('🎉 ¡Secuencia Core McGill completada!', 'success');
            return;
          } else {
            mcgillState.phase = 'work';
            mcgillState.remaining = mcgillState.workSec;
            playTone(880, 0.18); // Next work tone
            if (navigator.vibrate) navigator.vibrate(150);
          }
        }
      }
      updateMcGillUI();
    }, 1000);
  } else {
    clearInterval(mcgillState.intervalId);
    mcgillState.intervalId = null;
    if (label) label.textContent = 'Reanudar Secuencia';
    if (playBtn) playBtn.className = 'flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-[#30d158] hover:opacity-90 text-zinc-950 text-xs font-black shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5';
  }
};

window.resetMcGillTimer = function () {
  if (mcgillState.intervalId) {
    clearInterval(mcgillState.intervalId);
    mcgillState.intervalId = null;
  }
  mcgillState.isRunning = false;
  mcgillState.phase = 'work';
  mcgillState.remaining = mcgillState.workSec;
  mcgillState.cycle = 1;

  const label = document.getElementById('mcgill-play-label');
  const playBtn = document.getElementById('btn-mcgill-play-pause');
  if (label) label.textContent = 'Iniciar Secuencia';
  if (playBtn) playBtn.className = 'flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-[#30d158] hover:opacity-90 text-zinc-950 text-xs font-black shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5';

  updateMcGillUI();
};

function updateMcGillUI() {
  const badge = document.getElementById('mcgill-phase-badge');
  const num = document.getElementById('mcgill-countdown-number');
  const cycleEl = document.getElementById('mcgill-cycle-label');

  if (num) num.textContent = mcgillState.remaining;
  if (cycleEl) cycleEl.textContent = `Repetición ${mcgillState.cycle} de ${mcgillState.maxCycles}`;

  if (badge) {
    if (mcgillState.phase === 'work') {
      badge.textContent = 'TRABAJO (CONTRACCIÓN)';
      badge.className = 'px-3 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase mb-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    } else {
      badge.textContent = 'PAUSA (DESCOMPRESIÓN)';
      badge.className = 'px-3 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase mb-2 bg-blue-500/20 text-blue-300 border border-blue-500/30';
    }
  }
}

// ============================================================================
// 18. WEEKLY PERFORMANCE SUMMARY & WHATSAPP EXPORT (FEATURE 7)
// ============================================================================

window.openWeeklySummaryModal = function () {
  const modal = document.getElementById('modal-weekly-summary');
  if (!modal) return;

  const week = state.selectedWeek;
  const weekExercises = state.workoutData.filter(e => e.semana === week);

  let totalVolumeKg = 0;
  let totalCompletedSets = 0;
  let totalPRs = 0;
  let lumbarWarnings = 0;

  weekExercises.forEach(ex => {
    for (let s = 1; s <= ex.series; s++) {
      const log = state.workoutLogs[`${ex.id}_s${s}`];
      if (log && log.completed) {
        totalCompletedSets++;
        const w = parseFloat(log.weight) || 0;
        const r = parseFloat(log.reps) || 0;
        totalVolumeKg += w * r;

        if (w > 0 && checkIsPersonalRecord(ex, w, r)) {
          totalPRs++;
        }
      }
      if (log && log.molestia_dolor) lumbarWarnings++;
    }
  });

  // Nutrition adherence for selected week
  const weekMeals = state.nutritionData.filter(m => m.semana === week);
  let completedMeals = 0;
  weekMeals.forEach(m => {
    if (state.nutritionLogs[m.id]) completedMeals++;
  });
  const nutritionPct = weekMeals.length > 0 ? Math.round((completedMeals / weekMeals.length) * 100) : 0;

  // Update UI Stats
  const volEl = document.getElementById('summary-volume-stat');
  const setsEl = document.getElementById('summary-sets-stat');
  const prsEl = document.getElementById('summary-prs-stat');
  const nutriEl = document.getElementById('summary-nutrition-stat');

  if (volEl) volEl.textContent = `${Math.round(totalVolumeKg).toLocaleString('es-ES')} kg`;
  if (setsEl) setsEl.textContent = `${totalCompletedSets} series`;
  if (prsEl) prsEl.textContent = `${totalPRs} batidos`;
  if (nutriEl) nutriEl.textContent = `${nutritionPct}% (${completedMeals}/${weekMeals.length})`;

  // Generate WhatsApp message
  const spineText = lumbarWarnings === 0 ? '🟢 Óptima (Sin sobrecarga lumbar)' : `🟡 ${lumbarWarnings} avisos controlados`;
  const whatsappMsg = 
`🏋️‍♂️ *FITPANTRY REPORT - SEMANA ${week}* 🚀
────────────────────────
💪 *Volumen Total:* ${Math.round(totalVolumeKg).toLocaleString('es-ES')} kg
✅ *Series Completadas:* ${totalCompletedSets} series
🏆 *Nuevos Récords (PR):* ${totalPRs} récords
🥗 *Adherencia Nutrición:* ${nutritionPct}% (${completedMeals}/${weekMeals.length} comidas)
🛡️ *Salud Raquídea:* ${spineText}
────────────────────────
🔥 _Constancia, disciplina y salud raquídea._`;

  const textarea = document.getElementById('whatsapp-summary-textarea');
  if (textarea) textarea.value = whatsappMsg;

  modal.classList.remove('hidden');
};

window.closeWeeklySummaryModal = function () {
  const modal = document.getElementById('modal-weekly-summary');
  if (modal) modal.classList.add('hidden');
};

window.copyWeeklySummaryWhatsApp = function () {
  const textarea = document.getElementById('whatsapp-summary-textarea');
  if (!textarea) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textarea.value).then(() => {
      playTone(800, 0.15);
      showToast('📋 ¡Resumen semanal copiado para WhatsApp!', 'success');
    }).catch(() => {
      textarea.select();
      document.execCommand('copy');
      showToast('📋 ¡Copiado al portapapeles!', 'success');
    });
  } else {
    textarea.select();
    document.execCommand('copy');
    showToast('📋 ¡Copiado al portapapeles!', 'success');
  }
};

// Bootstrap
document.addEventListener('DOMContentLoaded', initApp);
