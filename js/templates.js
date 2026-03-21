// ===== TEMPLATES MANAGEMENT =====

async function loadTemplates() {
  const container = document.getElementById('templates-content');
  container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  if (currentTemplateTab === 'training') {
    const { data: templates } = await supabaseClient
      .from('training_templates')
      .select('*')
      .eq('coach_id', currentUser.id)
      .order('created_at', { ascending: false });

    container.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
        <button class="btn btn-red" onclick="createWorkoutTemplate()">
          <i class="fas fa-plus"></i> Nouveau template
        </button>
      </div>
      ${templates?.length ? templates.map(t => `
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header">
            <div class="card-title">${t.nom}</div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-outline btn-sm" onclick="copyTemplateToAthlete('${t.id}', 'training')">
                <i class="fas fa-copy"></i> Copier
              </button>
              <button class="btn btn-outline btn-sm" onclick="editWorkoutTemplate('${t.id}')">
                <i class="fas fa-pen"></i>
              </button>
            </div>
          </div>
          <div style="color:var(--text2);font-size:13px;">${t.description || ''}</div>
        </div>
      `).join('') : '<div class="empty-state"><i class="fas fa-dumbbell"></i><p>Aucun template</p></div>'}
    `;
  } else {
    const { data: templates } = await supabaseClient
      .from('nutrition_templates')
      .select('*')
      .eq('coach_id', currentUser.id)
      .order('created_at', { ascending: false });

    container.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
        <button class="btn btn-red" onclick="createNutritionTemplate()">
          <i class="fas fa-plus"></i> Nouveau template
        </button>
      </div>
      ${templates?.length ? templates.map(t => `
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header">
            <div class="card-title">${t.nom}</div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-outline btn-sm" onclick="copyTemplateToAthlete('${t.id}', 'nutrition')">
                <i class="fas fa-copy"></i> Copier
              </button>
              <button class="btn btn-outline btn-sm" onclick="editNutritionTemplate('${t.id}')">
                <i class="fas fa-pen"></i>
              </button>
            </div>
          </div>
          <div style="color:var(--text2);font-size:13px;">${t.calories_objectif || 0} kcal | P:${t.proteines || 0}g G:${t.glucides || 0}g L:${t.lipides || 0}g</div>
        </div>
      `).join('') : '<div class="empty-state"><i class="fas fa-utensils"></i><p>Aucun template</p></div>'}
    `;
  }
}

function createWorkoutTemplate() {
  openModal('modal-workout-template');
}

function createNutritionTemplate() {
  openModal('modal-nutrition-template');
}

// Template form listeners
document.getElementById('workout-template-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const { error } = await supabaseClient
    .from('training_templates')
    .insert({
      nom: document.getElementById('workout-template-name').value,
      description: document.getElementById('workout-template-description').value,
      coach_id: currentUser.id
    })
    .select();

  if (error) { notify('Erreur: ' + error.message, 'error'); return; }

  notify('Template créé avec succès !', 'success');
  closeModal('modal-workout-template');
  document.getElementById('workout-template-form').reset();
  loadTemplates();
});

document.getElementById('nutrition-template-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const { error } = await supabaseClient
    .from('nutrition_templates')
    .insert({
      nom: document.getElementById('nutrition-template-name').value,
      calories_objectif: parseFloat(document.getElementById('nutrition-template-calories').value) || 0,
      proteines: parseFloat(document.getElementById('nutrition-template-proteines').value) || 0,
      glucides: parseFloat(document.getElementById('nutrition-template-glucides').value) || 0,
      lipides: parseFloat(document.getElementById('nutrition-template-lipides').value) || 0,
      coach_id: currentUser.id
    })
    .select();

  if (error) { notify('Erreur: ' + error.message, 'error'); return; }

  notify('Template créé avec succès !', 'success');
  closeModal('modal-nutrition-template');
  document.getElementById('nutrition-template-form').reset();
  loadTemplates();
});

function copyTemplateToAthlete(templateId, type) {
  if (!currentAthleteId) {
    notify('Veuillez sélectionner un athlète', 'warning');
    return;
  }
  if (type === 'nutrition') {
    copyNutritionTemplate(templateId);
  } else {
    copyWorkoutTemplate(templateId);
  }
}

