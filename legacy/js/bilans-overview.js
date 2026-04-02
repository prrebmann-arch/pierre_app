// ===== BILANS OVERVIEW (Coach view — all athletes) =====

let _bilansFilter = 'all';

async function loadBilansOverview() {
  const el = document.getElementById('bilans-overview-content');
  if (!el) return;
  el.innerHTML = '<div class="text-center" style="padding:60px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

  const coachId = currentUser?.id;
  if (!coachId) return;

  // Load athletes + recent reports
  const [{ data: athletes }, { data: reports }] = await Promise.all([
    supabaseClient.from('athletes').select('id, user_id, prenom, nom, bilan_frequency, bilan_interval, bilan_day, bilan_month_day, bilan_anchor_date, complete_bilan_frequency, complete_bilan_interval, complete_bilan_day, complete_bilan_month_day, complete_bilan_anchor_date').eq('coach_id', coachId).order('prenom'),
    supabaseClient.from('daily_reports').select('id, user_id, date, weight, energy, sleep_quality, stress, adherence, sessions_executed, session_performance, steps').order('date', { ascending: false }).limit(1000),
  ]);

  const athletesList = athletes || [];
  const allReports = reports || [];
  const now = new Date();
  const today = toDateStr(now);

  // Build athlete map
  const athleteMap = {};
  athletesList.forEach(a => { if (a.user_id) athleteMap[a.user_id] = a; });

  // Monday of this week
  const monday = new Date(now);
  const dayOff = monday.getDay() === 0 ? 6 : monday.getDay() - 1;
  monday.setDate(monday.getDate() - dayOff);
  const mondayStr = toDateStr(monday);

  // Categorize per athlete — based on complete_bilan config
  const athleteData = athletesList.map(a => {
    if (!a.user_id) return null;
    const myReports = allReports.filter(r => r.user_id === a.user_id);

    const freq = a.complete_bilan_frequency || 'weekly';
    const intv = a.complete_bilan_interval || 7;
    const day = a.complete_bilan_day ?? 0;
    const anchor = a.complete_bilan_anchor_date;
    const mDay = a.complete_bilan_month_day || 1;

    // Find last expected complete bilan date (looking back)
    const lastExpected = getLastExpectedBilanDate(freq, intv, day, anchor, mDay);
    // Find next expected
    const nextExpected = getNextBilanDate(freq, intv, day, anchor, mDay);

    const expectedStr = lastExpected || nextExpected || today;
    const isPast = expectedStr <= today;

    const bilanReport = myReports.find(r => r.date === expectedStr) || null;
    const lastBilanReport = myReports.find(r => r.weight || r.photo_front || r.photo_side || r.photo_back) || null;

    let status;
    if (freq === 'none') {
      status = 'upcoming'; // disabled = always "à venir"
    } else if (bilanReport) {
      status = 'done';
    } else if (isPast) {
      status = 'late';
    } else {
      status = 'upcoming';
    }

    return { athlete: a, status, bilanReport, lastBilanReport, expectedStr };
  }).filter(Boolean);

  // Counts
  const counts = { all: athleteData.length, done: 0, late: 0, upcoming: 0 };
  athleteData.forEach(d => { counts[d.status]++; });

  window._bilansOverviewData = athleteData;
  renderBilansOverview(el, athleteData, counts);
}

