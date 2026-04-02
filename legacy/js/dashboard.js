/* ── Carbon: animated counter ── */
function animateCounter(el, target, duration) {
  duration = duration || 800;
  if (!el || isNaN(target)) return;
  var start = 0;
  var startTime = performance.now();
  function tick(now) {
    var elapsed = now - startTime;
    var progress = Math.min(elapsed / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ===== DASHBOARD =====

async function loadDashboard() {
  const el = document.getElementById('dashboard-content');
  if (!el) return;
  el.innerHTML = '<div class="text-center" style="padding:60px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

  const coachId = currentUser?.id;
  if (!coachId) return;

  // Load athletes first, then everything in parallel
  const { data: athletes } = await supabaseClient.from('athletes').select('*').eq('coach_id', coachId).order('prenom');
  const athleteUserIds = (athletes || []).map(a => a.user_id).filter(Boolean);
  const athleteIds = (athletes || []).map(a => a.id);

  const [
    { data: allReports },
    { data: allPhases },
    { data: allPrograms },
    { data: pendingVideos },
    { data: settingsRows },
  ] = await Promise.all([
    athleteUserIds.length
      ? supabaseClient.from('daily_reports').select('*').in('user_id', athleteUserIds).order('date', { ascending: false }).limit(500)
      : Promise.resolve({ data: [] }),
    supabaseClient.from('roadmap_phases').select('*').eq('coach_id', coachId).order('start_date'),
    supabaseClient.from('workout_programs').select('id, nom, athlete_id, actif').eq('coach_id', coachId),
    athleteIds.length
      ? supabaseClient.from('execution_videos').select('id, athlete_id, exercise_name, created_at').in('athlete_id', athleteIds).eq('status', 'a_traiter').order('created_at', { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    supabaseClient.from('coach_settings').select('*').eq('coach_id', coachId).limit(1),
  ]);

  // Coach settings (create with defaults if missing)
  let coachSettings = settingsRows?.[0] || null;
  if (!coachSettings) {
    const { data: created, error: settingsErr } = await supabaseClient.from('coach_settings').insert({ coach_id: coachId, max_videos_per_day: 3 }).select().single();
    if (settingsErr) { handleError(settingsErr, 'dashboard'); }
    coachSettings = created || { max_videos_per_day: 3 };
  }

  const athletesList = athletes || [];
  const reports = allReports || [];
  const phases = allPhases || [];
  const programs = allPrograms || [];
  const videos = pendingVideos || [];
  const today = toDateStr(new Date());
  const now = new Date();

  // ── Build athlete lookup ──
  const athleteMap = {};
  athletesList.forEach(a => { athleteMap[a.user_id] = a; athleteMap[a.id] = a; });

  // ── Bilans this week (Monday-based) ──
  const mondayDate = new Date(now);
  const dayOff = mondayDate.getDay() === 0 ? 6 : mondayDate.getDay() - 1;
  mondayDate.setDate(mondayDate.getDate() - dayOff);
  const mondayStr = toDateStr(mondayDate);

  const thisWeekReports = reports.filter(r => r.date >= mondayStr && r.date <= today);

  // ── Bilans à traiter ──
  const bilansToReview = [];
  athletesList.forEach(a => {
    if (!a.user_id) return;
    const athleteReports = thisWeekReports.filter(r => r.user_id === a.user_id);
    if (athleteReports.length > 0) {
      const lastReport = athleteReports.sort((x, y) => y.date.localeCompare(x.date))[0];
      bilansToReview.push({ athlete: a, report: lastReport, count: athleteReports.length });
    }
  });

  // ── Bilans en retard (based on complete_bilan config) ──
  const lateAthletes = [];
  athletesList.forEach(a => {
    if (!a.user_id) return;
    const freq = a.complete_bilan_frequency || 'weekly';
    if (freq === 'none') return;
    const intv = a.complete_bilan_interval || 7;
    const day = a.complete_bilan_day ?? 0;
    const anchor = a.complete_bilan_anchor_date;
    const mDay = a.complete_bilan_month_day || 1;

    const lastExpected = getLastExpectedBilanDate(freq, intv, day, anchor, mDay);
    if (!lastExpected) return;

    const hasBilan = thisWeekReports.some(r => r.user_id === a.user_id && r.date === lastExpected);
    if (hasBilan) return;
    const lastReport = reports.find(r => r.user_id === a.user_id);
    const expectedLabel = new Date(lastExpected + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
    lateAthletes.push({
      athlete: a,
      expectedDay: expectedLabel,
      lastDate: lastReport ? new Date(lastReport.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'jamais'
    });
  });

  // ── Vidéos à corriger ──
  const pendingVids = videos.map(v => {
    const athlete = athleteMap[v.athlete_id];
    return athlete ? { ...v, athlete } : null;
  }).filter(Boolean);

  // ── Anniversaires ──
  const birthdays = [];
  athletesList.forEach(a => {
    if (!a.date_naissance) return;
    const bd = new Date(a.date_naissance + 'T00:00:00');
    const nextBd = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
    if (nextBd < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      nextBd.setFullYear(nextBd.getFullYear() + 1);
    }
    const diffDays = Math.ceil((nextBd - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
    if (diffDays <= 60) {
      const age = nextBd.getFullYear() - bd.getFullYear();
      birthdays.push({ athlete: a, daysLeft: diffDays, nextBd, age });
    }
  });
  birthdays.sort((a, b) => a.daysLeft - b.daysLeft);

  // ── Recent activity ──
  const recentActivity = reports.slice(0, 30).map(r => {
    const athlete = athleteMap[r.user_id];
    if (!athlete) return null;
    const items = [];
    if (r.weight) items.push({ icon: 'fa-weight', text: `${r.weight} kg`, color: 'var(--text)' });
    if (r.sessions_executed) items.push({ icon: 'fa-dumbbell', text: r.sessions_executed, color: 'var(--primary)' });
    if (r.session_performance) items.push({ icon: 'fa-chart-line', text: r.session_performance, color: r.session_performance === 'Progrès' ? 'var(--success)' : r.session_performance === 'Régression' ? 'var(--danger)' : 'var(--text2)' });
    if (!items.length && !r.energy) return null;
    return { athlete, date: r.date, items, energy: r.energy, sleep: r.sleep_quality, adherence: r.adherence };
  }).filter(Boolean).slice(0, 20);

  // ── Render ──

  // Stats row
  const totalAthletes = athletesList.length;
  const activePrograms = programs.filter(p => p.actif).length;

  const coachName = currentUser?.email?.split('@')[0] || 'Coach';
  const todayFull = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  let html = `
    <div class="prc-welcome">
      <div>
        <div class="prc-welcome-title">Bonjour, ${escHtml(coachName)}</div>
        <div class="prc-welcome-sub">Voici un aperçu de vos athlètes</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="prc-welcome-date"><i class="fas fa-calendar-alt"></i> ${todayFull}</div>
        <button class="btn btn-red" onclick="showSection('athletes');setTimeout(()=>openModal('modal-athlete'),100)">
          <i class="fas fa-plus"></i> Ajouter un athlète
        </button>
      </div>
    </div>

    <!-- Stats cards -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;">
      <div style="background:var(--bg2);border:1px solid var(--glass-border);border-radius:20px;padding:22px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#60a5fa);"></div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(59,130,246,0.1);display:flex;align-items:center;justify-content:center;"><i class="fas fa-users" style="color:#3b82f6;font-size:14px;"></i></div>
          <div>
            <div id="dash-stat-athletes" style="font-size:24px;font-weight:800;color:var(--text);line-height:1;">${totalAthletes}</div>
            <div style="font-size:11px;color:var(--text2);font-weight:500;">Athlètes</div>
          </div>
        </div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--glass-border);border-radius:20px;padding:22px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#22c55e,#4ade80);"></div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(34,197,94,0.1);display:flex;align-items:center;justify-content:center;"><i class="fas fa-clipboard-check" style="color:#22c55e;font-size:14px;"></i></div>
          <div>
            <div id="dash-stat-bilans" style="font-size:24px;font-weight:800;color:var(--text);line-height:1;">${bilansToReview.length}</div>
            <div style="font-size:11px;color:var(--text2);font-weight:500;">Bilans à traiter</div>
          </div>
        </div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--glass-border);border-radius:20px;padding:22px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#f59e0b,#fbbf24);"></div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(245,158,11,0.1);display:flex;align-items:center;justify-content:center;"><i class="fas fa-video" style="color:#f59e0b;font-size:14px;"></i></div>
          <div>
            <div id="dash-stat-videos" style="font-size:24px;font-weight:800;color:var(--text);line-height:1;">${pendingVids.length}</div>
            <div style="font-size:11px;color:var(--text2);font-weight:500;">Vidéos à corriger</div>
          </div>
        </div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--glass-border);border-radius:20px;padding:22px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#B30808,#d41a1a);"></div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(179,8,8,0.1);display:flex;align-items:center;justify-content:center;"><i class="fas fa-exclamation-triangle" style="color:#B30808;font-size:14px;"></i></div>
          <div>
            <div id="dash-stat-late" style="font-size:24px;font-weight:800;color:var(--text);line-height:1;">${lateAthletes.length}</div>
            <div style="font-size:11px;color:var(--text2);font-weight:500;">Bilans en retard</div>
          </div>
        </div>
      </div>
    </div>

    <div class="dash-layout">
      <div class="dash-main">
        <div class="dash-row">`;

  // ══════ LEFT COLUMN ══════

  // ── Card: Bilans à traiter ──
  html += `
          <div class="dash-card">
            <div class="dash-card-header">
              <span class="dash-card-title"><i class="fas fa-clipboard-check"></i> Bilans à traiter</span>
              <span class="dash-badge">${bilansToReview.length}</span>
            </div>
            <div class="dash-card-body">`;

  if (bilansToReview.length) {
    bilansToReview.forEach(b => {
      const d = new Date(b.report.date + 'T00:00:00');
      const dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      html += `
              <div class="dash-item" onclick="openAthleteDashboard('${b.athlete.id}','bilans')">
                <div class="dash-avatar">${b.athlete.prenom.charAt(0)}${b.athlete.nom.charAt(0)}</div>
                <div class="dash-item-info">
                  <div class="dash-item-name">${escHtml(b.athlete.prenom)} ${escHtml(b.athlete.nom)}</div>
                  <div class="dash-item-sub">${b.count} bilan${b.count > 1 ? 's' : ''} · dernier le ${dateStr}</div>
                </div>
              </div>`;
    });
  } else {
    html += '<div class="dash-empty">Aucun bilan cette semaine</div>';
  }
  html += '</div></div>';

  // ── Card: Bilans en retard ──
  html += `
          <div class="dash-card">
            <div class="dash-card-header">
              <span class="dash-card-title"><i class="fas fa-bell"></i> Bilans en retard</span>
              <span class="dash-badge ${lateAthletes.length ? 'dash-badge-warn' : ''}">${lateAthletes.length}</span>
            </div>
            <div class="dash-card-body">`;

  if (lateAthletes.length) {
    lateAthletes.forEach(l => {
      html += `
              <div class="dash-item" style="cursor:default;">
                <div class="dash-avatar dash-avatar-warn">${l.athlete.prenom.charAt(0)}${l.athlete.nom.charAt(0)}</div>
                <div class="dash-item-info" style="flex:1;">
                  <div class="dash-item-name">${escHtml(l.athlete.prenom)} ${escHtml(l.athlete.nom)}</div>
                  <div class="dash-item-sub">Attendu ${l.expectedDay} · Dernier : ${l.lastDate}</div>
                </div>
                <button class="dash-bell-btn" id="bell-${l.athlete.id}" onclick="event.stopPropagation();sendBilanRappel('${l.athlete.id}','${l.athlete.user_id}','${escHtml(l.athlete.prenom)}')" title="Envoyer un rappel">
                  <i class="fas fa-bell"></i>
                </button>
              </div>`;
    });
  } else {
    html += '<div class="dash-empty"><i class="fas fa-check-circle" style="color:var(--success);margin-right:6px;"></i>Tous les bilans sont à jour</div>';
  }
  html += '</div></div>';

  html += '</div><div class="dash-row">';

  // ══════ MIDDLE COLUMN ══════

  // ── Card: Vidéos à corriger ──
  html += `
          <div class="dash-card">
            <div class="dash-card-header">
              <span class="dash-card-title"><i class="fas fa-video"></i> Vidéos à corriger</span>
              <span class="dash-badge ${pendingVids.length ? 'dash-badge-warn' : ''}">${pendingVids.length}</span>
            </div>
            <div class="dash-card-body">`;

  if (pendingVids.length) {
    pendingVids.forEach(v => {
      const d = new Date(v.created_at);
      const timeAgo = getTimeAgo(d);
      html += `
              <div class="dash-item" onclick="openAthleteDashboard('${v.athlete.id}','videos')">
                <div class="dash-avatar" style="background:var(--warning);">${v.athlete.prenom.charAt(0)}${v.athlete.nom.charAt(0)}</div>
                <div class="dash-item-info">
                  <div class="dash-item-name">${escHtml(v.athlete.prenom)} ${escHtml(v.athlete.nom)}</div>
                  <div class="dash-item-sub">${escHtml(v.exercise_name || 'Exercice')} · ${timeAgo}</div>
                </div>
              </div>`;
    });
  } else {
    html += '<div class="dash-empty"><i class="fas fa-check-circle" style="color:var(--success);margin-right:6px;"></i>Aucune vidéo en attente</div>';
  }
  html += '</div></div>';

  // ── Card: Anniversaires ──
  html += `
          <div class="dash-card">
            <div class="dash-card-header">
              <span class="dash-card-title"><i class="fas fa-birthday-cake"></i> Anniversaires</span>
              <span class="dash-badge">${birthdays.length}</span>
            </div>
            <div class="dash-card-body">`;

  if (birthdays.length) {
    birthdays.forEach(b => {
      const bdStr = b.nextBd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
      const isToday = b.daysLeft === 0;
      const countdownColor = isToday ? 'var(--warning)' : b.daysLeft <= 7 ? 'var(--primary)' : 'var(--text3)';
      const countdownText = isToday ? '🎂 Aujourd\'hui !' : `J-${b.daysLeft}`;
      html += `
              <div class="dash-item" onclick="openAthleteDashboard('${b.athlete.id}','infos')">
                <div class="dash-avatar" style="background:${isToday ? 'var(--warning)' : 'var(--bg3)'}; color:${isToday ? '#000' : 'var(--text2)'};">${b.athlete.prenom.charAt(0)}${b.athlete.nom.charAt(0)}</div>
                <div class="dash-item-info">
                  <div class="dash-item-name">${escHtml(b.athlete.prenom)} ${escHtml(b.athlete.nom)}</div>
                  <div class="dash-item-sub">${bdStr} · ${b.age} ans</div>
                </div>
                <span style="font-size:13px;font-weight:700;color:${countdownColor};white-space:nowrap;">${countdownText}</span>
              </div>`;
    });
  } else {
    html += '<div class="dash-empty">Aucun anniversaire à venir</div>';
  }
  html += '</div></div>';

  // ── Card: Réglages ──
  html += `
          <div class="dash-card">
            <div class="dash-card-header">
              <span class="dash-card-title"><i class="fas fa-cog"></i> Réglages</span>
            </div>
            <div class="dash-card-body">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;">
                <div>
                  <div style="font-size:13px;font-weight:600;color:var(--text);">Vidéos max / jour</div>
                  <div style="font-size:11px;color:var(--text3);">Limite par athlète sur l'app mobile</div>
                </div>
                <input type="number" min="1" max="20" value="${coachSettings.max_videos_per_day ?? 3}"
                  style="width:56px;text-align:center;padding:6px 4px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:14px;font-weight:700;"
                  onchange="updateCoachSetting('max_videos_per_day',parseInt(this.value)||3)" />
              </div>
            </div>
          </div>`;

  html += '</div></div>'; // close dash-main

  // ══════ RIGHT COLUMN: Activité récente ══════
  html += `
      <div class="dash-card dash-card-activity">
        <div class="dash-card-header">
          <span class="dash-card-title"><i class="fas fa-bolt"></i> Activité récente</span>
        </div>
        <div class="dash-card-body dash-activity-scroll">`;

  if (recentActivity.length) {
    recentActivity.forEach(a => {
      const d = new Date(a.date + 'T00:00:00');
      const timeAgo = getTimeAgo(d);
      html += `
          <div class="dash-activity-item" onclick="openAthleteDashboard('${a.athlete.id}','bilans')">
            <div class="dash-avatar-sm">${a.athlete.prenom.charAt(0)}${a.athlete.nom.charAt(0)}</div>
            <div class="dash-activity-content">
              <span class="dash-activity-name">${escHtml(a.athlete.prenom)} ${escHtml(a.athlete.nom)}</span>
              ${a.items.map(it => `<span class="dash-activity-tag" style="color:${it.color};"><i class="fas ${it.icon}"></i> ${escHtml(String(it.text))}</span>`).join('')}
              <span class="dash-activity-time">${timeAgo}</span>
            </div>
          </div>`;
    });
  } else {
    html += '<div class="dash-empty">Aucune activité récente</div>';
  }
  html += '</div></div>';

  html += '</div>'; // close dash-layout
  el.innerHTML = html;

  // Animate stat counters
  animateCounter(document.getElementById('dash-stat-athletes'), totalAthletes);
  animateCounter(document.getElementById('dash-stat-bilans'), bilansToReview.length);
  animateCounter(document.getElementById('dash-stat-videos'), pendingVids.length);
  animateCounter(document.getElementById('dash-stat-late'), lateAthletes.length);

  // Sync activity column height with main column
  const mainCol = el.querySelector('.dash-main');
  const activityCard = el.querySelector('.dash-card-activity');
  if (mainCol && activityCard) {
    activityCard.style.maxHeight = mainCol.offsetHeight + 'px';
  }
}

// Helper: navigate to athlete tab
function openAthleteDashboard(athleteId, tab) {
  const a = (typeof athletesList !== 'undefined' ? athletesList : []).find(x => x.id === athleteId);
  if (!a) {
    showSection('athletes');
    return;
  }
  currentAthleteId = a.id;
  currentAthleteObj = a;
  document.getElementById('athlete-detail-name').textContent = a.prenom + ' ' + a.nom;
  showSection('athlete-detail');
  if (tab) setTimeout(() => switchAthleteTab(tab), 50);
}

// Helper: send bilan reminder (push + notification in DB)
async function sendBilanRappel(athleteId, userId, prenom) {
  const btn = document.getElementById('bell-' + athleteId);
  if (!btn || btn.disabled) return;

  // Check if a rappel was already sent today
  const todayStr = toDateStr(new Date());
  const { data: existing } = await supabaseClient
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'rappel')
    .gte('created_at', todayStr + 'T00:00:00')
    .limit(1);

  if (existing && existing.length > 0) {
    notify('Rappel déjà envoyé aujourd\'hui', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  const title = 'Rappel bilan';
  const body = 'Ton bilan est en retard, pense à le remplir !';

  const { error } = await supabaseClient.from('notifications').insert({
    user_id: userId,
    type: 'rappel',
    title,
    body
  });
  if (error) { handleError(error, 'dashboard'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-bell"></i>'; return; }

  await sendExpoPush([userId], title, body, { type: 'rappel' });

  btn.innerHTML = '<i class="fas fa-check"></i>';
  btn.style.color = 'var(--success)';
  notify(`Rappel envoyé à ${prenom}`, 'success');
}

// Helper: relative time
function getTimeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ── Coach settings upsert ──
async function updateCoachSetting(key, value) {
  const coachId = currentUser?.id;
  if (!coachId) return;
  const { error } = await supabaseClient
    .from('coach_settings')
    .upsert({ coach_id: coachId, [key]: value }, { onConflict: 'coach_id' });
  if (error) { handleError(error, 'updateCoachSetting'); return; }
  notify('Réglage sauvegardé', 'success');
}
