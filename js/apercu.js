// ===== ATHLETE APERÇU (OVERVIEW) =====

async function loadAthleteTabApercu() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:60px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

  const athleteId = currentAthleteId;
  const userId = currentAthleteObj?.user_id;
  if (!athleteId || !currentAthleteObj) return;

  // Load all data in parallel
  const [
    { data: athlete },
    { data: reports },
    { data: phases },
    { data: programs },
    { data: nutritionPlans },
    { data: trackingRows },
  ] = await Promise.all([
    supabaseClient.from('athletes').select('*').eq('id', athleteId).single(),
    userId
      ? supabaseClient.from('daily_reports').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(60)
      : Promise.resolve({ data: [] }),
    supabaseClient.from('roadmap_phases').select('*').eq('athlete_id', athleteId).eq('status', 'en_cours').order('position').limit(1),
    supabaseClient.from('workout_programs').select('id, nom, actif, workout_sessions(id, nom, exercices)').eq('athlete_id', athleteId).eq('actif', true).limit(1),
    supabaseClient.from('nutrition_plans').select('*').eq('athlete_id', athleteId).eq('actif', true),
    supabaseClient.from('daily_tracking').select('date, water_ml, steps').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(7),
  ]);

  const allReports = reports || [];
  const today = new Date();

  // --- Last 7 days reports ---
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = toDateStr(d);
    const r = allReports.find(rep => rep.date === ds);
    last7.push({ date: ds, day: d.toLocaleDateString('fr-FR', { weekday: 'short' }).substring(0, 3), report: r });
  }

  // --- Weight card (30 days history with hover) ---
  const last30 = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = toDateStr(d);
    const r = allReports.find(rep => rep.date === ds);
    last30.push({ date: ds, label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), report: r });
  }
  const weightData = last30.map(d => ({ weight: d.report?.weight || null, label: d.label }));
  const validWeights = weightData.filter(d => d.weight != null);
  const lastWeight = validWeights.length ? validWeights[validWeights.length - 1].weight : null;
  const weightMin = validWeights.length ? Math.min(...validWeights.map(w => w.weight)) : 0;
  const weightMax = validWeights.length ? Math.max(...validWeights.map(w => w.weight)) : 0;
  const weightRange = weightMax - weightMin || 1;

  // Weight chart — use Chart.js
  let weightChartHtml;
  if (validWeights.length > 1) {
    // Store data globally for Chart.js init after render
    window._apWeightChartData = {
      labels: weightData.map(d => d.label),
      data: weightData.map(d => d.weight),
    };
    weightChartHtml = '<div style="position:relative;height:160px;"><canvas id="ap-weight-canvas"></canvas></div>';
  } else {
    weightChartHtml = '<div style="height:120px;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:12px;">Pas assez de données</div>';
  }

  const weightDiff = validWeights.length >= 2 ? (validWeights[validWeights.length-1].weight - validWeights[0].weight).toFixed(1) : null;
  const weightDiffHtml = weightDiff ? `<span style="font-size:12px;margin-left:8px;color:${parseFloat(weightDiff) !== 0 ? 'var(--text2)' : 'var(--text3)'};">${parseFloat(weightDiff) > 0 ? '+' : ''}${weightDiff} kg</span>` : '';

  // --- Tracking map (shared by steps + water) ---
  const trackingMap = {};
  (trackingRows || []).forEach(t => { trackingMap[t.date] = t; });

  // --- Steps card (priority: daily_tracking > daily_reports) ---
  const stepsTarget = athlete?.pas_journalier || DEFAULT_STEPS_GOAL;
  const todayReport = last7[6]?.report;
  const todayTrackedSteps = trackingMap[toDateStr(today)]?.steps;
  const todaySteps = todayTrackedSteps || todayReport?.steps || 0;
  const stepsPct = Math.min(100, Math.round((todaySteps / stepsTarget) * 100));
  const stepsValues = last7.map(d => {
    const tracked = trackingMap[d.date]?.steps;
    return tracked || d.report?.steps || 0;
  });
  const stepsMax = Math.max(...stepsValues, stepsTarget, 1);
  const stepsChartPoints = [];
  const stepsBarData = last7.map((d, i) => {
    const v = d.report?.steps || 0;
    const h = Math.max(4, (v / stepsMax) * 60);
    const color = v >= stepsTarget ? 'var(--success)' : 'var(--primary)';
    stepsChartPoints.push({ steps: v, day: d.day });
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;">
      <div style="height:60px;display:flex;align-items:flex-end;width:100%;"><div style="width:100%;height:${h}px;background:${color};border-radius:3px 3px 0 0;opacity:${v ? 1 : 0.2};"></div></div>
      <span style="font-size:9px;color:var(--text3);">${d.day}</span>
    </div>`;
  });
  const daysReached = stepsValues.filter(v => v >= stepsTarget).length;
  const avgSteps = Math.round(stepsValues.reduce((a, b) => a + b, 0) / 7);

  // --- Sleep card ---
  const sleepValues = last7.map(d => d.report?.sleep_quality).filter(v => v != null);
  const avgSleep = sleepValues.length ? (sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length).toFixed(1) : null;
  const sleepChartPoints = [];
  const sleepBarData = last7.map(d => {
    const v = d.report?.sleep_quality;
    const h = v != null ? Math.max(4, (v / 10) * 60) : 4;
    const color = v >= 7 ? 'var(--success)' : v >= 5 ? 'var(--warning)' : v != null ? 'var(--danger)' : 'var(--bg4)';
    sleepChartPoints.push({ quality: v, day: d.day });
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;">
      <div style="height:60px;display:flex;align-items:flex-end;width:100%;"><div style="width:100%;height:${h}px;background:${color};border-radius:3px 3px 0 0;opacity:${v != null ? 1 : 0.2};"></div></div>
      <span style="font-size:9px;color:var(--text3);">${d.day}</span>
    </div>`;
  });

  // --- Water card ---
  const waterGoal = athlete?.water_goal_ml || DEFAULT_WATER_GOAL;
  const todayTracking = trackingMap[toDateStr(today)];
  const todayWater = todayTracking?.water_ml || 0;
  const waterPct = Math.min(100, Math.round((todayWater / waterGoal) * 100));
  const waterBarData = last7.map(d => {
    const t = trackingMap[d.date];
    const v = t?.water_ml || 0;
    const h = Math.max(4, (v / Math.max(waterGoal, 1)) * 60);
    const color = v >= waterGoal ? 'var(--success)' : 'var(--info, #3b82f6)';
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;">
      <div style="height:60px;display:flex;align-items:flex-end;width:100%;"><div style="width:100%;height:${h}px;background:${color};border-radius:3px 3px 0 0;opacity:${v ? 1 : 0.2};"></div></div>
      <span style="font-size:9px;color:var(--text3);">${d.day}</span>
    </div>`;
  });
  const daysWaterReached = last7.filter(d => (trackingMap[d.date]?.water_ml || 0) >= waterGoal).length;

  // --- Activity feed (last 15 reports) ---
  const activityHtml = allReports.slice(0, 15).map(r => {
    const d = new Date(r.date + 'T00:00:00');
    const timeAgo = getTimeAgo(d);
    const items = [];
    if (r.weight) items.push(`<span style="color:var(--text2);"><i class="fas fa-weight" style="color:var(--primary);margin-right:3px;"></i>${r.weight} kg</span>`);
    if (r.sessions_executed) items.push(`<span style="color:var(--text2);"><i class="fas fa-dumbbell" style="color:var(--primary);margin-right:3px;"></i>${escHtml(r.sessions_executed)}</span>`);
    if (r.session_performance) {
      const pc = r.session_performance === 'Progrès' ? 'var(--success)' : r.session_performance === 'Régression' ? 'var(--danger)' : 'var(--warning)';
      items.push(`<span style="color:${pc};"><i class="fas fa-chart-line" style="margin-right:3px;"></i>${escHtml(r.session_performance)}</span>`);
    }
    if (r.steps) items.push(`<span style="color:var(--text2);"><i class="fas fa-shoe-prints" style="color:var(--text3);margin-right:3px;"></i>${Number(r.steps).toLocaleString('fr-FR')} pas</span>`);
    if (!items.length) return '';
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-subtle);">
      <div style="width:6px;height:6px;border-radius:50%;background:var(--primary);margin-top:6px;flex-shrink:0;"></div>
      <div style="flex:1;">
        <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:12px;">${items.join('')}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px;">${timeAgo}</div>
      </div>
    </div>`;
  }).filter(Boolean).join('') || '<div style="color:var(--text3);font-size:12px;text-align:center;padding:20px;">Aucune activité</div>';

  // --- Roadmap phase ---
  const activePhase = phases?.[0];
  let phaseHtml = '<div style="color:var(--text3);font-size:13px;">Aucune phase en cours</div>';
  if (activePhase) {
    const pi = typeof PROG_PHASES !== 'undefined' ? PROG_PHASES[activePhase.phase] : null;
    const color = pi ? pi.color : 'var(--primary)';
    const end = activePhase.end_date ? new Date(activePhase.end_date + 'T00:00:00') : null;
    const daysLeft = end ? Math.max(0, Math.ceil((end - today) / MS_PER_DAY)) : '?';
    phaseHtml = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></div>
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--text);">${escHtml(activePhase.name)}</div>
          <div style="font-size:11px;color:var(--text3);">${pi ? pi.label : ''} · ${daysLeft}j restants</div>
        </div>
      </div>`;
  }

  // --- Active program ---
  const activeProg = programs?.[0];
  let progHtml = '<div style="color:var(--text3);font-size:13px;">Aucun programme actif</div>';
  if (activeProg) {
    const sessions = activeProg.workout_sessions || [];
    let totalEx = 0, totalSeries = 0;
    sessions.forEach(s => {
      let exs = [];
      try { exs = typeof s.exercices === 'string' ? JSON.parse(s.exercices) : (s.exercices || []); } catch (e) {}
      exs.forEach(ex => { totalEx++; totalSeries += (parseInt(ex.series) || 0); });
    });
    progHtml = `
      <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px;">${escHtml(activeProg.nom)}</div>
      <div style="font-size:11px;color:var(--text3);">${sessions.length} séances · ${totalEx} exercices · ${totalSeries} séries</div>`;
  }

  // --- Nutrition (both training + rest) ---
  const allPlans = nutritionPlans || [];
  const trainingPlan = allPlans.find(p => p.meal_type === 'training' || p.meal_type === 'entrainement') || null;
  const restPlan = allPlans.find(p => p.meal_type === 'rest' || p.meal_type === 'repos') || null;

  const renderMiniNutri = (plan, label) => {
    if (!plan) return '';
    const cal = plan.calories_objectif || 0;
    const p = plan.proteines || 0;
    const g = plan.glucides || 0;
    const l = plan.lipides || 0;
    return `<div style="margin-bottom:6px;">
      <div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">${label}</div>
      <div style="font-size:18px;font-weight:700;color:var(--text);">${cal} <span style="font-size:11px;font-weight:400;color:var(--text3);">kcal</span></div>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <span style="font-size:10px;color:var(--text2);"><span style="color:var(--success);">P</span> ${p}g</span>
        <span style="font-size:10px;color:var(--text2);"><span style="color:var(--info);">G</span> ${g}g</span>
        <span style="font-size:10px;color:var(--text2);"><span style="color:var(--warning);">L</span> ${l}g</span>
      </div>
    </div>`;
  };

  let nutriHtml;
  if (trainingPlan || restPlan) {
    nutriHtml = `${renderMiniNutri(trainingPlan, 'Jour entraînement')}${renderMiniNutri(restPlan, 'Jour repos')}`;
  } else {
    nutriHtml = '<div style="color:var(--text3);font-size:13px;">Aucun plan actif</div>';
  }

  // --- Bilan status ---
  const mondayDate = new Date(today);
  const dayOff = mondayDate.getDay() === 0 ? 6 : mondayDate.getDay() - 1;
  mondayDate.setDate(mondayDate.getDate() - dayOff);
  const mondayStr = toDateStr(mondayDate);
  const thisWeekReports = allReports.filter(r => r.date >= mondayStr);
  const bilanCount = thisWeekReports.length;
  const lastBilan = allReports[0];
  const bilanHtml = bilanCount > 0
    ? `<div style="font-size:14px;font-weight:600;color:var(--text);">${bilanCount} bilan${bilanCount > 1 ? 's' : ''} cette semaine</div>
       <div style="font-size:11px;color:var(--text3);margin-top:4px;">Dernier : ${lastBilan ? new Date(lastBilan.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}</div>`
    : `<div style="color:var(--text3);font-size:13px;">Aucun bilan cette semaine</div>
       ${lastBilan ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;">Dernier : ${new Date(lastBilan.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>` : ''}`;

  // ===== RENDER =====
  // Sleep color helper
  const sleepColor = avgSleep >= 7 ? '#22c55e' : avgSleep >= 5 ? '#f59e0b' : '#ef4444';
  const sleepBg = avgSleep >= 7 ? 'rgba(34,197,94,0.1)' : avgSleep >= 5 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';

  el.innerHTML = `
    <div class="ap-layout">
      <div class="ap-main">

        <!-- ═══ TOP STATS ROW ═══ -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;">

          <!-- Poids -->
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#B30808,#d41a1a);"></div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
              <div style="width:38px;height:38px;border-radius:10px;background:rgba(179,8,8,0.1);display:flex;align-items:center;justify-content:center;"><i class="fas fa-weight" style="color:#B30808;font-size:15px;"></i></div>
              <div style="font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;">Poids</div>
            </div>
            <div style="font-size:32px;font-weight:800;color:var(--text);letter-spacing:-0.03em;line-height:1;">${lastWeight || '—'}<span style="font-size:14px;font-weight:500;color:var(--text2);margin-left:4px;">kg</span></div>
            <div style="font-size:12px;color:var(--text2);margin-top:6px;">${weightDiff ? (parseFloat(weightDiff) > 0 ? '+' : '') + weightDiff + ' kg sur 30j' : '—'}</div>
          </div>

          <!-- Bilans -->
          <div onclick="switchAthleteTab('bilans')" style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;cursor:pointer;position:relative;overflow:hidden;transition:all 0.15s;">
            <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#22c55e,#4ade80);"></div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
              <div style="width:38px;height:38px;border-radius:10px;background:rgba(34,197,94,0.1);display:flex;align-items:center;justify-content:center;"><i class="fas fa-clipboard-check" style="color:#22c55e;font-size:15px;"></i></div>
              <div style="font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;">Bilans</div>
            </div>
            <div style="font-size:32px;font-weight:800;color:var(--text);letter-spacing:-0.03em;line-height:1;">${bilanCount}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:6px;">cette semaine${lastBilan ? ' · dernier ' + new Date(lastBilan.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}</div>
          </div>

          <!-- Sommeil -->
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${sleepColor},${sleepColor}88);"></div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
              <div style="width:38px;height:38px;border-radius:10px;background:${sleepBg};display:flex;align-items:center;justify-content:center;"><i class="fas fa-moon" style="color:${sleepColor};font-size:15px;"></i></div>
              <div style="font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;">Sommeil</div>
            </div>
            <div style="font-size:32px;font-weight:800;color:var(--text);letter-spacing:-0.03em;line-height:1;">${avgSleep || '—'}<span style="font-size:14px;font-weight:500;color:var(--text2);margin-left:2px;">/10</span></div>
            <div style="font-size:12px;color:var(--text2);margin-top:6px;">moyenne 7 derniers jours</div>
          </div>

          <!-- Pas -->
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#60a5fa);"></div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
              <div style="width:38px;height:38px;border-radius:10px;background:rgba(59,130,246,0.1);display:flex;align-items:center;justify-content:center;"><i class="fas fa-shoe-prints" style="color:#3b82f6;font-size:15px;"></i></div>
              <div style="font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;">Pas</div>
            </div>
            <div style="font-size:32px;font-weight:800;color:var(--text);letter-spacing:-0.03em;line-height:1;">${todaySteps ? todaySteps.toLocaleString('fr-FR') : '—'}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
              <div style="flex:1;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;"><div style="width:${stepsPct}%;height:100%;background:${stepsPct >= 100 ? '#22c55e' : '#3b82f6'};border-radius:3px;transition:width 0.5s;"></div></div>
              <span style="font-size:11px;font-weight:600;color:${stepsPct >= 100 ? '#22c55e' : 'var(--text2)'};">${stepsPct}%</span>
            </div>
          </div>
        </div>

        <!-- ═══ WEIGHT CHART ═══ -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div style="font-size:13px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px;"><i class="fas fa-chart-line" style="color:#B30808;opacity:0.7;"></i> Évolution du poids</div>
            <span style="font-size:11px;color:var(--text3);background:var(--bg3);padding:3px 10px;border-radius:8px;">30 jours</span>
          </div>
          ${weightChartHtml}
        </div>

        <!-- ═══ CHARTS ROW (Steps, Sleep, Water) ═══ -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">
          <!-- Steps chart -->
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:18px;">
            <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:12px;display:flex;align-items:center;gap:6px;"><i class="fas fa-shoe-prints" style="color:#3b82f6;font-size:11px;"></i> PAS (7J)</div>
            <div class="ap-steps-chart" id="ap-steps-chart" data-points='${JSON.stringify(stepsChartPoints)}'>
              <div style="display:flex;gap:3px;align-items:flex-end;">${stepsBarData.join('')}</div>
              <div class="ap-weight-crosshair" id="ap-steps-crosshair"></div>
              <div class="ap-weight-tooltip" id="ap-steps-tooltip"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-top:8px;">
              <span>${daysReached}/7 objectifs</span>
              <span>Moy: ${avgSteps.toLocaleString('fr-FR')}</span>
            </div>
          </div>

          <!-- Sleep chart -->
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:18px;">
            <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:12px;display:flex;align-items:center;gap:6px;"><i class="fas fa-moon" style="color:${sleepColor};font-size:11px;"></i> SOMMEIL (7J)</div>
            <div class="ap-steps-chart" id="ap-sleep-chart" data-points='${JSON.stringify(sleepChartPoints)}'>
              <div style="display:flex;gap:3px;align-items:flex-end;">${sleepBarData.join('')}</div>
              <div class="ap-weight-crosshair" id="ap-sleep-crosshair"></div>
              <div class="ap-weight-tooltip" id="ap-sleep-tooltip"></div>
            </div>
          </div>

          <!-- Water chart -->
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:18px;">
            <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:12px;display:flex;align-items:center;gap:6px;"><i class="fas fa-tint" style="color:#3b82f6;font-size:11px;"></i> EAU (7J)</div>
            <div style="display:flex;gap:3px;align-items:flex-end;">${waterBarData.join('')}</div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-top:8px;">
              <span>${daysWaterReached}/7 objectifs</span>
              <span>Obj: ${(waterGoal / 1000).toFixed(1)}L</span>
            </div>
          </div>
        </div>

        <!-- ═══ BOTTOM ROW ═══ -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">
          <!-- Roadmap -->
          <div onclick="switchAthleteTab('roadmap')" style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;cursor:pointer;transition:all 0.15s;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
              <div style="width:32px;height:32px;border-radius:8px;background:rgba(139,92,246,0.1);display:flex;align-items:center;justify-content:center;"><i class="fas fa-road" style="color:#8b5cf6;font-size:13px;"></i></div>
              <div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.4px;">Roadmap</div>
            </div>
            ${phaseHtml}
          </div>

          <!-- Programme -->
          <div onclick="switchAthleteTab('training')" style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;cursor:pointer;transition:all 0.15s;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
              <div style="width:32px;height:32px;border-radius:8px;background:rgba(245,158,11,0.1);display:flex;align-items:center;justify-content:center;"><i class="fas fa-dumbbell" style="color:#f59e0b;font-size:13px;"></i></div>
              <div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.4px;">Programme</div>
            </div>
            ${progHtml}
          </div>

          <!-- Nutrition -->
          <div onclick="switchAthleteTab('nutrition')" style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;cursor:pointer;transition:all 0.15s;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
              <div style="width:32px;height:32px;border-radius:8px;background:rgba(34,197,94,0.1);display:flex;align-items:center;justify-content:center;"><i class="fas fa-utensils" style="color:#22c55e;font-size:13px;"></i></div>
              <div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.4px;">Nutrition</div>
            </div>
            ${nutriHtml}
          </div>
        </div>

      </div>

      <!-- ═══ ACTIVITY SIDEBAR ═══ -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;overflow:hidden;">
        <div style="padding:16px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">
          <div style="width:28px;height:28px;border-radius:7px;background:rgba(179,8,8,0.1);display:flex;align-items:center;justify-content:center;"><i class="fas fa-bolt" style="color:#B30808;font-size:11px;"></i></div>
          <span style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.4px;">Activité</span>
        </div>
        <div class="ap-activity-scroll" style="padding:8px;max-height:600px;overflow-y:auto;">${activityHtml}</div>
      </div>
    </div>`;

  // Interactive chart tooltips
  initWeightChart();
  initStepsTooltip();
  initSleepTooltip();

  // Match activity height to main column
  const mainCol = el.querySelector('.ap-main');
  const activityCard = el.querySelector('.ap-card-activity');
  if (mainCol && activityCard) {
    activityCard.style.maxHeight = mainCol.offsetHeight + 'px';
  }
}

function clampTooltip(tooltip, leftPx, containerWidth) {
  tooltip.style.left = leftPx + 'px';
  tooltip.style.display = 'block';
  tooltip.style.transform = 'translateX(-50%)';
  // After render, check if tooltip overflows
  const tw = tooltip.offsetWidth;
  const half = tw / 2;
  if (leftPx - half < 0) {
    tooltip.style.transform = 'translateX(0)';
    tooltip.style.left = '0px';
  } else if (leftPx + half > containerWidth) {
    tooltip.style.transform = 'translateX(-100%)';
    tooltip.style.left = containerWidth + 'px';
  }
}

let _apWeightChart = null;

function initWeightChart() {
  const ctx = document.getElementById('ap-weight-canvas');
  if (!ctx || !window._apWeightChartData) return;
  if (_apWeightChart) _apWeightChart.destroy();

  const { labels, data } = window._apWeightChartData;
  const grd = ctx.getContext('2d').createLinearGradient(0, 0, 0, 160);
  grd.addColorStop(0, 'rgba(179,8,8,0.2)');
  grd.addColorStop(1, 'rgba(179,8,8,0)');

  _apWeightChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#B30808',
        backgroundColor: grd,
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: '#B30808',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        spanGaps: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.85)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          displayColors: false,
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => item.parsed.y != null ? item.parsed.y + ' kg' : 'Pas de données',
          },
        },
      },
      scales: {
        x: {
          display: true,
          grid: { display: false },
          ticks: {
            color: '#55555e',
            font: { size: 10 },
            maxTicksLimit: 5,
            maxRotation: 0,
          },
        },
        y: {
          display: true,
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: {
            color: '#55555e',
            font: { size: 10 },
            callback: (v) => v + ' kg',
            maxTicksLimit: 4,
          },
        },
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
    },
  });
}

