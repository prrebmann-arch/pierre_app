// ===== ATHLETES MANAGEMENT =====

function _dayLabel(day) {
  if (Array.isArray(day)) return day.map(d => JOURS_SEMAINE[d] || '?').join(' & ');
  return JOURS_SEMAINE[day] || '';
}

function _formatBilanLabel(freq, interval, day, monthDay, notifTime) {
  let s = formatFrequency(freq, interval);
  if (['weekly','biweekly'].includes(freq) && day != null) s += ' — ' + _dayLabel(day);
  if (freq === 'monthly' && monthDay) s += ' — le ' + monthDay + ' du mois';
  if (notifTime) s += ' · ' + notifTime;
  return s;
}

async function loadAthletes() {
  const [{ data, error }, { data: phases }] = await Promise.all([
    supabaseClient.from('athletes').select('*').eq('coach_id', currentUser.id).order('created_at', { ascending: false }),
    supabaseClient.from('roadmap_phases').select('athlete_id, phase, name').eq('coach_id', currentUser.id).eq('status', 'en_cours'),
  ]);

  if (error) {
    handleError(error, 'loadAthletes');
    return;
  }

  // Attach active phase to each athlete
  const phaseMap = {};
  (phases || []).forEach(p => { if (!phaseMap[p.athlete_id]) phaseMap[p.athlete_id] = p; });

  athletesList = (data || []).map(a => ({ ...a, _phase: phaseMap[a.id] || null }));
  renderAthletes();
  updateAthleteSelects();

  const countLabel = document.getElementById('athletes-count-label');
  if (countLabel) countLabel.textContent = `${athletesList.length} athlète${athletesList.length > 1 ? 's' : ''} enregistré${athletesList.length > 1 ? 's' : ''}`;
}

