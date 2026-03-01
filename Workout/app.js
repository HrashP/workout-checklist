/* =========================================================
   Workout Checklist — app.js
   Fully refactored with all 15 improvements applied
   ========================================================= */

// ---------- GLOBAL STATE ----------
let EXERCISES = {};
let viewYear, viewMonth; // calendar popup month view

// ---------- HELPERS ----------
const $ = (id) => document.getElementById(id);

function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function dateToISO(d) {
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function parseISO(str) {
    return new Date(str + 'T00:00:00');
}

const ACTIVE_DATE_KEY = 'workoutChecklist:activeDate';
const SESSION_KEY = 'workoutChecklist:sessionStart';

function getStoredActiveDate() {
    // On a new session (new tab/reload), always start on today
    const sessionStart = sessionStorage.getItem(SESSION_KEY);
    if (!sessionStart) {
        // First load this session — reset to today
        sessionStorage.setItem(SESSION_KEY, '1');
        const today = todayISO();
        localStorage.setItem(ACTIVE_DATE_KEY, today);
        return today;
    }
    return localStorage.getItem(ACTIVE_DATE_KEY) || todayISO();
}

function setStoredActiveDate(dateStr) {
    localStorage.setItem(ACTIVE_DATE_KEY, dateStr);
}

function getActiveDate() {
    return getStoredActiveDate();
}

// ---------- DATE NAVIGATION (Improvement #4: DRY) ----------
function navigateToDate(isoStr) {
    setStoredActiveDate(isoStr);
    $('dateText').textContent = isoStr;
    const d = parseISO(isoStr);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    renderAll();
}

// ---------- STATE PERSISTENCE ----------
function keyFor(dateStr) { return `workoutChecklist:${dateStr}`; }

function loadState(dateStr) {
    const raw = localStorage.getItem(keyFor(dateStr));
    if (!raw) return { checks: {}, notes: '' };
    try { return JSON.parse(raw); }
    catch { return { checks: {}, notes: '' }; }
}

function saveState(dateStr, state) {
    localStorage.setItem(keyFor(dateStr), JSON.stringify(state));
}

// ---------- DAILY SUMMARY ----------
function summaryKey(dateStr) { return `workoutSummary:${dateStr}`; }

function saveSummary(dateStr, summaryObj) {
    localStorage.setItem(summaryKey(dateStr), JSON.stringify(summaryObj));
}

function loadSummary(dateStr) {
    const raw = localStorage.getItem(summaryKey(dateStr));
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch { return null; }
}

function deleteSummary(dateStr) {
    localStorage.removeItem(summaryKey(dateStr));
}

// ---------- Improvement #3: SINGLE computeStats ----------
function computeStats(state) {
    const sections = {};
    let totalAll = 0, doneAll = 0;

    for (const sec of Object.keys(EXERCISES)) {
        const ids = EXERCISES[sec].map((_, idx) => `${sec}_${idx}`);
        const done = ids.filter(id => state.checks[id]).length;
        sections[sec] = { done, total: ids.length };
        totalAll += ids.length;
        doneAll += done;
    }

    const percent = totalAll ? Math.round((doneAll / totalAll) * 100) : 0;
    return { done: doneAll, total: totalAll, percent, sections };
}

function updateProgressUI(stats) {
    $('total').textContent = stats.total;
    $('done').textContent = stats.done;
    $('percent').textContent = stats.percent;
    $('fill').style.width = `${stats.percent}%`;

    for (const sec of Object.keys(stats.sections)) {
        const s = stats.sections[sec];
        const el = $(`${sec}Count`);
        if (el) el.textContent = `${s.done}/${s.total}`;
    }
}

function formatSavedAt(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString();
}

// ---------- Improvement #13: XSS-safe rendering ----------
function escapeText(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ---------- SUMMARY CARD ----------
function renderSummaryCard() {
    const dateStr = getActiveDate();
    const saved = loadSummary(dateStr);

    const meta = $('summaryMeta');
    const body = $('summaryBody');
    $('summaryStatus').textContent = '';

    if (!saved) {
        meta.textContent = 'No summary saved for this date.';
        body.className = 'sumEmpty';
        body.innerHTML = `Press <b>Save daily summary</b> to store today's snapshot.`;
        return;
    }

    meta.textContent = `Saved on: ${formatSavedAt(saved.savedAt)}`;

    const s = saved.sections || {};
    const secLine = (secName, label) => {
        const obj = s[secName] || { done: 0, total: 0 };
        return `${label}: <b>${obj.done}/${obj.total}</b>`;
    };

    // Improvement #13: notes rendered safely
    const notesText = saved.notes && saved.notes.trim()
        ? `"${escapeText(saved.notes.trim())}"`
        : '<i>none</i>';

    body.className = '';
    body.innerHTML = `
    <div class="sumGrid">
      <div class="sumBox">
        <div class="k">Overall</div>
        <div class="v">${saved.done}/${saved.total} (${saved.percent}%)</div>
      </div>
      <div class="sumBox">
        <div class="k">Sections</div>
        <div class="v" style="font-weight:750; font-size:13px; line-height:1.45;">
          ${secLine('lower', 'Lower')}<br/>
          ${secLine('upper', 'Upper')}<br/>
          ${secLine('core', 'Core')}<br/>
          ${secLine('speed', 'Speed')}<br/>
          ${secLine('mobility', 'Mobility')}
        </div>
      </div>
    </div>
    <div style="margin-top:10px; color:var(--muted); font-size:12px;">
      Notes snapshot: ${notesText}
    </div>
  `;
}

// ---------- RENDER SECTIONS ----------
function renderSection(sectionId, items, state, dateStr) {
    const container = $(sectionId);
    container.innerHTML = '';

    items.forEach((it, idx) => {
        const id = `${sectionId}_${idx}`;
        const checked = !!state.checks[id];

        const row = document.createElement('div');
        row.className = 'item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = id;
        cb.checked = checked;

        cb.addEventListener('change', () => {
            state.checks[id] = cb.checked;
            saveState(dateStr, state);
            updateProgressUI(computeStats(state));
        });

        const label = document.createElement('label');
        label.htmlFor = id;
        label.className = 'name';
        label.textContent = it.name;

        // Improvement #11: CSS class instead of inline styles
        const right = document.createElement('div');
        right.className = 'hint-col';

        if (it.hint) {
            const hint = document.createElement('div');
            hint.className = 'hint';
            hint.textContent = it.hint;
            right.appendChild(hint);
        }

        row.appendChild(cb);
        row.appendChild(label);
        row.appendChild(right);
        container.appendChild(row);
    });
}

function renderAll() {
    const dateStr = getActiveDate();
    const state = loadState(dateStr);

    $('notes').value = state.notes ?? '';

    for (const sec of Object.keys(EXERCISES)) {
        renderSection(sec, EXERCISES[sec], state, dateStr);
    }

    updateProgressUI(computeStats(state));

    $('notes').oninput = () => {
        state.notes = $('notes').value;
        saveState(dateStr, state);
    };

    renderSummaryCard();
    renderAnalytics();
}

// ---------- Improvement #5: Reset with confirm ----------
function resetThisDay() {
    if (!confirm('Reset all checks, notes, and saved summary for this day?')) return;

    const dateStr = getActiveDate();
    const state = loadState(dateStr);
    state.checks = {};
    state.notes = '';
    saveState(dateStr, state);
    deleteSummary(dateStr);
    renderAll();
}

function expandCollapse(allOpen) {
    document.querySelectorAll('details').forEach(d => d.open = allOpen);
}

// ---------- Improvement #7: File download export ----------
function exportText() {
    const dateStr = getActiveDate();
    const state = loadState(dateStr);

    const lines = [];
    lines.push(`Workout Checklist — ${dateStr}`);
    lines.push('');

    for (const sec of Object.keys(EXERCISES)) {
        lines.push(sec.toUpperCase());
        EXERCISES[sec].forEach((it, idx) => {
            const id = `${sec}_${idx}`;
            const mark = state.checks[id] ? '✅' : '⬜';
            const hint = it.hint ? ` (${it.hint})` : '';
            lines.push(`${mark} ${it.name}${hint}`);
        });
        lines.push('');
    }

    if (state.notes?.trim()) {
        lines.push('NOTES');
        lines.push(state.notes.trim());
        lines.push('');
    }

    const text = lines.join('\n');

    // Clipboard copy
    navigator.clipboard?.writeText(text).catch(() => { });

    // File download
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function onSaveDailySummary() {
    const dateStr = getActiveDate();
    const state = loadState(dateStr);
    const stats = computeStats(state);

    if (stats.done === 0) {
        $('summaryStatus').textContent = '⚠️ Select at least 1 workout before saving.';
        setTimeout(() => { $('summaryStatus').textContent = ''; }, 2500);
        return;
    }

    const summaryObj = {
        date: dateStr,
        savedAt: new Date().toISOString(),
        done: stats.done,
        total: stats.total,
        percent: stats.percent,
        sections: stats.sections,
        notes: (state.notes || '')
    };

    saveSummary(dateStr, summaryObj);

    $('summaryStatus').textContent = '✅ Saved!';
    setTimeout(() => { $('summaryStatus').textContent = ''; }, 2000);

    renderSummaryCard();
}

// ---------- Improvement #8: Analytics ----------
function computeStreak() {
    let streak = 0;
    const d = new Date();

    for (let i = 0; i < 365; i++) {
        const iso = dateToISO(d);
        const state = loadState(iso);
        const stats = computeStats(state);
        if (stats.done > 0) {
            streak++;
        } else if (i > 0) {
            break; // don't break on today if nothing done yet
        } else {
            break;
        }
        d.setDate(d.getDate() - 1);
    }

    return streak;
}

function getLast30DaysData() {
    const result = [];
    const d = new Date();

    for (let i = 29; i >= 0; i--) {
        const target = new Date(d);
        target.setDate(target.getDate() - i);
        const iso = dateToISO(target);
        const state = loadState(iso);
        const stats = computeStats(state);
        result.push({ date: iso, ...stats });
    }

    return result;
}

function renderAnalytics() {
    const streak = computeStreak();
    const last30 = getLast30DaysData();

    // Streak
    $('streakValue').textContent = streak;

    // Weekly average (last 7 days)
    const last7 = last30.slice(-7);
    const avgPct = last7.length
        ? Math.round(last7.reduce((s, d) => s + d.percent, 0) / last7.length)
        : 0;
    $('weekAvgValue').textContent = avgPct + '%';

    // Total workouts (days with > 0 done in last 30)
    const activeDays = last30.filter(d => d.done > 0).length;
    $('activeDaysValue').textContent = activeDays;

    // Heatmap
    const heatmap = $('heatmap');
    heatmap.innerHTML = '';

    // Pad start to align to Sunday
    const firstDate = parseISO(last30[0].date);
    const startPad = firstDate.getDay(); // 0=Sun

    for (let i = 0; i < startPad; i++) {
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        cell.style.opacity = '0';
        heatmap.appendChild(cell);
    }

    for (const day of last30) {
        const cell = document.createElement('div');
        let level = '';
        if (day.percent >= 80) level = 'l4';
        else if (day.percent >= 50) level = 'l3';
        else if (day.percent >= 20) level = 'l2';
        else if (day.percent > 0) level = 'l1';

        cell.className = `heatmap-cell ${level}`;
        cell.setAttribute('data-tip', `${day.date}: ${day.percent}%`);
        heatmap.appendChild(cell);
    }
}

// ---------- Improvement #9: Timer ----------
let timerInterval = null;
let timerSeconds = 0;
let timerMode = 'stopwatch'; // 'stopwatch' or 'countdown'
let timerPreset = 0;

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimerDisplay() {
    $('timerDisplay').textContent = formatTime(timerSeconds);
}

function startTimer() {
    if (timerInterval) return;

    $('timerStart').textContent = '⏸ Pause';

    timerInterval = setInterval(() => {
        if (timerMode === 'countdown') {
            timerSeconds--;
            if (timerSeconds <= 0) {
                timerSeconds = 0;
                stopTimer();
                // Flash + beep indication
                $('timerDisplay').style.animation = 'none';
                void $('timerDisplay').offsetWidth;
                $('timerDisplay').style.animation = '';
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = ctx.createOscillator();
                    osc.frequency.value = 880;
                    osc.connect(ctx.destination);
                    osc.start();
                    setTimeout(() => osc.stop(), 200);
                } catch (e) { }
            }
        } else {
            timerSeconds++;
        }
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    $('timerStart').textContent = '▶ Start';
}

function resetTimer() {
    stopTimer();
    timerSeconds = timerPreset;
    updateTimerDisplay();
}

function setTimerPreset(secs) {
    stopTimer();
    timerPreset = secs;
    timerSeconds = secs;
    timerMode = secs > 0 ? 'countdown' : 'stopwatch';
    updateTimerDisplay();

    // Update active preset button
    document.querySelectorAll('.timer-presets button').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.secs) === secs);
    });
}

