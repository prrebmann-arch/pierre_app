// ===== EXERCICES PAGE =====

let _exFilter = '';
let _exSearch = '';

async function loadExercicesPage() {
  const el = document.getElementById('exercices-content');
  el.innerHTML = '<div class="text-center" style="padding:60px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

  const [{ data: exos }, { data: overrides }] = await Promise.all([
    supabaseClient.from('exercices').select('*').order('nom'),
    supabaseClient.from('exercice_overrides').select('*').eq('coach_id', currentUser.id),
  ]);

  window._exAllExos = exos || [];
  window._exOverrides = overrides || [];

  renderExercicesPage(el);
}

function renderExercicesPage(el) {
  if (!el) el = document.getElementById('exercices-content');
  const allExos = window._exAllExos || [];
  const overrides = window._exOverrides || [];
  const overrideMap = {};
  overrides.forEach(o => { overrideMap[o.exercice_id] = o; });

  // Get unique categories
  const categories = [...new Set(allExos.map(e => e.categorie).filter(Boolean))].sort();

  // Filter
  let filtered = allExos;
  if (_exFilter === 'custom') {
    filtered = filtered.filter(e => e.coach_id);
  } else if (_exFilter === 'base') {
    filtered = filtered.filter(e => !e.coach_id);
  } else if (_exFilter) {
    filtered = filtered.filter(e => e.categorie === _exFilter);
  }
  if (_exSearch) {
    const s = _exSearch.toLowerCase();
    filtered = filtered.filter(e => e.nom?.toLowerCase().includes(s) || e.muscle_principal?.toLowerCase().includes(s));
  }

  const countBase = allExos.filter(e => !e.coach_id).length;
  const countCustom = allExos.filter(e => e.coach_id).length;
  const countOverrides = overrides.length;

  // Filter buttons
  const filters = [
    { key: '', label: 'Tous', count: allExos.length },
    { key: 'base', label: 'Base', count: countBase },
    { key: 'custom', label: 'Mes exos', count: countCustom },
    ...categories.map(c => ({ key: c, label: c, count: allExos.filter(e => e.categorie === c).length })),
  ];
  const filtersHtml = filters.map(f =>
    `<button class="bo-filter ${_exFilter === f.key ? 'active' : ''}" onclick="_exFilter='${escHtml(f.key)}';renderExercicesPage()">${escHtml(f.label)} <span class="bo-count">${f.count}</span></button>`
  ).join('');

  // Exercise rows
  const rowsHtml = filtered.map(ex => {
    const isCustom = !!ex.coach_id;
    const hasOverride = !!overrideMap[ex.id];
    const override = overrideMap[ex.id];
    const displayVideo = override?.video_url || ex.video_url;
    const displayMuscle = override?.muscle_principal || ex.muscle_principal || '';

    const tag = isCustom
      ? '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--primary);color:#fff;margin-left:8px;">Perso</span>'
      : hasOverride
        ? '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--warning);color:#000;margin-left:8px;">Modifié</span>'
        : '';

    const videoIcon = displayVideo
      ? `<a href="${escHtml(displayVideo)}" target="_blank" onclick="event.stopPropagation();" style="color:var(--primary);"><i class="fas fa-play-circle"></i></a>`
      : '<i class="fas fa-play-circle" style="color:var(--bg4);"></i>';

    return `
      <div style="background:var(--bg2);border:var(--card-border);border-radius:var(--radius);padding:12px 16px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;" onclick="openExerciceEditor('${ex.id}')">
        <div style="display:flex;align-items:center;gap:12px;">
          ${videoIcon}
          <div>
            <div style="font-weight:600;font-size:14px;color:var(--text);">${escHtml(ex.nom)}${tag}</div>
            <div style="font-size:12px;color:var(--text3);">${escHtml(displayMuscle)}${ex.categorie ? ' · ' + escHtml(ex.categorie) : ''}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;" onclick="event.stopPropagation();">
          ${isCustom ? `<button class="btn btn-outline btn-sm" onclick="deleteCustomExercice('${ex.id}')" style="color:var(--danger);padding:4px 8px;"><i class="fas fa-trash"></i></button>` : ''}
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <div>
        <h1 style="font-size:22px;font-weight:700;color:var(--text);margin-bottom:4px;">Exercices</h1>
        <p style="font-size:13px;color:var(--text3);">${countBase} de base · ${countCustom} perso · ${countOverrides} modifié${countOverrides > 1 ? 's' : ''}</p>
      </div>
      <button class="btn btn-red" onclick="openExerciceEditor()">
        <i class="fas fa-plus"></i> Nouvel exercice
      </button>
    </div>

    <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
      <input type="text" placeholder="Rechercher un exercice..." value="${escHtml(_exSearch)}" oninput="_exSearch=this.value;renderExercicesPage()" style="flex:1;min-width:200px;padding:10px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:13px;">
    </div>

    <div class="bo-filters" style="margin-bottom:14px;">${filtersHtml}</div>

    ${filtered.length ? rowsHtml : '<div style="text-align:center;padding:40px;color:var(--text3);"><i class="fas fa-dumbbell" style="font-size:28px;margin-bottom:8px;display:block;"></i>Aucun exercice trouvé</div>'}`;
}

// ── Editor (modal-like inline) ──
function openExerciceEditor(exId) {
  const el = document.getElementById('exercices-content');
  const allExos = window._exAllExos || [];
  const overrides = window._exOverrides || [];

  let ex = null, override = null, isNew = !exId;
  if (exId) {
    ex = allExos.find(e => e.id === exId);
    override = overrides.find(o => o.exercice_id === exId);
  }

  const isBase = ex && !ex.coach_id;
  const isCustom = ex && !!ex.coach_id;
  const title = isNew ? 'Nouvel exercice' : isBase ? `Modifier (perso) — ${escHtml(ex.nom)}` : `Modifier — ${escHtml(ex.nom)}`;
  const hint = isBase ? '<p style="font-size:11px;color:var(--warning);margin-bottom:16px;"><i class="fas fa-info-circle"></i> Cet exercice est partagé. Vos modifications ne s\'appliqueront que pour vous.</p>' : '';

  const nom = isNew ? '' : ex.nom;
  const muscle = override?.muscle_principal || ex?.muscle_principal || '';
  const categorie = ex?.categorie || '';
  const videoUrl = override?.video_url || ex?.video_url || '';
  const notes = override?.notes || ex?.description || '';

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;">
      <button class="btn btn-outline btn-sm" onclick="loadExercicesPage()"><i class="fas fa-arrow-left"></i> Retour</button>
      <span style="font-size:16px;font-weight:700;">${title}</span>
    </div>
    ${hint}
    <div style="max-width:600px;">
      ${isBase ? '' : `
        <div class="form-group">
          <label>Nom *</label>
          <input type="text" id="ex-nom" value="${escHtml(nom)}" placeholder="Ex: Bulgarian Split Squat" ${isBase ? 'disabled' : ''}>
        </div>
      `}
      <div class="form-group">
        <label>Muscle principal</label>
        <input type="text" id="ex-muscle" value="${escHtml(muscle)}" placeholder="Ex: Quadriceps">
      </div>
      ${isBase ? '' : `
        <div class="form-group">
          <label>Catégorie</label>
          <input type="text" id="ex-categorie" value="${escHtml(categorie)}" placeholder="Ex: Jambes, Dos, Poussée...">
        </div>
      `}
      <div class="form-group">
        <label>URL vidéo démo</label>
        <input type="url" id="ex-video" value="${escHtml(videoUrl)}" placeholder="https://youtube.com/... ou lien direct">
      </div>
      <div class="form-group">
        <label>Notes / Description</label>
        <textarea id="ex-notes" rows="3" placeholder="Conseils d'exécution...">${escHtml(notes)}</textarea>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="btn btn-red" onclick="saveExercice('${exId || ''}', ${isBase})"><i class="fas fa-check" style="margin-right:4px;"></i>Sauvegarder</button>
        <button class="btn btn-outline" onclick="loadExercicesPage()">Annuler</button>
      </div>
    </div>`;
}

// ── Save ──
async function saveExercice(exId, isBaseOverride) {
  const muscle = document.getElementById('ex-muscle')?.value?.trim() || null;
  const videoUrl = document.getElementById('ex-video')?.value?.trim() || null;
  const notes = document.getElementById('ex-notes')?.value?.trim() || null;

  if (isBaseOverride && exId) {
    // Upsert override for base exercise
    const { error } = await supabaseClient.from('exercice_overrides').upsert({
      exercice_id: exId,
      coach_id: currentUser.id,
      video_url: videoUrl,
      notes: notes,
      muscle_principal: muscle,
    }, { onConflict: 'exercice_id,coach_id' });
    if (error) { handleError(error, 'exercices'); return; }
    notify('Exercice personnalisé !', 'success');
  } else if (exId) {
    // Update own custom exercise
    const nom = document.getElementById('ex-nom')?.value?.trim();
    if (!nom) { notify('Le nom est obligatoire', 'error'); return; }
    const categorie = document.getElementById('ex-categorie')?.value?.trim() || null;
    const { error } = await supabaseClient.from('exercices').update({
      nom, muscle_principal: muscle, categorie, video_url: videoUrl, description: notes
    }).eq('id', exId);
    if (error) { handleError(error, 'exercices'); return; }
    notify('Exercice mis à jour !', 'success');
  } else {
    // Create new custom exercise
    const nom = document.getElementById('ex-nom')?.value?.trim();
    if (!nom) { notify('Le nom est obligatoire', 'error'); return; }
    const categorie = document.getElementById('ex-categorie')?.value?.trim() || null;
    const { error } = await supabaseClient.from('exercices').insert({
      nom, muscle_principal: muscle, categorie, video_url: videoUrl, description: notes, coach_id: currentUser.id
    });
    if (error) { handleError(error, 'exercices'); return; }
    notify('Exercice créé !', 'success');
  }

  // Clear cache so training.js reloads fresh
  window.exercicesDB = null;
  loadExercicesPage();
}

// ── Delete custom exercise ──
async function deleteCustomExercice(exId) {
  if (!confirm('Supprimer cet exercice personnalisé ?')) return;
  const { error } = await supabaseClient.from('exercices').delete().eq('id', exId).eq('coach_id', currentUser.id);
  if (error) { handleError(error, 'exercices'); return; }
  window.exercicesDB = null;
  notify('Exercice supprimé', 'success');
  loadExercicesPage();
}
