// ===== TEMPLATES MANAGEMENT =====

async function loadTemplates() {
  const container = document.getElementById('templates-content');
  container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  if (currentTemplateTab === 'workflow') {
    loadWorkflows();
    return;
  }

  if (currentTemplateTab === 'questionnaires') {
    loadQuestionnaireTemplates();
    return;
  }

  if (currentTemplateTab === 'training') {
    const { data: templates } = await supabaseClient
      .from('training_templates')
      .select('*')
      .eq('coach_id', currentUser.id)
      .order('created_at', { ascending: false });

    window._trainingTemplates = templates || [];
    window._tplSearch = '';
    renderTrainingTemplatesList(container);
  } else {
    // Nutrition — 3 sub-tabs: Diète, Jour, Repas
    const ntplSub = window._ntplSubTab || 'diete';
    const { data: templates } = await supabaseClient
      .from('nutrition_templates')
      .select('*')
      .eq('coach_id', currentUser.id)
      .order('created_at', { ascending: false });

    window._nutritionTemplates = templates || [];
    window._ntplSearch = window._ntplSearch || '';

    const filtered = (templates || []).filter(t => {
      const tt = t.template_type || 'jour';
      return tt === ntplSub;
    });

    const q = (window._ntplSearch || '').toLowerCase();
    const searched = q ? filtered.filter(t => t.nom.toLowerCase().includes(q)) : filtered;

    // Group by category
    const groups = {};
    searched.forEach(t => {
      const cat = t.category || 'Sans catégorie';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });
    const catNames = Object.keys(groups).sort((a, b) => {
      if (a === 'Sans catégorie') return 1;
      if (b === 'Sans catégorie') return -1;
      return a.localeCompare(b);
    });
    if (!window._ntplCollapsed) window._ntplCollapsed = {};

    const subTabs = `
      <div style="display:flex;gap:4px;margin-bottom:16px;">
        <button class="athlete-tab-btn${ntplSub==='diete'?' active':''}" onclick="switchNtplSubTab('diete')"><i class="fas fa-utensils"></i> Diète</button>
        <button class="athlete-tab-btn${ntplSub==='jour'?' active':''}" onclick="switchNtplSubTab('jour')"><i class="fas fa-calendar-day"></i> Jour</button>
        <button class="athlete-tab-btn${ntplSub==='repas'?' active':''}" onclick="switchNtplSubTab('repas')"><i class="fas fa-drumstick-bite"></i> Repas</button>
      </div>`;

    const createLabel = ntplSub === 'diete' ? 'Nouvelle diète' : ntplSub === 'jour' ? 'Nouveau jour' : 'Nouveau repas';

    let listHtml = '';
    if (!searched.length) {
      const emptyLabel = q ? 'Aucun résultat' : (ntplSub === 'diete' ? 'Aucun template diète' : ntplSub === 'jour' ? 'Aucun template jour' : 'Aucun template repas');
      listHtml = `<div class="empty-state"><i class="fas fa-utensils"></i><p>${emptyLabel}</p></div>`;
    } else {
      catNames.forEach(cat => {
        const items = groups[cat];
        const collapsed = window._ntplCollapsed[cat];
        listHtml += `<div style="margin-bottom:12px;">
          <div onclick="toggleNtplCategory('${escHtml(cat)}')" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;user-select:none;margin-bottom:${collapsed ? '0' : '8px'};">
            <i class="fas fa-chevron-${collapsed ? 'right' : 'down'}" style="font-size:10px;color:var(--text3);width:12px;"></i>
            <i class="fas fa-folder${collapsed ? '' : '-open'}" style="color:var(--primary);font-size:13px;"></i>
            <span style="font-size:13px;font-weight:600;color:var(--text);flex:1;">${escHtml(cat)}</span>
            <span style="font-size:11px;color:var(--text3);">${items.length}</span>
          </div>`;
        if (!collapsed) {
          listHtml += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px;">';
          items.forEach(t => {
            let mc = 0;
            try { const md = typeof t.meals_data === 'string' ? JSON.parse(t.meals_data) : (t.meals_data || []); mc = md.length; } catch(e) {}
            const subtitle = `${t.calories_objectif||0} kcal · P:${t.proteines||0}g G:${t.glucides||0}g L:${t.lipides||0}g${ntplSub === 'jour' && mc ? ' · ' + mc + ' repas' : ''}`;
            listHtml += `
              <div class="card" style="margin:0;">
                <div class="card-header">
                  <div style="flex:1;min-width:0;">
                    <div class="card-title" style="font-size:14px;">${escHtml(t.nom)}</div>
                    <div style="color:var(--text2);font-size:11px;margin-top:3px;">${subtitle}</div>
                  </div>
                  <div style="display:flex;gap:6px;flex-shrink:0;">
                    <button class="btn btn-outline btn-sm" onclick="editNutritionTemplate('${t.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn btn-outline btn-sm btn-danger" onclick="deleteNutritionTemplate('${t.id}')"><i class="fas fa-trash"></i></button>
                  </div>
                </div>
              </div>`;
          });
          listHtml += '</div>';
        }
        listHtml += '</div>';
      });
    }

    container.innerHTML = `
      ${subTabs}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:12px;flex-wrap:wrap;">
        <div style="position:relative;flex:1;min-width:200px;max-width:360px;">
          <i class="fas fa-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:13px;"></i>
          <input type="text" value="${escHtml(window._ntplSearch || '')}" placeholder="Rechercher..." oninput="window._ntplSearch=this.value;loadTemplates()" style="width:100%;padding:8px 12px 8px 34px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;">
        </div>
        <button class="btn btn-red" onclick="createNutritionTemplate('${ntplSub}')">
          <i class="fas fa-plus"></i> ${createLabel}
        </button>
      </div>
      ${listHtml}
    `;
  }
}

