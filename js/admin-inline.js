// ===== ADMIN DASHBOARD v2 — Premium Edition =====

let adminCache = {};
let mrrChart = null;
let subsChart = null;

function showAdminApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('landing-screen').classList.remove('active');
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('admin-app').style.display = 'block';
  loadOverview();
}

// ── RPC ──
async function adminRPC(fnName) {
  const { data, error } = await supabaseClient.rpc(fnName);
  if (error) throw new Error(error.message || 'Erreur RPC');
  return data;
}

// ── Helpers ──
function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatEur(cents) {
  if (!cents && cents !== 0) return '0,00 €';
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}
function adminFormatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function timeAgo(d) {
  if (!d) return '—';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days}j`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem`;
  return adminFormatDate(d);
}
function statusBadge(status) {
  const map = { active: ['Actif','active'], canceled: ['Annulé','canceled'], past_due: ['En retard','past_due'], trialing: ['Essai','active'] };
  const [label, cls] = map[status] || [status || '—', 'inactive'];
  return `<span class="admin-badge ${cls}">${label}</span>`;
}
function todayLabel() {
  return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Navigation ──
function adminShowSection(section) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('section-' + section);
  if (el) el.classList.add('active');
  const nav = document.querySelector(`.admin-nav-item[data-section="${section}"]`);
  if (nav) nav.classList.add('active');
  if (section === 'overview') loadOverview();
  if (section === 'coaches') loadCoaches();
  if (section === 'athletes-admin') loadAdminAthletes();
  if (section === 'payments') loadPayments();
  if (section === 'metrics') loadMetrics();
}
function adminRefresh() { adminCache = {}; adminShowSection('overview'); }

