// ===== ADMIN DASHBOARD =====

const SUPABASE_URL = 'https://kczcqnasnjufkgbnrbvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjemNxbmFzbmp1ZmtnYm5yYnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjEwOTAsImV4cCI6MjA4OTEzNzA5MH0.rRAuqUkU_6Ry7nUdnfHdz_7zvCLcxgNBPgE53j_nfQc';
const ADMIN_EMAIL = 'rebmannpierre1@gmail.com';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let adminUser = null;
let let adminCache = {};
let mrrChart = null;

// ── Auth ──

document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const btn = document.getElementById('admin-submit');
  const errEl = document.getElementById('admin-auth-error');
  errEl.style.display = 'none';

  if (email !== ADMIN_EMAIL) {
    errEl.textContent = 'Accès refusé.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    adminUser = data.user;
    showAdminApp();
  } catch (err) {
    errEl.textContent = err.message || 'Erreur de connexion';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Se connecter';
  }
});

async function checkAdminSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session && session.user.email === ADMIN_EMAIL) {
    adminUser = session.user;
    showAdminApp();
  }
}

function showAdminApp() {
  document.getElementById('admin-auth').style.display = 'none';
  document.getElementById('admin-app').style.display = 'block';
  loadOverview();
}

async function adminLogout() {
  await supabaseClient.auth.signOut();
  adminUser = null;
    adminCache = {};
  document.getElementById('admin-app').style.display = 'none';
  document.getElementById('admin-auth').style.display = 'flex';
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
  if (section === 'athletes-admin') loadAthletes();
  if (section === 'payments') loadPayments();
  if (section === 'metrics') loadMetrics();
}

function adminRefresh() {
  adminCache = {};
  adminShowSection('overview');
}

// ── RPC call helper ──

async function adminRPC(fnName) {
  const { data, error } = await supabaseClient.rpc(fnName);
  if (error) throw new Error(error.message || 'Erreur RPC');
  return data;
}

// ── Helpers ──

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatEur(cents) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function formatDate(d) {
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
  if (days < 30) return `il y a ${days}j`;
  return formatDate(d);
}

function statusBadge(status) {
  const labels = { active: 'Actif', canceled: 'Annulé', past_due: 'En retard', trialing: 'Essai' };
  const cls = status === 'active' ? 'active' : status === 'canceled' ? 'canceled' : status === 'past_due' ? 'past_due' : 'inactive';
  return `<span class="admin-badge ${cls}">${labels[status] || status || '—'}</span>`;
}

// ── OVERVIEW ──

