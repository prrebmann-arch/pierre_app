// ===== UTILITY FUNCTIONS =====

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  el.classList.add('open');
  if (modalId === 'modal-athlete' && typeof loadWorkflowDropdown === 'function') {
    loadWorkflowDropdown();
  }
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('open');
}

// ===== NOTIFICATION SYSTEM =====
function notify(message, type = 'success', duration = 3500) {
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:10000;display:flex;flex-direction:column-reverse;gap:8px;';
    document.body.appendChild(container);
  }
  const notif = document.createElement('div');
  notif.className = `notification ${type}`;
  notif.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> <span>${escHtml(message)}</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;margin-left:12px;font-size:16px;line-height:1;">&times;</button>`;
  container.appendChild(notif);
  requestAnimationFrame(() => notif.classList.add('show'));
  setTimeout(() => {
    notif.classList.remove('show');
    setTimeout(() => notif.remove(), 300);
  }, duration);
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function devLog(...args) {
  if (typeof IS_DEV !== 'undefined' && IS_DEV) console.log(...args);
}

function devError(...args) {
  if (typeof IS_DEV !== 'undefined' && IS_DEV) console.error(...args);
}

// ===== ERROR HANDLING =====
function handleError(error, context) {
  devError(`[${context}]`, error);
  const msg = error?.message || '';
  if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already exists')) {
    notify('Cet élément existe déjà.', 'error');
  } else if (msg.includes('permission denied') || msg.includes('row-level security')) {
    notify('Accès refusé. Vérifiez vos permissions.', 'error');
  } else if (msg.includes('Failed to fetch') || msg.includes('network') || msg.includes('fetch')) {
    notify('Erreur de connexion. Vérifiez votre réseau.', 'error');
  } else if (msg.includes('invalid input') || msg.includes('validation')) {
    notify('Données invalides. Vérifiez les champs.', 'error');
  } else if (msg.includes('too large') || msg.includes('payload')) {
    notify('Fichier trop volumineux.', 'error');
  } else if (msg.includes('relation') || msg.includes('does not exist') || msg.includes('column')) {
    notify('Erreur technique, réessayez.', 'error');
  } else {
    notify('Une erreur est survenue. Réessayez.', 'error');
  }
}

function avgWeek(bilans, field) {
  const vals = bilans.map(b => parseFloat(b[field])).filter(v => !isNaN(v) && v > 0);
  if (!vals.length) return '-';
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

// ===== CLEANUP SYSTEM (memory leak prevention) =====
const _cleanupFns = [];
function registerCleanup(fn) { _cleanupFns.push(fn); }
function runCleanups() { while (_cleanupFns.length) { try { _cleanupFns.pop()(); } catch(e) { devError('cleanup error', e); } } }

// ===== LOAD GUARD (race condition prevention) =====
const _loadCounters = {};
function getLoadId(key) { _loadCounters[key] = (_loadCounters[key] || 0) + 1; return _loadCounters[key]; }
function isStaleLoad(key, id) { return _loadCounters[key] !== id; }

// ===== LOADING INDICATOR =====
function showLoading(container, message) {
  if (!container) return;
  container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;gap:12px;"><i class="fas fa-spinner fa-spin fa-2x" style="color:var(--primary);"></i>${message ? `<span style="color:var(--text2);font-size:14px;">${escHtml(message)}</span>` : ''}</div>`;
}

// ===== FILE UPLOAD VALIDATION =====
function validateFile(file, type) {
  const MAX_IMAGE = 10 * 1024 * 1024;
  const MAX_VIDEO = 100 * 1024 * 1024;
  const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const VID_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
  const maxSize = type === 'video' ? MAX_VIDEO : MAX_IMAGE;
  const allowed = type === 'video' ? VID_TYPES : IMG_TYPES;
  if (file.size > maxSize) { notify(`Fichier trop volumineux (max ${Math.round(maxSize / 1024 / 1024)} MB)`, 'error'); return false; }
  if (!allowed.includes(file.type)) { notify('Type de fichier non autorisé', 'error'); return false; }
  return true;
}

async function validateFileMagicBytes(file) {
  try {
    const buffer = await file.slice(0, 4).arrayBuffer();
    const hex = [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
    const valid = ['ffd8ffe0','ffd8ffe1','89504e47','52494646','00000018','00000020','0000001c','1a45dfa3'];
    if (!valid.some(sig => hex.startsWith(sig))) {
      notify('Format de fichier non reconnu.', 'error');
      return false;
    }
    return true;
  } catch { return true; }
}

function generateSecurePassword(length = 12) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => charset[b % charset.length]).join('');
}

// ===== STATE CLEANUP (between athletes) =====
function cleanAthleteState() {
  const keys = ['_rmPhases','_rmPrograms','_rmNutritions','_rmReports','_rmWeeks','_npTempMeals','_npEditId','_npMealType','_npActiveMeal','_ntplSelectorTemplates','_ntplSelectorTab','_vidsData','_vidsFilter','_photoHistory','_bilansFilter','_bilansOverviewData','_cardioConfig','_editAlimentId'];
  keys.forEach(k => delete window[k]);
}