// ══════════════════════════════════
// ── OVERVIEW
// ══════════════════════════════════
async function loadOverview() {
  const el = document.getElementById('overview-content');
  if (!el) return;
  try {
    if (!adminCache.overview) adminCache.overview = await adminRPC('admin_overview');
    const d = adminCache.overview;
    const coaches = d.coaches || [];
    const coachesCount = coaches.length;
    const churnRate = d.total_subs > 0 ? Math.round((d.canceled_subs / d.total_subs) * 100) : 0;
    const avgAthletesPerCoach = coachesCount > 0 ? (d.athletes_count / coachesCount).toFixed(1) : 0;
    const totalAthletesSubs = d.active_subs + d.canceled_subs;

    let html = `
      <div class="admin-welcome">
        <div class="admin-welcome-title">Bienvenue, Pierre</div>
        <div class="admin-welcome-sub">Voici un aperçu de votre plateforme</div>
        <div class="admin-welcome-date"><i class="fas fa-calendar-alt"></i> ${todayLabel()}</div>
      </div>

      <div class="admin-stats">
        <div class="admin-stat-card">
          <div class="admin-stat-header"><div class="admin-stat-icon red"><i class="fas fa-euro-sign"></i></div></div>
          <div class="admin-stat-value">${formatEur(d.total_mrr)}</div>
          <div class="admin-stat-label">MRR Total</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-header"><div class="admin-stat-icon blue"><i class="fas fa-user-tie"></i></div></div>
          <div class="admin-stat-value">${coachesCount}</div>
          <div class="admin-stat-label">Coachs</div>
          <div class="admin-stat-sub">${avgAthletesPerCoach} athlètes/coach en moy.</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-header"><div class="admin-stat-icon orange"><i class="fas fa-users"></i></div></div>
          <div class="admin-stat-value">${d.athletes_count}</div>
          <div class="admin-stat-label">Athlètes</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-header"><div class="admin-stat-icon green"><i class="fas fa-credit-card"></i></div></div>
          <div class="admin-stat-value">${d.active_subs}</div>
          <div class="admin-stat-label">Abo. actifs</div>
          <div class="admin-stat-sub">${d.canceled_subs} annulé${d.canceled_subs > 1 ? 's' : ''}</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-header"><div class="admin-stat-icon ${churnRate > 20 ? 'orange' : churnRate > 10 ? 'blue' : 'green'}"><i class="fas fa-chart-line"></i></div></div>
          <div class="admin-stat-value">${churnRate}<span style="font-size:16px;font-weight:600;">%</span></div>
          <div class="admin-stat-label">Churn</div>
        </div>
      </div>

      <div class="admin-grid-3">
        <div class="admin-card">
          <div class="admin-card-header">
            <div class="admin-card-title"><i class="fas fa-chart-area"></i> Évolution des revenus</div>
            <span class="admin-card-badge">6 mois</span>
          </div>
          <div class="admin-card-body"><div class="admin-chart-container"><canvas id="mrr-chart"></canvas></div></div>
        </div>
        <div>
          <div class="admin-card">
            <div class="admin-card-header">
              <div class="admin-card-title"><i class="fas fa-chart-pie"></i> Abonnements</div>
            </div>
            <div class="admin-card-body">
              <div class="admin-donut-wrap">
                <div style="width:120px;height:120px;"><canvas id="subs-chart"></canvas></div>
                <div class="admin-donut-legend">
                  <div class="admin-donut-item"><div class="admin-donut-color" style="background:var(--success);"></div><div class="admin-donut-label">Actifs</div><div class="admin-donut-val">${d.active_subs}</div></div>
                  <div class="admin-donut-item"><div class="admin-donut-color" style="background:var(--danger);"></div><div class="admin-donut-label">Annulés</div><div class="admin-donut-val">${d.canceled_subs}</div></div>
                </div>
              </div>
            </div>
          </div>
          <div class="admin-card">
            <div class="admin-card-header">
              <div class="admin-card-title"><i class="fas fa-bolt"></i> Derniers paiements</div>
              <span class="admin-card-badge">${(d.recent_payments || []).length}</span>
            </div>
            <div class="admin-card-body" style="max-height:200px;overflow-y:auto;padding:8px 16px;">`;

    if (d.recent_payments && d.recent_payments.length) {
      d.recent_payments.slice(0, 10).forEach(p => {
        html += `<div class="admin-activity-item">
          <div class="admin-activity-dot ${p.status === 'paid' ? 'payment' : 'cancel'}"></div>
          <div class="admin-activity-text"><strong>${formatEur(p.amount || 0)}</strong></div>
          <div class="admin-activity-time">${timeAgo(p.created_at)}</div>
        </div>`;
      });
    } else {
      html += '<div class="admin-empty" style="padding:20px;"><i class="fas fa-inbox"></i>Aucun paiement</div>';
    }

    html += `</div></div></div></div>`;

    // ── Coach Table ──
    html += `
      <div class="admin-card">
        <div class="admin-card-header">
          <div class="admin-card-title"><i class="fas fa-user-tie"></i> Coachs enregistrés</div>
          <span class="admin-card-badge">${coachesCount}</span>
        </div>
        <div class="admin-card-body no-pad">
          <table class="admin-table"><thead><tr>
            <th>Coach</th><th>Inscrit le</th><th>Athlètes</th><th>MRR</th><th>Dernière connexion</th>
          </tr></thead><tbody>`;

    coaches.sort((a, b) => (b.mrr || 0) - (a.mrr || 0)).forEach(c => {
      const initials = (c.email || '').substring(0, 2).toUpperCase();
      html += `<tr>
        <td><div style="display:flex;align-items:center;gap:10px;">
          <div class="admin-coach-avatar">${initials}</div>
          <div><div class="admin-coach-email">${esc(c.email)}</div></div>
        </div></td>
        <td class="admin-coach-date">${adminFormatDate(c.created_at)}</td>
        <td><strong>${c.athletes_count}</strong></td>
        <td class="admin-coach-mrr">${c.mrr > 0 ? formatEur(c.mrr) : '<span style="color:var(--text3)">—</span>'}</td>
        <td class="admin-coach-date">${timeAgo(c.last_sign_in_at)}</td>
      </tr>`;
    });

    html += '</tbody></table></div></div>';
    el.innerHTML = html;
    renderMRRChart(d.mrr_history);
    renderSubsChart(d.active_subs, d.canceled_subs);
  } catch (err) {
    el.innerHTML = `<div class="admin-empty"><i class="fas fa-exclamation-triangle"></i>${esc(err.message)}</div>`;
  }
}