function renderBilansOverview(el, data, counts) {
  const filter = _bilansFilter;
  const filtered = filter === 'all' ? data : data.filter(d => d.status === filter);

  // Sort: late first, then done, then upcoming
  const order = { late: 0, done: 1, upcoming: 2 };
  filtered.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

  const filterBtns = [
    { key: 'all', label: 'Tous', color: '', icon: '' },
    { key: 'done', label: 'À traiter', color: 'var(--primary)', icon: 'fa-clipboard-check' },
    { key: 'late', label: 'En retard', color: 'var(--danger)', icon: 'fa-exclamation-circle' },
    { key: 'upcoming', label: 'À venir', color: 'var(--text3)', icon: 'fa-clock' },
  ];

  const filtersHtml = filterBtns.map(f => {
    const count = counts[f.key] || 0;
    const active = filter === f.key;
    return `<button class="bo-filter ${active ? 'active' : ''}" style="${active && f.color ? '--bo-color:'+f.color+';' : ''}" onclick="_bilansFilter='${f.key}';renderBilansOverview(document.getElementById('bilans-overview-content'), window._bilansOverviewData, ${JSON.stringify(counts)})">
      ${f.icon ? `<i class="fas ${f.icon}"></i> ` : ''}${f.label}
      <span class="bo-count">${count}</span>
    </button>`;
  }).join('');

  const statusBadge = (status) => {
    if (status === 'done') return '<span class="bo-status bo-status-done"><i class="fas fa-check"></i> Soumis</span>';
    if (status === 'late') return '<span class="bo-status bo-status-late"><i class="fas fa-exclamation-circle"></i> En retard</span>';
    return '<span class="bo-status bo-status-upcoming"><i class="fas fa-clock"></i> À venir</span>';
  };

  const rowsHtml = filtered.length ? filtered.map(d => {
    const a = d.athlete;
    const initials = (a.prenom?.charAt(0) || '') + (a.nom?.charAt(0) || '');
    const lastBilanDate = d.lastBilanReport?.date;
    const lastDateStr = lastBilanDate
      ? new Date(lastBilanDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
    const echeanceStr = new Date(d.expectedStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    const bilanInfo = d.bilanReport
      ? `${d.bilanReport.weight ? d.bilanReport.weight + ' kg' : 'Soumis'}`
      : '—';

    return `
      <tr class="bo-row" onclick="openAthleteBilans('${a.id}')">
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="bo-avatar">${initials}</div>
            <span style="font-weight:600;color:var(--text);">${escHtml(a.prenom)} ${escHtml(a.nom)}</span>
          </div>
        </td>
        <td>${statusBadge(d.status)}</td>
        <td style="color:var(--text2);">${bilanInfo}</td>
        <td style="color:var(--text3);">Échéance: ${echeanceStr}</td>
        <td style="color:var(--text3);">${lastBilanDate ? lastDateStr : '—'}</td>
        <td style="white-space:nowrap;">
          ${d.status === 'done' ? `<button class="bo-action-btn" style="color:var(--success);" onclick="event.stopPropagation();openBilanTraitePopup('${a.user_id}','${escHtml(a.prenom)}')" title="Bilan traité"><i class="fas fa-check"></i></button>` : ''}
          <button class="bo-action-btn" onclick="event.stopPropagation();openAthleteBilans('${a.id}')"><i class="fas fa-eye"></i></button>
        </td>
      </tr>`;
  }).join('') : `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text3);font-size:13px;">Aucun bilan dans cette catégorie</td></tr>`;

  el.innerHTML = `
    <div style="margin-bottom:24px;">
      <h1 style="font-size:22px;font-weight:700;color:var(--text);margin-bottom:6px;">Bilans</h1>
      <p style="font-size:13px;color:var(--text3);">Suivez la progression de vos athlètes</p>
    </div>

    <div class="bo-filters">${filtersHtml}</div>

    <div class="bo-table-wrap">
      <table class="bo-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Statut</th>
            <th>Poids</th>
            <th>Échéance</th>
            <th>Dernier bilan</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
}

// ── Bilan traité popup ──
const _bilanTraiteMessages = [
  "Bon bilan, pas de changement, donne-toi à fond !",
  "Très beau résultat, continue comme ça !",
  "Bilan correct, on garde le cap !",
  "Super progression, rien à modifier !",
  "RAS, on continue sur cette lancée !"
];

function openBilanTraitePopup(userId, prenom) {
  // Remove any existing popup
  closeBilanTraitePopup();

  const chipsHtml = _bilanTraiteMessages.map((msg, i) =>
    `<button type="button" class="bt-chip ${i === 0 ? 'active' : ''}" onclick="selectBtChip(this)" data-msg="${escHtml(msg)}">${escHtml(msg)}</button>`
  ).join('');

  const popup = document.createElement('div');
  popup.id = 'bilan-traite-popup';
  popup.className = 'bt-popup-overlay';
  popup.onclick = (e) => { if (e.target === popup) closeBilanTraitePopup(); };
  popup.innerHTML = `
    <div class="bt-popup">
      <div class="bt-popup-header">
        <div class="bt-popup-title">
          <div class="bt-popup-avatar">${escHtml(prenom.charAt(0))}</div>
          <div>
            <div style="font-weight:700;font-size:15px;">Retour bilan</div>
            <div style="font-size:12px;color:var(--text3);font-weight:400;">${escHtml(prenom)}</div>
          </div>
        </div>
        <button class="bt-close" onclick="closeBilanTraitePopup()"><i class="fas fa-times"></i></button>
      </div>
      <div class="bt-popup-body">
        <div class="bt-section-label"><i class="fas fa-comment-dots"></i> Message rapide</div>
        <div class="bt-chips">${chipsHtml}</div>

        <div class="bt-section-label" style="margin-top:16px;"><i class="fas fa-pen"></i> Ou message libre</div>
        <input type="text" id="bt-custom-msg" class="bt-input" placeholder="Écrivez votre message…" onfocus="document.querySelectorAll('.bt-chip').forEach(c=>c.classList.remove('active'))">

        <div class="bt-divider"></div>

        <div class="bt-extras">
          <div class="bt-extra-item">
            <div class="bt-section-label" style="margin:0;"><i class="fas fa-video"></i> Lien Loom</div>
            <input type="url" id="bt-loom-url" class="bt-input" placeholder="https://www.loom.com/share/...">
          </div>
          <div class="bt-extra-item">
            <div class="bt-section-label" style="margin:0;"><i class="fas fa-microphone"></i> Message vocal</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <button type="button" class="bt-mic-btn" id="bt-mic-btn" onclick="toggleBtVoice('${userId}')">
                <i class="fas fa-microphone" id="bt-mic-icon"></i>
                <span id="bt-mic-label">Enregistrer</span>
              </button>
              <div id="bt-audio-player" style="flex:1;"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="bt-popup-footer">
        <button class="btn btn-outline btn-sm" onclick="closeBilanTraitePopup()">Annuler</button>
        <button class="btn btn-red" onclick="sendBilanTraite('${userId}')"><i class="fas fa-paper-plane" style="margin-right:6px;"></i>Envoyer</button>
      </div>
    </div>`;
  document.body.appendChild(popup);
}

function closeBilanTraitePopup() {
  const el = document.getElementById('bilan-traite-popup');
  if (el) el.remove();
}

function selectBtChip(btn) {
  btn.parentElement.querySelectorAll('.bt-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const customInput = document.getElementById('bt-custom-msg');
  if (customInput) customInput.value = '';
}

// ── Bilan traité vocal ──
let _btRecorder = null;
let _btChunks = [];
let _btTimer = null;
let _btSeconds = 0;
let _btAudioUrl = null;

async function toggleBtVoice(userId) {
  if (_btRecorder && _btRecorder.state === 'recording') {
    _btRecorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _btChunks = [];
    _btSeconds = 0;
    const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
    const ext = mimeType === 'audio/mp4' ? 'mp4' : 'webm';
    _btRecorder = new MediaRecorder(stream, { mimeType });

    _btRecorder.ondataavailable = e => { if (e.data.size > 0) _btChunks.push(e.data); };
    _btRecorder.onstop = async () => {
      clearInterval(_btTimer);
      stream.getTracks().forEach(t => t.stop());
      const icon = document.getElementById('bt-mic-icon');
      const lbl = document.getElementById('bt-mic-label');
      const btn = document.getElementById('bt-mic-btn');
      if (icon) { icon.className = 'fas fa-microphone'; icon.style.color = ''; }
      if (lbl) lbl.textContent = 'Vocal';
      if (btn) btn.style.borderColor = '';

      const blob = new Blob(_btChunks, { type: mimeType });
      if (blob.size < 500) return;

      const path = `${currentUser.id}/bilan_${userId}_${Date.now()}.${ext}`;
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
      const { error } = await supabaseClient.storage.from('coach-audio').upload(path, blob, { contentType: mimeType, upsert: true });
      if (error) { handleError(error, 'btVoice'); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-microphone"></i> Enregistrer'; } return; }
      const { data: signedData } = await supabaseClient.storage.from('coach-audio').createSignedUrl(path, 31536000);
      _btAudioUrl = signedData?.signedUrl || null;
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-microphone"></i> Enregistrer'; }

      const playerEl = document.getElementById('bt-audio-player');
      if (playerEl && _btAudioUrl) {
        playerEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px;">
            <audio controls src="${escHtml(_btAudioUrl)}" style="height:32px;flex:1;"></audio>
            <button type="button" class="btn btn-outline btn-sm" onclick="_btAudioUrl=null;document.getElementById('bt-audio-player').innerHTML=''" style="padding:3px 6px;color:var(--danger);"><i class="fas fa-trash"></i></button>
          </div>`;
      }
    };

    _btRecorder.start();
    const icon = document.getElementById('bt-mic-icon');
    const lbl = document.getElementById('bt-mic-label');
    const btn = document.getElementById('bt-mic-btn');
    if (icon) { icon.className = 'fas fa-stop'; icon.style.color = 'var(--danger)'; }
    if (lbl) lbl.textContent = '0:00';
    if (btn) btn.style.borderColor = 'var(--danger)';
    _btTimer = setInterval(() => {
      _btSeconds++;
      const l = document.getElementById('bt-mic-label');
      if (l) l.textContent = `${Math.floor(_btSeconds / 60)}:${String(_btSeconds % 60).padStart(2, '0')}`;
    }, 1000);
  } catch (err) {
    notify('Impossible d\'accéder au micro', 'error');
  }
}

