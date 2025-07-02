// ========== STATE MANAGEMENT ========== //
const STORAGE_KEY = 'timeTrackerData';
let productivityChart = null;

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const today = new Date().toDateString();
  
  if (saved) {
    const state = JSON.parse(saved);
    
    // Проверяем, не наступил ли новый день
    if (state.lastActivityDate !== today) {
      saveDailyStats(state); // Сохраняем статистику за предыдущий день
      return getDefaultState(today);
    }
    return state;
  }
  return getDefaultState(today);
}

function getDefaultState(today) {
  return {
    productiveTime: 0,
    unproductiveTime: 0,
    isProductiveRunning: false,
    isUnproductiveRunning: false,
    firstStartTime: null,
    lastEndTime: null,
    longestProductiveSession: 0,
    currentSessionStart: 0,
    breaksCount: 0,
    activityLog: [],
    lastActivityDate: today
  };
}

function saveState(state) {
  state.lastActivityDate = new Date().toDateString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ========== TIMER FUNCTIONS ========== //
function startProductiveTimer() {
  if (appState.isProductiveRunning) return;
  
  // Если это первый запуск за день
  if (!appState.firstStartTime) {
    appState.firstStartTime = new Date();
  }
  
  // Запускаем полезный таймер
  appState.isProductiveRunning = true;
  appState.currentSessionStart = Date.now();
  appState.breaksCount++;
  
  // Останавливаем бесполезный таймер
  stopUnproductiveTimer();
  
  // Добавляем запись в лог
  addActivityLog('Начало работы');
  
  // Запускаем интервал обновления каждую секунду
  appState.productiveInterval = setInterval(() => {
    appState.productiveTime++;
    updateTimerDisplay();
    saveState(appState);
  }, 1000);
  
  updateTimerDisplay();
  saveState(appState);
}

function pauseProductiveTimer() {
  if (!appState.isProductiveRunning) return;
  
  // Останавливаем полезный таймер
  appState.isProductiveRunning = false;
  clearInterval(appState.productiveInterval);
  
  // Фиксируем длительность сеанса
  const sessionDuration = Math.floor((Date.now() - appState.currentSessionStart) / 1000);
  if (sessionDuration > appState.longestProductiveSession) {
    appState.longestProductiveSession = sessionDuration;
  }
  
  // Запускаем бесполезный таймер
  startUnproductiveTimer();
  
  // Добавляем запись в лог
  addActivityLog('Перерыв');
  
  saveState(appState);
}

function startUnproductiveTimer() {
  if (appState.isUnproductiveRunning) return;
  
  appState.isUnproductiveRunning = true;
  appState.unproductiveInterval = setInterval(() => {
    appState.unproductiveTime++;
    updateTimerDisplay();
    saveState(appState);
  }, 1000);
}

function stopUnproductiveTimer() {
  if (!appState.isUnproductiveRunning) return;
  
  appState.isUnproductiveRunning = false;
  clearInterval(appState.unproductiveInterval);
}

function resetTimers() {
  appState.productiveTime = 0;
  appState.unproductiveTime = 0;
  updateTimerDisplay();
  saveState(appState);
}

// ========== SLEEP COUNTDOWN ========== //
function startSleepCountdown() {
  pauseProductiveTimer();
  stopUnproductiveTimer();
  
  elements.sleepCountdownEl.classList.remove('hidden');
  
  let countdown = 5;
  elements.countdownEl.textContent = countdown;
  
  appState.countdownInterval = setInterval(() => {
    countdown--;
    elements.countdownEl.textContent = countdown;
    
    if (countdown <= 0) {
      clearInterval(appState.countdownInterval);
      finishDay();
    }
  }, 1000);
}

function cancelSleepCountdown() {
  clearInterval(appState.countdownInterval);
  elements.sleepCountdownEl.classList.add('hidden');
}

// ========== DAY FINISH ========== //
function finishDay() {
  appState.lastEndTime = new Date();
  saveDailyStats(appState);
  showStats();
  resetStateForNewDay();
}

function resetStateForNewDay() {
  appState = getDefaultState(new Date().toDateString());
  saveState(appState);
  updateTimerDisplay();
}

function saveDailyStats(state) {
  const stats = {
    date: state.lastActivityDate,
    productiveTime: state.productiveTime,
    unproductiveTime: state.unproductiveTime,
    longestSession: state.longestProductiveSession
  };
  
  const allStats = JSON.parse(localStorage.getItem('timeTrackerStats') || '[]');
  allStats.push(stats);
  localStorage.setItem('timeTrackerStats', JSON.stringify(allStats));
}

// ========== STATISTICS ========== //
function showStats() {
  elements.sleepCountdownEl.classList.add('hidden');
  elements.statsPanel.classList.remove('hidden');
  calculateStatistics();
}

function calculateStatistics() {
  const totalSeconds = appState.productiveTime + appState.unproductiveTime;
  
  // 1. Общее время
  elements.totalTimeEl.textContent = formatTime(totalSeconds);
  
  // 2. Круговая диаграмма
  const productivePercent = totalSeconds > 0 
    ? Math.round((appState.productiveTime / totalSeconds) * 100) 
    : 0;
  const unproductivePercent = 100 - productivePercent;
  
  updateChart(appState.productiveTime, appState.unproductiveTime);
  elements.productivePercentEl.textContent = `${productivePercent}%`;
  elements.unproductivePercentEl.textContent = `${unproductivePercent}%`;
  
  // 3. Мотивация
  setMotivationMessage(productivePercent);
  
  // 4. Временные метки
  if (appState.firstStartTime) {
    elements.startTimeEl.textContent = `Начало: ${formatTimeToHours(appState.firstStartTime)}`;
  }
  if (appState.lastEndTime) {
    elements.endTimeEl.textContent = `Окончание: ${formatTimeToHours(appState.lastEndTime)}`;
  }
  
  // 5. Активность
  elements.longestSessionEl.textContent = `Лучший сеанс: ${formatTime(appState.longestProductiveSession)}`;
  elements.breaksCountEl.textContent = `Перерывов: ${appState.breaksCount}`;
  
  // 6. Лог активности
  renderActivityLog();
}

function updateChart(productiveTime, unproductiveTime) {
  if (!productivityChart) {
    initChart();
  }
  
  productivityChart.data.datasets[0].data = [productiveTime, unproductiveTime];
  productivityChart.update();
}

function initChart() {
  const ctx = elements.productivityChart.getContext('2d');
  productivityChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Полезно', 'Бесполезно'],
      datasets: [{
        data: [0, 0],
        backgroundColor: [getComputedStyle(document.documentElement).getPropertyValue('--productive'), 
                        getComputedStyle(document.documentElement).getPropertyValue('--unproductive')],
        borderWidth: 0
      }]
    },
    options: {
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      animation: {
        animateScale: true,
        animateRotate: true
      }
    }
  });
}