function renderMRRChart(history) {
  const ctx = document.getElementById('mrr-chart');
  if (!ctx) return;
  if (mrrChart) mrrChart.destroy();
  const labels = (history || []).map(h => h.month);
  const data = (history || []).map(h => h.revenue / 100);
  const grd = ctx.getContext('2d').createLinearGradient(0, 0, 0, 280);
  grd.addColorStop(0, 'rgba(179,8,8,0.2)');
  grd.addColorStop(1, 'rgba(179,8,8,0)');
  mrrChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Revenus', data, borderColor: '#B30808', backgroundColor: grd, borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 5, pointHoverRadius: 7, pointBackgroundColor: '#B30808', pointBorderColor: '#fff', pointBorderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0,0,0,0.85)', titleColor: '#fff', bodyColor: '#fff', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, cornerRadius: 10, padding: 12, displayColors: false, callbacks: { label: c => c.parsed.y.toLocaleString('fr-FR', { style:'currency', currency:'EUR' }) } } },
      scales: { x: { grid: { display: false }, ticks: { color: '#8b8b96', font: { size: 11, weight: 500 } } }, y: { grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false }, ticks: { color: '#8b8b96', font: { size: 11 }, callback: v => v + ' €' }, beginAtZero: true } }
    }
  });
}

function renderSubsChart(active, canceled) {
  const ctx = document.getElementById('subs-chart');
  if (!ctx) return;
  if (subsChart) subsChart.destroy();
  const total = active + canceled;
  if (total === 0) return;
  subsChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Actifs', 'Annulés'], datasets: [{ data: [active, canceled], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 0, spacing: 2 }] },
    options: { responsive: true, maintainAspectRatio: true, cutout: '70%', plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0,0,0,0.85)', cornerRadius: 8, padding: 10, displayColors: false } } }
  });
}