async function loadOverview() {
  const el = document.getElementById('overview-content');
  if (!el) return;

  try {
    if (!adminCache.overview) {
      adminCache.overview = await adminRPC('admin_overview');
    }
    const d = adminCache.overview;

    const coachesCount = (d.coaches || []).length;
    const churnRate = d.total_subs > 0 ? Math.round((d.canceled_subs / d.total_subs) * 100) : 0;

    let html = `
      <div class="admin-stats">
        <div class="admin-stat-card">
          <div class="admin-stat-header">
            <div class="admin-stat-icon red"><i class="fas fa-euro-sign"></i></div>
          </div>
          <div class="admin-stat-value">${formatEur(d.total_mrr)}</div>
          <div class="admin-stat-label">MRR Total</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-header">
            <div class="admin-stat-icon blue"><i class="fas fa-user-tie"></i></div>
          </div>
          <div class="admin-stat-value">${coachesCount}</div>
          <div class="admin-stat-label">Coachs inscrits</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-header">
            <div class="admin-stat-icon orange"><i class="fas fa-running"></i></div>
          </div>
          <div class="admin-stat-value">${d.athletes_count}</div>
          <div class="admin-stat-label">Athlètes total</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-header">
            <div class="admin-stat-icon green"><i class="fas fa-check-circle"></i></div>
          </div>
          <div class="admin-stat-value">${d.active_subs}</div>
          <div class="admin-stat-label">Abonnements actifs</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-header">
            <div class="admin-stat-icon ${churnRate > 15 ? 'orange' : 'green'}">
              <i class="fas fa-chart-line"></i>
            </div>
          </div>
          <div class="admin-stat-value">${churnRate}%</div>
          <div class="admin-stat-label">Taux de churn</div>
        </div>
      </div>

      <div class="admin-grid-3">
        <div class="admin-card">
          <div class="admin-card-header">
            <div class="admin-card-title"><i class="fas fa-chart-area"></i> Revenus (6 mois)</div>
          </div>
          <div class="admin-card-body">
            <div class="admin-chart-container">
              <canvas id="mrr-chart"></canvas>
            </div>
          </div>
        </div>

        <div class="admin-card">
          <div class="admin-card-header">
            <div class="admin-card-title"><i class="fas fa-bolt"></i> Activité récente</div>
          </div>
          <div class="admin-card-body" style="max-height:340px;overflow-y:auto;">`;

    if (d.recent_payments && d.recent_payments.length) {
      d.recent_payments.slice(0, 15).forEach(p => {
        const dotClass = p.status === 'paid' ? 'payment' : 'cancel';
        html += `
            <div class="admin-activity-item">
              <div class="admin-activity-dot ${dotClass}"></div>
              <div class="admin-activity-text">${esc(p.stripe_customer_id?.slice(-8) || '—')} — ${formatEur(p.amount || 0)}</div>
              <div class="admin-activity-time">${timeAgo(p.created_at)}</div>
            </div>`;
      });
    } else {
      html += '<div class="admin-empty"><i class="fas fa-inbox"></i>Aucun paiement récent</div>';
    }

    html += `
          </div>
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card-header">
          <div class="admin-card-title"><i class="fas fa-user-tie"></i> Coachs</div>
        </div>
        <div class="admin-card-body no-pad">
          <table class="admin-table">
            <thead><tr>
              <th>Email</th><th>Inscrit le</th><th>Athlètes</th><th>MRR</th><th>Dernière connexion</th>
            </tr></thead>
            <tbody>`;

    (d.coaches || []).sort((a, b) => b.mrr - a.mrr).forEach(c => {
      html += `
              <tr>
                <td class="admin-coach-email">${esc(c.email)}</td>
                <td class="admin-coach-date">${formatDate(c.created_at)}</td>
                <td>${c.athletes_count}</td>
                <td class="admin-coach-mrr">${c.mrr > 0 ? formatEur(c.mrr) : '—'}</td>
                <td class="admin-coach-date">${timeAgo(c.last_sign_in_at)}</td>
              </tr>`;
    });

    html += '</tbody></table></div></div>';
    el.innerHTML = html;

    // Draw chart
    renderMRRChart(d.mrr_history);
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

  const gradientFill = ctx.getContext('2d').createLinearGradient(0, 0, 0, 280);
  gradientFill.addColorStop(0, 'rgba(179, 8, 8, 0.25)');
  gradientFill.addColorStop(1, 'rgba(179, 8, 8, 0)');

  mrrChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenus (€)',
        data,
        borderColor: '#B30808',
        backgroundColor: gradientFill,
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#B30808',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#18181b',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          callbacks: {
            label: (ctx) => ctx.parsed.y.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }),
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#8b8b96', font: { size: 11 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#8b8b96',
            font: { size: 11 },
            callback: (v) => v + ' €',
          },
        },
      },
    },
  });
}

// ── COACHES ──

async function loadCoaches() {
  const el = document.getElementById('coaches-content');
  if (!el) return;

  try {
    if (!adminCache.coaches) {
      adminCache.coaches = await adminRPC('admin_coaches');
    }
    renderCoaches(adminCache.coaches);
  } catch (err) {
    el.innerHTML = `<div class="admin-empty"><i class="fas fa-exclamation-triangle"></i>${esc(err.message)}</div>`;
  }
}

