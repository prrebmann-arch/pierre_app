// ===== ONBOARDING WORKFLOW MANAGEMENT =====

const STEP_TYPES = [
  { value: 'video', label: 'Vidéo', icon: 'fa-play-circle' },
  { value: 'contract', label: 'Contrat', icon: 'fa-file-signature' },
  { value: 'questionnaire', label: 'Questionnaire', icon: 'fa-clipboard-list' },
  { value: 'formation', label: 'Formation', icon: 'fa-graduation-cap' }
];

// ── Load workflows in templates tab ──
async function loadWorkflows() {
  const container = document.getElementById('templates-content');
  container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const { data: workflows } = await supabaseClient
    .from('onboarding_workflows')
    .select('*')
    .eq('coach_id', currentUser.id)
    .order('created_at', { ascending: false });

  container.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
      <button class="btn btn-red" onclick="createWorkflow()">
        <i class="fas fa-plus"></i> Nouveau workflow
      </button>
    </div>
    ${workflows?.length ? workflows.map(w => {
      const steps = (typeof w.steps === 'string' ? JSON.parse(w.steps) : w.steps) || [];
      return `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div>
            <div class="card-title">${escHtml(w.name)}</div>
            <div style="color:var(--text2);font-size:12px;margin-top:4px;">
              ${steps.length} étape(s)${w.description ? ' — ' + escHtml(w.description) : ''}
              <span style="margin-left:8px;color:var(--text3);">${steps.map(s => {
                const t = STEP_TYPES.find(st => st.value === s.type);
                return t ? `<i class="fas ${t.icon}" style="margin:0 2px;" title="${t.label}"></i>` : '';
              }).join('')}</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-outline btn-sm" onclick="editWorkflow('${w.id}')"><i class="fas fa-pen"></i></button>
            <button class="btn btn-outline btn-sm btn-danger" onclick="deleteWorkflow('${w.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>`;
    }).join('') : '<div class="empty-state"><i class="fas fa-route"></i><p>Aucun workflow</p></div>'}
  `;
}

// ── Create workflow ──
function createWorkflow() {
  const container = document.getElementById('templates-content');
  container.innerHTML = `
    <div class="card" style="padding:24px;">
      <h2 style="margin:0 0 20px;font-size:18px;">Nouveau workflow</h2>
      <div class="form-group">
        <label>Nom du workflow</label>
        <input type="text" id="wf-name" placeholder="Ex: Parcours Premium" style="width:100%;">
      </div>
      <div class="form-group">
        <label>Description (optionnel)</label>
        <input type="text" id="wf-desc" placeholder="Ex: Vidéo + contrat + formation 7 jours" style="width:100%;">
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin:24px 0 12px;">
        <h3 style="margin:0;font-size:15px;color:var(--text2);">Étapes du parcours</h3>
        <button class="btn btn-outline btn-sm" onclick="addWfStep()"><i class="fas fa-plus"></i> Ajouter une étape</button>
      </div>
      <div id="wf-steps"></div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:24px;padding-top:16px;border-top:1px solid var(--border);">
        <button class="btn btn-outline" onclick="loadWorkflows()">Annuler</button>
        <button class="btn btn-red" onclick="saveWorkflow()"><i class="fas fa-check"></i> Créer</button>
      </div>
    </div>
  `;
}

// ── Edit workflow ──
async function editWorkflow(id) {
  const container = document.getElementById('templates-content');
  container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const { data: wf } = await supabaseClient.from('onboarding_workflows').select('*').eq('id', id).single();
  if (!wf) { notify('Workflow introuvable', 'error'); loadWorkflows(); return; }

  const steps = (typeof wf.steps === 'string' ? JSON.parse(wf.steps) : wf.steps) || [];

  container.innerHTML = `
    <div class="card" style="padding:24px;">
      <h2 style="margin:0 0 20px;font-size:18px;">Modifier le workflow</h2>
      <input type="hidden" id="wf-edit-id" value="${wf.id}">
      <div class="form-group">
        <label>Nom du workflow</label>
        <input type="text" id="wf-name" value="${escHtml(wf.name)}" style="width:100%;">
      </div>
      <div class="form-group">
        <label>Description (optionnel)</label>
        <input type="text" id="wf-desc" value="${escHtml(wf.description || '')}" style="width:100%;">
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin:24px 0 12px;">
        <h3 style="margin:0;font-size:15px;color:var(--text2);">Étapes du parcours</h3>
        <button class="btn btn-outline btn-sm" onclick="addWfStep()"><i class="fas fa-plus"></i> Ajouter une étape</button>
      </div>
      <div id="wf-steps"></div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:24px;padding-top:16px;border-top:1px solid var(--border);">
        <button class="btn btn-outline" onclick="loadWorkflows()">Annuler</button>
        <button class="btn btn-red" onclick="saveWorkflow('${wf.id}')"><i class="fas fa-check"></i> Sauvegarder</button>
      </div>
    </div>
  `;

  // Populate existing steps
  steps.forEach(s => addWfStep(s));
}

// ── Add step to editor ──
function addWfStep(existing) {
  const stepsDiv = document.getElementById('wf-steps');
  const idx = stepsDiv.children.length;
  const div = document.createElement('div');
  div.className = 'wf-step';
  div.dataset.idx = idx;

  const type = existing?.type || 'video';

  div.innerHTML = `
    <div class="wf-step-header">
      <span class="wf-step-num">${idx + 1}</span>
      <select class="wf-step-type" onchange="onWfStepTypeChange(this)">
        ${STEP_TYPES.map(t => `<option value="${t.value}" ${t.value === type ? 'selected' : ''}>${t.label}</option>`).join('')}
      </select>
      <input type="text" class="wf-step-title" placeholder="Titre de l'étape" value="${escHtml(existing?.title || '')}">
      <div style="display:flex;gap:4px;margin-left:auto;">
        <button class="btn btn-outline btn-sm" onclick="moveWfStep(this,-1)" title="Monter"><i class="fas fa-arrow-up"></i></button>
        <button class="btn btn-outline btn-sm" onclick="moveWfStep(this,1)" title="Descendre"><i class="fas fa-arrow-down"></i></button>
        <button class="btn btn-outline btn-sm btn-danger" onclick="removeWfStep(this)"><i class="fas fa-trash"></i></button>
      </div>
    </div>
    <div class="wf-step-body"></div>
  `;

  stepsDiv.appendChild(div);
  renderStepBody(div, type, existing);
}

// ── Render step body based on type ──
function renderStepBody(stepDiv, type, data) {
  const body = stepDiv.querySelector('.wf-step-body');

  switch (type) {
    case 'video':
      body.innerHTML = `
        <div class="form-group" style="margin:0;">
          <label style="font-size:12px;">URL de la vidéo</label>
          <input type="url" class="wf-video-url" placeholder="https://youtube.com/watch?v=..." value="${escHtml(data?.video_url || '')}" style="width:100%;">
        </div>
      `;
      break;

    case 'contract':
      body.innerHTML = `
        <div class="form-group" style="margin:0;">
          <label style="font-size:12px;">Texte du contrat</label>
          <textarea class="wf-contract-text" rows="5" placeholder="Saisissez le texte du contrat ici..." style="width:100%;resize:vertical;">${escHtml(data?.contract_text || '')}</textarea>
        </div>
      `;
      break;

    case 'questionnaire':
      body.innerHTML = `
        <div class="wf-questions">
          ${(data?.questions || []).map((q, i) => buildQuestionHtml(q, i)).join('')}
        </div>
        <button class="btn btn-outline btn-sm" onclick="addWfQuestion(this)" style="margin-top:8px;"><i class="fas fa-plus"></i> Ajouter une question</button>
      `;
      if (!data?.questions?.length) {
        addWfQuestion(body.querySelector('button'));
      }
      break;

    case 'formation':
      body.innerHTML = `
        <div class="form-group" style="margin:0;">
          <label style="font-size:12px;">ID de la formation (optionnel — lié à l'onglet Formations)</label>
          <input type="text" class="wf-formation-id" placeholder="Laisser vide pour lien libre" value="${escHtml(data?.formation_id || '')}" style="width:100%;">
        </div>
      `;
      break;
  }
}

// ── Question builder ──
function buildQuestionHtml(q, idx) {
  const qType = q?.type || 'text';
  return `
    <div class="wf-question" style="padding:8px 12px;margin-bottom:6px;background:var(--bg2);border-radius:8px;border:1px solid var(--border);">
      <div style="display:flex;gap:8px;align-items:center;">
        <span style="color:var(--text3);font-size:11px;font-weight:600;">${idx + 1}.</span>
        <input type="text" class="wf-q-label" placeholder="Question..." value="${escHtml(q?.label || '')}" style="flex:1;">
        <select class="wf-q-type" onchange="onWfQTypeChange(this)" style="width:110px;">
          <option value="text" ${qType === 'text' ? 'selected' : ''}>Texte libre</option>
          <option value="choice" ${qType === 'choice' ? 'selected' : ''}>Choix multiple</option>
          <option value="number" ${qType === 'number' ? 'selected' : ''}>Nombre</option>
        </select>
        <button class="btn btn-outline btn-sm btn-danger" onclick="this.closest('.wf-question').remove()" style="padding:4px 8px;"><i class="fas fa-times"></i></button>
      </div>
      ${qType === 'choice' ? `<div class="wf-q-choices" style="margin-top:6px;padding-left:24px;">
        ${(q?.choices || ['Option 1']).map(c => `<div style="display:flex;gap:4px;margin-bottom:4px;"><input type="text" class="wf-q-choice" value="${escHtml(c)}" style="flex:1;font-size:12px;"><button class="btn btn-outline btn-sm btn-danger" onclick="this.parentElement.remove()" style="padding:2px 6px;font-size:10px;"><i class="fas fa-times"></i></button></div>`).join('')}
        <button class="btn btn-outline btn-sm" onclick="addWfChoice(this)" style="font-size:11px;margin-top:2px;"><i class="fas fa-plus"></i> Option</button>
      </div>` : ''}
    </div>
  `;
}

function addWfQuestion(btn) {
  const container = btn.closest('.wf-step-body').querySelector('.wf-questions');
  const idx = container.children.length;
  const div = document.createElement('div');
  div.innerHTML = buildQuestionHtml({}, idx);
  container.appendChild(div.firstElementChild);
}

function addWfChoice(btn) {
  const choicesDiv = btn.closest('.wf-q-choices');
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;gap:4px;margin-bottom:4px;';
  div.innerHTML = `<input type="text" class="wf-q-choice" value="" style="flex:1;font-size:12px;"><button class="btn btn-outline btn-sm btn-danger" onclick="this.parentElement.remove()" style="padding:2px 6px;font-size:10px;"><i class="fas fa-times"></i></button>`;
  choicesDiv.insertBefore(div, btn);
}

function onWfQTypeChange(sel) {
  const qDiv = sel.closest('.wf-question');
  const existing = qDiv.querySelector('.wf-q-choices');
  if (sel.value === 'choice' && !existing) {
    const choicesHtml = `<div class="wf-q-choices" style="margin-top:6px;padding-left:24px;">
      <div style="display:flex;gap:4px;margin-bottom:4px;"><input type="text" class="wf-q-choice" value="Option 1" style="flex:1;font-size:12px;"><button class="btn btn-outline btn-sm btn-danger" onclick="this.parentElement.remove()" style="padding:2px 6px;font-size:10px;"><i class="fas fa-times"></i></button></div>
      <button class="btn btn-outline btn-sm" onclick="addWfChoice(this)" style="font-size:11px;margin-top:2px;"><i class="fas fa-plus"></i> Option</button>
    </div>`;
    sel.closest('div').insertAdjacentHTML('afterend', choicesHtml);
  } else if (sel.value !== 'choice' && existing) {
    existing.remove();
  }
}

// ── Step type change ──
function onWfStepTypeChange(sel) {
  const stepDiv = sel.closest('.wf-step');
  renderStepBody(stepDiv, sel.value, null);
}

// ── Move / remove steps ──
function moveWfStep(btn, dir) {
  const stepDiv = btn.closest('.wf-step');
  const parent = stepDiv.parentElement;
  const siblings = [...parent.children];
  const idx = siblings.indexOf(stepDiv);
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= siblings.length) return;

  if (dir === -1) {
    parent.insertBefore(stepDiv, siblings[targetIdx]);
  } else {
    parent.insertBefore(siblings[targetIdx], stepDiv);
  }
  renumberSteps();
}

function removeWfStep(btn) {
  btn.closest('.wf-step').remove();
  renumberSteps();
}

function renumberSteps() {
  document.querySelectorAll('#wf-steps .wf-step').forEach((s, i) => {
    s.querySelector('.wf-step-num').textContent = i + 1;
  });
}

// ── Collect steps data ──
function getWfStepsData() {
  const steps = [];
  document.querySelectorAll('#wf-steps .wf-step').forEach((s, i) => {
    const type = s.querySelector('.wf-step-type').value;
    const title = s.querySelector('.wf-step-title').value.trim();
    const step = { type, title, position: i + 1 };

    switch (type) {
      case 'video': {
        let videoUrl = s.querySelector('.wf-video-url')?.value.trim() || '';
        // Fix BUG-C7: if coach pasted YouTube URL in title field, move it to video_url
        if (!videoUrl && step.title && (step.title.includes('youtube.com') || step.title.includes('youtu.be'))) {
          videoUrl = step.title;
          step.title = 'Vidéo';
        }
        step.video_url = videoUrl;
        break;
      }
      case 'contract':
        step.contract_text = s.querySelector('.wf-contract-text')?.value.trim() || '';
        break;
      case 'questionnaire':
        step.questions = [];
        s.querySelectorAll('.wf-question').forEach(q => {
          const qData = {
            label: q.querySelector('.wf-q-label').value.trim(),
            type: q.querySelector('.wf-q-type').value
          };
          if (qData.type === 'choice') {
            qData.choices = [...q.querySelectorAll('.wf-q-choice')].map(c => c.value.trim()).filter(Boolean);
          }
          if (qData.label) step.questions.push(qData);
        });
        break;
      case 'formation':
        step.formation_id = s.querySelector('.wf-formation-id')?.value.trim() || '';
        break;
    }

    steps.push(step);
  });
  return steps;
}

// ── Save workflow ──
async function saveWorkflow(editId) {
  const name = document.getElementById('wf-name').value.trim();
  if (!name) { notify('Le nom est requis', 'error'); return; }

  const steps = getWfStepsData();
  const description = document.getElementById('wf-desc').value.trim() || null;

  const payload = { name, description, steps };

  if (editId) {
    const { error } = await supabaseClient.from('onboarding_workflows').update(payload).eq('id', editId);
    if (error) { handleError(error, 'workflow'); return; }
    notify('Workflow mis à jour', 'success');
  } else {
    payload.coach_id = currentUser.id;
    const { error } = await supabaseClient.from('onboarding_workflows').insert(payload);
    if (error) { handleError(error, 'workflow'); return; }
    notify('Workflow créé', 'success');
  }

  loadWorkflows();
}

// ── Delete workflow ──
async function deleteWorkflow(id) {
  if (!confirm('Supprimer ce workflow ?')) return;
  const { error } = await supabaseClient.from('onboarding_workflows').delete().eq('id', id);
  if (error) { handleError(error, 'workflow'); return; }
  notify('Workflow supprimé', 'success');
  loadWorkflows();
}

// ── Populate workflow dropdown in athlete creation modal ──
async function loadWorkflowDropdown() {
  const sel = document.getElementById('athlete-workflow');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Aucun —</option>';

  const session = (await supabaseClient.auth.getSession()).data?.session;
  if (!session) return;

  const { data } = await supabaseClient
    .from('onboarding_workflows')
    .select('id, name')
    .eq('coach_id', session.user.id)
    .order('name');

  (data || []).forEach(w => {
    sel.innerHTML += `<option value="${w.id}">${escHtml(w.name)}</option>`;
  });
}