// ══════════════════════════════════
// ── COACHES
// ══════════════════════════════════
async function loadCoaches() {
  const el = document.getElementById('coaches-content');
  if (!el) return;
  try {
    if (!adminCache.coaches) adminCache.coaches = await adminRPC('admin_coaches');
    const coaches = adminCache.coaches || [];
    if (!coaches.length) { el.innerHTML = '<div class="admin-empty"><i class="fas fa-user-slash"></i>Aucun coach inscrit</div>'; return; }

    let html = '<div class="admin-coach-grid" id="coaches-grid">';
    coaches.forEach(c => {
      const initials = (c.email || '').substring(0, 2).toUpperCase();
      const athletes = c.athletes || [];
      const lastSeen = timeAgo(c.last_sign_in_at);
      const banned = c.banned_until && new Date(c.banned_until) > new Date();

      html += `
        <div class="admin-coach-card" data-email="${esc(c.email).toLowerCase()}">
          <div class="admin-coach-card-head">
            <div class="admin-coach-avatar">${initials}</div>
            <div style="flex:1;min-width:0;">
              <div class="admin-coach-card-name">${esc(c.email)}</div>
              <div class="admin-coach-card-sub">Inscrit ${adminFormatDate(c.created_at)} · Vu ${lastSeen}</div>
            </div>
            ${banned ? '<span class="admin-badge canceled">Bloqué</span>' : '<span class="admin-badge active">Actif</span>'}
          </div>
          <div class="admin-coach-card-stats">
            <div class="admin-coach-card-stat">
              <div class="admin-coach-card-stat-val">${c.athletes_count}</div>
              <div class="admin-coach-card-stat-lbl">Athlètes</div>
            </div>
            <div class="admin-coach-card-stat">
              <div class="admin-coach-card-stat-val" style="color:var(--success);">${c.mrr > 0 ? formatEur(c.mrr) : '—'}</div>
              <div class="admin-coach-card-stat-lbl">MRR</div>
            </div>
            <div class="admin-coach-card-stat">
              <div class="admin-coach-card-stat-val">${lastSeen}</div>
              <div class="admin-coach-card-stat-lbl">Vu</div>
            </div>
          </div>
          ${athletes.length ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-subtle);">
            <div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:500;">ATHLÈTES</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">${athletes.map(a => `<span style="font-size:11px;background:var(--tint);border:1px solid var(--border-subtle);padding:2px 8px;border-radius:6px;color:var(--text2);">${esc(a.prenom)} ${esc(a.nom)}</span>`).join('')}</div>
          </div>` : ''}
        </div>`;
    });
    html += '</div>';
    el.innerHTML = html;
  } catch (err) { el.innerHTML = `<div class="admin-empty"><i class="fas fa-exclamation-triangle"></i>${esc(err.message)}</div>`; }
}

function adminFilterCoaches() {
  const q = document.getElementById('coach-search').value.toLowerCase();
  document.querySelectorAll('#coaches-grid .admin-coach-card').forEach(card => {
    card.style.display = card.dataset.email.includes(q) ? '' : 'none';
  });
}

// ══════════════════════════════════
// ── ATHLETES
// ══════════════════════════════════
async function loadAdminAthletes() {
  const el = document.getElementById('athletes-content');
  if (!el) return;
  try {
    if (!adminCache.athletes) adminCache.athletes = await adminRPC('admin_athletes');
    const athletes = adminCache.athletes || [];
    const total = athletes.length;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const active = athletes.filter(a => a.last_activity && a.last_activity >= thirtyDaysAgo).length;
    const activeWeek = athletes.filter(a => a.last_activity && a.last_activity >= sevenDaysAgo).length;
    const coachSet = new Set(athletes.map(a => a.coach_id));
    const avgPerCoach = coachSet.size > 0 ? (total / coachSet.size).toFixed(1) : 0;
    const neverActive = athletes.filter(a => !a.last_activity).length;
    const engagementRate = total > 0 ? Math.round((active / total) * 100) : 0;

    let html = `
      <div class="admin-stats">
        <div class="admin-stat-card">
          <div class="admin-stat-header"><div class="admin-stat-icon blue"><i class="fas fa-users"></i></div></div>
          <div class="admin-stat-value">${total}</div>
          <div class="admin-stat-label">Total</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-header"><div class="admin-stat-icon green"><i class="fas fa-heartbeat"></i></div></div>
          <div class="admin-stat-value">${active}</div>
          <div class="admin-stat-label">Actifs (30j)</div>
          <div class="admin-stat-sub">${activeWeek} cette semaine</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-header"><div class="admin-stat-icon orange"><i class="fas fa-percentage"></i></div></div>
          <div class="admin-stat-value">${engagementRate}<span style="font-size:16px;font-weight:600;">%</span></div>
          <div class="admin-stat-label">Engagement</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-header"><div class="admin-stat-icon purple"><i class="fas fa-calculator"></i></div></div>
          <div class="admin-stat-value">${avgPerCoach}</div>
          <div class="admin-stat-label">Moy. / Coach</div>
          <div class="admin-stat-sub">${neverActive} jamais actif${neverActive > 1 ? 's' : ''}</div>
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card-header">
          <div class="admin-card-title"><i class="fas fa-list"></i> Tous les athlètes</div>
          <span class="admin-card-badge">${total}</span>
        </div>
        <div class="admin-card-body no-pad">
          <table class="admin-table" id="athletes-table"><thead><tr>
            <th>Athlète</th><th>Coach</th><th>Inscrit le</th><th>Dernière activité</th><th>Statut</th>
          </tr></thead><tbody>`;

    athletes.forEach(a => {
      const isActive = a.last_activity && a.last_activity >= thirtyDaysAgo;
      const initials = ((a.prenom || '')[0] + (a.nom || '')[0]).toUpperCase();
      html += `<tr data-name="${esc((a.prenom+' '+a.nom).toLowerCase())}">
        <td><div style="display:flex;align-items:center;gap:10px;">
          <div class="admin-coach-avatar" style="width:32px;height:32px;border-radius:8px;font-size:11px;">${initials}</div>
          <div style="font-weight:500;">${esc(a.prenom)} ${esc(a.nom)}</div>
        </div></td>
        <td style="font-size:12px;color:var(--text2);">${esc(a.coach_email)}</td>
        <td class="admin-coach-date">${adminFormatDate(a.created_at)}</td>
        <td class="admin-coach-date">${a.last_activity ? timeAgo(a.last_activity + 'T00:00:00') : '<span style="color:var(--text3);font-style:italic;">Jamais</span>'}</td>
        <td>${isActive ? '<span class="admin-badge active">Actif</span>' : '<span class="admin-badge inactive">Inactif</span>'}</td>
      </tr>`;
    });

    html += '</tbody></table></div></div>';
    el.innerHTML = html;
  } catch (err) { el.innerHTML = `<div class="admin-empty"><i class="fas fa-exclamation-triangle"></i>${esc(err.message)}</div>`; }
}

function adminFilterAthletes() {
  const q = document.getElementById('athlete-search').value.toLowerCase();
  document.querySelectorAll('#athletes-table tbody tr').forEach(tr => {
    tr.style.display = (tr.dataset.name || '').includes(q) ? '' : 'none';
  });
}

// ══════════════════════════════════
// ── PAYMENTS
// ══════════════════════════════════
async function loadPayments() {
  const el = document.getElementById('payments-content');
  if (!el) return;
  try {
    if (!adminCache.payments) adminCache.payments = await adminRPC('admin_payments');
    const { payments, stripe_customers } = adminCache.payments;
    const activeSubs = stripe_customers.filter(s => s.subscription_status === 'active');
    const totalMRR = activeSubs.reduce((s, c) => s + (c.monthly_amount || 0), 0);
    const paidPayments = payments.filter(p => p.status === 'paid');
    const failedPayments = payments.filter(p => p.status !== 'paid');
    const totalRev = paidPayments.reduce((s, p) => s + (p.amount || 0), 0);

    let html = `
      <div class="admin-stats">
        <div class="admin-stat-card">
          <div class="admin-stat-header"><div class="admin-stat-icon red"><i class="fas fa-sync-alt"></i></div></div>
          <div class="admin-stat-value">${formatEur(totalMRR)}</div>
          <div class="admin-stat-label">MRR Actif</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-header"><div class="admin-stat-icon green"><i class="fas fa-coins"></i></div></div>
          <div class="admin-stat-value">${formatEur(totalRev)}</div>
          <div class="admin-stat-label">Revenus totaux</div>
          <div class="admin-stat-sub">${paidPayments.length} paiement${paidPayments.length > 1 ? 's' : ''} reçu${paidPayments.length > 1 ? 's' : ''}</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-header"><div class="admin-stat-icon blue"><i class="fas fa-file-invoice"></i></div></div>
          <div class="admin-stat-value">${stripe_customers.length}</div>
          <div class="admin-stat-label">Abonnements</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-header"><div class="admin-stat-icon ${failedPayments.length > 0 ? 'orange' : 'green'}"><i class="fas fa-exclamation-triangle"></i></div></div>
          <div class="admin-stat-value">${failedPayments.length}</div>
          <div class="admin-stat-label">Échecs</div>
        </div>
      </div>

      <div class="admin-grid-2">
        <div class="admin-card">
          <div class="admin-card-header">
            <div class="admin-card-title"><i class="fas fa-credit-card"></i> Abonnements Stripe</div>
            <span class="admin-card-badge">${stripe_customers.length}</span>
          </div>
          <div class="admin-card-body no-pad" style="max-height:500px;overflow-y:auto;">
            <table class="admin-table"><thead><tr><th>Client</th><th>Montant</th><th>Statut</th></tr></thead><tbody>`;

    stripe_customers.sort((a, b) => (b.monthly_amount || 0) - (a.monthly_amount || 0)).forEach(s => {
      html += `<tr>
        <td style="font-size:12px;font-family:monospace;color:var(--text2);">${esc(s.stripe_customer_id?.slice(-12) || '—')}</td>
        <td style="font-weight:600;">${formatEur(s.monthly_amount || 0)}<span style="color:var(--text3);font-weight:400;">/mois</span></td>
        <td>${statusBadge(s.subscription_status)}</td>
      </tr>`;
    });

    html += `</tbody></table></div></div>
        <div class="admin-card">
          <div class="admin-card-header">
            <div class="admin-card-title"><i class="fas fa-receipt"></i> Historique des paiements</div>
            <span class="admin-card-badge">${payments.length}</span>
          </div>
          <div class="admin-card-body no-pad" style="max-height:500px;overflow-y:auto;">
            <table class="admin-table"><thead><tr><th>Date</th><th>Montant</th><th>Statut</th></tr></thead><tbody>`;

    payments.slice(0, 100).forEach(p => {
      html += `<tr>
        <td class="admin-coach-date">${adminFormatDate(p.created_at)}</td>
        <td style="font-weight:600;">${formatEur(p.amount || 0)}</td>
        <td>${p.status === 'paid' ? '<span class="admin-badge active">Payé</span>' : '<span class="admin-badge canceled">Échoué</span>'}</td>
      </tr>`;
    });

    html += '</tbody></table></div></div></div>';
    el.innerHTML = html;
  } catch (err) { el.innerHTML = `<div class="admin-empty"><i class="fas fa-exclamation-triangle"></i>${esc(err.message)}</div>`; }
}

// ══════════════════════════════════
// ── METRICS
// ══════════════════════════════════
async function loadMetrics() {
  const el = document.getElementById('metrics-content');
  if (!el) return;
  try {
    if (!adminCache.metrics) adminCache.metrics = await adminRPC('admin_metrics');
    const m = adminCache.metrics;
    const maxVal = Math.max(m.programs, m.reports, m.videos, m.nutrition_plans, m.formations, m.questionnaires, 1);

    const items = [
      { icon: 'fa-dumbbell', value: m.programs, label: 'Programmes', color: '#B30808' },
      { icon: 'fa-clipboard-check', value: m.reports, label: 'Bilans remplis', color: '#22c55e' },
      { icon: 'fa-video', value: m.videos, label: 'Vidéos', color: '#3b82f6' },
      { icon: 'fa-utensils', value: m.nutrition_plans, label: 'Plans nutrition', color: '#f59e0b' },
      { icon: 'fa-graduation-cap', value: m.formations, label: 'Formations', color: '#8b5cf6' },
      { icon: 'fa-question-circle', value: m.questionnaires, label: 'Questionnaires', color: '#ec4899' },
    ];

    let html = `
      <div class="admin-card">
        <div class="admin-card-header">
          <div class="admin-card-title"><i class="fas fa-chart-bar"></i> Usage des fonctionnalités</div>
          <span class="admin-card-badge">${items.reduce((s, i) => s + i.value, 0)} total</span>
        </div>
        <div class="admin-card-body">
          <div class="admin-metrics-grid">`;

    items.forEach(item => {
      const pct = maxVal > 0 ? Math.round((item.value / maxVal) * 100) : 0;
      html += `
            <div class="admin-metric-item">
              <div class="admin-metric-icon"><i class="fas ${item.icon}" style="color:${item.color};"></i></div>
              <div class="admin-metric-value">${item.value.toLocaleString('fr-FR')}</div>
              <div class="admin-metric-label">${item.label}</div>
              <div class="admin-metric-bar"><div class="admin-metric-bar-fill" style="width:${pct}%;background:${item.color};"></div></div>
            </div>`;
    });

    html += '</div></div></div>';
    el.innerHTML = html;
  } catch (err) { el.innerHTML = `<div class="admin-empty"><i class="fas fa-exclamation-triangle"></i>${esc(err.message)}</div>`; }
}