function renderCoaches(coaches) {
  const el = document.getElementById('coaches-content');
  if (!coaches || !coaches.length) {
    el.innerHTML = '<div class="admin-empty"><i class="fas fa-user-slash"></i>Aucun coach inscrit</div>';
    return;
  }

  let html = `
    <div class="admin-card">
      <div class="admin-card-body no-pad">
        <table class="admin-table" id="coaches-table">
          <thead><tr>
            <th>Email</th><th>Inscrit le</th><th>Athlètes</th><th>MRR</th><th>Dernière connexion</th><th>Action</th>
          </tr></thead>
          <tbody>`;

  coaches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach(c => {
    const isFreeCoach = c.plan === 'free';
    html += `
            <tr data-email="${esc(c.email).toLowerCase()}">
              <td>
                <div class="admin-coach-email">${esc(c.email)}</div>
                ${isFreeCoach ? '<span class="admin-badge" style="color:#22c55e;font-size:11px;">GRATUIT</span>' : ''}
              </td>
              <td class="admin-coach-date">${formatDate(c.created_at)}</td>
              <td>${c.athletes_count}${c.athletes.length ? `<br><span style="font-size:11px;color:var(--text3);">${c.athletes.map(a => esc(a.prenom)).join(', ')}</span>` : ''}</td>
              <td class="admin-coach-mrr">${c.mrr > 0 ? formatEur(c.mrr) : '—'}</td>
              <td class="admin-coach-date">${timeAgo(c.last_sign_in_at)}</td>
              <td style="display:flex;gap:4px;flex-wrap:wrap;">
                <button class="admin-toggle-btn ${isFreeCoach ? '' : 'ban'}" onclick="adminToggleFreeCoach('${c.id}', ${isFreeCoach ? 'false' : 'true'})" title="${isFreeCoach ? 'Remettre payant' : 'Passer en gratuit'}">
                  <i class="fas fa-${isFreeCoach ? 'money-bill' : 'gift'}"></i> ${isFreeCoach ? 'Payant' : 'Gratuit'}
                </button>
                <button class="admin-toggle-btn ban" onclick="adminToggleCoach('${c.id}', true)" title="Bloquer ce coach">
                  <i class="fas fa-ban"></i>
                </button>
              </td>
            </tr>`;
  });

  html += '</tbody></table></div></div>';
  el.innerHTML = html;
}

function adminFilterCoaches() {
  const q = document.getElementById('coach-search').value.toLowerCase();
  document.querySelectorAll('#coaches-table tbody tr').forEach(tr => {
    tr.style.display = tr.dataset.email.includes(q) ? '' : 'none';
  });
}

async function adminToggleCoach(coachId, ban) {
  if (!confirm(ban ? 'Bloquer ce coach ?' : 'Débloquer ce coach ?')) return;
  try {
    await supabaseClient.from('coach_profiles').update({
      is_blocked: ban,
      blocked_at: ban ? new Date().toISOString() : null,
      blocked_reason: ban ? 'Bloqué par admin' : null,
    }).eq('user_id', coachId);
    notify(ban ? 'Coach bloqué' : 'Coach débloqué', 'success');
    adminCache.coaches = null;
    loadCoaches();
  } catch (err) {
    handleError(err, 'adminToggleCoach');
  }
}

async function adminToggleFreeCoach(coachId, makeFree) {
  const label = makeFree ? 'Passer ce coach en gratuit ?' : 'Remettre ce coach en payant ?';
  if (!confirm(label)) return;
  try {
    await supabaseClient.from('coach_profiles').update({
      plan: makeFree ? 'free' : 'athlete',
    }).eq('user_id', coachId);
    notify(makeFree ? 'Coach passé en gratuit' : 'Coach repassé en payant', 'success');
    adminCache.coaches = null;
    loadCoaches();
  } catch (err) {
    handleError(err, 'adminToggleFreeCoach');
  }
}

// ── ATHLETES ──

async function loadAthletes() {
  const el = document.getElementById('athletes-content');
  if (!el) return;

  try {
    if (!adminCache.athletes) {
      adminCache.athletes = await adminRPC('admin_athletes');
    }
    renderAthletes(adminCache.athletes);
  } catch (err) {
    el.innerHTML = `<div class="admin-empty"><i class="fas fa-exclamation-triangle"></i>${esc(err.message)}</div>`;
  }
}