function initStepsTooltip() {
  const chart = document.getElementById('ap-steps-chart');
  const crosshair = document.getElementById('ap-steps-crosshair');
  const tooltip = document.getElementById('ap-steps-tooltip');
  if (!chart || !crosshair || !tooltip) return;

  let points;
  try { points = JSON.parse(chart.getAttribute('data-points')); } catch (e) { return; }
  if (!points.length) return;

  chart.addEventListener('mousemove', (e) => {
    const rect = chart.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;

    // 7 bars evenly spaced — find nearest
    const idx = Math.max(0, Math.min(6, Math.round(xPct * 6)));
    const pt = points[idx];

    // Crosshair at center of that bar
    const centerX = ((idx + 0.5) / 7) * rect.width;
    crosshair.style.left = centerX + 'px';
    crosshair.style.display = 'block';

    // Tooltip (clamped)
    tooltip.textContent = `${pt.steps.toLocaleString('fr-FR')} pas — ${pt.day}`;
    clampTooltip(tooltip, centerX, rect.width);
  });

  chart.addEventListener('mouseleave', () => {
    crosshair.style.display = 'none';
    tooltip.style.display = 'none';
  });
}

function initSleepTooltip() {
  const chart = document.getElementById('ap-sleep-chart');
  const crosshair = document.getElementById('ap-sleep-crosshair');
  const tooltip = document.getElementById('ap-sleep-tooltip');
  if (!chart || !crosshair || !tooltip) return;

  let points;
  try { points = JSON.parse(chart.getAttribute('data-points')); } catch (e) { return; }
  if (!points.length) return;

  chart.addEventListener('mousemove', (e) => {
    const rect = chart.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const idx = Math.max(0, Math.min(6, Math.round(xPct * 6)));
    const pt = points[idx];

    const centerX = ((idx + 0.5) / 7) * rect.width;
    crosshair.style.left = centerX + 'px';
    crosshair.style.display = 'block';

    tooltip.textContent = pt.quality != null ? `${pt.quality}/10 — ${pt.day}` : `— ${pt.day}`;
    clampTooltip(tooltip, centerX, rect.width);
  });

  chart.addEventListener('mouseleave', () => {
    crosshair.style.display = 'none';
    tooltip.style.display = 'none';
  });
}