function setupTimer() {
    $('timerStart').addEventListener('click', () => {
        if (timerInterval) stopTimer();
        else startTimer();
    });

    $('timerReset').addEventListener('click', resetTimer);

    document.querySelectorAll('.timer-presets button').forEach(btn => {
        btn.addEventListener('click', () => {
            setTimerPreset(parseInt(btn.dataset.secs));
        });
    });

    updateTimerDisplay();
}

// ---------- Improvement #6: Storage Management ----------
function getStorageInfo() {
    let totalKeys = 0;
    let totalSize = 0;
    let workoutKeys = 0;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('workoutChecklist:') || key.startsWith('workoutSummary:')) {
            workoutKeys++;
            totalSize += (localStorage.getItem(key) || '').length;
        }
        totalKeys++;
    }

    return { workoutKeys, totalSize, totalKeys };
}

function cleanOldData(daysToKeep = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    const cutoffISO = dateToISO(cutoff);

    let removed = 0;

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const checklistMatch = key.match(/^workoutChecklist:(\d{4}-\d{2}-\d{2})$/);
        const summaryMatch = key.match(/^workoutSummary:(\d{4}-\d{2}-\d{2})$/);
        const dateStr = checklistMatch?.[1] || summaryMatch?.[1];

        if (dateStr && dateStr < cutoffISO) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(k => { localStorage.removeItem(k); removed++; });
    return removed;
}