async function copyNutritionTemplate(templateId) {
  const { data: template, error } = await supabaseClient
    .from('nutrition_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) { notify('Erreur: ' + error.message, 'error'); return; }

  const { error: insertError } = await supabaseClient
    .from('nutrition_plans')
    .insert({
      nom: template.nom,
      athlete_id: currentAthleteId,
      coach_id: currentUser.id,
      calories_objectif: template.calories_objectif,
      proteines: template.proteines,
      glucides: template.glucides,
      lipides: template.lipides,
      meals_data: template.meals_data || null
    })
    .select();

  if (insertError) { notify('Erreur: ' + insertError.message, 'error'); return; }
  notify('Template copié !', 'success');
  loadAthleteTabNutrition();
}

async function copyWorkoutTemplate(templateId) {
  const { data: template, error } = await supabaseClient
    .from('training_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) { notify('Erreur: ' + error.message, 'error'); return; }

  // Create the program
  const { data: program, error: progError } = await supabaseClient
    .from('workout_programs')
    .insert({
      nom: template.nom,
      athlete_id: currentAthleteId,
      coach_id: currentUser.id,
      pattern_type: template.pattern_type,
      pattern_data: template.pattern_data
    })
    .select()
    .single();

  if (progError) { notify('Erreur: ' + progError.message, 'error'); return; }

  // Copy sessions if template has them
  if (template.sessions_data) {
    let sessions = [];
    try { sessions = typeof template.sessions_data === 'string' ? JSON.parse(template.sessions_data) : (template.sessions_data || []); } catch(e) {}

    if (sessions.length) {
      const sessionsToInsert = sessions.map((s, i) => ({
        program_id: program.id,
        nom: s.nom || `Séance ${i + 1}`,
        jour: s.jour || null,
        exercices: typeof s.exercices === 'string' ? s.exercices : JSON.stringify(s.exercices || []),
        ordre: i
      }));

      await supabaseClient.from('workout_sessions').insert(sessionsToInsert);
    }
  }

  notify('Template copié !', 'success');
  loadAthleteTabTraining();
}

function editWorkoutTemplate(id) { notify('Fonctionnalité en cours de développement', 'info'); }
function editNutritionTemplate(id) { notify('Fonctionnalité en cours de développement', 'info'); }

// ===== TEMPLATE COPY =====

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
  return new Promise(resolve => {
    const list = document.getElementById('template-selector-list');
    list.innerHTML = templates.map(t => `
      <div class="card athlete-card" style="margin-bottom:8px;padding:16px;" onclick="resolveTemplateSelection('${t.id}')">
        <div style="font-weight:600;">${t.nom}</div>
        ${type === 'nutrition' ? `<div style="font-size:12px;color:var(--text3);">${t.calories_objectif||0} kcal | P:${t.proteines||0}g G:${t.glucides||0}g L:${t.lipides||0}g</div>` : ''}
        ${type === 'training' ? `<div style="font-size:12px;color:var(--text3);">${t.description||''}</div>` : ''}
      </div>`).join('');
    window._templateSelectorResolve = (id) => { closeModal('modal-template-selector'); resolve(id); };
    window._templateSelectorResolveNull = () => { closeModal('modal-template-selector'); resolve(null); };
    openModal('modal-template-selector');
  });
}

function resolveTemplateSelection(id) {
  if (window._templateSelectorResolve) window._templateSelectorResolve(id);
}

async function copyNutritionTemplateWithType(templateId, mealType) {
  const { data: template, error } = await supabaseClient.from('nutrition_templates').select('*').eq('id', templateId).single();
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  const { error: insertError } = await supabaseClient.from('nutrition_plans').insert({
    nom: template.nom,
    athlete_id: currentAthleteId,
    coach_id: currentUser.id,
    calories_objectif: template.calories_objectif,
    proteines: template.proteines,
    glucides: template.glucides,
    lipides: template.lipides,
    meal_type: mealType || window.currentNutriTab || 'training',
    repas_detail: template.repas_detail,
    meals_data: template.meals_data || null
  }).select();
  if (insertError) { notify('Erreur: ' + insertError.message, 'error'); return; }
  notify('Template copié !', 'success');
  loadAthleteTabNutrition();
}
