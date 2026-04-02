// ===== QUESTIONNAIRES MANAGEMENT =====

// ── Helpers ──
function qGenId() {
  return crypto.randomUUID ? crypto.randomUUID() : 'q' + Date.now() + Math.random().toString(36).slice(2, 8);
}

const Q_TYPES = [
  { value: 'text', label: 'Texte libre', icon: 'fa-align-left' },
  { value: 'choice', label: 'Choix multiples', icon: 'fa-list-ul' },
  { value: 'rating', label: 'Note (1-10)', icon: 'fa-star' },
  { value: 'yesno', label: 'Oui / Non', icon: 'fa-toggle-on' },
];

// ── Templates tab (inside Templates section) ──

async function loadQuestionnaireTemplates() {
  const container = document.getElementById('templates-content');
  container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const { data: templates } = await supabaseClient
    .from('questionnaire_templates')
    .select('*')
    .eq('coach_id', currentUser.id)
    .order('created_at', { ascending: false });

  container.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
      <button class="btn btn-red" onclick="editQuestionnaireTemplate()">
        <i class="fas fa-plus"></i> Nouveau questionnaire
      </button>
    </div>
    ${templates?.length ? templates.map(t => {
      const qs = t.questions || [];
      const d = new Date(t.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
      return `
      <div class="card" style="margin-bottom:12px;cursor:pointer;" onclick="editQuestionnaireTemplate('${t.id}')">
        <div class="card-header">
          <div style="flex:1;">
            <div class="card-title">${escHtml(t.titre)}</div>
            ${t.description ? `<div style="color:var(--text3);font-size:12px;margin-top:2px;">${escHtml(t.description)}</div>` : ''}
            <div style="color:var(--text3);font-size:12px;margin-top:4px;">${qs.length} question(s) · ${d}</div>
          </div>
          <div style="display:flex;gap:8px;" onclick="event.stopPropagation()">
            <button class="btn btn-outline btn-sm" onclick="openSendQuestionnaireModal('${t.id}')" title="Envoyer"><i class="fas fa-paper-plane"></i></button>
            <button class="btn btn-outline btn-sm" onclick="duplicateQuestionnaireTemplate('${t.id}')" title="Dupliquer"><i class="fas fa-copy"></i></button>
            <button class="btn btn-outline btn-sm btn-danger" onclick="deleteQuestionnaireTemplate('${t.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>`;
    }).join('') : '<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>Aucun template de questionnaire</p></div>'}
  `;
}

// ── Template editor ──

let _qtEditorQuestions = [];

async function editQuestionnaireTemplate(templateId) {
  let tpl = { titre: '', description: '', questions: [] };

  if (templateId) {
    const { data } = await supabaseClient
      .from('questionnaire_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    if (data) tpl = data;
  }

  _qtEditorQuestions = (tpl.questions || []).map(q => ({ ...q }));

  const container = document.getElementById('templates-content');
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h2 style="margin:0;font-size:18px;">${templateId ? 'Modifier' : 'Nouveau'} questionnaire</h2>
      <button class="btn btn-outline" onclick="loadQuestionnaireTemplates()"><i class="fas fa-arrow-left"></i> Retour</button>
    </div>
    <div class="card" style="padding:20px;">
      <div class="form-group">
        <label>Titre *</label>
        <input type="text" id="qt-titre" class="form-control" value="${escHtml(tpl.titre)}" placeholder="Ex: Bilan de rentrée">
      </div>
      <div class="form-group">
        <label>Description</label>
        <input type="text" id="qt-description" class="form-control" value="${escHtml(tpl.description || '')}" placeholder="Optionnel">
      </div>
      <h3 style="font-size:15px;margin:20px 0 12px;">Questions</h3>
      <div id="qt-questions-list"></div>
      <button class="btn btn-outline" style="margin-top:12px;" onclick="qtAddQuestion()">
        <i class="fas fa-plus"></i> Ajouter une question
      </button>
      <div style="display:flex;gap:12px;margin-top:24px;border-top:1px solid var(--border);padding-top:16px;">
        <button class="btn btn-red" onclick="saveQuestionnaireTemplate('${templateId || ''}')"><i class="fas fa-save"></i> Sauvegarder</button>
        <button class="btn btn-outline" onclick="loadQuestionnaireTemplates()">Annuler</button>
      </div>
    </div>
  `;

  qtRenderQuestions();
}

function qtRenderQuestions() {
  const list = document.getElementById('qt-questions-list');
  if (!list) return;

  if (_qtEditorQuestions.length === 0) {
    list.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:12px 0;">Aucune question. Cliquez sur "Ajouter une question".</div>';
    return;
  }

  list.innerHTML = _qtEditorQuestions.map((q, i) => {
    const typeOpts = Q_TYPES.map(t => `<option value="${t.value}" ${q.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('');
    const optionsHtml = q.type === 'choice' ? `
      <div style="margin-top:8px;">
        <label style="font-size:11px;color:var(--text3);">Options (une par ligne)</label>
        <textarea class="form-control" rows="3" onchange="qtUpdateOptions(${i}, this.value)" placeholder="Option 1&#10;Option 2&#10;Option 3">${(q.options || []).join('\n')}</textarea>
      </div>` : '';

    return `
    <div class="card" style="padding:14px;margin-bottom:10px;background:var(--bg2);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="font-weight:700;color:var(--text3);font-size:13px;min-width:24px;">#${i + 1}</span>
        <input type="text" class="form-control" style="flex:1;" value="${escHtml(q.label || '')}" onchange="qtUpdateLabel(${i}, this.value)" placeholder="Texte de la question">
        <select class="form-control" style="width:160px;" onchange="qtUpdateType(${i}, this.value)">${typeOpts}</select>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap;cursor:pointer;">
          <input type="checkbox" ${q.required ? 'checked' : ''} onchange="qtToggleRequired(${i}, this.checked)"> Obligatoire
        </label>
      </div>
      ${optionsHtml}
      <div style="display:flex;gap:6px;margin-top:8px;">
        ${i > 0 ? `<button class="btn btn-outline btn-sm" onclick="qtMoveQuestion(${i},-1)" title="Monter"><i class="fas fa-arrow-up"></i></button>` : ''}
        ${i < _qtEditorQuestions.length - 1 ? `<button class="btn btn-outline btn-sm" onclick="qtMoveQuestion(${i},1)" title="Descendre"><i class="fas fa-arrow-down"></i></button>` : ''}
        <button class="btn btn-outline btn-sm btn-danger" onclick="qtRemoveQuestion(${i})" title="Supprimer"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function qtAddQuestion() {
  _qtEditorQuestions.push({ id: qGenId(), label: '', type: 'text', options: [], required: false });
  qtRenderQuestions();
}

function qtUpdateLabel(i, val) { _qtEditorQuestions[i].label = val; }
function qtUpdateType(i, val) {
  _qtEditorQuestions[i].type = val;
  if (val === 'choice' && !_qtEditorQuestions[i].options) _qtEditorQuestions[i].options = [];
  qtRenderQuestions();
}
function qtUpdateOptions(i, val) {
  _qtEditorQuestions[i].options = val.split('\n').map(s => s.trim()).filter(Boolean);
}
function qtToggleRequired(i, val) { _qtEditorQuestions[i].required = val; }

function qtMoveQuestion(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= _qtEditorQuestions.length) return;
  [_qtEditorQuestions[i], _qtEditorQuestions[j]] = [_qtEditorQuestions[j], _qtEditorQuestions[i]];
  qtRenderQuestions();
}

function qtRemoveQuestion(i) {
  _qtEditorQuestions.splice(i, 1);
  qtRenderQuestions();
}

async function saveQuestionnaireTemplate(templateId) {
  const titre = document.getElementById('qt-titre').value.trim();
  if (!titre) { notify('Le titre est obligatoire', 'error'); return; }

  // Ensure all questions have IDs
  _qtEditorQuestions.forEach(q => { if (!q.id) q.id = qGenId(); });

  const payload = {
    coach_id: currentUser.id,
    titre,
    description: document.getElementById('qt-description').value.trim() || null,
    questions: _qtEditorQuestions,
    updated_at: new Date().toISOString(),
  };

  let error;
  if (templateId) {
    ({ error } = await supabaseClient.from('questionnaire_templates').update(payload).eq('id', templateId));
  } else {
    ({ error } = await supabaseClient.from('questionnaire_templates').insert(payload));
  }

  if (error) { handleError(error, 'saveQuestionnaireTemplate'); return; }
  notify('Template sauvegardé');
  loadQuestionnaireTemplates();
}

async function duplicateQuestionnaireTemplate(templateId) {
  const { data } = await supabaseClient.from('questionnaire_templates').select('*').eq('id', templateId).single();
  if (!data) return;

  const { error } = await supabaseClient.from('questionnaire_templates').insert({
    coach_id: currentUser.id,
    titre: data.titre + ' (copie)',
    description: data.description,
    questions: data.questions,
  });

  if (error) { handleError(error, 'duplicateQuestionnaireTemplate'); return; }
  notify('Template dupliqué');
  loadQuestionnaireTemplates();
}

async function deleteQuestionnaireTemplate(templateId) {
  if (!confirm('Supprimer ce template ?')) return;
  const { error } = await supabaseClient.from('questionnaire_templates').delete().eq('id', templateId);
  if (error) { handleError(error, 'deleteQuestionnaireTemplate'); return; }
  notify('Template supprimé');
  loadQuestionnaireTemplates();
}

// ── Send modal ──

async function openSendQuestionnaireModal(templateId, preselectedAthleteId) {
  window._sendQtTemplateId = templateId;

  const { data: tpl } = await supabaseClient
    .from('questionnaire_templates')
    .select('titre, questions')
    .eq('id', templateId)
    .single();

  if (!tpl) { notify('Template introuvable', 'error'); return; }
  window._sendQtTemplate = tpl;

  const { data: athletes } = await supabaseClient
    .from('athletes')
    .select('id, prenom, nom, user_id')
    .eq('coach_id', currentUser.id)
    .order('prenom');

  const modal = document.getElementById('modal-send-questionnaire');
  document.getElementById('send-qt-title').textContent = tpl.titre;

  const listEl = document.getElementById('send-qt-athletes');
  listEl.innerHTML = (athletes || []).map(a => `
    <label style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-subtle);cursor:pointer;">
      <input type="checkbox" class="send-qt-cb" value="${a.id}" data-userid="${a.user_id || ''}" data-prenom="${escHtml(a.prenom)}" ${preselectedAthleteId === a.id ? 'checked' : ''}>
      <span style="font-weight:600;">${escHtml(a.prenom)} ${escHtml(a.nom || '')}</span>
    </label>
  `).join('');

  document.getElementById('send-qt-obligatoire').checked = false;
  openModal('modal-send-questionnaire');
}

function toggleAllSendQt(selectAll) {
  document.querySelectorAll('.send-qt-cb').forEach(cb => cb.checked = selectAll);
}

async function confirmSendQuestionnaire() {
  const cbs = document.querySelectorAll('.send-qt-cb:checked');
  if (cbs.length === 0) { notify('Sélectionnez au moins un athlète', 'error'); return; }

  const obligatoire = document.getElementById('send-qt-obligatoire').checked;
  const tpl = window._sendQtTemplate;
  const templateId = window._sendQtTemplateId;
  let sent = 0;

  for (const cb of cbs) {
    const athleteId = cb.value;
    const userId = cb.dataset.userid;
    const prenom = cb.dataset.prenom;

    const { error } = await supabaseClient.from('questionnaire_assignments').insert({
      template_id: templateId,
      athlete_id: athleteId,
      coach_id: currentUser.id,
      obligatoire,
      questions_snapshot: tpl.questions,
    });

    if (error) { handleError(error, 'sendQuestionnaire'); continue; }

    // Notification
    if (userId) {
      await notifyAthlete(
        userId,
        'questionnaire',
        'Nouveau questionnaire',
        `Votre coach vous a envoyé un questionnaire : ${tpl.titre}`,
        { template_id: templateId }
      );
    }
    sent++;
  }

  closeModal('modal-send-questionnaire');
  notify(`Questionnaire envoyé à ${sent} athlète(s)`);

  // Refresh if on athlete questionnaires tab
  if (typeof currentAthleteTab !== 'undefined' && currentAthleteTab === 'questionnaires') {
    loadAthleteTabQuestionnaires();
  }
}

// ── Athlete tab: Questionnaires ──

async function loadAthleteTabQuestionnaires() {
  const container = document.getElementById('athlete-tab-content');
  container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const athleteId = currentAthleteId;

  // Load assignments with template info
  const { data: assignments } = await supabaseClient
    .from('questionnaire_assignments')
    .select('*, questionnaire_templates(titre)')
    .eq('athlete_id', athleteId)
    .order('sent_at', { ascending: false });

  // Load responses for completed
  const completedIds = (assignments || []).filter(a => a.status === 'completed').map(a => a.id);
  let responsesMap = {};
  if (completedIds.length > 0) {
    const { data: responses } = await supabaseClient
      .from('questionnaire_responses')
      .select('*')
      .in('assignment_id', completedIds);
    (responses || []).forEach(r => { responsesMap[r.assignment_id] = r; });
  }

  // Load templates for "send from template" dropdown
  const { data: templates } = await supabaseClient
    .from('questionnaire_templates')
    .select('id, titre, questions')
    .eq('coach_id', currentUser.id)
    .order('titre');

  let html = `
    <div class="card" style="padding:16px;margin-bottom:20px;">
      <h3 style="font-size:15px;margin:0 0 12px;">Envoyer un questionnaire</h3>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
        ${templates?.length ? `
          <select id="qt-send-template-select" class="form-control" style="width:auto;min-width:200px;">
            <option value="">— Choisir un template —</option>
            ${templates.map(t => `<option value="${t.id}">${escHtml(t.titre)} (${(t.questions||[]).length}q)</option>`).join('')}
          </select>
          <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;"><input type="checkbox" id="qt-send-obligatoire"> Obligatoire</label>
          <button class="btn btn-red btn-sm" onclick="sendFromTemplateToAthlete()"><i class="fas fa-paper-plane"></i> Envoyer</button>
        ` : '<span style="color:var(--text3);font-size:13px;">Aucun template. Créez-en un dans Templates.</span>'}
        <button class="btn btn-outline btn-sm" onclick="quickQuestionnaire()"><i class="fas fa-bolt"></i> Questionnaire rapide</button>
      </div>
    </div>

    <h3 style="font-size:15px;margin:0 0 12px;">Historique</h3>
  `;

  if (!assignments?.length) {
    html += '<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>Aucun questionnaire envoyé</p></div>';
  } else {
    html += assignments.map(a => {
      const title = a.questionnaire_templates?.titre || '(Sans titre)';
      const sentDate = new Date(a.sent_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
      const isPending = a.status === 'pending';
      const statusBadge = isPending
        ? '<span style="background:var(--warning);color:#000;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">En attente</span>'
        : `<span style="background:var(--success);color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">Complété${a.completed_at ? ' · ' + new Date(a.completed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}</span>`;
      const obligBadge = a.obligatoire ? ' <span style="background:var(--danger);color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">Obligatoire</span>' : '';

      const resp = responsesMap[a.id];
      const questions = a.questions_snapshot || [];
      const answers = resp ? (resp.responses || []) : [];

      // Build collapsible detail: questions + answers (if any)
      const detailHtml = questions.map((q, qi) => {
        const typeIcon = Q_TYPES.find(t => t.value === q.type)?.icon || 'fa-question';
        const reqTag = q.required ? '<span style="color:var(--danger);font-size:10px;margin-left:4px;">*</span>' : '';
        const ans = answers.find(r => r.question_id === q.id);
        let ansHtml = '';
        if (resp) {
          const ansVal = ans ? formatQAnswer(q, ans.answer) : '<span style="color:var(--text3);font-style:italic;">Pas de réponse</span>';
          ansHtml = `<div style="margin-top:4px;font-size:14px;padding-left:22px;">${ansVal}</div>`;
        }
        return `<div style="margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <i class="fas ${typeIcon}" style="font-size:11px;color:var(--text3);width:16px;text-align:center;"></i>
            <span style="font-size:13px;font-weight:600;color:var(--text2);">${escHtml(q.label || '(sans label)')}${reqTag}</span>
          </div>
          ${ansHtml}
        </div>`;
      }).join('');

      return `
      <div class="card" style="padding:14px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div style="cursor:pointer;flex:1;" onclick="toggleQtDetail('${a.id}')">
            <div style="display:flex;align-items:center;gap:8px;">
              <i class="fas fa-chevron-right" id="qt-chevron-${a.id}" style="font-size:11px;color:var(--text3);transition:transform .2s;"></i>
              <span style="font-weight:700;font-size:14px;">${escHtml(title)}</span>
              ${statusBadge}${obligBadge}
            </div>
            <div style="font-size:12px;color:var(--text3);margin-top:2px;padding-left:22px;">Envoyé le ${sentDate} · ${questions.length} question(s)</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;" onclick="event.stopPropagation()">
            ${isPending ? `<button class="btn btn-outline btn-sm" onclick="relanceQuestionnaire('${a.id}')"><i class="fas fa-bell"></i> Relancer</button>` : ''}
            <button class="btn btn-outline btn-sm btn-danger" onclick="deleteAssignment('${a.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div id="qt-detail-${a.id}" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border-subtle);">
          ${resp ? '<div style="font-size:12px;font-weight:700;color:var(--success);margin-bottom:10px;"><i class="fas fa-check-circle"></i> Réponses reçues</div>' : ''}
          ${detailHtml}
        </div>
      </div>`;
    }).join('');
  }

  container.innerHTML = html;
}

function formatQAnswer(question, answer) {
  if (answer == null) return '<span style="color:var(--text3);">—</span>';
  if (question.type === 'yesno') return answer ? '<span style="color:var(--success);">Oui</span>' : '<span style="color:var(--danger);">Non</span>';
  if (question.type === 'rating') return `<strong>${answer}</strong>/10`;
  if (question.type === 'choice' && Array.isArray(answer)) return answer.map(a => escHtml(a)).join(', ');
  return escHtml(String(answer));
}

function toggleQtDetail(assignmentId) {
  const el = document.getElementById('qt-detail-' + assignmentId);
  const chevron = document.getElementById('qt-chevron-' + assignmentId);
  if (!el) return;
  const open = el.style.display === 'none';
  el.style.display = open ? 'block' : 'none';
  if (chevron) chevron.style.transform = open ? 'rotate(90deg)' : '';
}

// ── Send from template to current athlete ──

async function sendFromTemplateToAthlete() {
  const sel = document.getElementById('qt-send-template-select');
  if (!sel || !sel.value) { notify('Sélectionnez un template', 'error'); return; }

  const templateId = sel.value;
  const obligatoire = document.getElementById('qt-send-obligatoire')?.checked || false;

  const { data: tpl } = await supabaseClient
    .from('questionnaire_templates')
    .select('titre, questions')
    .eq('id', templateId)
    .single();

  if (!tpl) { notify('Template introuvable', 'error'); return; }

  const { error } = await supabaseClient.from('questionnaire_assignments').insert({
    template_id: templateId,
    athlete_id: currentAthleteId,
    coach_id: currentUser.id,
    obligatoire,
    questions_snapshot: tpl.questions,
  });

  if (error) { handleError(error, 'sendFromTemplateToAthlete'); return; }

  // Notification
  if (currentAthleteObj?.user_id) {
    await notifyAthlete(
      currentAthleteObj.user_id,
      'questionnaire',
      'Nouveau questionnaire',
      `Votre coach vous a envoyé un questionnaire : ${tpl.titre}`,
      { template_id: templateId }
    );
  }

  notify('Questionnaire envoyé');
  loadAthleteTabQuestionnaires();
}

// ── Quick questionnaire (one-shot, not saved as template) ──

let _quickQtQuestions = [];

function quickQuestionnaire() {
  _quickQtQuestions = [{ id: qGenId(), label: '', type: 'text', options: [], required: false }];

  const container = document.getElementById('athlete-tab-content');
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h2 style="margin:0;font-size:18px;">Questionnaire rapide</h2>
      <button class="btn btn-outline" onclick="loadAthleteTabQuestionnaires()"><i class="fas fa-arrow-left"></i> Retour</button>
    </div>
    <div class="card" style="padding:20px;">
      <div class="form-group">
        <label>Titre *</label>
        <input type="text" id="quick-qt-titre" class="form-control" placeholder="Ex: Retour de vacances">
      </div>
      <h3 style="font-size:15px;margin:20px 0 12px;">Questions</h3>
      <div id="quick-qt-questions"></div>
      <button class="btn btn-outline" style="margin-top:12px;" onclick="quickQtAddQuestion()">
        <i class="fas fa-plus"></i> Ajouter une question
      </button>
      <label style="display:flex;align-items:center;gap:6px;margin-top:16px;font-size:13px;cursor:pointer;">
        <input type="checkbox" id="quick-qt-obligatoire"> Rendre obligatoire
      </label>
      <div style="display:flex;gap:12px;margin-top:20px;border-top:1px solid var(--border);padding-top:16px;">
        <button class="btn btn-red" onclick="sendQuickQuestionnaire()"><i class="fas fa-paper-plane"></i> Envoyer</button>
        <button class="btn btn-outline" onclick="loadAthleteTabQuestionnaires()">Annuler</button>
      </div>
    </div>
  `;

  quickQtRenderQuestions();
}

function quickQtRenderQuestions() {
  const list = document.getElementById('quick-qt-questions');
  if (!list) return;

  list.innerHTML = _quickQtQuestions.map((q, i) => {
    const typeOpts = Q_TYPES.map(t => `<option value="${t.value}" ${q.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('');
    const optionsHtml = q.type === 'choice' ? `
      <div style="margin-top:8px;">
        <label style="font-size:11px;color:var(--text3);">Options (une par ligne)</label>
        <textarea class="form-control" rows="3" onchange="quickQtUpdateOptions(${i}, this.value)" placeholder="Option 1&#10;Option 2&#10;Option 3">${(q.options || []).join('\n')}</textarea>
      </div>` : '';

    return `
    <div class="card" style="padding:14px;margin-bottom:10px;background:var(--bg2);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="font-weight:700;color:var(--text3);font-size:13px;min-width:24px;">#${i + 1}</span>
        <input type="text" class="form-control" style="flex:1;" value="${escHtml(q.label || '')}" onchange="quickQtUpdateLabel(${i}, this.value)" placeholder="Texte de la question">
        <select class="form-control" style="width:160px;" onchange="quickQtUpdateType(${i}, this.value)">${typeOpts}</select>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap;cursor:pointer;">
          <input type="checkbox" ${q.required ? 'checked' : ''} onchange="quickQtToggleRequired(${i}, this.checked)"> Oblig.
        </label>
      </div>
      ${optionsHtml}
      <div style="display:flex;gap:6px;margin-top:8px;">
        ${i > 0 ? `<button class="btn btn-outline btn-sm" onclick="quickQtMove(${i},-1)"><i class="fas fa-arrow-up"></i></button>` : ''}
        ${i < _quickQtQuestions.length - 1 ? `<button class="btn btn-outline btn-sm" onclick="quickQtMove(${i},1)"><i class="fas fa-arrow-down"></i></button>` : ''}
        <button class="btn btn-outline btn-sm btn-danger" onclick="quickQtRemove(${i})"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function quickQtAddQuestion() {
  _quickQtQuestions.push({ id: qGenId(), label: '', type: 'text', options: [], required: false });
  quickQtRenderQuestions();
}
function quickQtUpdateLabel(i, val) { _quickQtQuestions[i].label = val; }
function quickQtUpdateType(i, val) {
  _quickQtQuestions[i].type = val;
  if (val === 'choice' && !_quickQtQuestions[i].options) _quickQtQuestions[i].options = [];
  quickQtRenderQuestions();
}
function quickQtUpdateOptions(i, val) { _quickQtQuestions[i].options = val.split('\n').map(s => s.trim()).filter(Boolean); }
function quickQtToggleRequired(i, val) { _quickQtQuestions[i].required = val; }
function quickQtMove(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= _quickQtQuestions.length) return;
  [_quickQtQuestions[i], _quickQtQuestions[j]] = [_quickQtQuestions[j], _quickQtQuestions[i]];
  quickQtRenderQuestions();
}
function quickQtRemove(i) { _quickQtQuestions.splice(i, 1); quickQtRenderQuestions(); }

async function sendQuickQuestionnaire() {
  const titre = document.getElementById('quick-qt-titre').value.trim();
  if (!titre) { notify('Le titre est obligatoire', 'error'); return; }
  if (_quickQtQuestions.length === 0 || !_quickQtQuestions.some(q => q.label.trim())) {
    notify('Ajoutez au moins une question', 'error'); return;
  }

  _quickQtQuestions.forEach(q => { if (!q.id) q.id = qGenId(); });
  const obligatoire = document.getElementById('quick-qt-obligatoire')?.checked || false;

  const { error } = await supabaseClient.from('questionnaire_assignments').insert({
    template_id: null,
    athlete_id: currentAthleteId,
    coach_id: currentUser.id,
    obligatoire,
    questions_snapshot: _quickQtQuestions,
  });

  if (error) { handleError(error, 'sendQuickQuestionnaire'); return; }

  if (currentAthleteObj?.user_id) {
    await notifyAthlete(
      currentAthleteObj.user_id,
      'questionnaire',
      'Nouveau questionnaire',
      `Votre coach vous a envoyé un questionnaire : ${titre}`,
      {}
    );
  }

  notify('Questionnaire envoyé');
  loadAthleteTabQuestionnaires();
}

// ── Relance & delete ──

async function relanceQuestionnaire(assignmentId) {
  const { data: a } = await supabaseClient
    .from('questionnaire_assignments')
    .select('*, questionnaire_templates(titre), athletes(user_id)')
    .eq('id', assignmentId)
    .single();

  if (!a) return;
  const userId = a.athletes?.user_id;
  if (!userId) { notify('Pas de user_id pour cet athlète', 'error'); return; }

  const title = a.questionnaire_templates?.titre || 'Questionnaire';
  await notifyAthlete(userId, 'rappel', 'Rappel questionnaire', `N'oubliez pas de remplir : ${title}`, {});
  notify('Rappel envoyé');
}

async function deleteAssignment(assignmentId) {
  if (!confirm('Supprimer ce questionnaire envoyé ?')) return;
  const { error } = await supabaseClient.from('questionnaire_assignments').delete().eq('id', assignmentId);
  if (error) { handleError(error, 'deleteAssignment'); return; }
  notify('Questionnaire supprimé');
  loadAthleteTabQuestionnaires();
}