function renderStorageInfo() {
    const info = getStorageInfo();
    const sizeKB = (info.totalSize / 1024).toFixed(1);
    $('storageStats').innerHTML =
        `<strong>${info.workoutKeys}</strong> saved entries · <strong>${sizeKB} KB</strong> used`;
}

function setupStorageManagement() {
    renderStorageInfo();

    $('cleanStorage').addEventListener('click', () => {
        const removed = cleanOldData(90);
        alert(`Cleaned up ${removed} entries older than 90 days.`);
        renderStorageInfo();
        renderAll();
    });
}

// ---------- TABS ----------
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            $(`tab-${tab}`).classList.add('active');
        });
    });
}

// ---------- POPUP CALENDAR ----------
function setupCalendar() {
    const modal = $('calModal');

    function openModal() {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        renderMonth();
    }

    function closeModal() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }

    function initViewFromActive() {
        const active = getStoredActiveDate();
        const d = parseISO(active);
        viewYear = d.getFullYear();
        viewMonth = d.getMonth();
        $('dateText').textContent = active;
    }

    function daysInMonth(y, m) {
        return new Date(y, m + 1, 0).getDate();
    }

    function toISO(y, m, day) {
        const mm = String(m + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return `${y}-${mm}-${dd}`;
    }

    // Improvement #14: Cap calendar grid at 42 cells (6 rows)
    function renderMonth() {
        const active = getStoredActiveDate();
        const activeD = parseISO(active);
        const activeY = activeD.getFullYear();
        const activeM = activeD.getMonth();
        const activeDay = activeD.getDate();

        const today = todayISO();
        const todayD = parseISO(today);
        const todayY = todayD.getFullYear();
        const todayM = todayD.getMonth();
        const todayDay = todayD.getDate();

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        $('calMonthLabel').textContent = `${monthNames[viewMonth]} ${viewYear}`;

        const calGrid = $('calGrid');
        calGrid.innerHTML = '';

        const firstDow = new Date(viewYear, viewMonth, 1).getDay();
        const dim = daysInMonth(viewYear, viewMonth);

        // Previous month filler
        const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
        const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
        const prevDim = daysInMonth(prevY, prevM);

        for (let i = 0; i < firstDow; i++) {
            const day = prevDim - (firstDow - 1 - i);
            const btn = document.createElement('div');
            btn.className = 'calDay muted';
            btn.textContent = day;
            btn.addEventListener('click', () => {
                const iso = toISO(prevY, prevM, day);
                navigateToDate(iso);
                closeModal();
            });
            calGrid.appendChild(btn);
        }

        // Current month days
        for (let day = 1; day <= dim; day++) {
            const btn = document.createElement('div');
            btn.className = 'calDay';
            btn.textContent = day;

            // Check if day has saved data (dot indicator)
            const dayISO = toISO(viewYear, viewMonth, day);
            const dayState = loadState(dayISO);
            const dayStats = computeStats(dayState);
            if (dayStats.done > 0) btn.classList.add('has-data');

            if (viewYear === todayY && viewMonth === todayM && day === todayDay) {
                btn.classList.add('today');
            }
            if (viewYear === activeY && viewMonth === activeM && day === activeDay) {
                btn.classList.add('selected');
            }

            btn.addEventListener('click', () => {
                navigateToDate(dayISO);
                closeModal();
            });

            calGrid.appendChild(btn);
        }

        // Next month filler — cap at 42 cells total (6 rows)
        const totalCells = calGrid.children.length;
        const maxCells = 42;
        const filler = Math.max(0, maxCells - totalCells);

        const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
        const nextM = viewMonth === 11 ? 0 : viewMonth + 1;

        for (let day = 1; day <= filler; day++) {
            const btn = document.createElement('div');
            btn.className = 'calDay muted';
            btn.textContent = day;
            btn.addEventListener('click', () => {
                const iso = toISO(nextY, nextM, day);
                navigateToDate(iso);
                closeModal();
            });
            calGrid.appendChild(btn);
        }
    }

    // Today quick button
    $('todayBtn').addEventListener('click', () => navigateToDate(todayISO()));

    // Prev day
    $('prevDay').addEventListener('click', () => {
        const cur = parseISO(getStoredActiveDate());
        cur.setDate(cur.getDate() - 1);
        navigateToDate(dateToISO(cur));
    });

    // Next day
    $('nextDay').addEventListener('click', () => {
        const cur = parseISO(getStoredActiveDate());
        cur.setDate(cur.getDate() + 1);
        navigateToDate(dateToISO(cur));
    });

    // Popup open/close
    $('openCalendar').addEventListener('click', openModal);
    $('calClose').addEventListener('click', closeModal);

    // Month navigation
    $('calPrev').addEventListener('click', () => {
        viewMonth -= 1;
        if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
        renderMonth();
    });

    $('calNext').addEventListener('click', () => {
        viewMonth += 1;
        if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
        renderMonth();
    });

    $('calToday').addEventListener('click', () => {
        navigateToDate(todayISO());
        closeModal();
    });

    // ESC close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) {
            closeModal();
        }
    });

    initViewFromActive();
}

