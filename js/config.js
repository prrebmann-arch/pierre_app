// ===== SUPABASE CONFIGURATION =====
const SUPABASE_URL = 'https://kczcqnasnjufkgbnrbvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjemNxbmFzbmp1ZmtnYm5yYnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjEwOTAsImV4cCI6MjA4OTEzNzA5MH0.rRAuqUkU_6Ry7nUdnfHdz_7zvCLcxgNBPgE53j_nfQc';

if (!window.supabase) {
  document.body.innerHTML = '<div style="color:red;font-size:20px;padding:40px;">ERREUR: Supabase script non chargé. Vérifiez votre connexion internet.</div>';
  throw new Error('Supabase not loaded');
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== DEV FLAG =====
const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// ===== AUTHENTICATED FETCH HELPER =====
async function authFetch(url, options = {}) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return fetch(url, { ...options, headers });
}

// ===== GLOBAL STATE =====
let currentUser = null;
let athletesList = [];
let currentAthleteId = null;
let currentAthleteObj = null;
let currentAthleteTab = 'infos';
let currentTemplateTab = 'training';
let mealCount = 4;

// ===== CONSTANTS =====
const JOURS_SEMAINE = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const MS_PER_DAY = 86400000;
const MAX_VIDEOS_LOAD = 200;
const VIDEO_RETENTION_MONTHS = 3;
const DEFAULT_STEPS_GOAL = 10000;
const DEFAULT_WATER_GOAL = 2500;
const DEFAULT_NOTIF_TIME = '08:00';

// ===== BILAN SCHEDULING =====

/**
 * Check if a given date is a bilan date according to the athlete's config.
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} frequency - 'none','daily','weekly','biweekly','monthly','custom'
 * @param {number} interval - days between bilans (for 'custom')
 * @param {number|number[]} day - JS getDay index(es). Single for weekly, array of 2 for biweekly
 * @param {string} anchorDate - reference date 'YYYY-MM-DD'
 * @param {number} [monthDay] - day of month (1-31) for 'monthly'
 */
function isBilanDate(dateStr, frequency, interval, day, anchorDate, monthDay) {
  if (frequency === 'none') return false;
  if (frequency === 'daily') return true;

  const date = new Date(dateStr + 'T12:00:00');

  if (frequency === 'weekly') {
    return date.getDay() === (typeof day === 'number' ? day : (Array.isArray(day) ? day[0] : 1));
  }

  if (frequency === 'biweekly') {
    // day is an array of 2 JS getDay values
    const days = Array.isArray(day) ? day : [day ?? 1];
    return days.includes(date.getDay());
  }

  if (frequency === 'monthly') {
    return date.getDate() === (monthDay || 1);
  }

  if (frequency === 'custom') {
    const anchor = new Date((anchorDate || dateStr) + 'T12:00:00');
    const diffDays = Math.round((date.getTime() - anchor.getTime()) / MS_PER_DAY);
    return diffDays >= 0 && diffDays % (interval || 1) === 0;
  }

  return false;
}

/** Find next bilan date from today (within 60 days). */
function getNextBilanDate(frequency, interval, day, anchorDate, monthDay) {
  const today = new Date();
  for (let i = 0; i <= 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const str = toDateStr(d);
    if (isBilanDate(str, frequency, interval, day, anchorDate, monthDay)) return str;
  }
  return null;
}

/** Find last expected bilan date (looking back up to 60 days). */
function getLastExpectedBilanDate(frequency, interval, day, anchorDate, monthDay) {
  const today = new Date();
  for (let i = 0; i <= 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const str = toDateStr(d);
    if (isBilanDate(str, frequency, interval, day, anchorDate, monthDay)) return str;
  }
  return null;
}

function formatFrequency(freq, interval) {
  const labels = {
    none: 'Désactivé',
    daily: 'Quotidien',
    weekly: 'Hebdomadaire',
    biweekly: 'Bi-hebdomadaire',
    monthly: 'Mensuel',
    custom: `Tous les ${interval || '?'} jours`
  };
  return labels[freq] || '—';
}

