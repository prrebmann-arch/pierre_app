// ===== MENSTRUAL TRACKING TAB =====

async function loadAthleteTabMenstrual() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const [{ data: logs }, { data: athlete }] = await Promise.all([
    supabaseClient.from('menstrual_logs').select('*').eq('athlete_id', currentAthleteId).order('start_date', { ascending: false }).limit(24),
    supabaseClient.from('athletes').select('menstrual_tracking_enabled').eq('id', currentAthleteId).single(),
  ]);

  const enabled = athlete?.menstrual_tracking_enabled || false;
  const entries = logs || [];

  renderMenstrualTab(el, entries, enabled);
}

function renderMenstrualTab(el, entries, enabled) {
  // Toggle
  const toggleHtml = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:${enabled ? 'rgba(236,72,153,0.08)' : 'rgba(239,68,68,0.08)'};border-radius:8px;margin-bottom:16px;border:1px solid ${enabled ? 'rgba(236,72,153,0.2)' : 'rgba(239,68,68,0.2)'};">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text);">${enabled ? '<i class="fas fa-unlock" style="color:#ec4899;margin-right:6px;"></i>Suivi activé pour l\'athlète' : '<i class="fas fa-lock" style="color:var(--danger);margin-right:6px;"></i>Suivi désactivé'}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">L'athlète ${enabled ? 'peut enregistrer' : 'ne voit pas'} le suivi menstruel dans l'app</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" ${enabled ? 'checked' : ''} onchange="toggleMenstrualTracking(this.checked)">
        <span class="switch"></span>
      </label>
    </div>`;

  if (!entries.length) {
    el.innerHTML = `${toggleHtml}<div style="text-align:center;padding:60px;color:var(--text3);"><i class="fas fa-venus" style="font-size:36px;margin-bottom:12px;display:block;color:#ec4899;"></i>Aucun cycle enregistré<br><span style="font-size:11px;">L'athlète doit activer le suivi dans son app</span></div>`;
    return;
  }

  // Stats
  const completed = entries.filter(e => e.end_date).sort((a, b) => a.start_date.localeCompare(b.start_date));
  let avgCycle = 28, avgDuration = 5;
  if (completed.length >= 2) {
    const cycleLengths = [];
    const durations = [];
    for (let i = 1; i < completed.length; i++) {
      cycleLengths.push(daysBetweenM(completed[i - 1].start_date, completed[i].start_date));
    }
    completed.forEach(l => durations.push(daysBetweenM(l.start_date, l.end_date)));
    avgCycle = Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length) || 28;
    avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) || 5;
  }

  // Predictions
  const lastEntry = entries[0];
  const lastStart = new Date(lastEntry.start_date + 'T12:00:00');
  const nextStart = new Date(lastStart);
  nextStart.setDate(nextStart.getDate() + avgCycle);
  const ovulation = new Date(nextStart);
  ovulation.setDate(ovulation.getDate() - 14);

  const statsHtml = `
    <div style="display:flex;gap:12px;margin-bottom:16px;">
      <div style="flex:1;background:var(--bg2);border:1px solid var(--border-subtle);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:var(--text);">${avgCycle}</div>
        <div style="font-size:11px;color:var(--text3);">jours / cycle</div>
      </div>
      <div style="flex:1;background:var(--bg2);border:1px solid var(--border-subtle);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:var(--text);">${avgDuration}</div>
        <div style="font-size:11px;color:var(--text3);">jours de règles</div>
      </div>
      <div style="flex:1;background:var(--bg2);border:1px solid var(--border-subtle);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:var(--text);">${completed.length}</div>
        <div style="font-size:11px;color:var(--text3);">cycles</div>
      </div>
    </div>`;

  // Predictions card
  const predHtml = `
    <div style="background:var(--bg2);border:1px solid var(--border-subtle);border-radius:10px;padding:16px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px;"><i class="fas fa-crystal-ball" style="margin-right:6px;color:#ec4899;"></i>Prédictions</div>
      <div style="display:flex;gap:16px;">
        <div style="flex:1;">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:600;">Prochaines règles</div>
          <div style="font-size:14px;font-weight:600;color:var(--text);margin-top:2px;">${formatDateM(nextStart)}</div>
        </div>
        <div style="flex:1;">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:600;">Ovulation estimée</div>
          <div style="font-size:14px;font-weight:600;color:var(--text);margin-top:2px;">${formatDateM(ovulation)}</div>
        </div>
      </div>
    </div>`;

  // Phase timeline (visual)
  const phaseHtml = buildPhaseTimeline(lastStart, avgCycle, avgDuration);

  // History
  const historyHtml = entries.map(e => {
    const dur = e.end_date ? daysBetweenM(e.start_date, e.end_date) : '—';
    const flowLabel = e.flow === 'light' ? 'Léger' : e.flow === 'heavy' ? 'Abondant' : 'Moyen';
    const flowColor = e.flow === 'light' ? '#f9a8d4' : e.flow === 'heavy' ? '#be185d' : '#ec4899';
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-subtle);">
        <div style="width:8px;height:8px;border-radius:4px;background:${flowColor};"></div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;color:var(--text);">${formatDateM(new Date(e.start_date + 'T12:00:00'))}${e.end_date ? ' → ' + formatDateM(new Date(e.end_date + 'T12:00:00')) : ' <span style="color:#ec4899;font-size:11px;">(en cours)</span>'}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">${flowLabel} · ${dur !== '—' ? dur + ' jours' : 'En cours'}</div>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    ${toggleHtml}
    ${statsHtml}
    ${predHtml}
    ${phaseHtml}
    <div style="background:var(--bg2);border:1px solid var(--border-subtle);border-radius:10px;padding:16px;">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px;"><i class="fas fa-history" style="margin-right:6px;color:var(--text3);"></i>Historique des cycles</div>
      ${historyHtml}
    </div>`;
}

function buildPhaseTimeline(lastStart, avgCycle, avgDuration) {
  const menPct = Math.round((avgDuration / avgCycle) * 100);
  const ovDay = avgCycle - 14;
  const follPct = Math.round(((ovDay - avgDuration) / avgCycle) * 100);
  const ovPct = Math.round((2 / avgCycle) * 100);
  const lutPct = 100 - menPct - follPct - ovPct;

  return `
    <div style="background:var(--bg2);border:1px solid var(--border-subtle);border-radius:10px;padding:16px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px;"><i class="fas fa-chart-bar" style="margin-right:6px;color:var(--text3);"></i>Phases du cycle</div>
      <div style="display:flex;height:32px;border-radius:6px;overflow:hidden;margin-bottom:8px;">
        <div style="width:${menPct}%;background:#ef4444;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:9px;color:#fff;font-weight:700;">Règles</span>
        </div>
        <div style="width:${follPct}%;background:#3b82f6;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:9px;color:#fff;font-weight:700;">Folliculaire</span>
        </div>
        <div style="width:${ovPct}%;background:#f59e0b;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:9px;color:#fff;font-weight:700;">Ov.</span>
        </div>
        <div style="width:${lutPct}%;background:#9b59b6;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:9px;color:#fff;font-weight:700;">Lutéale</span>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);">
        <span>J1</span>
        <span>J${avgDuration}</span>
        <span>J${ovDay} (ovulation)</span>
        <span>J${avgCycle}</span>
      </div>
    </div>`;
}

function daysBetweenM(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function formatDateM(d) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

async function toggleMenstrualTracking(on) {
  const { error } = await supabaseClient.from('athletes').update({ menstrual_tracking_enabled: on }).eq('id', currentAthleteId);
  if (error) { handleError(error, 'menstrual'); return; }
  notify(on ? 'Suivi menstruel activé' : 'Suivi menstruel désactivé', 'success');
  loadAthleteTabMenstrual();
}