// ---------- INIT ----------
async function init() {
    // Improvement #2: Load exercises from JSON
    try {
        const resp = await fetch('exercises.json');
        EXERCISES = await resp.json();
    } catch (e) {
        // Fallback if fetch fails (e.g. file:// protocol)
        EXERCISES = {
            lower: [
                { name: 'Squats', hint: 'Deep, controlled' },
                { name: 'Jump Squats', hint: '' },
                { name: 'Walking Lunges', hint: '' },
                { name: 'Bulgarian Split Squats', hint: '' },
                { name: 'Glute Bridges', hint: '' },
                { name: 'Single-Leg Squats', hint: 'Pistol progression' }
            ],
            upper: [
                { name: 'Push-Ups', hint: 'Basic → Diamond → Wide → Decline' },
                { name: 'Pike Push-Ups', hint: '' },
                { name: 'Explosive Push-Ups', hint: 'Clap if possible' },
                { name: 'Dips', hint: 'Chair/bed' },
                { name: 'Handstand Hold', hint: 'Against wall' },
                { name: 'Plank to Push-Up (Up-Down Planks)', hint: '30–45 sec • alternate lead arm' }
            ],
            core: [
                { name: 'Plank', hint: '' },
                { name: 'Side Plank', hint: '' },
                { name: 'Mountain Climbers', hint: '' },
                { name: 'Hollow Body Hold', hint: '' },
                { name: 'V-Ups', hint: '' },
                { name: 'Dead Bug', hint: '' }
            ],
            speed: [
                { name: 'Sprinting', hint: '10–30 sec bursts' },
                { name: 'High Knees', hint: '' },
                { name: 'Burpees', hint: '' },
                { name: 'Jump Lunges', hint: '' },
                { name: 'Skater Jumps', hint: '' },
                { name: 'Shadow Boxing', hint: '' }
            ],
            mobility: [
                { name: 'Deep Squat Hold', hint: '' },
                { name: 'Hip Openers', hint: '' },
                { name: 'Hamstring Stretch', hint: '' },
                { name: 'Shoulder Circles', hint: '' },
                { name: 'Dynamic Leg Swings', hint: '' },
                { name: "World's Greatest Stretch", hint: '' }
            ]
        };
    }

    setupCalendar();
    setupTabs();
    setupTimer();
    setupStorageManagement();
    renderAll();

    $('reset').addEventListener('click', resetThisDay);
    $('expandAll').addEventListener('click', () => expandCollapse(true));
    $('collapseAll').addEventListener('click', () => expandCollapse(false));
    $('export').addEventListener('click', exportText);
    $('saveSummary').addEventListener('click', onSaveDailySummary);

    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('sw.js');
        } catch (e) {
            // Silently fail — works fine without SW
        }
    }
}

init();