function renderAthletes(athletes) {
  const el = document.getElementById('athletes-content');

  // Stats
  const total = athletes.length;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const active = athletes.filter(a => a.last_activity && a.last_activity >= thirtyDaysAgo).length;
  const coachSet = new Set(athletes.map(a => a.coach_id));
  const avgPerCoach = coachSet.size > 0 ? (total / coachSet.size).toFixed(1) : 0;

  let html = `
    <div class="admin-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px;">
      <div class="admin-stat-card">
        <div class="admin-stat-value">${total}</div>
        <div class="admin-stat-label">Athlètes total</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-value">${active}</div>
        <div class="admin-stat-label">Actifs (30j)</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-value">${avgPerCoach}</div>
        <div class="admin-stat-label">Moy. par coach</div>
      </div>
    </div>
    <div class="admin-card">
      <div class="admin-card-body no-pad">
        <table class="admin-table" id="athletes-table">
          <thead><tr>
            <th>Nom</th><th>Coach</th><th>Inscrit le</th><th>Dernière activité</th><th>Statut</th>
          </tr></thead>
          <tbody>`;

  athletes.forEach(a => {
    const isActive = a.last_activity && a.last_activity >= thirtyDaysAgo;
    html += `
            <tr data-name="${esc((a.prenom + ' ' + a.nom).toLowerCase())}">
              <td style="font-weight:500;">${esc(a.prenom)} ${esc(a.nom)}</td>
              <td style="font-size:12px;color:var(--text2);">${esc(a.coach_email)}</td>
              <td class="admin-coach-date">${formatDate(a.created_at)}</td>
              <td class="admin-coach-date">${a.last_activity ? formatDate(a.last_activity) : 'Jamais'}</td>
              <td>${isActive ? '<span class="admin-badge active">Actif</span>' : '<span class="admin-badge inactive">Inactif</span>'}</td>
            </tr>`;
  });

  html += '</tbody></table></div></div>';
  el.innerHTML = html;
}

function adminFilterAthletes() {
  const q = document.getElementById('athlete-search').value.toLowerCase();
  document.querySelectorAll('#athletes-table tbody tr').forEach(tr => {
    tr.style.display = tr.dataset.name.includes(q) ? '' : 'none';
  });
}

// ── PAYMENTS ──

async function loadPayments() {
  const el = document.getElementById('payments-content');
  if (!el) return;

  try {
    if (!adminCache.stripe) {
      adminCache.stripe = await adminRPC('admin_stripe_overview');
    }
    const d = adminCache.stripe;

    let html = `
      <div class="admin-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px;">
        <div class="admin-stat-card">
          <div class="admin-stat-value">${formatEur(d.platform_mrr || 0)}</div>
          <div class="admin-stat-label">MRR Plateforme</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-value">${formatEur(d.platform_total_revenue || 0)}</div>
          <div class="admin-stat-label">Revenus totaux</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-value">${d.total_coaches || 0}</div>
          <div class="admin-stat-label">Coachs</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-value" style="color:${(d.pending_invoices || 0) > 0 ? '#ef4444' : 'inherit'}">${d.pending_invoices || 0}</div>
          <div class="admin-stat-label">Impayés</div>
        </div>
      </div>

      <div class="admin-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px;">
        <div class="admin-stat-card">
          <div class="admin-stat-value">${d.coaches_with_connect || 0}</div>
          <div class="admin-stat-label">Connect actifs</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-value">${d.coaches_with_payment || 0}</div>
          <div class="admin-stat-label">CB enregistrée</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-value">${d.total_athletes_paying || 0}</div>
          <div class="admin-stat-label">Athlètes payants</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-value">${d.total_athletes_free || 0}</div>
          <div class="admin-stat-label">Athlètes gratuits</div>
        </div>
      </div>

      <div class="admin-grid-2">
        <div class="admin-card">
          <div class="admin-card-header">
            <div class="admin-card-title"><i class="fas fa-user-tie"></i> Coachs</div>
          </div>
          <div class="admin-card-body no-pad" style="max-height:500px;overflow-y:auto;">
            <table class="admin-table">
              <thead><tr><th>Coach</th><th>Plan</th><th>Athlètes</th><th>Total payé</th><th>Statut</th></tr></thead>
              <tbody>`;

    (d.coaches || []).forEach(c => {
      const planLabel = c.plan === 'business' ? '<span class="admin-badge active">Business</span>' : '<span class="admin-badge">Athlète</span>';
      const statusLabel = c.is_blocked
        ? '<span class="admin-badge canceled">Bloqué</span>'
        : c.stripe_onboarding_complete
          ? '<span class="admin-badge active">Actif</span>'
          : '<span class="admin-badge">Setup…</span>';
      html += `
                <tr>
                  <td><div style="font-weight:600;">${esc(c.display_name || '—')}</div><div style="font-size:12px;color:var(--text3);">${esc(c.email || '')}</div></td>
                  <td>${planLabel}</td>
                  <td style="text-align:center;font-weight:600;">${c.athlete_count || 0}</td>
                  <td style="font-weight:600;">${formatEur(c.total_paid || 0)}</td>
                  <td>${statusLabel}</td>
                </tr>`;
    });

    html += `
              </tbody>
            </table>
          </div>
        </div>

        <div class="admin-card">
          <div class="admin-card-header">
            <div class="admin-card-title"><i class="fas fa-file-invoice"></i> Factures récentes</div>
          </div>
          <div class="admin-card-body no-pad" style="max-height:500px;overflow-y:auto;">
            <table class="admin-table">
              <thead><tr><th>Coach</th><th>Période</th><th>Montant</th><th>Statut</th></tr></thead>
              <tbody>`;

    (d.recent_invoices || []).forEach(inv => {
      const invStatus = inv.status === 'paid'
        ? '<span class="admin-badge active">Payé</span>'
        : inv.status === 'blocked'
          ? '<span class="admin-badge canceled">Bloqué</span>'
          : `<span class="admin-badge" style="color:#f59e0b;">${esc(inv.status)}</span>`;
      html += `
                <tr>
                  <td style="font-size:13px;">${esc(inv.coach_name || inv.coach_email || '—')}</td>
                  <td>${inv.month}/${inv.year}</td>
                  <td style="font-weight:600;">${formatEur(inv.total_amount || 0)}</td>
                  <td>${invStatus}</td>
                </tr>`;
    });

    html += '</tbody></table></div></div></div>';
    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = `<div class="admin-empty"><i class="fas fa-exclamation-triangle"></i>${esc(err.message)}</div>`;
  }
}

