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

  state.timer.intervalId = setInterval(() => {
    if (state.timer.remaining > 1) {
      state.timer.remaining--;
      if (state.timer.remaining <= 3) playTone(520, 0.07);
      renderTimerWidget();
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
      } else {
        state.timer.remaining = 0;
        stopTimer();
        onTimerFinished();
      }
    }, 1000);
    renderTimerWidget();
  }
}

function stopTimer() {
  state.timer.isRunning = false;
  if (state.timer.intervalId) {
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
  }
  renderTimerWidget();
}

function adjustTimer(deltaSeconds) {
  state.timer.remaining = Math.max(0, state.timer.remaining + deltaSeconds);
  state.timer.total = Math.max(state.timer.total, state.timer.remaining);
  renderTimerWidget();
}

function resetTimer() {
  stopTimer();
  state.timer.remaining = state.timer.total;
  renderTimerWidget();
}

function onTimerFinished() {
  playTimerChime();
  if (state.settings.vibrate && 'vibrate' in navigator) {
    try { navigator.vibrate([250, 100, 250, 100, 350]); } catch (e) {}
  }
  showToast(`⏱️ ¡Tiempo completado: ${state.timer.label}!`, 'success');
  renderTimerWidget();
}

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

  if (tabName === 'nutrition') renderNutrition();
  if (tabName === 'pantry') renderPantry();
  if (tabName === 'workout') renderWorkout();
  if (tabName === 'settings') renderSettings();

  if (window.lucide) lucide.createIcons();
}

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

  // 4. Calculate Daily Macros Totals
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

  if (macrosCard) {
    macrosCard.innerHTML = `
      <div class="grid grid-cols-5 gap-1.5 text-center">
        <div class="glass-pill p-2 rounded-2xl border border-emerald-500/20 bg-emerald-950/20">
          <span class="text-[9px] uppercase font-bold text-emerald-300/80 tracking-wider block">Kcal</span>
          <span class="text-xs font-black text-emerald-300 font-mono">${Math.round(totals.cal)}</span>
        </div>
        <div class="glass-pill p-2 rounded-2xl">
          <span class="text-[9px] uppercase font-bold text-zinc-400 tracking-wider block">Proteína</span>
          <span class="text-xs font-bold text-zinc-100 font-mono">${Math.round(totals.prot)}g</span>
        </div>
        <div class="glass-pill p-2 rounded-2xl">
          <span class="text-[9px] uppercase font-bold text-zinc-400 tracking-wider block">Carbos</span>
          <span class="text-xs font-bold text-zinc-100 font-mono">${Math.round(totals.carbs)}g</span>
        </div>
        <div class="glass-pill p-2 rounded-2xl">
          <span class="text-[9px] uppercase font-bold text-zinc-400 tracking-wider block">Grasas</span>
          <span class="text-xs font-bold text-zinc-100 font-mono">${Math.round(totals.fat)}g</span>
        </div>
        <div class="glass-pill p-2 rounded-2xl">
          <span class="text-[9px] uppercase font-bold text-zinc-400 tracking-wider block">Fibra</span>
          <span class="text-xs font-bold text-zinc-100 font-mono">${Math.round(totals.fiber)}g</span>
        </div>
      </div>
    `;
  }

  // 5. Render Individual Meal Cards (Apple Frosted Card)
  let mealsHtml = '';
  meals.forEach(m => {
    const isEaten = !!state.nutritionLogs[m.id];
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
            </div>
            <h3 class="text-sm font-bold text-zinc-100 leading-snug tracking-tight">${m.plato}</h3>
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

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 px-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30">
        <p class="text-xs text-zinc-400">No hay productos en esta vista.</p>
      </div>
    `;
    return;
  }

  let html = '';
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

  // 3. Location Mode Toggle (Apple Segmented Style)
  if (locationToggle) {
    locationToggle.innerHTML = `
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
        🏠 Casa (Banco Romano)
      </button>
    `;
  }

  // 4. Filter Exercises for Selected Week & Day
  const exercises = state.workoutData.filter(
    e => e.semana === state.selectedWeek && e.dia === state.selectedWorkoutDay
  );

  // 5. Calculate Progress
  let totalSets = 0;
  let completedSets = 0;
  exercises.forEach(ex => {
    totalSets += ex.series;
    for (let s = 1; s <= ex.series; s++) {
      const log = state.workoutLogs[`${ex.id}_s${s}`];
      if (log && log.completed) completedSets++;
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

  // 6. Render Exercise Cards
  let exHtml = '';
  exercises.forEach(ex => {
    const overload = getPreviousWeekOverload(ex);
    const exerciseVariant = state.trainingLocation === 'gym'
      ? (ex.varianteGym || ex.patron)
      : (ex.varianteCasa || ex.patron);

    let setsTableHtml = '';
    for (let s = 1; s <= ex.series; s++) {
      const key = `${ex.id}_s${s}`;
      const log = state.workoutLogs[key] || { weight: '', reps: '', rir: '', completed: false, molestia_dolor: false, tempo_cumplido: true, notas: '' };

      setsTableHtml += `
        <tr class="border-b border-white/[0.05] hover:bg-white/[0.02]">
          <td class="py-2.5 px-2 text-xs font-semibold text-zinc-400 text-center font-mono">#${s}</td>
          <td class="py-2.5 px-1 text-center">
            <input type="number" step="0.5" placeholder="kg" value="${log.weight !== undefined ? log.weight : ''}"
              onchange="saveWorkoutSetField('${ex.id}', ${s}, 'weight', this.value)"
              class="w-16 bg-zinc-900/90 border border-white/[0.08] rounded-xl px-2 py-1 text-xs text-center text-zinc-100 font-mono focus:border-emerald-400 focus:outline-none" />
          </td>
          <td class="py-2.5 px-1 text-center">
            <input type="number" placeholder="${ex.reps.split('-')[0] || '10'}" value="${log.reps !== undefined ? log.reps : ''}"
              onchange="saveWorkoutSetField('${ex.id}', ${s}, 'reps', this.value)"
              class="w-14 bg-zinc-900/90 border border-white/[0.08] rounded-xl px-2 py-1 text-xs text-center text-zinc-100 font-mono focus:border-emerald-400 focus:outline-none" />
          </td>
          <td class="py-2.5 px-1 text-center">
            <input type="text" placeholder="${ex.rir}" value="${log.rir !== undefined ? log.rir : ''}"
              onchange="saveWorkoutSetField('${ex.id}', ${s}, 'rir', this.value)"
              class="w-12 bg-zinc-900/90 border border-white/[0.08] rounded-xl px-2 py-1 text-xs text-center text-zinc-100 font-mono focus:border-emerald-400 focus:outline-none" />
          </td>
          <td class="py-2.5 px-1 text-center">
            <button type="button" onclick="toggleWorkoutSetPain('${ex.id}', ${s})" class="px-2 py-1 rounded-xl text-xs transition-all ${log.molestia_dolor ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 font-bold shadow-sm' : 'text-zinc-600 hover:text-zinc-400 border border-transparent'}" title="${log.molestia_dolor ? 'Molestia registrada en serie' : 'Reportar molestia articular/lumbar'}">
              ⚠️
            </button>
          </td>
          <td class="py-2.5 px-2 text-center">
            <input type="checkbox" ${log.completed ? 'checked' : ''}
              onchange="toggleWorkoutSetDone('${ex.id}', ${s}, this.checked, ${ex.descanso}, '${encodeURIComponent(exerciseVariant)}')"
              class="set-checkbox" />
          </td>
        </tr>
      `;
    }

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
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button onclick="openFocusModeModal('${ex.id}')" class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400/20 to-[#30d158]/20 hover:from-emerald-400/30 hover:to-[#30d158]/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 transition-all" title="Modo Foco Manos Sudorosas">
              <i data-lucide="zap" class="w-3.5 h-3.5"></i>
              <span>Foco</span>
            </button>
            <button onclick="startTimer(${ex.descanso}, '${encodeURIComponent(exerciseVariant)}')" class="px-2.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border border-white/[0.07] text-xs font-medium flex items-center gap-1 transition-all shadow-sm">
              <i data-lucide="timer" class="w-4 h-4 text-emerald-400"></i>
              <span>${ex.descanso}s</span>
            </button>
          </div>
        </div>

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
              <span>Copiar</span>
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
                <th class="py-1 px-2 text-center w-10">Serie</th>
                <th class="py-1 px-1 text-center w-20">Kg</th>
                <th class="py-1 px-1 text-center w-16">Reps</th>
                <th class="py-1 px-1 text-center w-14">RIR</th>
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
      if (!state.workoutLogs[key]) state.workoutLogs[key] = { weight: '', reps: '', rir: '', completed: false };
      state.workoutLogs[key].weight = prevSet.weight;
      state.workoutLogs[key].reps = prevSet.reps || '';
      state.workoutLogs[key].rir = prevSet.rir || '';
    }
  });

  saveStateToStorage();
  renderWorkout();
  showToast('📈 Pesos de la semana anterior copiados', 'success');
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

window.saveFirebaseSettingsFromUI = function () {
  const apiKey = (document.getElementById('firebase-input-apikey')?.value || '').trim();
  const authDomain = (document.getElementById('firebase-input-authdomain')?.value || '').trim();
  const projectId = (document.getElementById('firebase-input-projectid')?.value || '').trim();
  const appId = (document.getElementById('firebase-input-appid')?.value || '').trim();

  if (!apiKey || !projectId) {
    showToast('Por favor introduce al menos la API Key y el Project ID de Firebase', 'error');
    return;
  }

  const ok = window.FirebaseAuth.saveFirebaseConfig({
    apiKey,
    authDomain,
    projectId,
    appId
  });

  if (ok) {
    showToast('Credenciales de Firebase guardadas en el dispositivo', 'success');
    window.SyncService.drainQueue();
  } else {
    showToast('Error al guardar credenciales', 'error');
  }
};

window.promptPasteFirebaseConfig = function () {
  const raw = prompt('Pega el objeto de configuración copiado de Firebase Console (const firebaseConfig = { ... }):');
  if (!raw) return;

  try {
    // Extraer valores mediante expresiones regulares o JSON
    const apiKeyMatch = raw.match(/apiKey["']?\s*:\s*["']([^"']+)["']/);
    const authDomainMatch = raw.match(/authDomain["']?\s*:\s*["']([^"']+)["']/);
    const projectIdMatch = raw.match(/projectId["']?\s*:\s*["']([^"']+)["']/);
    const appIdMatch = raw.match(/appId["']?\s*:\s*["']([^"']+)["']/);

    const config = {
      apiKey: apiKeyMatch ? apiKeyMatch[1] : '',
      authDomain: authDomainMatch ? authDomainMatch[1] : '',
      projectId: projectIdMatch ? projectIdMatch[1] : '',
      appId: appIdMatch ? appIdMatch[1] : ''
    };

    if (config.apiKey) document.getElementById('firebase-input-apikey').value = config.apiKey;
    if (config.authDomain) document.getElementById('firebase-input-authdomain').value = config.authDomain;
    if (config.projectId) document.getElementById('firebase-input-projectid').value = config.projectId;
    if (config.appId) document.getElementById('firebase-input-appid').value = config.appId;

    if (config.apiKey && config.projectId) {
      window.saveFirebaseSettingsFromUI();
    } else {
      showToast('Campos rellenados. Revisa y pulsa "Guardar Conexión"', 'info');
    }
  } catch (e) {
    showToast('No se pudo analizar el texto introducido', 'error');
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

// Bootstrap
document.addEventListener('DOMContentLoaded', initApp);
