// ===== UTILITY FUNCTIONS =====

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function openModal(modalId) {
  document.getElementById(modalId).classList.add('open');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('open');
}

function notify(message, type = 'success') {
  const notification = document.getElementById('notification');
  const text = document.getElementById('notification-text');
  text.textContent = message;
  notification.className = `notification ${type} show`;
  setTimeout(() => notification.classList.remove('show'), 3000);
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

function avgWeek(bilans, field) {
  const vals = bilans.map(b => parseFloat(b[field])).filter(v => !isNaN(v) && v > 0);
  if (!vals.length) return '-';
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}