function setMotivationMessage(percent) {
  const messages = {
    high: { text: "🏆 Отличный результат! Так держать!", color: "#2ecc71" },
    medium: { text: "👍 Хорошо, но есть куда расти", color: "#f39c12" },
    low: { text: "🤔 Стоит поработать над продуктивностью", color: "#e74c3c" }
  };
  
  let selectedMessage;
  if (percent >= 80) selectedMessage = messages.high;
  else if (percent >= 50) selectedMessage = messages.medium;
  else selectedMessage = messages.low;
  
  elements.motivationEl.textContent = selectedMessage.text;
  elements.motivationEl.style.color = selectedMessage.color;
  
  // Случайный совет
  const tips = [
    "Попробуйте технику Pomodoro (25 минут работы + 5 минут отдыха)",
    "Выключайте уведомления на телефоне во время работы",
    "Планируйте задачи на день с утра",
    "Делайте короткие перерывы каждые 45-60 минут",
    "Начинайте с самых сложных задач"
  ];
  elements.adviceEl.textContent = tips[Math.floor(Math.random() * tips.length)];
}

// ========== ACTIVITY LOG ========== //
function addActivityLog(action) {
  const now = new Date();
  appState.activityLog.unshift({
    time: now.toLocaleTimeString(),
    action: action,
    timestamp: now.getTime()
  });
  
  // Ограничиваем лог 20 последними записями
  if (appState.activityLog.length > 20) {
    appState.activityLog.pop();
  }
}