function selectFreq(btn) {
  const target = btn.dataset.target;
  const value = btn.dataset.value;
  document.getElementById(target).value = value;
  btn.parentElement.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Determine prefix from target id (ie-bilan_frequency → bilan, ie-complete_bilan_frequency → complete)
  const prefix = target === 'ie-bilan_frequency' ? 'bilan' : 'complete';

  const dayRow = document.getElementById(prefix + '-day-row');
  const customRow = document.getElementById(prefix + '-custom-row');
  const monthRow = document.getElementById(prefix + '-month-row');

  if (dayRow) dayRow.style.display = ['weekly','biweekly'].includes(value) ? 'flex' : 'none';
  if (customRow) customRow.style.display = value === 'custom' ? 'flex' : 'none';
  if (monthRow) monthRow.style.display = value === 'monthly' ? 'flex' : 'none';

  // Switch day circles between single (weekly) and multi (biweekly)
  if (dayRow) {
    const multiSelect = value === 'biweekly';
    dayRow.querySelectorAll('.day-circle').forEach(c => c.dataset.multi = multiSelect ? '1' : '');
    if (!multiSelect) {
      // Keep only first active
      const actives = dayRow.querySelectorAll('.day-circle.active');
      if (actives.length > 1) {
        for (let k = 1; k < actives.length; k++) actives[k].classList.remove('active');
      }
      _syncDayCircleValue(dayRow);
    }
    // Update label
    const lbl = dayRow.querySelector('.dc-label');
    if (lbl) lbl.textContent = multiSelect ? 'Jours (2) :' : 'Jour :';
  }
}

/** Day circle click — single or multi-select */
function selectDayCircle(btn) {
  const multi = btn.dataset.multi === '1';
  const row = btn.closest('[id$="-day-row"]');
  const allCircles = row ? row.querySelectorAll('.day-circle') : btn.parentElement.querySelectorAll('.day-circle');

  if (multi) {
    btn.classList.toggle('active');
    // Enforce max 2 selections
    const actives = row ? row.querySelectorAll('.day-circle.active') : btn.parentElement.querySelectorAll('.day-circle.active');
    if (actives.length > 2) {
      actives[0].classList.remove('active');
    }
  } else {
    allCircles.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  _syncDayCircleValue(row);
}

/** Sync hidden input from active circles */
function _syncDayCircleValue(row) {
  if (!row) return;
  const input = row.querySelector('input[type="hidden"]');
  if (!input) return;
  const actives = row.querySelectorAll('.day-circle.active');
  const vals = Array.from(actives).map(b => parseInt(b.dataset.value));
  input.value = JSON.stringify(vals.length === 1 ? vals[0] : vals);
}

/** Generates HTML for 7 day circles (L M M J V S D) */
function dayCirclesHtml(inputId, currentDays, multi) {
  const labels = ['L','M','M','J','V','S','D'];
  // Normalize to array
  const selected = Array.isArray(currentDays) ? currentDays : [currentDays ?? 1];
  return labels.map((l, i) => {
    const jsIdx = i === 6 ? 0 : i + 1; // circle index → JS getDay
    const isActive = selected.includes(jsIdx);
    return `<button type="button" class="day-circle ${isActive ? 'active' : ''}" data-value="${jsIdx}" data-multi="${multi ? '1' : ''}" onclick="selectDayCircle(this)" title="${JOURS_SEMAINE[jsIdx]}">${l}</button>`;
  }).join('');
}

/** Generates HTML for month day selector (1-31) */
function monthDaySelectHtml(inputId, currentVal) {
  const opts = [];
  for (let d = 1; d <= 31; d++) {
    opts.push(`<option value="${d}" ${d === (currentVal || 1) ? 'selected' : ''}>${d}</option>`);
  }
  return `<select id="${inputId}" class="info-edit-input" style="width:auto;" onchange="document.getElementById('${inputId}').value=this.value">${opts.join('')}</select>`;
}

// ===== PHASE DEFINITIONS =====
const PROG_PHASES = {
  seche:          { label: 'SÈCHE',          short: 'SÈCHE', color: '#c0392b' },
  reverse:        { label: 'REVERSE',        short: 'REV',   color: '#2471a3' },
  prise_de_masse: { label: 'PRISE DE MASSE', short: 'MASS',  color: '#1e8449' },
  mini_cut:       { label: 'MINI CUT',       short: 'MCUT',  color: '#e67e22' },
};