// ===== TRAINING TEMPLATES LIST (categories + search) =====

function renderTrainingTemplatesList(container) {
  const templates = window._trainingTemplates || [];
  const q = (window._tplSearch || '').toLowerCase();

  // Filter by search
  const filtered = q ? templates.filter(t => t.nom.toLowerCase().includes(q)) : templates;

  // Group by category
  const groups = {};
  filtered.forEach(t => {
    const cat = t.category || 'Sans catégorie';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(t);
  });

  // Sort: named categories first, "Sans catégorie" last
  const catNames = Object.keys(groups).sort((a, b) => {
    if (a === 'Sans catégorie') return 1;
    if (b === 'Sans catégorie') return -1;
    return a.localeCompare(b);
  });

  // Collapsed state
  if (!window._tplCollapsed) window._tplCollapsed = {};

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:12px;flex-wrap:wrap;">
      <div style="position:relative;flex:1;min-width:200px;max-width:360px;">
        <i class="fas fa-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:13px;"></i>
        <input type="text" value="${escHtml(window._tplSearch || '')}" placeholder="Rechercher un template..." oninput="window._tplSearch=this.value;renderTrainingTemplatesList(document.getElementById('templates-content'))" style="width:100%;padding:8px 12px 8px 34px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;">
      </div>
      <button class="btn btn-red" onclick="createWorkoutTemplate()">
        <i class="fas fa-plus"></i> Nouveau template
      </button>
    </div>`;

  if (!filtered.length) {
    html += q
      ? '<div class="empty-state"><i class="fas fa-search"></i><p>Aucun résultat</p></div>'
      : '<div class="empty-state"><i class="fas fa-dumbbell"></i><p>Aucun template training</p></div>';
  } else {
    catNames.forEach(cat => {
      const items = groups[cat];
      const collapsed = window._tplCollapsed[cat];
      html += `
        <div style="margin-bottom:12px;">
          <div onclick="toggleTplCategory('${escHtml(cat)}')" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;user-select:none;margin-bottom:${collapsed ? '0' : '8px'};">
            <i class="fas fa-chevron-${collapsed ? 'right' : 'down'}" style="font-size:10px;color:var(--text3);width:12px;"></i>
            <i class="fas fa-folder${collapsed ? '' : '-open'}" style="color:var(--primary);font-size:13px;"></i>
            <span style="font-size:13px;font-weight:600;color:var(--text);flex:1;">${escHtml(cat)}</span>
            <span style="font-size:11px;color:var(--text3);">${items.length}</span>
          </div>`;
      if (!collapsed) {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px;">';
        items.forEach(t => {
          html += buildTrainingTemplateCard(t);
        });
        html += '</div>';
      }
      html += '</div>';
    });
  }

  container.innerHTML = html;
}

function buildTrainingTemplateCard(t) {
  let sd = [];
  try { sd = typeof t.sessions_data === 'string' ? JSON.parse(t.sessions_data) : (t.sessions_data || []); } catch(e) {}
  let totalEx = 0, totalSeries = 0;
  sd.forEach(s => {
    let exs = [];
    try { exs = typeof s.exercices === 'string' ? JSON.parse(s.exercices) : (s.exercices || s.exercises || []); } catch(e) {}
    exs.forEach(ex => { totalEx++; totalSeries += (parseInt(ex.series) || 0); });
  });
  const sessionTags = sd.map(s => `<span style="display:inline-block;padding:2px 8px;background:var(--bg3);border-radius:6px;font-size:11px;color:var(--text2);font-weight:500;">${escHtml(s.nom || 'Séance')}</span>`).join(' ');
  return `
    <div class="card" style="margin:0;cursor:pointer;" onclick="editWorkoutTemplate('${t.id}')">
      <div class="card-header">
        <div style="flex:1;min-width:0;">
          <div class="card-title" style="font-size:14px;">${escHtml(t.nom)}</div>
          <div style="color:var(--text3);font-size:11px;margin-top:3px;">${sd.length} séance(s) · ${totalEx} exos · ${totalSeries} séries</div>
          ${sessionTags ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:6px;">${sessionTags}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;" onclick="event.stopPropagation()">
          <button class="btn btn-outline btn-sm" onclick="editWorkoutTemplate('${t.id}')" title="Modifier"><i class="fas fa-pen"></i></button>
          <button class="btn btn-outline btn-sm btn-danger" onclick="deleteWorkoutTemplate('${t.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>`;
}

function toggleTplCategory(cat) {
  if (!window._tplCollapsed) window._tplCollapsed = {};
  window._tplCollapsed[cat] = !window._tplCollapsed[cat];
  renderTrainingTemplatesList(document.getElementById('templates-content'));
}

// ===== TRAINING TEMPLATE CREATE / EDIT =====

async function createWorkoutTemplate() {
  const container = document.getElementById('templates-content');
  container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';
  await loadExercices();
  window._tplEditId = null;
  window._tplEditCategory = '';
  window._tpSessions = [{ nom: '', jour: '', exercises: [] }];
  window._tpActiveSession = 0;
  window._tplMode = true;
  renderTplEditor(container, '', 'pattern', {}, false);
}

async function editWorkoutTemplate(id) {
  const container = document.getElementById('templates-content');
  container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';
  await loadExercices();

  const { data: tpl } = await supabaseClient.from('training_templates').select('*').eq('id', id).single();
  if (!tpl) { notify('Template introuvable', 'error'); loadTemplates(); return; }

  window._tplEditId = id;
  window._tplMode = true;
  window._tplEditCategory = tpl.category || '';
  let pd = {};
  try { pd = typeof tpl.pattern_data === 'string' ? JSON.parse(tpl.pattern_data) : (tpl.pattern_data || {}); } catch(e) {}
  const patternType = tpl.pattern_type || 'pattern';

  let sessions = [];
  try { sessions = typeof tpl.sessions_data === 'string' ? JSON.parse(tpl.sessions_data) : (tpl.sessions_data || []); } catch(e) {}
  window._tpSessions = sessions.map(s => ({
    nom: s.nom || '',
    jour: s.jour || '',
    exercises: ((() => { try { return typeof s.exercices === 'string' ? JSON.parse(s.exercices) : (s.exercices || s.exercises || []); } catch(e) { return []; } })()).map(ex => ({
      ...ex,
      muscle_principal: ex.muscle_principal || ((window.exercicesDB || []).find(e => e.nom === ex.nom || String(e.id) === String(ex.exercice_id)))?.muscle_principal || ''
    }))
  }));
  if (!window._tpSessions.length) window._tpSessions = [{ nom: '', jour: '', exercises: [] }];
  window._tpActiveSession = 0;
  renderTplEditor(container, tpl.nom || '', patternType, pd, true);
}

function renderTplEditor(el, progName, patternType, pd, isEdit) {
  const sessions = window._tpSessions;
  const activeIdx = window._tpActiveSession || 0;

  const tabsHtml = sessions.map((s, i) => {
    const label = s.nom || ('Séance ' + (i + 1));
    return `<button class="tr-session-tab ${i===activeIdx?'active':''}" onclick="switchTpSession(${i})">${escHtml(label)}</button>`;
  }).join('') + `<button class="tr-session-tab-add" onclick="addTplSessionNew()" title="Ajouter une séance"><i class="fas fa-plus"></i></button>`;

  const muscleGroups = [...new Set((window.exercicesDB || []).map(e => e.muscle_principal).filter(Boolean))].sort();

  // Build category options from existing templates
  const existingCats = [...new Set((window._trainingTemplates || []).map(t => t.category).filter(Boolean))].sort();
  const currentCat = window._tplEditCategory || '';
  const catOptions = existingCats.map(c => `<option value="${escHtml(c)}"${c === currentCat ? ' selected' : ''}>${escHtml(c)}</option>`).join('');

  el.innerHTML = `
    <div class="tr-header">
      <div style="display:flex;align-items:center;gap:12px;flex:1;flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" onclick="window._tplMode=false;loadTemplates()"><i class="fas fa-arrow-left"></i></button>
        <input type="text" id="tp-nom" value="${escHtml(progName)}" placeholder="Nom du template" class="tr-session-name-input" style="max-width:350px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <i class="fas fa-folder" style="color:var(--text3);font-size:12px;"></i>
          <select id="tp-category" style="padding:5px 8px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;">
            <option value="">Sans catégorie</option>
            ${catOptions}
          </select>
          <button class="btn btn-outline btn-sm" onclick="addTplCategory()" title="Nouvelle catégorie" style="padding:4px 8px;"><i class="fas fa-plus" style="font-size:10px;"></i></button>
        </div>
      </div>
      <button class="btn btn-red" onclick="saveTplFromEditor()"><i class="fas fa-save"></i> ${isEdit ? 'Enregistrer' : 'Créer'}</button>
    </div>
    <div class="tr-config-row">
      <select id="tp-type" onchange="updateTpPatternInputs()" class="inline-input" style="width:auto;padding:6px 10px;font-size:12px;">
        <option value="pattern"${patternType==='pattern'?' selected':''}>Pattern</option>
        <option value="fixed"${patternType==='fixed'?' selected':''}>Jours fixes</option>
      </select>
      <div id="tp-pattern-group" style="${patternType!=='pattern'?'display:none;':''}flex:1;">
        <input type="text" id="tp-pattern" value="${escHtml(pd.pattern||'')}" placeholder="ex: Haut / Bas / Repos" class="inline-input" style="font-size:12px;padding:6px 10px;">
      </div>
      <div id="tp-fixed-group" style="${patternType!=='fixed'?'display:none;':''}flex:1;">
        <input type="text" id="tp-fixed" value="${escHtml((pd.days||[]).join(', '))}" placeholder="ex: Lundi, Mercredi, Vendredi" class="inline-input" style="font-size:12px;padding:6px 10px;">
      </div>
    </div>
    <div class="tr-session-tabs" id="tp-session-tabs">${tabsHtml}</div>
    <div id="tp-program-total" style="padding:12px 20px;background:var(--bg2);border-left:1px solid var(--border);border-right:1px solid var(--border);"></div>
    <div class="tr-body">
      <div class="tr-library">
        <div class="tr-library-header">
          <i class="fas fa-book-open" style="color:var(--text3);"></i>
          <span class="tr-library-title">Bibliothèque d'exercices</span>
        </div>
        <div class="tr-library-search">
          <i class="fas fa-search"></i>
          <input type="text" id="tp-lib-search" placeholder="Rechercher un exercice..." oninput="filterTpLibrary()">
        </div>
        <div class="tr-library-filters" id="tp-lib-filters">
          <button class="tr-library-filter active" onclick="setTpLibFilter(this, '')">Tous</button>
          ${muscleGroups.map(m => `<button class="tr-library-filter" onclick="setTpLibFilter(this, '${escHtml(m)}')">${escHtml(m)}</button>`).join('')}
        </div>
        <div class="tr-library-results" id="tp-lib-results"></div>
      </div>
      <div class="tr-session-content" id="tp-session-editor"></div>
    </div>`;

  window._tpLibFilter = '';
  filterTpLibrary();
  renderTpSessionEditor();
}

function addTplCategory() {
  const btn = document.querySelector('#tp-category + button');
  if (!btn) return;
  // Replace button with inline input
  const wrap = document.createElement('span');
  wrap.style.cssText = 'display:inline-flex;gap:4px;align-items:center;';
  wrap.innerHTML = `<input type="text" id="tp-new-cat" placeholder="Nom…" style="padding:4px 8px;background:var(--bg2);border:1px solid var(--primary);border-radius:6px;color:var(--text);font-size:12px;width:130px;" autofocus>
    <button class="btn btn-outline btn-sm" onclick="confirmTplCategory()" style="padding:4px 8px;"><i class="fas fa-check" style="font-size:10px;color:var(--success);"></i></button>
    <button class="btn btn-outline btn-sm" onclick="cancelTplCategory()" style="padding:4px 8px;"><i class="fas fa-times" style="font-size:10px;"></i></button>`;
  btn.replaceWith(wrap);
  const inp = document.getElementById('tp-new-cat');
  inp.focus();
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') confirmTplCategory(); if (e.key === 'Escape') cancelTplCategory(); });
}

function confirmTplCategory() {
  const inp = document.getElementById('tp-new-cat');
  const name = inp?.value?.trim();
  if (!name) return cancelTplCategory();
  const sel = document.getElementById('tp-category');
  const exists = [...sel.options].some(o => o.value === name);
  if (!exists) { const opt = document.createElement('option'); opt.value = name; opt.textContent = name; sel.appendChild(opt); }
  sel.value = name;
  // Restore + button
  const wrap = inp.closest('span');
  const btn = document.createElement('button');
  btn.className = 'btn btn-outline btn-sm';
  btn.onclick = addTplCategory;
  btn.title = 'Nouvelle catégorie';
  btn.style.cssText = 'padding:4px 8px;';
  btn.innerHTML = '<i class="fas fa-plus" style="font-size:10px;"></i>';
  wrap.replaceWith(btn);
}

function cancelTplCategory() {
  const inp = document.getElementById('tp-new-cat');
  if (!inp) return;
  const wrap = inp.closest('span');
  const btn = document.createElement('button');
  btn.className = 'btn btn-outline btn-sm';
  btn.onclick = addTplCategory;
  btn.title = 'Nouvelle catégorie';
  btn.style.cssText = 'padding:4px 8px;';
  btn.innerHTML = '<i class="fas fa-plus" style="font-size:10px;"></i>';
  wrap.replaceWith(btn);
}

function addTplSessionNew() {
  saveTpSessionInputs();
  window._tpSessions.push({ nom: '', jour: '', exercises: [] });
  window._tpActiveSession = window._tpSessions.length - 1;
  const el = document.getElementById('templates-content');
  const progName = document.getElementById('tp-nom')?.value || '';
  const patternType = document.getElementById('tp-type')?.value || 'pattern';
  const pd = patternType === 'pattern'
    ? { pattern: document.getElementById('tp-pattern')?.value || '' }
    : { days: (document.getElementById('tp-fixed')?.value || '').split(',').map(d => d.trim()).filter(Boolean) };
  renderTplEditor(el, progName, patternType, pd, !!window._tplEditId);
}

async function saveTplFromEditor() {
  saveTpSessionInputs();
  const nom = document.getElementById('tp-nom')?.value?.trim();
  if (!nom) { notify('Le nom est obligatoire', 'error'); return; }

  const patternType = document.getElementById('tp-type')?.value || 'pattern';
  const patternData = patternType === 'pattern'
    ? { pattern: document.getElementById('tp-pattern')?.value || '' }
    : { days: (document.getElementById('tp-fixed')?.value || '').split(',').map(d => d.trim()).filter(Boolean) };

  const sessionsData = window._tpSessions.map(s => ({
    nom: s.nom,
    jour: s.jour,
    exercices: s.exercises.map(e => ({ nom: e.nom, exercice_id: e.exercice_id || null, series: e.series || '-', reps: e.reps || '-' }))
  }));

  const category = document.getElementById('tp-category')?.value || null;

  const tplData = {
    nom,
    category,
    pattern_type: patternType,
    pattern_data: patternData,
    sessions_data: sessionsData,
    coach_id: currentUser.id
  };

  if (window._tplEditId) {
    const { error } = await supabaseClient.from('training_templates').update(tplData).eq('id', window._tplEditId);
    if (error) { handleError(error, 'templates'); return; }
    notify('Template modifié !', 'success');
  } else {
    const { error } = await supabaseClient.from('training_templates').insert(tplData).select();
    if (error) { handleError(error, 'templates'); return; }
    notify('Template créé !', 'success');
  }
  window._tplEditId = null;
  window._tplMode = false;
  loadTemplates();
}

async function deleteWorkoutTemplate(id) {
  if (!confirm('Supprimer ce template ?')) return;
  const { error } = await supabaseClient.from('training_templates').delete().eq('id', id);
  if (error) { handleError(error, 'templates'); return; }
  notify('Template supprimé', 'success');
  loadTemplates();
}

// ===== NUTRITION TEMPLATE SUB-TABS =====

function switchNtplSubTab(tab) {
  window._ntplSubTab = tab;
  loadTemplates();
}

function toggleNtplCategory(cat) {
  if (!window._ntplCollapsed) window._ntplCollapsed = {};
  window._ntplCollapsed[cat] = !window._ntplCollapsed[cat];
  loadTemplates();
}

// ===== NUTRITION TEMPLATE CREATE / EDIT =====

async function createNutritionTemplate(type) {
  const tplType = type || window._ntplSubTab || 'jour';
  const container = document.getElementById('templates-content');
  container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';
  if (!window.alimentsDB) await loadAliments();
  window._ntplEditId = null;
  window._ntplEditCategory = '';
  window._ntplType = tplType;
  window._npActiveMeal = 0;

  if (tplType === 'diete') {
    window._ntplDieteMeals = { training: [[]], rest: [[]] };
    window._ntplDieteTab = 'training';
    renderNtplDieteEditor(container, '', 'Créer le template');
  } else if (tplType === 'repas') {
    renderNtplRepasEditor(container, '', [[]], 'Créer le template');
  } else {
    renderNtplEditor(container, '', [[]], 'Créer le template');
  }
}

async function editNutritionTemplate(id) {
  const container = document.getElementById('templates-content');
  container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';
  if (!window.alimentsDB) await loadAliments();

  const { data: tpl } = await supabaseClient.from('nutrition_templates').select('*').eq('id', id).single();
  if (!tpl) { notify('Template introuvable', 'error'); loadTemplates(); return; }

  window._ntplEditId = id;
  window._ntplEditCategory = tpl.category || '';
  window._npActiveMeal = 0;
  const tplType = tpl.template_type || 'jour';
  window._ntplType = tplType;

  let meals = [];
  try { meals = typeof tpl.meals_data === 'string' ? JSON.parse(tpl.meals_data) : (tpl.meals_data || []); } catch(e) {}
  if (!meals.length) meals = [[]];

  if (tplType === 'diete') {
    // meals_data for diete = { training: [...], rest: [...] }
    let dieteData = {};
    try { dieteData = typeof tpl.meals_data === 'string' ? JSON.parse(tpl.meals_data) : (tpl.meals_data || {}); } catch(e) {}
    if (dieteData.training || dieteData.rest) {
      window._ntplDieteMeals = {
        training: dieteData.training || [[]],
        rest: dieteData.rest || [[]]
      };
    } else {
      // Legacy: plain array → treat as training
      window._ntplDieteMeals = { training: meals, rest: [[]] };
    }
    window._ntplDieteTab = 'training';
    renderNtplDieteEditor(container, tpl.nom || '', 'Enregistrer');
  } else if (tplType === 'repas') {
    renderNtplRepasEditor(container, tpl.nom || '', meals, 'Enregistrer');
  } else {
    renderNtplEditor(container, tpl.nom || '', meals, 'Enregistrer');
  }
}

function getNtplCategoryHtml() {
  const existingCats = [...new Set((window._nutritionTemplates || []).map(t => t.category).filter(Boolean))].sort();
  const currentCat = window._ntplEditCategory || '';
  const opts = existingCats.map(c => `<option value="${escHtml(c)}"${c === currentCat ? ' selected' : ''}>${escHtml(c)}</option>`).join('');
  return `<div style="display:flex;align-items:center;gap:6px;margin-left:8px;">
    <i class="fas fa-folder" style="color:var(--text3);font-size:12px;"></i>
    <select id="ntpl-category" style="padding:5px 8px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;">
      <option value="">Sans catégorie</option>${opts}
    </select>
    <button class="btn btn-outline btn-sm" onclick="addNtplCategory()" title="Nouvelle catégorie" style="padding:4px 8px;"><i class="fas fa-plus" style="font-size:10px;"></i></button>
  </div>`;
}

function addNtplCategory() {
  const btn = document.querySelector('#ntpl-category + button');
  if (!btn) return;
  const wrap = document.createElement('span');
  wrap.style.cssText = 'display:inline-flex;gap:4px;align-items:center;';
  wrap.innerHTML = `<input type="text" id="ntpl-new-cat" placeholder="Nom…" style="padding:4px 8px;background:var(--bg2);border:1px solid var(--primary);border-radius:6px;color:var(--text);font-size:12px;width:130px;" autofocus>
    <button class="btn btn-outline btn-sm" onclick="confirmNtplCategory()" style="padding:4px 8px;"><i class="fas fa-check" style="font-size:10px;color:var(--success);"></i></button>
    <button class="btn btn-outline btn-sm" onclick="cancelNtplCategory()" style="padding:4px 8px;"><i class="fas fa-times" style="font-size:10px;"></i></button>`;
  btn.replaceWith(wrap);
  const inp = document.getElementById('ntpl-new-cat');
  inp.focus();
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') confirmNtplCategory(); if (e.key === 'Escape') cancelNtplCategory(); });
}

function confirmNtplCategory() {
  const inp = document.getElementById('ntpl-new-cat');
  const name = inp?.value?.trim();
  if (!name) return cancelNtplCategory();
  const sel = document.getElementById('ntpl-category');
  const exists = [...sel.options].some(o => o.value === name);
  if (!exists) { const opt = document.createElement('option'); opt.value = name; opt.textContent = name; sel.appendChild(opt); }
  sel.value = name;
  const wrap = inp.closest('span');
  const btn = document.createElement('button');
  btn.className = 'btn btn-outline btn-sm'; btn.onclick = addNtplCategory; btn.title = 'Nouvelle catégorie'; btn.style.cssText = 'padding:4px 8px;';
  btn.innerHTML = '<i class="fas fa-plus" style="font-size:10px;"></i>';
  wrap.replaceWith(btn);
}

function cancelNtplCategory() {
  const inp = document.getElementById('ntpl-new-cat');
  if (!inp) return;
  const wrap = inp.closest('span');
  const btn = document.createElement('button');
  btn.className = 'btn btn-outline btn-sm'; btn.onclick = addNtplCategory; btn.title = 'Nouvelle catégorie'; btn.style.cssText = 'padding:4px 8px;';
  btn.innerHTML = '<i class="fas fa-plus" style="font-size:10px;"></i>';
  wrap.replaceWith(btn);
}

// --- Jour editor (existing, multi-meal) ---
function renderNtplEditor(el, tplName, meals, saveLabel) {
  const title = window._ntplEditId ? `Modifier — ${npEsc(tplName)}` : 'Nouveau template jour';
  const catHtml = getNtplCategoryHtml();
  const mealsHtml = meals.map((meal, i) => {
    const isObj = meal && !Array.isArray(meal) && meal.foods;
    const items = isObj ? meal.foods : (Array.isArray(meal) ? meal : []);
    const pw = isObj ? meal.pre_workout : false;
    return buildNpMealHtml(i + 1, items, i === 0, pw);
  }).join('');

  el.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="np-editor-head">
        <div style="display:flex;align-items:center;">${title}${catHtml}</div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline" onclick="loadTemplates()"><i class="fas fa-arrow-left"></i> Annuler</button>
          <button class="btn btn-red" onclick="saveNutritionTemplateInline()"><i class="fas fa-save"></i> ${npEsc(saveLabel)}</button>
        </div>
      </div>
      <div class="np-editor-macros">
        <div class="form-group"><label>Nom</label><input type="text" id="np-nom" value="${npEsc(tplName)}" placeholder="ex: Jour sèche, Jour high carb…"></div>
        <div class="form-group"><label>kcal total</label><div class="np-macro-val" id="np-cal">0</div></div>
        <div class="form-group"><label>Protéines (g)</label><div class="np-macro-val" id="np-prot">0</div></div>
        <div class="form-group"><label>Glucides (g)</label><div class="np-macro-val" id="np-gluc">0</div></div>
        <div class="form-group"><label>Lipides (g)</label><div class="np-macro-val" id="np-lip">0</div></div>
      </div>
      <div class="tr-body">
        <div class="tr-library">
          <div class="tr-library-header">
            <i class="fas fa-apple-alt" style="color:var(--text3);"></i>
            <span class="tr-library-title">Bibliothèque d'aliments</span>
          </div>
          <div class="tr-library-search">
            <i class="fas fa-search"></i>
            <input type="text" id="np-lib-search" placeholder="Rechercher un aliment..." oninput="filterNpLibrary()">
          </div>
          <div class="tr-library-results" id="np-lib-results"></div>
        </div>
        <div class="np-meals-area">
          <div id="np-meals">${mealsHtml}</div>
          <div class="np-meals-footer">
            <button class="btn btn-outline" onclick="addNpMeal()"><i class="fas fa-plus"></i> Repas</button>
          </div>
        </div>
      </div>
    </div>`;

  filterNpLibrary();
  updateNpTotals();
}

// --- Diète editor (ON/OFF tabs) ---
function renderNtplDieteEditor(el, tplName, saveLabel) {
  const title = window._ntplEditId ? `Modifier diète — ${npEsc(tplName)}` : 'Nouveau template diète';
  const catHtml = getNtplCategoryHtml();
  const tab = window._ntplDieteTab || 'training';
  const meals = window._ntplDieteMeals[tab] || [[]];

  const mealsHtml = meals.map((meal, i) => {
    const isObj = meal && !Array.isArray(meal) && meal.foods;
    const items = isObj ? meal.foods : (Array.isArray(meal) ? meal : []);
    const pw = isObj ? meal.pre_workout : false;
    return buildNpMealHtml(i + 1, items, i === 0, pw);
  }).join('');

  const isT = tab === 'training';
  const onBtn = isT
    ? `<button class="athlete-tab-btn active"><i class="fas fa-dumbbell"></i> Jour ON</button>`
    : `<button class="athlete-tab-btn" onclick="switchNtplDieteTab('training')"><i class="fas fa-dumbbell"></i> Jour ON</button>`;
  const offBtn = !isT
    ? `<button class="athlete-tab-btn active"><i class="fas fa-bed"></i> Jour OFF</button>`
    : `<button class="athlete-tab-btn" onclick="switchNtplDieteTab('rest')"><i class="fas fa-bed"></i> Jour OFF</button>`;
  const pairTabs = `<div style="display:flex;gap:4px;margin-left:12px;">${onBtn}${offBtn}</div>`;

  el.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="np-editor-head">
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
          <div class="card-title">${title}</div>
          ${catHtml}
          ${pairTabs}
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline" onclick="loadTemplates()"><i class="fas fa-arrow-left"></i> Annuler</button>
          <button class="btn btn-red" onclick="saveNutritionTemplateInline()"><i class="fas fa-save"></i> ${npEsc(saveLabel)}</button>
        </div>
      </div>
      <div class="np-editor-macros">
        <div class="form-group"><label>Nom</label><input type="text" id="np-nom" value="${npEsc(tplName)}" placeholder="ex: Sèche 2000kcal, Prise de masse…"></div>
        <div class="form-group"><label>kcal total</label><div class="np-macro-val" id="np-cal">0</div></div>
        <div class="form-group"><label>Protéines (g)</label><div class="np-macro-val" id="np-prot">0</div></div>
        <div class="form-group"><label>Glucides (g)</label><div class="np-macro-val" id="np-gluc">0</div></div>
        <div class="form-group"><label>Lipides (g)</label><div class="np-macro-val" id="np-lip">0</div></div>
      </div>
      <div class="tr-body">
        <div class="tr-library">
          <div class="tr-library-header">
            <i class="fas fa-apple-alt" style="color:var(--text3);"></i>
            <span class="tr-library-title">Bibliothèque d'aliments</span>
          </div>
          <div class="tr-library-search">
            <i class="fas fa-search"></i>
            <input type="text" id="np-lib-search" placeholder="Rechercher un aliment..." oninput="filterNpLibrary()">
          </div>
          <div class="tr-library-results" id="np-lib-results"></div>
        </div>
        <div class="np-meals-area">
          <div id="np-meals">${mealsHtml}</div>
          <div class="np-meals-footer">
            <button class="btn btn-outline" onclick="addNpMeal()"><i class="fas fa-plus"></i> Repas</button>
          </div>
        </div>
      </div>
    </div>`;

  filterNpLibrary();
  updateNpTotals();
}

function switchNtplDieteTab(targetTab) {
  // Save current tab meals to cache
  const currentTab = window._ntplDieteTab || 'training';
  window._ntplDieteMeals[currentTab] = getNpMealData();
  // Switch
  window._ntplDieteTab = targetTab;
  const el = document.getElementById('templates-content');
  const tplName = document.getElementById('np-nom')?.value || '';
  const saveLabel = window._ntplEditId ? 'Enregistrer' : 'Créer le template';
  renderNtplDieteEditor(el, tplName, saveLabel);
}

// --- Repas editor (single meal, no add meal button) ---
function renderNtplRepasEditor(el, tplName, meals, saveLabel) {
  const title = window._ntplEditId ? `Modifier repas — ${npEsc(tplName)}` : 'Nouveau template repas';
  const catHtml = getNtplCategoryHtml();
  const meal = meals[0] || [];
  const isObj = meal && !Array.isArray(meal) && meal.foods;
  const items = isObj ? meal.foods : (Array.isArray(meal) ? meal : []);
  const pw = isObj ? meal.pre_workout : false;
  const mealHtml = buildNpMealHtml(1, items, true, pw);

  el.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="np-editor-head">
        <div style="display:flex;align-items:center;">${title}${catHtml}</div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline" onclick="loadTemplates()"><i class="fas fa-arrow-left"></i> Annuler</button>
          <button class="btn btn-red" onclick="saveNutritionTemplateInline()"><i class="fas fa-save"></i> ${npEsc(saveLabel)}</button>
        </div>
      </div>
      <div class="np-editor-macros">
        <div class="form-group"><label>Nom</label><input type="text" id="np-nom" value="${npEsc(tplName)}" placeholder="ex: Petit-déj protéiné, Collation…"></div>
        <div class="form-group"><label>kcal total</label><div class="np-macro-val" id="np-cal">0</div></div>
        <div class="form-group"><label>Protéines (g)</label><div class="np-macro-val" id="np-prot">0</div></div>
        <div class="form-group"><label>Glucides (g)</label><div class="np-macro-val" id="np-gluc">0</div></div>
        <div class="form-group"><label>Lipides (g)</label><div class="np-macro-val" id="np-lip">0</div></div>
      </div>
      <div class="tr-body">
        <div class="tr-library">
          <div class="tr-library-header">
            <i class="fas fa-apple-alt" style="color:var(--text3);"></i>
            <span class="tr-library-title">Bibliothèque d'aliments</span>
          </div>
          <div class="tr-library-search">
            <i class="fas fa-search"></i>
            <input type="text" id="np-lib-search" placeholder="Rechercher un aliment..." oninput="filterNpLibrary()">
          </div>
          <div class="tr-library-results" id="np-lib-results"></div>
        </div>
        <div class="np-meals-area">
          <div id="np-meals">${mealHtml}</div>
        </div>
      </div>
    </div>`;

  filterNpLibrary();
  updateNpTotals();
}

// --- Save (handles all 3 types) ---
async function saveNutritionTemplateInline() {
  const nom = document.getElementById('np-nom')?.value?.trim();
  if (!nom) { notify('Le nom est obligatoire', 'error'); return; }
  const tplType = window._ntplType || 'jour';

  let mealsDataRaw;
  if (tplType === 'diete') {
    // Save current tab first
    const currentTab = window._ntplDieteTab || 'training';
    window._ntplDieteMeals[currentTab] = getNpMealData();
    mealsDataRaw = { training: window._ntplDieteMeals.training, rest: window._ntplDieteMeals.rest };
  } else {
    mealsDataRaw = getNpMealData();
  }

  // Calculate totals
  let calories = 0, proteines = 0, glucides = 0, lipides = 0;
  function addMacros(meals) {
    if (!Array.isArray(meals)) return;
    meals.forEach(meal => {
      const items = Array.isArray(meal) ? meal : (meal.foods || []);
      items.forEach(item => {
        calories += parseFloat(item.kcal) || 0;
        proteines += parseFloat(item.p) || 0;
        glucides += parseFloat(item.g) || 0;
        lipides += parseFloat(item.l) || 0;
      });
    });
  }
  if (tplType === 'diete') {
    addMacros(mealsDataRaw.training);
    addMacros(mealsDataRaw.rest);
  } else {
    addMacros(mealsDataRaw);
  }

  const ntplCategory = document.getElementById('ntpl-category')?.value || null;

  const tplData = {
    nom,
    category: ntplCategory,
    template_type: tplType,
    calories_objectif: Math.round(calories),
    proteines: Math.round(proteines),
    glucides: Math.round(glucides),
    lipides: Math.round(lipides),
    meals_data: JSON.stringify(mealsDataRaw),
    coach_id: currentUser.id
  };

  if (window._ntplEditId) {
    const { error } = await supabaseClient.from('nutrition_templates').update(tplData).eq('id', window._ntplEditId);
    if (error) { handleError(error, 'templates'); return; }
    notify('Template modifié !', 'success');
  } else {
    const { error } = await supabaseClient.from('nutrition_templates').insert(tplData).select();
    if (error) { handleError(error, 'templates'); return; }
    notify('Template créé !', 'success');
  }
  window._ntplEditId = null;
  loadTemplates();
}

async function deleteNutritionTemplate(id) {
  if (!confirm('Supprimer ce template ?')) return;
  const { error } = await supabaseClient.from('nutrition_templates').delete().eq('id', id);
  if (error) { handleError(error, 'templates'); return; }
  notify('Template supprimé', 'success');
  loadTemplates();
}

// ===== COPY TEMPLATE TO ATHLETE (from athlete pages) =====

async function copyWorkoutTemplate(templateId) {
  const { data: template, error } = await supabaseClient
    .from('training_templates').select('*').eq('id', templateId).single();
  if (error) { handleError(error, 'templates'); return; }

  // Désactiver tous les programmes existants avant d'ajouter le nouveau
  await supabaseClient.from('workout_programs').update({ actif: false }).eq('athlete_id', currentAthleteId);

  const { data: program, error: progError } = await supabaseClient
    .from('workout_programs')
    .insert({
      nom: template.nom,
      athlete_id: currentAthleteId,
      coach_id: currentUser.id,
      pattern_type: template.pattern_type,
      pattern_data: template.pattern_data,
      actif: true
    })
    .select().single();
  if (progError) { handleError(progError, 'templates'); return; }

  let sessions = [];
  try { sessions = typeof template.sessions_data === 'string' ? JSON.parse(template.sessions_data) : (template.sessions_data || []); } catch(e) {}

  if (sessions.length) {
    const rows = sessions.map((s, i) => ({
      program_id: program.id,
      nom: s.nom || `Séance ${i + 1}`,
      jour: s.jour || null,
      exercices: typeof s.exercices === 'string' ? s.exercices : JSON.stringify(s.exercices || []),
      ordre: i
    }));
    await supabaseClient.from('workout_sessions').insert(rows);
  }

  notify('Template copié !', 'success');
  loadAthleteTabTraining();
}

async function copyNutritionTemplate(templateId) {
  const { data: template, error } = await supabaseClient
    .from('nutrition_templates').select('*').eq('id', templateId).single();
  if (error) { handleError(error, 'templates'); return; }

  const mealsRaw = template.meals_data;
  let mealsStr = null;
  if (mealsRaw) {
    mealsStr = typeof mealsRaw === 'string' ? mealsRaw : JSON.stringify(mealsRaw);
  }

  const { error: insertError } = await supabaseClient.from('nutrition_plans').insert({
    nom: template.nom,
    athlete_id: currentAthleteId,
    coach_id: currentUser.id,
    calories_objectif: template.calories_objectif,
    proteines: template.proteines,
    glucides: template.glucides,
    lipides: template.lipides,
    meals_data: mealsStr,
    actif: true,
    valid_from: toDateStr(new Date())
  }).select();
  if (insertError) { handleError(insertError, 'templates'); return; }
  notify('Template copié !', 'success');
  loadAthleteTabNutrition();
}

async function copyNutritionTemplateWithType(templateId, mealType) {
  const { data: template, error } = await supabaseClient
    .from('nutrition_templates').select('*').eq('id', templateId).single();
  if (error) { handleError(error, 'templates'); return; }

  const mealsRaw = template.meals_data;
  let mealsStr = null;
  if (mealsRaw) {
    mealsStr = typeof mealsRaw === 'string' ? mealsRaw : JSON.stringify(mealsRaw);
  }

  const { error: insertError } = await supabaseClient.from('nutrition_plans').insert({
    nom: template.nom,
    athlete_id: currentAthleteId,
    coach_id: currentUser.id,
    calories_objectif: template.calories_objectif,
    proteines: template.proteines,
    glucides: template.glucides,
    lipides: template.lipides,
    meal_type: mealType || window.currentNutriTab || 'training',
    meals_data: mealsStr,
    actif: true,
    valid_from: toDateStr(new Date())
  }).select();
  if (insertError) { handleError(insertError, 'templates'); return; }
  notify('Template copié !', 'success');
  loadAthleteTabNutrition();
}

// ===== TEMPLATE SELECTOR MODAL (called from athlete pages) =====

async function copyTrainingFromTemplate() {
  const { data: templates } = await supabaseClient.from('training_templates').select('*').eq('coach_id', currentUser.id);
  if (!templates?.length) { notify('Aucun template disponible', 'error'); return; }
  showTemplateSelector('training', templates).then(id => { if (id) copyWorkoutTemplate(id); });
}

async function copyNutritionFromTemplateForType(mealType) {
  const { data: templates } = await supabaseClient.from('nutrition_templates').select('*').eq('coach_id', currentUser.id);
  if (!templates?.length) { notify('Aucun template disponible', 'error'); return; }
  showTemplateSelector('nutrition', templates).then(id => { if (id) copyNutritionTemplateWithType(id, mealType); });
}

function showTemplateSelector(type, templates) {
  // Hide nutrition tabs for training selector
  document.getElementById('template-selector-tabs').style.display = 'none';
  return new Promise(resolve => {
    const list = document.getElementById('template-selector-list');
    list.innerHTML = templates.map(t => {
      let subtitle = '';
      if (type === 'nutrition') {
        subtitle = `${t.calories_objectif||0} kcal · P:${t.proteines||0}g G:${t.glucides||0}g L:${t.lipides||0}g`;
      } else {
        let sc = 0;
        try {
          const sd = typeof t.sessions_data === 'string' ? JSON.parse(t.sessions_data) : (t.sessions_data || []);
          sc = sd.length;
        } catch(e) {}
        subtitle = sc + ' séance(s)' + (t.description ? ' — ' + escHtml(t.description) : '');
      }
      return `
      <div class="card athlete-card" style="margin-bottom:8px;padding:16px;cursor:pointer;" onclick="resolveTemplateSelection('${t.id}')">
        <div style="font-weight:600;">${escHtml(t.nom)}</div>
        <div style="font-size:12px;color:var(--text3);margin-top:4px;">${subtitle}</div>
      </div>`;
    }).join('');
    window._templateSelectorResolve = (id) => { closeModal('modal-template-selector'); resolve(id); };
    window._templateSelectorResolveNull = () => { closeModal('modal-template-selector'); resolve(null); };
    openModal('modal-template-selector');
  });
}

function resolveTemplateSelection(id) {
  if (window._templateSelectorResolve) window._templateSelectorResolve(id);
}