function renderActivityLog() {
  elements.activityLogEl.innerHTML = '<h3>📝 История активности</h3>';
  
  if (appState.activityLog.length === 0) {
    elements.activityLogEl.innerHTML += '<p>Нет данных об активности</p>';
    return;
  }
  
  appState.activityLog.forEach(entry => {
    const entryEl = document.createElement('div');
    entryEl.className = 'activity-entry';
    entryEl.innerHTML = `
      <span>${entry.time}</span>
      <strong>${entry.action}</strong>
    `;
    elements.activityLogEl.appendChild(entryEl);
  });
}

// ========== HISTORY ========== //
function showHistory() {
  const history = JSON.parse(localStorage.getItem('timeTrackerStats') || '[]');
  const historyList = document.getElementById('history-list');
  
  historyList.innerHTML = history.length === 0 
    ? '<p>Нет данных за предыдущие дни</p>'
    : history.reverse().map(day => `
        <div class="history-item">
          <div class="history-date">${new Date(day.date).toLocaleDateString()}</div>
          <div class="history-stats">
            <span class="productive">Полезно: ${formatTime(day.productiveTime)}</span>
            <span class="unproductive">Бесполезно: ${formatTime(day.unproductiveTime)}</span>
          </div>
          <div>Лучший сеанс: ${formatTime(day.longestSession)}</div>
        </div>
      `).join('');
  
  elements.historyModal.classList.remove('hidden');
}

// ========== UTILITIES ========== //
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeToHours(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateTimerDisplay() {
  elements.productiveTimer.textContent = formatTime(appState.productiveTime);
  elements.unproductiveTimer.textContent = formatTime(appState.unproductiveTime);
}

// ========== INITIALIZATION ========== //
const elements = {
  productiveTimer: document.getElementById('productive-timer'),
  unproductiveTimer: document.getElementById('unproductive-timer'),
  startBtn: document.getElementById('start-productive'),
  pauseBtn: document.getElementById('pause-productive'),
  resetBtn: document.getElementById('reset-all-timers'),
  finishDayBtn: document.getElementById('reset-all'),
  sleepCountdownEl: document.getElementById('sleep-countdown'),
  countdownEl: document.getElementById('countdown'),
  cancelSleepBtn: document.getElementById('cancel-sleep'),
  statsPanel: document.getElementById('stats'),
  totalTimeEl: document.getElementById('total-time'),
  productivePercentEl: document.getElementById('productive-percent'),
  unproductivePercentEl: document.getElementById('unproductive-percent'),
  productivityChart: document.getElementById('productivityChart'),
  motivationEl: document.getElementById('motivation'),
  adviceEl: document.getElementById('advice'),
  startTimeEl: document.getElementById('start-time'),
  endTimeEl: document.getElementById('end-time'),
  longestSessionEl: document.getElementById('longest-session'),
  breaksCountEl: document.getElementById('breaks-count'),
  activityLogEl: document.getElementById('activity-log'),
  newDayBtn: document.getElementById('start-new-day'),
  historyModal: document.getElementById('history-modal'),
  showHistoryBtn: document.getElementById('show-history')
};

let appState = loadState();

function setupEventListeners() {
  elements.startBtn.addEventListener('click', startProductiveTimer);
  elements.pauseBtn.addEventListener('click', pauseProductiveTimer);
  elements.resetBtn.addEventListener('click', resetTimers);
  elements.finishDayBtn.addEventListener('click', startSleepCountdown);
  elements.cancelSleepBtn.addEventListener('click', cancelSleepCountdown);
  elements.newDayBtn.addEventListener('click', startNewDay);
  elements.showHistoryBtn.addEventListener('click', showHistory);
  document.querySelector('.close-btn').addEventListener('click', () => {
    elements.historyModal.classList.add('hidden');
  });
}

function init() {
  setupEventListeners();
  updateTimerDisplay();
  
  // Восстанавливаем работу таймеров при загрузке
  if (appState.isProductiveRunning) {
    const elapsed = Math.floor((Date.now() - appState.currentSessionStart) / 1000);
    appState.productiveTime += elapsed;
    startProductiveTimer();
  } else if (appState.isUnproductiveRunning) {
    startUnproductiveTimer();
  }
  
  // Инициализируем график
  initChart();
}

// Запускаем приложение
init();
