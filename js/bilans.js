// ===== BILANS TAB =====

async function loadAthleteTabBilans() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  if (!currentAthleteObj) {
    el.innerHTML = '<div class="card"><div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Athlète non sélectionné</p></div></div>';
    return;
  }

  const { data: bilans, error } = await supabaseClient
    .from('daily_reports')
    .select('*')
    .eq('user_id', currentAthleteObj.user_id)
    .order('date', { ascending: false });

  if (error) {
    el.innerHTML = `<div class="card"><div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Erreur: ${error.message}</p></div></div>`;
    return;
  }

  if (!bilans?.length) {
    el.innerHTML = '<div class="card"><div class="empty-state"><i class="fas fa-chart-line"></i><p>Aucun bilan enregistré</p><p style="font-size:12px;color:var(--text3);margin-top:8px;">L\'athlète doit remplir ses check-ins journaliers.</p></div></div>';
    return;
  }

  const weeks = {};
  bilans.forEach(b => {
    const date = new Date(b.date);
    const week = getWeekNumber(date);
    const key = `${date.getFullYear()}-S${week}`;
    if (!weeks[key]) weeks[key] = [];
    weeks[key].push(b);
  });

  const NCOLS = 18;
  let tableHtml = `
    <div class="card" style="padding:0;">
      <div style="overflow-x:auto;">
        <table class="bilans-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Poids</th>
              <th>Adhérence</th>
              <th>Séances</th>
              <th>Perf./Plaisir</th>
              <th>Cardio</th>
              <th>Pas/NEAT</th>
              <th>Courbatures</th>
              <th>Stress</th>
              <th>Énergie</th>
              <th>Maladie</th>
              <th>Coucher</th>
              <th>Réveil</th>
              <th>Eff. sommeil</th>
              <th>Qual. sommeil</th>
              <th>Positif</th>
              <th>Négatif</th>
              <th>Général</th>
            </tr>
          </thead>
          <tbody>`;

  Object.keys(weeks).sort().reverse().forEach(weekKey => {
    const wb = weeks[weekKey];
    wb.forEach(b => {
      tableHtml += `
        <tr>
          <td>${new Date(b.date).toLocaleDateString('fr-FR')}</td>
          <td>${b.weight ?? '-'}</td>
          <td>${b.adherence ?? '-'}</td>
          <td>${b.sessions_executed ?? '-'}</td>
          <td>${b.enjoyment ?? '-'}</td>
          <td>${b.cardio_minutes ?? '-'}</td>
          <td>${b.steps ?? '-'}</td>
          <td>${b.soreness ?? '-'}</td>
          <td>${b.stress ?? '-'}</td>
          <td>${b.energy ?? '-'}</td>
          <td>${b.illness_signs ?? '-'}</td>
          <td>${b.bedtime ?? '-'}</td>
          <td>${b.wake_time ?? '-'}</td>
          <td>${b.sleep_efficiency ?? '-'}</td>
          <td>${b.sleep_quality ?? '-'}</td>
          <td>${b.positives ? '✓' : '-'}</td>
          <td>${b.negatives ? '✓' : '-'}</td>
          <td>${b.general_notes ? '📝' : '-'}</td>
        </tr>`;
    });

    tableHtml += `
      <tr class="week-avg">
        <td>Moy. ${weekKey}</td>
        <td>${avgWeek(wb,'weight')}</td>
        <td>${avgWeek(wb,'adherence')}</td>
        <td>${avgWeek(wb,'sessions_executed')}</td>
        <td>${avgWeek(wb,'enjoyment')}</td>
        <td>${avgWeek(wb,'cardio_minutes')}</td>
        <td>${avgWeek(wb,'steps')}</td>
        <td>${avgWeek(wb,'soreness')}</td>
        <td>${avgWeek(wb,'stress')}</td>
        <td>${avgWeek(wb,'energy')}</td>
        <td>-</td><td>-</td><td>-</td>
        <td>${avgWeek(wb,'sleep_efficiency')}</td>
        <td>${avgWeek(wb,'sleep_quality')}</td>
        <td>-</td><td>-</td><td>-</td>
      </tr>
      <tr class="week-spacer"><td colspan="${NCOLS}"></td></tr>`;
  });

  tableHtml += '</tbody></table></div></div>';
  el.innerHTML = tableHtml;
}