function renderAthletes() {
  const container = document.getElementById('athletes-list');

  if (!athletesList.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Aucun athlète</p></div>';
    return;
  }

  container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:20px;">${athletesList.map(athlete => {
    const initials = (athlete.prenom?.charAt(0) || '') + (athlete.nom?.charAt(0) || '');
    const avatar = athlete.avatar_url
      ? `<img src="${escHtml(athlete.avatar_url)}" style="width:52px;height:52px;border-radius:16px;object-fit:cover;border:2px solid var(--border);">`
      : `<div style="width:52px;height:52px;border-radius:16px;background:linear-gradient(135deg,var(--bg3),var(--bg4));border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:var(--text2);">${initials}</div>`;
    const poids = athlete.poids_actuel ? `${athlete.poids_actuel} kg` : '—';
    const activePhase = athlete._phase;
    const phaseInfo = activePhase?.phase && typeof PROG_PHASES !== 'undefined' ? PROG_PHASES[activePhase.phase] : null;
    const phaseLabel = phaseInfo ? phaseInfo.label : (activePhase?.name || '');
    const phaseColor = phaseInfo ? phaseInfo.color : 'var(--primary)';

    return `<div onclick="openAthleteDetail('${athlete.id}')" style="background:var(--bg2);border:1px solid var(--glass-border);border-radius:20px;padding:24px;cursor:pointer;transition:all 0.3s cubic-bezier(0.22,1,0.36,1);position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${phaseInfo ? phaseColor : 'var(--border)'};opacity:${phaseInfo ? 0.8 : 0.3};"></div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
        ${avatar}
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(athlete.prenom)} ${escHtml(athlete.nom)}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(athlete.email || '')}</div>
        </div>
        ${phaseLabel ? `<span style="font-size:10px;font-weight:700;color:${phaseColor};background:${phaseColor}18;padding:4px 10px;border-radius:8px;white-space:nowrap;letter-spacing:0.3px;">${escHtml(phaseLabel)}</span>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:16px;font-weight:800;color:var(--text);line-height:1;">${poids}</div>
          <div style="font-size:10px;color:var(--text2);margin-top:3px;text-transform:uppercase;letter-spacing:0.3px;">Poids</div>
        </div>
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:16px;font-weight:800;color:var(--text);line-height:1;">${athlete.poids_objectif ? athlete.poids_objectif + ' kg' : '—'}</div>
          <div style="font-size:10px;color:var(--text2);margin-top:3px;text-transform:uppercase;letter-spacing:0.3px;">Objectif</div>
        </div>
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:16px;font-weight:800;color:${phaseInfo ? phaseColor : 'var(--text)'};line-height:1;">${phaseInfo ? phaseInfo.short : '—'}</div>
          <div style="font-size:10px;color:var(--text2);margin-top:3px;text-transform:uppercase;letter-spacing:0.3px;">Phase</div>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function openAthleteDetail(athleteId) {
  currentAthleteId = athleteId;
  currentAthleteObj = athletesList.find(a => a.id === athleteId);
  if (!currentAthleteObj) return;

  document.getElementById('athlete-detail-name').textContent = `${currentAthleteObj.prenom} ${currentAthleteObj.nom}`;
  showSection('athlete-detail');
  switchAthleteTab('apercu');
}

function updateAthleteSelects() {
  ['programme-athlete', 'nutrition-athlete'].forEach(selectId => {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">Sélectionner un athlète</option>' +
      athletesList.map(a => `<option value="${a.id}">${a.prenom} ${a.nom}</option>`).join('');
  });
}

// ===== AVATAR UPLOAD =====

async function uploadAthleteAvatar(input) {
  const file = input.files?.[0];
  if (!file || !currentAthleteId) return;
  if (!validateFile(file, 'image')) return;

  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${currentAthleteId}/avatar_${Date.now()}.${ext}`;

  // Show loading on avatar
  const avatarEl = document.getElementById('athlete-avatar-img');
  if (avatarEl) avatarEl.style.opacity = '0.4';

  const { error: uploadErr } = await supabaseClient.storage
    .from('athlete-avatars')
    .upload(path, file, { upsert: true });

  if (uploadErr) {
    handleError(uploadErr, 'avatar upload');
    if (avatarEl) avatarEl.style.opacity = '1';
    return;
  }

  const { data: urlData } = supabaseClient.storage.from('athlete-avatars').getPublicUrl(path);
  const publicUrl = urlData?.publicUrl;

  if (!publicUrl) {
    notify('Erreur lors de la génération de l\'URL', 'error');
    if (avatarEl) avatarEl.style.opacity = '1';
    return;
  }

  const { error: updateErr } = await supabaseClient
    .from('athletes')
    .update({ avatar_url: publicUrl })
    .eq('id', currentAthleteId);

  if (updateErr) {
    handleError(updateErr, 'avatar update');
    if (avatarEl) avatarEl.style.opacity = '1';
    return;
  }

  // Update local state
  currentAthleteObj.avatar_url = publicUrl;
  const idx = athletesList.findIndex(a => a.id === currentAthleteId);
  if (idx >= 0) athletesList[idx].avatar_url = publicUrl;

  // Refresh the avatar visually
  if (avatarEl) {
    if (avatarEl.tagName === 'IMG') {
      avatarEl.src = publicUrl;
      avatarEl.style.opacity = '1';
    } else {
      avatarEl.outerHTML = `<img id="athlete-avatar-img" src="${escHtml(publicUrl)}" style="width:80px;height:80px;border-radius:20px;object-fit:cover;border:3px solid var(--border);cursor:pointer;" onclick="document.getElementById('avatar-upload').click()" title="Changer la photo">`;
    }
  }

  notify('Photo mise à jour !', 'success');
  input.value = '';
}

// ===== ATHLETE INFO TAB =====

let _currentOnboarding = null;
let _currentWorkflow = null;

async function loadAthleteTabInfos() {
  devLog('[INFOS] loadAthleteTabInfos CALLED — v2');
  const el = document.getElementById('athlete-tab-content');
  const a = currentAthleteObj;
  el.innerHTML = '<div class="text-center" style="padding:60px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

  // Load onboarding data (try user_id first, fallback to athlete id)
  _currentOnboarding = null;
  _currentWorkflow = null;
  if (a.user_id || a.id) {
    let ob = null;
    // Try with user_id
    const r1 = await supabaseClient
      .from('athlete_onboarding').select('*').eq('athlete_id', a.user_id).limit(1);
    devLog('[ONBOARDING] user_id query:', a.user_id, r1.data, r1.error);
    ob = r1.data?.[0] || null;
    // Fallback: try with athletes.id
    if (!ob) {
      const r2 = await supabaseClient
        .from('athlete_onboarding').select('*').eq('athlete_id', a.id).limit(1);
      devLog('[ONBOARDING] athlete.id query:', a.id, r2.data, r2.error);
      ob = r2.data?.[0] || null;
    }
    _currentOnboarding = ob;
    if (ob?.workflow_id) {
      const { data: wf } = await supabaseClient
        .from('onboarding_workflows').select('*').eq('id', ob.workflow_id).single();
      _currentWorkflow = wf;
    }
  }

  const objectifLabels = { perte_de_poids: 'Perte de poids', prise_de_masse: 'Prise de masse', maintenance: 'Maintenance', recomposition: 'Recomposition', performance: 'Performance' };
  const objLabel = objectifLabels[a.objectif] || a.objectif || '—';
  const bilanFreqLabel = _formatBilanLabel(a.bilan_frequency || 'daily', a.bilan_interval, a.bilan_day, a.bilan_month_day, a.bilan_notif_time);
  const completeFreqLabel = _formatBilanLabel(a.complete_bilan_frequency || 'weekly', a.complete_bilan_interval, a.complete_bilan_day, a.complete_bilan_month_day, a.complete_bilan_notif_time);

  const r = (icon, label, value) => `
    <div class="info-row">
      <span class="info-label"><i class="fas ${icon}" style="width:16px;color:var(--text3);margin-right:6px;"></i>${label}</span>
      <span class="info-value">${value || '—'}</span>
    </div>`;

  // --- Onboarding section ---
  let onboardingHtml = '';
  if (_currentWorkflow && _currentOnboarding) {
    const steps = typeof _currentWorkflow.steps === 'string' ? JSON.parse(_currentWorkflow.steps) : (_currentWorkflow.steps || []);
    const completed = _currentOnboarding.steps_completed || [];
    const responses = typeof _currentOnboarding.responses === 'string' ? JSON.parse(_currentOnboarding.responses) : (_currentOnboarding.responses || {});

    const isDone = (idx, step) =>
      completed.includes(idx) || completed.includes(String(idx)) ||
      completed.includes(step.position) || completed.includes(String(step.position));

    const stepTypeInfo = { video: { icon: 'fa-play-circle', color: '#3b82f6' }, contract: { icon: 'fa-file-signature', color: '#f59e0b' }, questionnaire: { icon: 'fa-clipboard-list', color: '#8b5cf6' }, formation: { icon: 'fa-graduation-cap', color: '#22c55e' } };

    const stepsHtml = steps.map((step, idx) => {
      const done = isDone(idx, step);
      const info = stepTypeInfo[step.type] || { icon: 'fa-circle', color: 'var(--text3)' };
      let statusHtml, contentHtml = '';

      if (step.type === 'contract') {
        statusHtml = done
          ? '<span class="ob-badge ob-badge-done"><i class="fas fa-check"></i> Signé</span>'
          : '<span class="ob-badge ob-badge-pending"><i class="fas fa-clock"></i> En attente</span>';
        if (done) {
          contentHtml = `<div class="ob-step-content">
            <button class="btn btn-outline btn-sm" onclick="downloadContractPdf(${idx})">
              <i class="fas fa-download" style="margin-right:4px;"></i> Télécharger le contrat PDF
            </button>
          </div>`;
        }
      } else if (step.type === 'video') {
        statusHtml = done
          ? '<span class="ob-badge ob-badge-done"><i class="fas fa-check"></i> Vu</span>'
          : '<span class="ob-badge ob-badge-pending"><i class="fas fa-clock"></i> Non vu</span>';
      } else if (step.type === 'questionnaire') {
        statusHtml = done
          ? '<span class="ob-badge ob-badge-done"><i class="fas fa-check"></i> Complété</span>'
          : '<span class="ob-badge ob-badge-pending"><i class="fas fa-clock"></i> Non complété</span>';
        if (done && step.questions?.length) {
          const stepResp = responses[idx] || responses[String(idx)] || responses[step.position] || responses[String(step.position)] || {};
          contentHtml = `<div class="ob-step-content"><div class="ob-answers">
            ${step.questions.map((q, qi) => {
              const ans = stepResp[qi] || stepResp[String(qi)] || stepResp[q.label] || '—';
              return `<div class="ob-answer">
                <div class="ob-answer-q"><i class="fas fa-question-circle" style="color:var(--text3);margin-right:4px;font-size:10px;"></i>${escHtml(q.label)}</div>
                <div class="ob-answer-a">${escHtml(String(ans))}</div>
              </div>`;
            }).join('')}
          </div></div>`;
        }
      } else if (step.type === 'formation') {
        statusHtml = done
          ? '<span class="ob-badge ob-badge-done"><i class="fas fa-check"></i> Terminée</span>'
          : '<span class="ob-badge ob-badge-pending"><i class="fas fa-clock"></i> Non commencée</span>';
      }

      return `
        <div class="ob-step">
          <div class="ob-step-marker" style="background:${done ? info.color : 'var(--bg4)'};"><i class="fas ${info.icon}" style="color:${done ? '#fff' : 'var(--text3)'};font-size:12px;"></i></div>
          <div class="ob-step-body">
            <div class="ob-step-header">
              <div class="ob-step-title">${escHtml(step.title || (stepTypeInfo[step.type] ? '' : step.type))}</div>
              ${statusHtml}
            </div>
            ${contentHtml}
          </div>
        </div>`;
    }).join('');

    const doneCount = steps.filter((s, i) => isDone(i, s)).length;
    const pct = Math.round((doneCount / steps.length) * 100);

    onboardingHtml = `
      <div class="ob-section">
        <div class="ob-header">
          <div>
            <div class="ob-title"><i class="fas fa-route" style="color:var(--primary);margin-right:8px;"></i>Onboarding — ${escHtml(_currentWorkflow.name)}</div>
            <div class="ob-subtitle">${doneCount}/${steps.length} étapes · ${pct === 100 ? 'Terminé' : 'En cours'}</div>
          </div>
        </div>
        <div class="ob-progress"><div class="ob-progress-fill" style="width:${pct}%;background:${pct === 100 ? 'var(--success)' : 'var(--primary)'};"></div></div>
        <div class="ob-steps">${stepsHtml}</div>
      </div>`;
  }

  // Avatar section
  const avatarInitials = (a.prenom?.charAt(0) || '') + (a.nom?.charAt(0) || '');
  const avatarHtml = a.avatar_url
    ? `<img id="athlete-avatar-img" src="${escHtml(a.avatar_url)}" style="width:80px;height:80px;border-radius:20px;object-fit:cover;border:3px solid var(--border);cursor:pointer;" onclick="document.getElementById('avatar-upload').click()" title="Changer la photo">`
    : `<div id="athlete-avatar-img" onclick="document.getElementById('avatar-upload').click()" style="width:80px;height:80px;border-radius:20px;background:linear-gradient(135deg,var(--bg3),var(--bg4));border:3px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:var(--text2);cursor:pointer;" title="Ajouter une photo">${avatarInitials}</div>`;

  el.innerHTML = `
    <!-- Avatar + Name header -->
    <div style="display:flex;align-items:center;gap:20px;margin-bottom:28px;padding:28px;background:var(--bg2);border:1px solid var(--glass-border);border-radius:20px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--primary),#d41a1a);"></div>
      <div style="position:relative;">
        ${avatarHtml}
        <div onclick="document.getElementById('avatar-upload').click()" style="position:absolute;bottom:-2px;right:-2px;width:26px;height:26px;border-radius:8px;background:var(--primary);display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px solid var(--bg2);"><i class="fas fa-camera" style="color:#fff;font-size:10px;"></i></div>
        <input type="file" id="avatar-upload" accept="image/jpeg,image/png,image/webp" style="display:none;" onchange="uploadAthleteAvatar(this)">
      </div>
      <div style="flex:1;">
        <div style="font-size:20px;font-weight:800;color:var(--text);letter-spacing:-0.02em;">${escHtml(a.prenom)} ${escHtml(a.nom)}</div>
        <div style="font-size:13px;color:var(--text2);margin-top:3px;">${escHtml(a.email || '')}</div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          ${a.objectif ? `<span style="font-size:11px;font-weight:600;background:rgba(179,8,8,0.1);color:var(--primary);padding:3px 10px;border-radius:6px;">${escHtml(objectifLabels[a.objectif] || a.objectif)}</span>` : ''}
          ${a.poids_actuel ? `<span style="font-size:11px;font-weight:600;background:var(--tint-medium);color:var(--text2);padding:3px 10px;border-radius:6px;">${a.poids_actuel} kg</span>` : ''}
        </div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-card" id="info-card-personal">
        <div class="info-card-header">
          <span class="info-card-title"><i class="fas fa-user" style="margin-right:6px;"></i>INFORMATIONS PERSONNELLES</span>
          <button class="info-edit-btn" onclick="editInfoCard('personal')"><i class="fas fa-pen"></i></button>
        </div>
        <div class="info-card-content">
          ${r('fa-id-card', 'Prénom', escHtml(a.prenom))}
          ${r('fa-id-card', 'Nom', escHtml(a.nom))}
          ${r('fa-envelope', 'Email', escHtml(a.email))}
          ${r('fa-phone', 'Téléphone', escHtml(a.telephone || ''))}
          ${r('fa-calendar', 'Date de naissance', a.date_naissance ? new Date(a.date_naissance + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '')}
          ${r('fa-venus-mars', 'Genre', escHtml(a.genre || ''))}
          ${r('fa-calendar-day', 'Bilan régulier', bilanFreqLabel)}
          ${r('fa-calendar-check', 'Bilan complet', completeFreqLabel)}
          ${r('fa-lock', 'Mode d\'accès', a.access_mode === 'training_only' ? 'Training uniquement' : a.access_mode === 'nutrition_only' ? 'Diète uniquement' : 'Complet')}
          ${r('fa-shoe-prints', 'Objectif pas', a.pas_journalier ? a.pas_journalier.toLocaleString('fr-FR') + ' pas/jour' : '10 000 pas/jour')}
          ${r('fa-tint', 'Objectif eau', (a.water_goal_ml || DEFAULT_WATER_GOAL).toLocaleString('fr-FR') + ' ml/jour')}
        </div>
      </div>

      <div class="info-card" id="info-card-health">
        <div class="info-card-header">
          <span class="info-card-title"><i class="fas fa-heartbeat" style="margin-right:6px;"></i>SANTÉ</span>
          <button class="info-edit-btn" onclick="editInfoCard('health')"><i class="fas fa-pen"></i></button>
        </div>
        <div class="info-card-content">
          ${r('fa-band-aid', 'Blessures / Limitations', escHtml(a.blessures || ''))}
          ${r('fa-allergies', 'Allergies alimentaires', escHtml(a.allergies || ''))}
          ${r('fa-pills', 'Médicaments', escHtml(a.medicaments || ''))}
          ${r('fa-notes-medical', 'Notes santé', escHtml(a.notes_sante || ''))}
        </div>
      </div>
    </div>

    ${onboardingHtml}

    <div id="athlete-payment-card" style="margin-top:16px;">
      <div class="text-center" style="padding:20px;color:var(--text3);font-size:13px;"><i class="fas fa-spinner fa-spin"></i> Chargement paiement...</div>
    </div>

    <div style="display:flex;justify-content:flex-end;margin-top:20px;">
      <button class="btn btn-outline btn-sm" onclick="deleteAthlete('${a.id}', '${escHtml(a.prenom)} ${escHtml(a.nom)}')" style="color:var(--danger);">
        <i class="fas fa-trash"></i> Supprimer l'athlète
      </button>
    </div>
  `;

  // Load payment info async
  loadAthletePaymentCard(a.id);
}

async function loadAthletePaymentCard(athleteId) {
  const el = document.getElementById('athlete-payment-card');
  if (!el) return;

  const { data: plan } = await supabaseClient
    .from('athlete_payment_plans')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('coach_id', currentUser.id)
    .maybeSingle();

  const { data: payments } = await supabaseClient
    .from('payment_history')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('is_platform_payment', false)
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: cancelRequests } = await supabaseClient
    .from('cancellation_requests')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('coach_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!plan) {
    el.innerHTML = '';
    return;
  }

  const statusMap = {
    active: { label: 'Actif', color: '#22c55e', icon: 'fa-check-circle' },
    pending: { label: 'En attente', color: '#f59e0b', icon: 'fa-clock' },
    past_due: { label: 'Impayé', color: '#ef4444', icon: 'fa-exclamation-circle' },
    canceled: { label: 'Annulé', color: '#ef4444', icon: 'fa-times-circle' },
    completed: { label: 'Terminé', color: '#6366f1', icon: 'fa-flag-checkered' },
    free: { label: 'Gratuit', color: '#22c55e', icon: 'fa-gift' },
  };
  const status = statusMap[plan.payment_status] || statusMap.pending;

  const freqLabel = plan.is_free ? 'Gratuit' :
    plan.frequency === 'once' ? `${(plan.amount / 100).toFixed(0)}€ (unique)` :
    `${(plan.amount / 100).toFixed(0)}€/${plan.frequency === 'month' ? 'mois' : plan.frequency === 'week' ? 'sem' : 'jour'}`;

  const engagementLabel = plan.engagement_months > 0
    ? `${plan.engagement_months} mois${plan.engagement_end ? ` (jusqu'au ${new Date(plan.engagement_end).toLocaleDateString('fr-FR')})` : ''}`
    : 'Sans engagement';

  const isEngaged = plan.engagement_end && new Date(plan.engagement_end) > new Date();

  let paymentsHtml = '';
  if (payments?.length) {
    paymentsHtml = `
      <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px;">
        <div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:8px;">HISTORIQUE</div>
        ${payments.map(p => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:13px;">
            <span style="color:var(--text2);">${new Date(p.created_at).toLocaleDateString('fr-FR')}</span>
            <span style="font-weight:600;">${(p.amount / 100).toFixed(2)}€</span>
            <span style="color:${p.status === 'succeeded' ? '#22c55e' : '#ef4444'};font-weight:600;font-size:12px;">${p.status === 'succeeded' ? 'Payé' : 'Échoué'}</span>
          </div>
        `).join('')}
      </div>`;
  }

  let cancelHtml = '';
  if (cancelRequests?.length) {
    const pendingReq = cancelRequests.find(r => r.status === 'pending');
    if (pendingReq) {
      cancelHtml = `
        <div style="margin-top:12px;padding:12px;background:rgba(239,68,68,0.1);border-radius:8px;border:1px solid rgba(239,68,68,0.2);">
          <div style="font-size:13px;font-weight:600;color:#ef4444;"><i class="fas fa-exclamation-triangle" style="margin-right:4px;"></i> Demande de résiliation en attente</div>
          <div id="cancel-refusal-note-${pendingReq.id}" style="display:none;margin-top:8px;">
            <textarea id="cancel-refusal-text-${pendingReq.id}" placeholder="Raison du refus (optionnel)" rows="2" style="width:100%;border:1px solid var(--border);border-radius:6px;padding:8px;font-size:13px;resize:none;background:var(--bg2);color:var(--text1);"></textarea>
            <div style="display:flex;gap:6px;margin-top:6px;">
              <button class="btn btn-sm cancel-respond-btn" style="background:#ef4444;color:#fff;border:none;flex:1;" onclick="confirmRefusal('${pendingReq.id}')">Confirmer le refus</button>
              <button class="btn btn-sm" style="border:1px solid var(--border);flex:1;" onclick="document.getElementById('cancel-refusal-note-${pendingReq.id}').style.display='none';document.getElementById('cancel-actions-${pendingReq.id}').style.display='flex';">Annuler</button>
            </div>
          </div>
          <div id="cancel-actions-${pendingReq.id}" style="display:flex;gap:8px;margin-top:8px;">
            <button class="btn btn-sm cancel-respond-btn" style="background:#22c55e;color:#fff;border:none;" onclick="respondCancellation('${pendingReq.id}', 'accepted')">
              <i class="fas fa-check"></i> Accepter
            </button>
            <button class="btn btn-sm cancel-respond-btn" style="background:#ef4444;color:#fff;border:none;" onclick="showRefusalInput('${pendingReq.id}')">
              <i class="fas fa-times"></i> Refuser
            </button>
          </div>
        </div>`;
    }
    cancelRequests.filter(r => r.status === 'blocked_engaged').forEach(r => {
      cancelHtml += `
        <div style="margin-top:8px;padding:8px 12px;background:rgba(245,158,11,0.1);border-radius:8px;font-size:12px;color:#f59e0b;">
          <i class="fas fa-lock" style="margin-right:4px;"></i> Tentative résiliation le ${new Date(r.created_at).toLocaleDateString('fr-FR')} (engagé)
        </div>`;
    });
  }

  el.innerHTML = `
    <div class="info-card">
      <div class="info-card-header">
        <span class="info-card-title"><i class="fas fa-credit-card" style="margin-right:6px;"></i>PAIEMENT</span>
      </div>
      <div class="info-card-content">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;">
          <span style="color:var(--text3);font-size:13px;">Statut</span>
          <span style="color:${status.color};font-weight:600;font-size:13px;"><i class="fas ${status.icon}" style="margin-right:4px;"></i>${status.label}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid var(--border);">
          <span style="color:var(--text3);font-size:13px;">Montant</span>
          <span style="font-weight:600;">${freqLabel}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid var(--border);">
          <span style="color:var(--text3);font-size:13px;">Engagement</span>
          <span style="font-weight:500;${isEngaged ? 'color:#f59e0b;' : ''}">${engagementLabel}</span>
        </div>
        ${plan.billing_anchor === 'fixed' && plan.billing_day ? `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid var(--border);">
          <span style="color:var(--text3);font-size:13px;">Prélèvement</span>
          <span style="font-weight:500;">Le ${plan.billing_day} du mois</span>
        </div>` : ''}
        ${plan.total_payments ? `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid var(--border);">
          <span style="color:var(--text3);font-size:13px;">Paiements</span>
          <span style="font-weight:500;">${plan.payments_completed || 0}/${plan.total_payments}</span>
        </div>` : ''}
        ${cancelHtml}
        ${paymentsHtml}
      </div>
    </div>
  `;
}

function showRefusalInput(requestId) {
  document.getElementById('cancel-actions-' + requestId).style.display = 'none';
  document.getElementById('cancel-refusal-note-' + requestId).style.display = 'block';
}

function confirmRefusal(requestId) {
  const note = document.getElementById('cancel-refusal-text-' + requestId)?.value?.trim() || null;
  respondCancellation(requestId, 'refused', note);
}

async function respondCancellation(requestId, decision, note) {
  // Disable all respond buttons to prevent double-click (BUG-C10)
  document.querySelectorAll('.cancel-respond-btn').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });
  try {
    const resp = await authFetch('/api/stripe?action=cancellation-respond', {
      method: 'POST',
      body: JSON.stringify({ requestId, decision, note: note || null, coachId: currentUser.id }),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    notify(decision === 'accepted' ? 'Résiliation acceptée' : 'Résiliation refusée', 'success');
    loadAthletePaymentCard(currentAthleteObj.id);
  } catch (err) {
    handleError(err, 'respondCancellation');
    // Re-enable buttons on error
    document.querySelectorAll('.cancel-respond-btn').forEach(b => { b.disabled = false; b.style.opacity = '1'; });
  }
}

function downloadContractPdf(stepIdx) {
  if (!_currentWorkflow || !_currentOnboarding) return;
  const steps = typeof _currentWorkflow.steps === 'string' ? JSON.parse(_currentWorkflow.steps) : _currentWorkflow.steps;
  const step = steps[stepIdx];
  if (!step || step.type !== 'contract') return;

  const a = currentAthleteObj;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Contrat — ${a.prenom} ${a.nom}</title>
<style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:20px;color:#222;line-height:1.8;}
h1{text-align:center;font-size:22px;margin-bottom:40px;border-bottom:2px solid #222;padding-bottom:16px;}
.text{white-space:pre-wrap;margin-bottom:40px;font-size:15px;}
.sig{margin-top:60px;border-top:1px solid #aaa;padding-top:24px;}
.sig p{margin:4px 0;font-size:14px;}
.sig .label{color:#666;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin-top:16px;}
@media print{body{margin:20px;}}</style></head><body>
<h1>${escHtml(step.title || 'Contrat de coaching')}</h1>
<div class="text">${escHtml(step.contract_text || '')}</div>
<div class="sig">
<p class="label">Signé électroniquement par</p>
<p><strong>${escHtml(a.prenom)} ${escHtml(a.nom)}</strong></p>
<p>${escHtml(a.email)}</p>
<p class="label">Date de signature</p>
<p>${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
<p style="margin-top:24px;font-style:italic;color:#888;font-size:12px;">Signature électronique validée lors de l'onboarding sur l'application Momentum.</p>
</div></body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

function editAthleteInfos() {
  fillEditAthleteForm();
  openModal('modal-edit-athlete');
}

function editInfoCard(section) {
  const a = currentAthleteObj;
  const f = (id, label, value, type = 'text') =>
    `<div class="info-row"><label class="info-label" for="ie-${id}">${label}</label><input id="ie-${id}" type="${type}" class="info-edit-input" value="${escHtml(String(value || ''))}" /></div>`;
  const sel = (id, label, options, current) =>
    `<div class="info-row"><label class="info-label" for="ie-${id}">${label}</label><select id="ie-${id}" class="info-edit-input">${options.map(o => `<option value="${o.v}" ${o.v == current ? 'selected' : ''}>${o.l}</option>`).join('')}</select></div>`;

  const completeFreqOpts = [
    { v: 'none', l: 'Aucun' },
    { v: 'weekly', l: 'Hebdomadaire' }, { v: 'biweekly', l: 'Bi-hebdo' },
    { v: 'monthly', l: 'Mensuel' }, { v: 'custom', l: 'Personnalisé' }
  ];

  let html;
  if (section === 'personal') {
    html = `
      ${f('prenom', 'Prénom', a.prenom)}
      ${f('nom', 'Nom', a.nom)}
      ${f('email', 'Email', a.email, 'email')}
      ${f('telephone', 'Téléphone', a.telephone)}
      ${f('date_naissance', 'Date de naissance', a.date_naissance, 'date')}
      ${sel('genre', 'Genre', [{ v: '', l: '—' }, { v: 'homme', l: 'Homme' }, { v: 'femme', l: 'Femme' }], a.genre || '')}
      ${sel('access_mode', 'Mode d\'accès', [{ v: 'full', l: 'Complet' }, { v: 'training_only', l: 'Training uniquement' }, { v: 'nutrition_only', l: 'Diète uniquement' }], a.access_mode || 'full')}
      ${f('pas_journalier', 'Objectif pas/jour', a.pas_journalier || DEFAULT_STEPS_GOAL, 'number')}
      ${f('water_goal_ml', 'Objectif eau (ml/jour)', a.water_goal_ml || DEFAULT_WATER_GOAL, 'number')}

      <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:10px;margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
        <label class="info-label" style="font-weight:600;font-size:14px;">
          <i class="fas fa-calendar-day" style="margin-right:6px;color:var(--text3);"></i>Bilan quotidien
        </label>
        <div style="display:flex;gap:6px;align-items:center;">
          <button type="button" class="freq-btn ${(a.bilan_frequency || 'daily') !== 'none' ? 'active' : ''}" data-target="ie-bilan_frequency" data-value="daily" onclick="selectFreq(this)">Activé</button>
          <button type="button" class="freq-btn ${(a.bilan_frequency || 'daily') === 'none' ? 'active' : ''}" data-target="ie-bilan_frequency" data-value="none" onclick="selectFreq(this)">Désactivé</button>
        </div>
        <input type="hidden" id="ie-bilan_frequency" value="${(a.bilan_frequency || 'daily') === 'none' ? 'none' : 'daily'}" />
        <div id="bilan-day-row" style="display:none;"></div>
        <div id="bilan-month-row" style="display:none;"></div>
        <div id="bilan-custom-row" style="display:none;"></div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="color:var(--text2);font-size:13px;"><i class="fas fa-bell" style="margin-right:4px;"></i>Notification à</span>
          <input id="ie-bilan_notif_time" type="time" class="info-edit-input" style="width:auto;" value="${a.bilan_notif_time || DEFAULT_NOTIF_TIME}" />
        </div>
      </div>

      <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:10px;margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
        <label class="info-label" style="font-weight:600;font-size:14px;">
          <i class="fas fa-calendar-check" style="margin-right:6px;color:var(--primary);"></i>Bilan complet <span style="font-weight:400;color:var(--text3);font-size:12px;">(photos + mensurations)</span>
        </label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${completeFreqOpts.map(o => `<button type="button" class="freq-btn ${o.v === (a.complete_bilan_frequency || 'weekly') ? 'active' : ''}" data-target="ie-complete_bilan_frequency" data-value="${o.v}" onclick="selectFreq(this)">${o.l}</button>`).join('')}
        </div>
        <input type="hidden" id="ie-complete_bilan_frequency" value="${a.complete_bilan_frequency || 'weekly'}" />
        <div id="complete-day-row" style="display:${['weekly','biweekly'].includes(a.complete_bilan_frequency || 'weekly') ? 'flex' : 'none'};align-items:center;gap:6px;flex-wrap:wrap;">
          <span class="dc-label" style="color:var(--text2);font-size:13px;">${(a.complete_bilan_frequency) === 'biweekly' ? 'Jours (2) :' : 'Jour :'}</span>
          <div style="display:flex;gap:4px;">
            ${dayCirclesHtml('ie-complete_bilan_day', a.complete_bilan_day ?? 1, (a.complete_bilan_frequency) === 'biweekly')}
          </div>
          <input type="hidden" id="ie-complete_bilan_day" value="${JSON.stringify(a.complete_bilan_day ?? 1)}" />
        </div>
        <div id="complete-month-row" style="display:${(a.complete_bilan_frequency) === 'monthly' ? 'flex' : 'none'};align-items:center;gap:8px;">
          <span style="color:var(--text2);font-size:13px;">Le</span>
          ${monthDaySelectHtml('ie-complete_bilan_month_day', a.complete_bilan_month_day || 1)}
          <span style="color:var(--text2);font-size:13px;">du mois</span>
        </div>
        <div id="complete-custom-row" style="display:${(a.complete_bilan_frequency === 'custom') ? 'flex' : 'none'};align-items:center;gap:8px;">
          <span style="color:var(--text2);font-size:13px;">Tous les</span>
          <input id="ie-complete_bilan_interval" type="number" class="info-edit-input" style="width:60px;" value="${a.complete_bilan_interval || 14}" min="2" max="90" />
          <span style="color:var(--text2);font-size:13px;">jours</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="color:var(--text2);font-size:13px;"><i class="fas fa-bell" style="margin-right:4px;"></i>Notification à</span>
          <input id="ie-complete_bilan_notif_time" type="time" class="info-edit-input" style="width:auto;" value="${a.complete_bilan_notif_time || DEFAULT_NOTIF_TIME}" />
        </div>
      </div>
    `;
  } else {
    html = `
      ${f('blessures', 'Blessures / Limitations', a.blessures)}
      ${f('allergies', 'Allergies alimentaires', a.allergies)}
      ${f('medicaments', 'Médicaments', a.medicaments)}
      ${f('notes_sante', 'Notes santé', a.notes_sante)}
    `;
  }

  const card = document.getElementById(section === 'personal' ? 'info-card-personal' : 'info-card-health');
  const content = card.querySelector('.info-card-content');
  const editBtn = card.querySelector('.info-edit-btn');
  editBtn.style.display = 'none';

  content.innerHTML = html + `
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
      <button class="btn btn-outline btn-sm" onclick="loadAthleteTabInfos()">Annuler</button>
      <button class="btn btn-red btn-sm" onclick="saveInfoCard('${section}')"><i class="fas fa-check" style="margin-right:4px;"></i>Sauvegarder</button>
    </div>`;
}

function _parseDayValue(inputId) {
  const raw = document.getElementById(inputId)?.value;
  if (!raw) return 1;
  try { return JSON.parse(raw); } catch { return parseInt(raw) || 1; }
}

async function saveInfoCard(section) {
  const g = id => document.getElementById('ie-' + id)?.value?.trim() || null;
  let updateData;

  if (section === 'personal') {
    const todayStr = new Date().toISOString().split('T')[0];
    const newBilanFreq = document.getElementById('ie-bilan_frequency')?.value || 'daily';
    const newCompleteFreq = document.getElementById('ie-complete_bilan_frequency')?.value || 'weekly';
    updateData = {
      prenom: g('prenom'),
      nom: g('nom'),
      email: g('email'),
      telephone: g('telephone'),
      date_naissance: g('date_naissance'),
      genre: g('genre'),
      access_mode: g('access_mode') || 'full',
      pas_journalier: parseInt(document.getElementById('ie-pas_journalier')?.value) || DEFAULT_STEPS_GOAL,
      water_goal_ml: parseInt(document.getElementById('ie-water_goal_ml')?.value) || DEFAULT_WATER_GOAL,
      bilan_frequency: newBilanFreq,
      bilan_interval: parseInt(document.getElementById('ie-bilan_interval')?.value) || 1,
      bilan_day: _parseDayValue('ie-bilan_day'),
      bilan_month_day: parseInt(document.getElementById('ie-bilan_month_day')?.value) || 1,
      bilan_notif_time: document.getElementById('ie-bilan_notif_time')?.value || DEFAULT_NOTIF_TIME,
      bilan_anchor_date: newBilanFreq !== (currentAthleteObj.bilan_frequency || 'daily') ? todayStr : (currentAthleteObj.bilan_anchor_date || todayStr),
      complete_bilan_frequency: newCompleteFreq,
      complete_bilan_interval: parseInt(document.getElementById('ie-complete_bilan_interval')?.value) || 7,
      complete_bilan_day: _parseDayValue('ie-complete_bilan_day'),
      complete_bilan_month_day: parseInt(document.getElementById('ie-complete_bilan_month_day')?.value) || 1,
      complete_bilan_notif_time: document.getElementById('ie-complete_bilan_notif_time')?.value || DEFAULT_NOTIF_TIME,
      complete_bilan_anchor_date: newCompleteFreq !== (currentAthleteObj.complete_bilan_frequency || 'weekly') ? todayStr : (currentAthleteObj.complete_bilan_anchor_date || todayStr),
    };
  } else {
    updateData = {
      blessures: g('blessures'),
      allergies: g('allergies'),
      medicaments: g('medicaments'),
      notes_sante: g('notes_sante')
    };
  }

  const { error } = await supabaseClient.from('athletes').update(updateData).eq('id', currentAthleteId);
  if (error) { handleError(error, 'updateAthlete'); return; }

  Object.assign(currentAthleteObj, updateData);
  notify('Informations mises à jour !', 'success');
  loadAthleteTabInfos();
}

function fillEditAthleteForm() {
  if (!currentAthleteObj) return;
  document.getElementById('edit-athlete-prenom').value = currentAthleteObj.prenom || '';
  document.getElementById('edit-athlete-nom').value = currentAthleteObj.nom || '';
  document.getElementById('edit-athlete-email').value = currentAthleteObj.email || '';
  document.getElementById('edit-athlete-poids').value = currentAthleteObj.poids_actuel || '';
  document.getElementById('edit-athlete-poids-obj').value = currentAthleteObj.poids_objectif || '';
  document.getElementById('edit-athlete-objectif').value = currentAthleteObj.objectif || 'maintenance';
}

document.getElementById('edit-athlete-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const prenom = document.getElementById('edit-athlete-prenom').value.trim();
  const nom = document.getElementById('edit-athlete-nom').value.trim();
  const email = document.getElementById('edit-athlete-email').value.trim();
  if (!prenom || !nom) { notify('Prénom et nom requis', 'error'); return; }
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) { notify('Email invalide', 'error'); return; }

  const updateData = {
    prenom, nom, email,
    poids_actuel: parseFloat(document.getElementById('edit-athlete-poids').value) || null,
    poids_objectif: parseFloat(document.getElementById('edit-athlete-poids-obj').value) || null,
    objectif: document.getElementById('edit-athlete-objectif').value,
  };

  const { error } = await supabaseClient.from('athletes').update(updateData).eq('id', currentAthleteId).select();
  if (error) { handleError(error, 'updateAthlete'); return; }

  Object.assign(currentAthleteObj, updateData);
  notify('Informations mises à jour !', 'success');
  closeModal('modal-edit-athlete');
  loadAthleteTabInfos();
  loadAthletes();
});

// ===== ADD ATHLETE =====

document.getElementById('athlete-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const prenom = document.getElementById('athlete-prenom').value.trim();
  const nom = document.getElementById('athlete-nom').value.trim();
  const email = document.getElementById('athlete-email').value.trim();

  // Validation
  if (!prenom || !nom) { notify('Prénom et nom requis', 'error'); return; }
  if (prenom.length > 100 || nom.length > 100) { notify('Nom ou prénom trop long (max 100)', 'error'); return; }
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  if (!emailRegex.test(email)) { notify('Email invalide', 'error'); return; }

  const poids = null;
  const poidsObj = null;

  // Check if coach has Stripe connected when adding a paid athlete
  const payType = document.querySelector('input[name="athlete-payment-type"]:checked')?.value || 'paid';
  if (payType === 'paid') {
    const { data: coachProfile } = await supabaseClient
      .from('coach_profiles')
      .select('stripe_charges_enabled, stripe_secret_key')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (!coachProfile?.stripe_charges_enabled && !coachProfile?.stripe_secret_key) {
      notify('Connectez votre Stripe dans Profil avant d\'ajouter un athlète payant', 'error');
      return;
    }
  }

  // Secure temp password (mixed case + digits + symbols)
  const tempPassword = generateSecurePassword(14);

  // Sauvegarder la session coach AVANT le signUp
  const { data: coachSessionData } = await supabaseClient.auth.getSession();
  const coachSession = coachSessionData?.session;
  const coachId = coachSession?.user?.id;
  if (!coachId) { notify('Erreur: pas de session coach', 'error'); return; }

  let authData;
  try {
    const { data: signUpData, error: authError } = await supabaseClient.auth.signUp({
      email,
      password: tempPassword,
      options: { data: { prenom, nom } }
    });

    if (authError && authError.message.includes('already registered')) {
      // Email exists in auth — look up existing user via athletes table or continue without auth link
      // The athlete will be created without user_id, coach can re-invite later
      authData = null;
    } else if (authError) {
      handleError(authError, 'signUp'); return;
    } else {
      authData = signUpData;
    }
  } catch (err) {
    handleError(err, 'signUp');
    return;
  } finally {
    // Toujours restaurer la session coach (le signUp a switché sur le compte athlète)
    try {
      await supabaseClient.auth.setSession({
        access_token: coachSession.access_token,
        refresh_token: coachSession.refresh_token
      });
      currentUser = coachSession.user;
    } catch (restoreErr) {
      devError('[setSession restore]', restoreErr);
      notify('Erreur critique: session perdue. Rechargez la page.', 'error');
      return;
    }
  }

  const workflowId = document.getElementById('athlete-workflow').value || null;

  // If email already existed, try to find the existing user_id
  let existingUserId = authData?.user?.id || null;
  if (!existingUserId) {
    // Look up if this email already has an athlete record with a user_id
    const { data: existingAthlete } = await supabaseClient
      .from('athletes')
      .select('user_id')
      .eq('email', email)
      .not('user_id', 'is', null)
      .maybeSingle();
    existingUserId = existingAthlete?.user_id || null;
  }

  const { data: insertedAthletes, error } = await supabaseClient
    .from('athletes')
    .insert({
      prenom, nom, email,
      poids_actuel: poids,
      poids_objectif: poidsObj,
      objectif: 'maintenance',
      onboarding_workflow_id: workflowId,
      coach_id: coachId,
      user_id: existingUserId,
    })
    .select();

  if (error) { handleError(error, 'insert athlete'); return; }

  const insertedAthlete = insertedAthletes?.[0];

  // Create payment plan
  if (insertedAthlete) {
    const paymentType = document.querySelector('input[name="athlete-payment-type"]:checked')?.value || 'paid';
    const isFree = paymentType === 'free';
    const payAmount = parseInt(document.getElementById('athlete-pay-amount')?.value) || 0;
    const payFrequency = document.getElementById('athlete-pay-frequency')?.value || 'month';
    const payInterval = parseInt(document.getElementById('athlete-pay-interval')?.value) || 1;
    const payDuration = document.getElementById('athlete-pay-duration')?.value || 'unlimited';
    const payTotal = payDuration === 'limited' ? (parseInt(document.getElementById('athlete-pay-total')?.value) || null) : null;
    const engagementMonths = parseInt(document.getElementById('athlete-pay-engagement')?.value) || 0;

    const engagementStart = engagementMonths > 0 ? new Date().toISOString() : null;
    const engagementEnd = engagementMonths > 0
      ? new Date(Date.now() + engagementMonths * 30.44 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const billingAnchor = document.getElementById('athlete-pay-billing-anchor')?.value || 'anniversary';
    const billingDay = billingAnchor === 'fixed' ? (parseInt(document.getElementById('athlete-pay-billing-day')?.value) || 1) : null;

    await supabaseClient.from('athlete_payment_plans').insert({
      coach_id: coachId,
      athlete_id: insertedAthlete.id,
      is_free: isFree,
      amount: isFree ? 0 : payAmount * 100, // Convert to cents
      frequency: isFree ? 'month' : payFrequency,
      frequency_interval: payInterval,
      is_unlimited: payDuration === 'unlimited',
      total_payments: payTotal,
      engagement_months: engagementMonths,
      engagement_start: engagementStart,
      engagement_end: engagementEnd,
      payment_status: isFree ? 'free' : 'pending',
      billing_anchor: billingAnchor,
      billing_day: billingDay,
    });

    // Activity log
    await supabaseClient.from('athlete_activity_log').insert({
      coach_id: coachId,
      athlete_id: insertedAthlete.id,
      event: 'added',
    });
  }

  // Create onboarding entry if workflow selected
  if (workflowId) {
    // Use authData.user.id if available, otherwise look up user_id from the athlete record
    let onboardingUserId = authData?.user?.id;
    if (!onboardingUserId && insertedAthlete) {
      // Fetch the athlete to get user_id (may have been linked already)
      const { data: freshAthlete } = await supabaseClient
        .from('athletes')
        .select('user_id')
        .eq('id', insertedAthlete.id)
        .single();
      onboardingUserId = freshAthlete?.user_id;
    }

    if (onboardingUserId) {
      await supabaseClient.from('athlete_onboarding').insert({
        athlete_id: onboardingUserId,
        workflow_id: workflowId,
        current_step: 0,
        steps_completed: [],
        completed: false,
        responses: {}
      });
    }
  }

  // Show WhatsApp message modal
  const whatsappMessage = `Bienvenue dans l'app de coaching Pierre! 🏋️\n\nVoici vos identifiants:\n\nEmail: ${email}\nMot de passe: ${tempPassword}\n\nConnectez-vous pour voir vos séances!`;
  window._whatsappMessage = whatsappMessage;
  const container = document.createElement('div');
  container.id = 'whatsapp-modal-temp';
  container.className = 'modal-overlay open';
  container.innerHTML = `
    <div class="modal" onclick="event.stopPropagation();">
      <div class="modal-header">
        <h2 class="modal-title">Message WhatsApp</h2>
        <button class="modal-close" onclick="document.getElementById('whatsapp-modal-temp').remove()">×</button>
      </div>
      <div style="padding:20px;background:var(--bg2);border-radius:10px;margin:16px;font-family:monospace;font-size:13px;color:var(--text2);line-height:1.6;white-space:pre-wrap;word-break:break-word;border:1px solid var(--border);">${escHtml(whatsappMessage)}</div>
      <div style="padding:16px;display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-red" onclick="copyWhatsappMessage()">Copier le message</button>
        <button class="btn btn-outline" onclick="document.getElementById('whatsapp-modal-temp').remove();">Fermer</button>
      </div>
    </div>
  `;
  container.onclick = () => container.remove();
  document.body.appendChild(container);

  notify('Athlète ajouté avec succès !', 'success');
  closeModal('modal-athlete');
  document.getElementById('athlete-form').reset();
  setTimeout(() => loadAthletes(), 500);
});

function copyWhatsappMessage() {
  navigator.clipboard.writeText(window._whatsappMessage || '');
  notify('Message copié !', 'success');
  const modal = document.getElementById('whatsapp-modal-temp');
  if (modal) modal.remove();
}

// ===== PROGRAMMING WEEKS =====

async function loadProgrammingWeeks() {
  const [{ data: weeks }, { data: programs }, { data: reports }] = await Promise.all([
    supabaseClient.from('programming_weeks').select('*').eq('athlete_id', currentAthleteId).order('week_date'),
    supabaseClient.from('workout_programs').select('id,nom').eq('athlete_id', currentAthleteId).order('created_at'),
    supabaseClient.from('daily_reports').select('date,weight').eq('user_id', currentAthleteObj.user_id),
  ]);
  window._progWeeksCache = weeks || [];
  window._progPrograms = programs || [];

  // Build weight averages per programming week
  const weightByDate = {};
  (reports || []).forEach(r => { if (r.weight) weightByDate[r.date] = parseFloat(r.weight); });
  const weightMap = {};
  (weeks || []).forEach(w => {
    const start = new Date(w.week_date + 'T00:00:00');
    const vals = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start); dt.setDate(dt.getDate() + d);
      const v = weightByDate[toDateStr(dt)];
      if (v) vals.push(v);
    }
    if (vals.length) weightMap[w.id] = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  });
  window._progWeightMap = weightMap;
  renderProgrammingTable(window._progWeeksCache);
}

function renderProgrammingTable(weeks) {
  const c = document.getElementById('prog-table-container');
  if (!c) return;

  if (!weeks.length) {
    c.innerHTML = `<div class="pg-empty">
      <i class="fas fa-calendar-alt"></i>
      <p>Aucune semaine planifiée</p>
      <p style="font-size:13px;margin-top:8px;">Clique <strong>+ sem.</strong> pour démarrer.</p>
    </div>`;
    return;
  }

  const todayStr = toDateStr(new Date());
  const weightMap = window._progWeightMap || {};

  // Mark current week + phase counters
  let lastPhase = null, phaseCounter = 0;
  weeks.forEach((w, i) => {
    const nextDate = weeks[i + 1]?.week_date;
    w._isCurrent = w.week_date <= todayStr && (!nextDate || nextDate > todayStr);
    if (w.phase && w.phase === lastPhase) { phaseCounter++; }
    else if (w.phase) { phaseCounter = 1; lastPhase = w.phase; }
    else { phaseCounter = 0; lastPhase = null; }
    w._phaseNum = phaseCounter;
  });

  // ── Phase paint toolbar ──
  let html = '<div class="pg-container">';
  html += '<div class="pg-toolbar">';
  Object.entries(PROG_PHASES).forEach(([k, v]) => {
    html += `<button class="pg-phase-btn${window._selectedProgPhase === k ? ' active' : ''}" id="pg-pbtn-${k}" style="background:${v.color};" onclick="selectProgPhase('${k}')">${v.short}</button>`;
  });
  html += `<button class="pg-phase-btn${window._selectedProgPhase === '' ? ' active' : ''}" id="pg-pbtn-" style="background:#555;" onclick="selectProgPhase('')">✕</button>`;
  if (window._selectedProgPhase !== null && window._selectedProgPhase !== undefined) {
    html += '<span class="pg-toolbar-hint">Clique les semaines · Shift+clic = plage</span>';
  }
  html += '</div>';

  // ── Week rows ──
  weeks.forEach((w, i) => {
    const pi = PROG_PHASES[w.phase];
    const d = new Date(w.week_date + 'T00:00:00');
    const dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const weight = weightMap[w.id];
    const weightTxt = weight || '—';

    let barHtml;
    if (pi) {
      barHtml = `<div class="pg-phase-bar" style="background:${pi.color};" onclick="paintProgPhase('${w.id}',${i},event)"><span class="pg-bar-label">${pi.short} · S${w._phaseNum}</span></div>`;
    } else {
      barHtml = `<div class="pg-phase-bar pg-bar-empty" onclick="paintProgPhase('${w.id}',${i},event)">—</div>`;
    }

    html += `<div class="pg-row${w._isCurrent ? ' pg-row-current' : ''}" data-pw-id="${w.id}">`;
    html += `<span class="pg-cell-date">${dateStr}</span>`;
    html += barHtml;
    html += `<span class="pg-cell-weight">${weightTxt}</span>`;
    html += '</div>';
  });

  html += '</div>';
  c.innerHTML = html;
}

// ── Paint mode ──

window._selectedProgPhase = null;
window._lastPaintedIdx = null;

function selectProgPhase(phase) {
  // Toggle: click same button again = deselect
  if (window._selectedProgPhase === phase) {
    window._selectedProgPhase = null;
    window._lastPaintedIdx = null;
  } else {
    window._selectedProgPhase = phase;
    window._lastPaintedIdx = null;
  }
  renderProgrammingTable(window._progWeeksCache || []);
}

async function paintProgPhase(id, idx, event) {
  const phase = window._selectedProgPhase;
  if (phase === null || phase === undefined) return; // no phase selected

  const weeks = window._progWeeksCache || [];

  if (event.shiftKey && window._lastPaintedIdx !== null) {
    // Range paint
    const from = Math.min(window._lastPaintedIdx, idx);
    const to = Math.max(window._lastPaintedIdx, idx);
    const ids = weeks.slice(from, to + 1).map(w => w.id);
    await supabaseClient.from('programming_weeks')
      .update({ phase: phase || null }).in('id', ids);
    for (let j = from; j <= to; j++) weeks[j].phase = phase || null;
  } else {
    // Single paint
    await supabaseClient.from('programming_weeks')
      .update({ phase: phase || null }).eq('id', id);
    const w = weeks.find(x => x.id === id);
    if (w) w.phase = phase || null;
  }

  window._lastPaintedIdx = idx;
  renderProgrammingTable(weeks);
}

// ── Add weeks ──

function getNextMonday(fromDate) {
  const d = new Date(fromDate);
  const add = (8 - d.getDay()) % 7;
  if (add > 0) d.setDate(d.getDate() + add);
  return d;
}

async function addProgWeek() {
  const weeks = window._progWeeksCache || [];
  let nextDate;
  if (weeks.length) {
    nextDate = new Date(weeks[weeks.length - 1].week_date + 'T00:00:00');
    nextDate.setDate(nextDate.getDate() + 7);
  } else {
    nextDate = getNextMonday(new Date());
  }
  const { error } = await supabaseClient.from('programming_weeks').insert({
    athlete_id: currentAthleteId, coach_id: currentUser.id, week_date: toDateStr(nextDate),
  });
  if (error) { handleError(error, 'addProgWeek'); return; }
  await loadProgrammingWeeks();
}

async function addProgWeeks() {
  const count = parseInt(document.getElementById('prog-add-count')?.value) || 12;
  if (count < 1) return;
  const weeks = window._progWeeksCache || [];
  let start;
  if (weeks.length) {
    start = new Date(weeks[weeks.length - 1].week_date + 'T00:00:00');
    start.setDate(start.getDate() + 7);
  } else {
    start = getNextMonday(new Date());
  }
  const rows = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i * 7);
    rows.push({ athlete_id: currentAthleteId, coach_id: currentUser.id, week_date: toDateStr(d) });
  }
  const { error } = await supabaseClient.from('programming_weeks').insert(rows);
  if (error) { handleError(error, 'addProgWeeks'); return; }
  await loadProgrammingWeeks();
  notify(`${count} semaines ajoutées`, 'success');
}

async function deleteProgWeek(id) {
  if (!confirm('Supprimer cette semaine ?')) return;
  const { error } = await supabaseClient.from('programming_weeks').delete().eq('id', id);
  if (error) { handleError(error, 'deleteProgWeek'); return; }
  await loadProgrammingWeeks();
}

// ===== DELETE ATHLETE =====

async function deleteAthlete(athleteId, athleteName) {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer ${athleteName} et TOUTES ses données ?`)) return;

  try {
    // Cancel Stripe subscription if active before deleting
    const { data: stripeSub } = await supabaseClient
      .from('stripe_customers')
      .select('stripe_subscription_id')
      .eq('athlete_id', athleteId)
      .eq('coach_id', currentUser.id)
      .in('subscription_status', ['active', 'past_due'])
      .maybeSingle();

    if (stripeSub?.stripe_subscription_id) {
      try {
        await authFetch('/api/stripe?action=cancel', {
          method: 'POST',
          body: JSON.stringify({
            subscriptionId: stripeSub.stripe_subscription_id,
            coachId: currentUser.id,
            athleteId,
          }),
        });
      } catch (stripeErr) {
        devError('[deleteAthlete] Stripe cancel failed:', stripeErr);
        // Continue with deletion even if Stripe cancel fails
      }
    }

    const { error } = await supabaseClient.rpc('delete_athlete_complete', { athlete_row_id: athleteId });
    if (error) throw error;

    notify(`${athleteName} a été supprimé !`, 'success');
    showSection('athletes');
    loadAthletes();
  } catch (error) {
    handleError(error, 'deleteAthlete');
  }
}

// ── Payment plan form helpers ──

function togglePaymentFields(show) {
  const fields = document.getElementById('payment-fields');
  if (fields) fields.style.display = show ? 'block' : 'none';
  // Update label styles
  const freeLabel = document.getElementById('pay-type-free-label');
  const paidLabel = document.getElementById('pay-type-paid-label');
  if (freeLabel && paidLabel) {
    if (show) {
      paidLabel.style.borderColor = 'var(--red)';
      paidLabel.style.background = 'rgba(179,8,8,0.1)';
      freeLabel.style.borderColor = 'var(--border)';
      freeLabel.style.background = 'transparent';
    } else {
      freeLabel.style.borderColor = '#22c55e';
      freeLabel.style.background = 'rgba(34,197,94,0.1)';
      paidLabel.style.borderColor = 'var(--border)';
      paidLabel.style.background = 'transparent';
    }
  }
}

function toggleDurationInput(val) {
  const group = document.getElementById('pay-total-payments-group');
  if (group) group.style.display = val === 'limited' ? 'block' : 'none';
}

function toggleBillingAnchor() {
  const anchor = document.getElementById('athlete-pay-billing-anchor')?.value;
  const group = document.getElementById('pay-billing-day-group');
  if (group) group.style.display = anchor === 'fixed' ? 'block' : 'none';
}