// ── METRICS ──

async function loadMetrics() {
  const el = document.getElementById('metrics-content');
  if (!el) return;

  try {
    if (!adminCache.metrics) {
      adminCache.metrics = await adminRPC('admin_metrics');
    }
    const m = adminCache.metrics;

    el.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <div class="admin-card-title"><i class="fas fa-chart-bar"></i> Usage des fonctionnalités</div>
        </div>
        <div class="admin-card-body">
          <div class="admin-metrics-grid">
            <div class="admin-metric-item">
              <div class="admin-metric-icon"><i class="fas fa-dumbbell"></i></div>
              <div class="admin-metric-value">${m.programs}</div>
              <div class="admin-metric-label">Programmes</div>
            </div>
            <div class="admin-metric-item">
              <div class="admin-metric-icon"><i class="fas fa-clipboard-check"></i></div>
              <div class="admin-metric-value">${m.reports}</div>
              <div class="admin-metric-label">Bilans remplis</div>
            </div>
            <div class="admin-metric-item">
              <div class="admin-metric-icon"><i class="fas fa-video"></i></div>
              <div class="admin-metric-value">${m.videos}</div>
              <div class="admin-metric-label">Vidéos upload</div>
            </div>
            <div class="admin-metric-item">
              <div class="admin-metric-icon"><i class="fas fa-utensils"></i></div>
              <div class="admin-metric-value">${m.nutrition_plans}</div>
              <div class="admin-metric-label">Plans nutrition</div>
            </div>
            <div class="admin-metric-item">
              <div class="admin-metric-icon"><i class="fas fa-graduation-cap"></i></div>
              <div class="admin-metric-value">${m.formations}</div>
              <div class="admin-metric-label">Formations</div>
            </div>
            <div class="admin-metric-item">
              <div class="admin-metric-icon"><i class="fas fa-question-circle"></i></div>
              <div class="admin-metric-value">${m.questionnaires}</div>
              <div class="admin-metric-label">Questionnaires</div>
            </div>
          </div>
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="admin-empty"><i class="fas fa-exclamation-triangle"></i>${esc(err.message)}</div>`;
  }
}

// ── Theme Toggle ──

function adminToggleTheme() {
  const html = document.documentElement;
  const isLight = html.getAttribute('data-theme') === 'light';
  if (isLight) {
    html.removeAttribute('data-theme');
    localStorage.setItem('prc-theme', 'dark');
  } else {
    html.setAttribute('data-theme', 'light');
    localStorage.setItem('prc-theme', 'light');
  }
  updateThemeUI();
}

function updateThemeUI() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const icon = document.getElementById('admin-theme-icon');
  const label = document.getElementById('admin-theme-label');
  if (icon) icon.className = isLight ? 'fas fa-sun' : 'fas fa-moon';
  if (label) label.textContent = isLight ? 'Thème clair' : 'Thème sombre';
}

// ── Init ──
updateThemeUI();
checkAdminSession();