async function sendBilanTraite(userId) {
  const customInput = document.getElementById('bt-custom-msg');
  const customMsg = customInput?.value?.trim();
  const active = document.querySelector('#bilan-traite-popup .bt-chip.active');
  const loomUrl = document.getElementById('bt-loom-url')?.value?.trim() || null;
  const hasAudio = !!_btAudioUrl;

  if (!active && !customMsg && !hasAudio && !loomUrl) {
    notify('Ajoutez un message, vocal ou lien Loom', 'error');
    return;
  }

  const msg = customMsg || (active ? active.dataset.msg : 'Bilan vérifié');
  const body = 'Ton bilan a été vérifié : ' + msg.charAt(0).toLowerCase() + msg.slice(1);

  // Find athlete_id from userId
  const athleteId = currentAthleteId || (athletesList || []).find(a => a.user_id === userId)?.id;

  // Save in bilan_retours so it appears in the Retours tab
  if (athleteId) {
    await supabaseClient.from('bilan_retours').insert({
      athlete_id: athleteId,
      coach_id: currentUser.id,
      loom_url: loomUrl,
      titre: 'Bilan traité',
      commentaire: msg,
      audio_url: hasAudio ? _btAudioUrl : null,
      type: loomUrl ? (hasAudio ? 'mixed' : 'loom') : (hasAudio ? 'audio' : 'message')
    });
  }

  // Notify athlete
  const meta = {};
  if (hasAudio) meta.audio_url = _btAudioUrl;
  if (loomUrl) meta.loom_url = loomUrl;
  await notifyAthlete(userId, 'bilan', 'Bilan traité', body, meta);

  _btAudioUrl = null;
  closeBilanTraitePopup();
  notify('Notification envoyée !', 'success');
}

function openAthleteBilans(athleteId) {
  const a = (typeof athletesList !== 'undefined' ? athletesList : []).find(x => x.id === athleteId);
  if (!a) { showSection('athletes'); return; }
  currentAthleteId = a.id;
  currentAthleteObj = a;
  document.getElementById('athlete-detail-name').textContent = a.prenom + ' ' + a.nom;
  showSection('athlete-detail');
  setTimeout(() => switchAthleteTab('bilans'), 50);
}
