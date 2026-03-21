// ===== NUTRITION MANAGEMENT =====

// Aliments
async function loadAliments() {
  let { data, error } = await supabaseClient
    .from('aliments_db')
    .select('*')
    .order('nom', { ascending: true });

  if (error && error.message.includes('permission denied')) {
    const result = await supabaseClient
      .from('aliments')
      .select('*')
      .order('nom', { ascending: true });
    data = result.data;
    error = result.error;
  }

  if (error) {
    notify('Erreur chargement aliments: ' + error.message, 'error');
    return [];
  }

  window.alimentsDB = data || [];
  renderAliments(data || []);
  return data || [];
}

function renderAliments(aliments) {
  const container = document.getElementById('aliments-list');

  if (!aliments.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-apple-alt"></i><p>Aucun aliment dans la base</p></div>';
    return;
  }

  container.innerHTML = aliments.map(aliment => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${aliment.nom}</div>
        <button class="btn btn-outline btn-sm" onclick="editAliment('${aliment.id}')">
          <i class="fas fa-pen"></i>
        </button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;font-size:14px;text-align:center;">
        <div><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Calories/g</div><div style="font-weight:700;">${aliment.calories || 0} kcal</div></div>
        <div><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Protéines/g</div><div style="font-weight:700;">${aliment.proteines || 0}g</div></div>
        <div><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Glucides/g</div><div style="font-weight:700;">${aliment.glucides || 0}g</div></div>
        <div><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Lipides/g</div><div style="font-weight:700;">${aliment.lipides || 0}g</div></div>
      </div>
    </div>
  `).join('');
}

function editAliment(id) {
  const aliment = (window.alimentsDB || []).find(a => a.id === id);
  if (!aliment) return;
  window._editAlimentId = id;
  document.getElementById('edit-aliment-nom').value = aliment.nom || '';
  document.getElementById('edit-aliment-calories').value = aliment.calories || '';
  document.getElementById('edit-aliment-proteines').value = aliment.proteines || '';
  document.getElementById('edit-aliment-glucides').value = aliment.glucides || '';
  document.getElementById('edit-aliment-lipides').value = aliment.lipides || '';
  openModal('modal-edit-aliment');
}

document.getElementById('aliment-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const alimentData = {
    nom: document.getElementById('aliment-nom').value,
    calories: parseFloat(document.getElementById('aliment-calories').value),
    proteines: parseFloat(document.getElementById('aliment-proteines').value) || 0,
    glucides: parseFloat(document.getElementById('aliment-glucides').value) || 0,
    lipides: parseFloat(document.getElementById('aliment-lipides').value) || 0,
    coach_id: currentUser.id
  };

  let { data, error } = await supabaseClient
    .from('aliments_db')
    .insert(alimentData)
    .select();

  if (error && error.message.includes('relation "aliments_db" does not exist')) {
    const result = await supabaseClient
      .from('aliments')
      .insert(alimentData)
      .select();
    data = result.data;
    error = result.error;
  }

  if (error) { notify('Erreur: ' + error.message, 'error'); return; }

  notify('Aliment ajouté avec succès !', 'success');
  closeModal('modal-aliment');
  document.getElementById('aliment-form').reset();
  loadAliments();
});

// ===== ALIMENT EDIT/DELETE =====
document.getElementById('edit-aliment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { error } = await supabaseClient.from('aliments_db').update({
    nom: document.getElementById('edit-aliment-nom').value,
    calories: parseFloat(document.getElementById('edit-aliment-calories').value),
    proteines: parseFloat(document.getElementById('edit-aliment-proteines').value) || 0,
    glucides: parseFloat(document.getElementById('edit-aliment-glucides').value) || 0,
    lipides: parseFloat(document.getElementById('edit-aliment-lipides').value) || 0
  }).eq('id', window._editAlimentId);
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  notify('Aliment modifié !', 'success');
  closeModal('modal-edit-aliment');
  loadAliments();
});

async function deleteAliment(id) {
  if (!confirm('Supprimer cet aliment ?')) return;
  await supabaseClient.from('aliments_db').delete().eq('id', id);
  closeModal('modal-edit-aliment');
  notify('Aliment supprimé !', 'success');
  loadAliments();
}

// ===== NUTRITION PLAN MODAL =====

function createNutritionPlan() {
  document.querySelector('#modal-nutrition-plan .modal-title').textContent = 'Créer un plan nutritionnel';
  document.querySelector('#modal-nutrition-plan button[type="submit"]').textContent = 'Créer le plan';
  window.editingPlanId = null;
  resetMeals();

  loadAliments().then(() => {
    updateFoodSelectsInModal();
    openModal('modal-nutrition-plan');
  }).catch(err => {
    notify('Erreur chargement aliments: ' + err.message, 'error');
  });
}

function addMealRow() {
  if (mealCount >= 10) { notify('Maximum 10 repas atteints', 'warning'); return; }

  mealCount++;
  const mealsList = document.getElementById('meals-list');
  const newMealRow = document.createElement('div');
  newMealRow.className = 'meal-row';
  newMealRow.id = `meal-row-${mealCount}`;

  newMealRow.innerHTML = `
    <div class="meal-header">R${mealCount}</div>
    <div id="meal-${mealCount}-foods">
      <div class="food-item">
        <select class="food-select" style="flex:1;background:var(--bg3);border:1px solid var(--border);outline:none;color:var(--text);padding:4px;">
          <option value="">Sélectionner un aliment...</option>
        </select>
        <input type="number" class="quantity-input" placeholder="Quantité (g)" style="width:80px;background:transparent;border:none;outline:none;text-align:center;" onchange="calculateFoodMacros(${mealCount})">
        <input type="text" placeholder="kcal" readonly style="width:60px;background:var(--bg2);border:none;outline:none;text-align:center;color:var(--text3);">
        <input type="text" placeholder="P" readonly style="width:40px;background:var(--bg2);border:none;outline:none;text-align:center;color:var(--text3);">
        <input type="text" placeholder="G" readonly style="width:40px;background:var(--bg2);border:none;outline:none;text-align:center;color:var(--text3);">
        <input type="text" placeholder="L" readonly style="width:40px;background:var(--bg2);border:none;outline:none;text-align:center;color:var(--text3);">
        <button type="button" class="btn btn-outline btn-sm" onclick="addFoodToMeal(${mealCount})">+</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="removeMealRow(${mealCount})" style="margin-left:4px;background:var(--error);border-color:var(--error);">×</button>
      </div>
    </div>
  `;

  mealsList.appendChild(newMealRow);
  updateFoodSelectsInModal();
  notify(`Repas R${mealCount} ajouté`, 'success');
}

function removeMealRow(mealNumber) {
  if (mealCount <= 1) { notify('Minimum 1 repas requis', 'warning'); return; }

  const mealRow = document.getElementById(`meal-row-${mealNumber}`);
  if (mealRow) {
    mealRow.remove();
    mealCount--;
    notify(`Repas R${mealNumber} supprimé`, 'success');
  }
}

function resetMeals() {
  mealCount = 4;
  const mealsList = document.getElementById('meals-list');
  mealsList.innerHTML = `
    ${Array.from({length: 4}, (_, i) => `
      <div class="meal-row" id="meal-row-${i+1}">
        <div class="meal-header">R${i+1}</div>
        <div id="meal-${i+1}-foods">
          <div class="food-item">
            <select class="food-select" style="flex:1;background:var(--bg3);border:1px solid var(--border);outline:none;color:var(--text);padding:4px;">
              <option value="">Sélectionner un aliment...</option>
            </select>
            <input type="number" class="quantity-input" placeholder="Quantité (g)" style="width:80px;background:transparent;border:none;outline:none;text-align:center;" onchange="calculateFoodMacros(${i+1})">
            <input type="text" placeholder="kcal" readonly style="width:60px;background:var(--bg2);border:none;outline:none;text-align:center;color:var(--text3);">
            <input type="text" placeholder="P" readonly style="width:40px;background:var(--bg2);border:none;outline:none;text-align:center;color:var(--text3);">
            <input type="text" placeholder="G" readonly style="width:40px;background:var(--bg2);border:none;outline:none;text-align:center;color:var(--text3);">
            <input type="text" placeholder="L" readonly style="width:40px;background:var(--bg2);border:none;outline:none;text-align:center;color:var(--text3);">
            <button type="button" class="btn btn-outline btn-sm" onclick="addFoodToMeal(${i+1})">+</button>
          </div>
        </div>
      </div>
    `).join('')}
  `;
}

function updateFoodSelectsInModal() {
  const foodOptions = window.alimentsDB ? window.alimentsDB.map(a =>
    `<option value="${a.id}" data-nom="${a.nom}" data-cal="${a.calories||0}" data-prot="${a.proteines||0}" data-gluc="${a.glucides||0}" data-lip="${a.lipides||0}">${a.nom}</option>`
  ).join('') : '';

  document.querySelectorAll('#modal-nutrition-plan select').forEach(select => {
    if (select) {
      select.innerHTML = '<option value="">Sélectionner un aliment...</option>' + foodOptions;
    }
  });
}

const nutritionPlanModal = `
  <div class="modal-overlay" id="modal-nutrition-plan">
    <div class="modal" style="max-width:700px;">
      <div class="modal-header">
        <h2 class="modal-title">Créer un plan nutritionnel</h2>
        <button class="modal-close" onclick="closeModal('modal-nutrition-plan')">×</button>
      </div>
      <form id="nutrition-plan-form">
        <div class="form-group">
          <label>Nom du plan</label>
          <input type="text" id="nutrition-plan-name" required>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Calories objectif</label><input type="number" id="nutrition-plan-calories" step="1"></div>
          <div class="form-group"><label>Protéines (g)</label><input type="number" id="nutrition-plan-proteines" step="0.1"></div>
          <div class="form-group"><label>Glucides (g)</label><input type="number" id="nutrition-plan-glucides" step="0.1"></div>
          <div class="form-group"><label>Lipides (g)</label><input type="number" id="nutrition-plan-lipides" step="0.1"></div>
        </div>
        <div id="meals-container">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h4 style="color:var(--primary);">Répétition du jour</h4>
            <button type="button" class="btn btn-outline btn-sm" onclick="addMealRow()"><i class="fas fa-plus"></i> Ajouter un repas</button>
          </div>
          <div id="meals-list">
            ${Array.from({length: 4}, (_, i) => `
              <div class="meal-row" id="meal-row-${i+1}">
                <div class="meal-header">R${i+1}</div>
                <div id="meal-${i+1}-foods">
                  <div class="food-item">
                    <select class="food-select" style="flex:1;background:var(--bg3);border:1px solid var(--border);outline:none;color:var(--text);padding:4px;">
                      <option value="">Sélectionner un aliment...</option>
                    </select>
                    <input type="number" class="quantity-input" placeholder="Quantité (g)" style="width:80px;background:transparent;border:none;outline:none;text-align:center;" onchange="calculateFoodMacros(${i+1})">
                    <input type="text" placeholder="kcal" readonly style="width:60px;background:var(--bg2);border:none;outline:none;text-align:center;color:var(--text3);">
                    <input type="text" placeholder="P" readonly style="width:40px;background:var(--bg2);border:none;outline:none;text-align:center;color:var(--text3);">
                    <input type="text" placeholder="G" readonly style="width:40px;background:var(--bg2);border:none;outline:none;text-align:center;color:var(--text3);">
                    <input type="text" placeholder="L" readonly style="width:40px;background:var(--bg2);border:none;outline:none;text-align:center;color:var(--text3);">
                    <button type="button" class="btn btn-outline btn-sm" onclick="addFoodToMeal(${i+1})">+</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        <div style="text-align:right;margin-top:24px;padding-top:16px;border-top:1px solid var(--border);">
          <button type="submit" class="btn btn-red">Créer le plan</button>
        </div>
      </form>
    </div>
  </div>
`;
document.body.insertAdjacentHTML('beforeend', nutritionPlanModal);

async function handleNutritionPlanSubmit(e) {
  e.preventDefault();

  const planData = {
    nom: document.getElementById('nutrition-plan-name').value,
    athlete_id: currentAthleteId,
    coach_id: currentUser.id,
    calories_objectif: parseFloat(document.getElementById('nutrition-plan-calories').value) || 0,
    proteines: parseFloat(document.getElementById('nutrition-plan-proteines').value) || 0,
    glucides: parseFloat(document.getElementById('nutrition-plan-glucides').value) || 0,
    lipides: parseFloat(document.getElementById('nutrition-plan-lipides').value) || 0,
    meals_data: JSON.stringify(getMealData()),
    meal_type: window.newPlanMealType || 'training'
  };

  if (window.editingPlanId) {
    const { data, error } = await supabaseClient
      .from('nutrition_plans')
      .update(planData)
      .eq('id', window.editingPlanId)
      .select();

    if (error) { notify('Erreur: ' + error.message, 'error'); return; }
    if (!data || data.length === 0) { notify('Erreur: Aucune donnée modifiée', 'error'); return; }

    notify('Plan modifié avec succès !', 'success');
    window.editingPlanId = null;
  } else {
    const { data, error } = await supabaseClient
      .from('nutrition_plans')
      .insert(planData)
      .select();

    if (error) { notify('Erreur: ' + error.message, 'error'); return; }
    notify('Plan créé avec succès !', 'success');
  }

  window.newPlanMealType = null;
  closeModal('modal-nutrition-plan');
  document.getElementById('nutrition-plan-form').reset();
  loadAthleteTabNutrition();
}

document.getElementById('nutrition-plan-form').addEventListener('submit', handleNutritionPlanSubmit);

function updateMealType() {
  const type = document.getElementById('nutrition-meal-type').value;
}

function getMealData() {
  const meals = [];

  for (let i = 1; i <= mealCount; i++) {
    const mealEl = document.getElementById(`meal-${i}-foods`);
    if (!mealEl) continue;

    const foods = [];
    mealEl.querySelectorAll('.food-item').forEach(foodEl => {
      const select = foodEl.querySelector('select');
      const aliment = select?.options[select.selectedIndex]?.text || '';
      const qte = parseFloat(foodEl.querySelector('input[placeholder*="Quantité"]')?.value) || 0;
      const kcal = parseFloat(foodEl.querySelector('input[placeholder*="kcal"]')?.value) || 0;
      const p = parseFloat(foodEl.querySelector('input[placeholder*="P"]')?.value) || 0;
      const g = parseFloat(foodEl.querySelector('input[placeholder*="G"]')?.value) || 0;
      const l = parseFloat(foodEl.querySelector('input[placeholder*="L"]')?.value) || 0;

      if (aliment && aliment !== 'Sélectionner un aliment...') {
        foods.push({ aliment, qte, kcal, p, g, l });
      }
    });

    meals.push(foods);
  }

  return meals;
}

function addFoodToMeal(mealNumber) {
  const mealEl = document.getElementById(`meal-${mealNumber}-foods`);
  const newFood = document.createElement('div');
  newFood.className = 'food-item';

  const foodOptions = window.alimentsDB ? window.alimentsDB.map(a =>
    `<option value="${a.id}" data-nom="${a.nom}" data-cal="${a.calories||0}" data-prot="${a.proteines||0}" data-gluc="${a.glucides||0}" data-lip="${a.lipides||0}">${a.nom}</option>`
  ).join('') : '';

  newFood.innerHTML = `
    <select style="flex:1;background:var(--bg3);border:1px solid var(--border);outline:none;color:var(--text);padding:4px;">
      <option value="">Sélectionner un aliment...</option>
      ${foodOptions}
    </select>
    <input type="number" placeholder="Quantité (g)" style="width:80px;background:transparent;border:none;outline:none;text-align:center;" onchange="calculateFoodMacros(this)">
    <input type="text" placeholder="kcal" readonly style="width:60px;background:var(--bg2);border:none;outline:none;text-align:center;color:var(--text3);">
    <input type="text" placeholder="P" readonly style="width:40px;background:var(--bg2);border:none;outline:none;text-align:center;color:var(--text3);">
    <input type="text" placeholder="G" readonly style="width:40px;background:var(--bg2);border:none;outline:none;text-align:center;color:var(--text3);">
    <input type="text" placeholder="L" readonly style="width:40px;background:var(--bg2);border:none;outline:none;text-align:center;color:var(--text3);">
    <button type="button" class="btn btn-outline btn-sm" onclick="this.parentElement.remove()">-</button>
  `;
  mealEl.appendChild(newFood);
}

function calculateFoodMacros(qteInput) {
  const foodItem = qteInput.parentElement;
  if (!foodItem) return;

  const select = foodItem.querySelector('select');
  if (!select) return;
  const qte = parseFloat(qteInput.value) || 0;

  if (select.value) {
    const option = select.options[select.selectedIndex];
    const calPer100g = parseFloat(option.dataset.cal) || 0;
    const protPer100g = parseFloat(option.dataset.prot) || 0;
    const glucPer100g = parseFloat(option.dataset.gluc) || 0;
    const lipPer100g = parseFloat(option.dataset.lip) || 0;

    const inputs = foodItem.querySelectorAll('input[type="text"]');
    inputs[0].value = (calPer100g * qte).toFixed(0);
    inputs[1].value = (protPer100g * qte).toFixed(1);
    inputs[2].value = (glucPer100g * qte).toFixed(1);
    inputs[3].value = (lipPer100g * qte).toFixed(1);
  }
}

async function editNutritionPlan(id) {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';
  await loadAliments();
  const { data: plan, error } = await supabaseClient.from('nutrition_plans').select('*').eq('id', id).single();
  if (error || !plan) { notify('Erreur chargement plan', 'error'); loadAthleteTabNutrition(); return; }
  let meals = [];
  try { if (plan.meals_data) meals = JSON.parse(plan.meals_data); } catch(e) {}
  if (!meals.length) meals = [[]];
  window._npEditId = id;
  window._npMealType = plan.meal_type || 'training';
  buildNpFoodOptions();
  const label = window._npMealType === 'training' ? 'Entraînement' : 'Repos';
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Modifier — ${npEsc(plan.nom)} <span style="font-size:12px;color:var(--text3);">(${label})</span></div>
        <button class="btn btn-outline" onclick="loadAthleteTabNutrition()"><i class="fas fa-arrow-left"></i> Annuler</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;">
        <div class="form-group"><label style="font-size:12px;color:var(--text3);">Nom</label><input type="text" id="np-nom" value="${npEsc(plan.nom||'')}" style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%;outline:none;font-size:13px;"></div>
        <div class="form-group"><label style="font-size:12px;color:var(--text3);">kcal total</label><div id="np-cal" style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%;font-size:13px;text-align:center;font-weight:600;">0</div></div>
        <div class="form-group"><label style="font-size:12px;color:var(--text3);">Protéines (g)</label><div id="np-prot" style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%;font-size:13px;text-align:center;font-weight:600;">0</div></div>
        <div class="form-group"><label style="font-size:12px;color:var(--text3);">Glucides (g)</label><div id="np-gluc" style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%;font-size:13px;text-align:center;font-weight:600;">0</div></div>
        <div class="form-group"><label style="font-size:12px;color:var(--text3);">Lipides (g)</label><div id="np-lip" style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%;font-size:13px;text-align:center;font-weight:600;">0</div></div>
      </div>
      <div id="np-meals">${meals.map((items, i) => buildNpMealHtml(i+1, items)).join('')}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
        <button class="btn btn-outline" onclick="addNpMeal()"><i class="fas fa-plus"></i> Repas</button>
        <button class="btn btn-red" onclick="saveNutritionPlanInline()"><i class="fas fa-save"></i> Enregistrer</button>
      </div>
    </div>`;
  document.querySelectorAll('#np-meals .np-food-row').forEach(row => {
    const sel = row.querySelector('select');
    if (sel && sel.value) calcNpMacros(sel);
  });
}

// ===== NUTRITION TABS =====

async function loadAthleteTabNutrition() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  await loadAliments();

  const { data: plans } = await supabaseClient
    .from('nutrition_plans')
    .select('*')
    .eq('athlete_id', currentAthleteId);

  const trainingPlan = plans?.find(p => p.meal_type === 'training' || p.meal_type === 'entrainement') || null;
  const restPlan = plans?.find(p => p.meal_type === 'rest' || p.meal_type === 'repos') || null;
  window.currentNutriPlans = { training: trainingPlan, rest: restPlan };
  window.currentNutriTab = 'training';

  el.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
      <button class="btn btn-outline" onclick="copyNutritionFromTemplate()"><i class="fas fa-copy"></i> Copier un template</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:8px;">
      <button class="athlete-tab-btn active" id="nutri-tab-training" onclick="switchNutriTab('training')">
        <i class="fas fa-dumbbell"></i> Jour Entraînement
      </button>
      <button class="athlete-tab-btn" id="nutri-tab-rest" onclick="switchNutriTab('rest')">
        <i class="fas fa-bed"></i> Jour Repos
      </button>
    </div>
    <div id="nutri-tab-content"></div>
  `;
  renderNutriTab('training');
}

function switchNutriTab(type) {
  window.currentNutriTab = type;
  document.getElementById('nutri-tab-training')?.classList.toggle('active', type === 'training');
  document.getElementById('nutri-tab-rest')?.classList.toggle('active', type === 'rest');
  renderNutriTab(type);
}

function renderNutriTab(type) {
  const container = document.getElementById('nutri-tab-content');
  if (!container) return;
  const plan = window.currentNutriPlans?.[type];
  const label = type === 'training' ? "jours d'entraînement" : "jours de repos";
  const mealType = type === 'training' ? 'training' : 'rest';

  if (!plan) {
    container.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <i class="fas fa-utensils"></i>
          <p>Aucun plan pour les ${label}</p>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
            <button class="btn btn-outline" onclick="copyNutritionFromTemplateForType('${mealType}')"><i class="fas fa-copy"></i> Copier template</button>
            <button class="btn btn-red" onclick="createNutritionPlanForType('${mealType}')"><i class="fas fa-plus"></i> Créer un plan</button>
          </div>
        </div>
      </div>`;
    return;
  }

  let meals = [];
  if (plan.meals_data) { try { meals = JSON.parse(plan.meals_data); } catch(e) {} }

  function calcItemMacros(item) {
    const qte = parseFloat(item.qte) || 0;
    const a = (window.alimentsDB || []).find(x => x.nom === (item.aliment || item.nom));
    if (a) {
      return {
        kcal: parseFloat((a.calories * qte).toFixed(0)),
        p: parseFloat((a.proteines * qte).toFixed(1)),
        g: parseFloat((a.glucides * qte).toFixed(1)),
        l: parseFloat((a.lipides * qte).toFixed(1))
      };
    }
    return { kcal: parseFloat(item.kcal)||0, p: parseFloat(item.p)||0, g: parseFloat(item.g)||0, l: parseFloat(item.l)||0 };
  }

  let totalK = 0, totalP = 0, totalG = 0, totalL = 0;
  meals.forEach(meal => { if (Array.isArray(meal)) meal.forEach(item => {
    const m = calcItemMacros(item);
    totalK += m.kcal; totalP += m.p; totalG += m.g; totalL += m.l;
  }); });

  const mealsHtml = meals.map((meal, idx) => {
    if (!Array.isArray(meal)) return '';
    let mk=0,mp=0,mg=0,ml=0;
    meal.forEach(item => { const m=calcItemMacros(item); mk+=m.kcal; mp+=m.p; mg+=m.g; ml+=m.l; });
    return `
      <div class="meal-row">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div class="meal-header" style="margin-bottom:0;">R${idx+1}</div>
          <div style="font-size:12px;font-weight:600;">${mk.toFixed(0)} kcal &nbsp;|&nbsp; P:${mp.toFixed(1)}g &nbsp;G:${mg.toFixed(1)}g &nbsp;L:${ml.toFixed(1)}g</div>
        </div>
        ${meal.map(item => { const m=calcItemMacros(item); return `
          <div class="food-item">
            <div style="flex:1;"><span style="font-weight:500;">${item.aliment||item.nom||'-'}</span><span style="font-size:11px;color:var(--text3);margin-left:8px;">${item.qte}g</span></div>
            <div style="font-size:12px;text-align:right;"><span style="font-weight:600;">${m.kcal} kcal</span><span style="color:var(--text3);margin-left:8px;">P:${m.p}g G:${m.g}g L:${m.l}g</span></div>
          </div>`; }).join('')}
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${plan.nom}</div>
        <button class="btn btn-red btn-sm" onclick="editNutritionPlan('${plan.id}')"><i class="fas fa-pen"></i> Modifier</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;padding:16px;background:var(--bg3);border-radius:10px;">
        <div style="text-align:center;"><div style="font-size:24px;font-weight:700;color:var(--primary);">${totalK.toFixed(0)}</div><div style="font-size:11px;color:var(--text3);">Total kcal</div></div>
        <div style="text-align:center;"><div style="font-size:24px;font-weight:700;">${totalP.toFixed(1)}g</div><div style="font-size:11px;color:var(--text3);">Protéines</div></div>
        <div style="text-align:center;"><div style="font-size:24px;font-weight:700;">${totalG.toFixed(1)}g</div><div style="font-size:11px;color:var(--text3);">Glucides</div></div>
        <div style="text-align:center;"><div style="font-size:24px;font-weight:700;">${totalL.toFixed(1)}g</div><div style="font-size:11px;color:var(--text3);">Lipides</div></div>
      </div>
      ${mealsHtml || '<div class="empty-state"><i class="fas fa-utensils"></i><p>Aucun repas</p></div>'}
    </div>
  `;
}

function createNutritionPlanForType(mealType) {
  const el = document.getElementById('athlete-tab-content');
  window._npEditId = null;
  window._npMealType = mealType;
  loadAliments().then(() => {
    buildNpFoodOptions();
    const label = mealType === 'training' ? 'Entraînement' : 'Repos';
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Nouveau plan — Jour ${label}</div>
          <button class="btn btn-outline" onclick="loadAthleteTabNutrition()"><i class="fas fa-arrow-left"></i> Annuler</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;">
          <div class="form-group"><label style="font-size:12px;color:var(--text3);">Nom</label><input type="text" id="np-nom" placeholder="ex: Plan S1" style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%;outline:none;font-size:13px;"></div>
          <div class="form-group"><label style="font-size:12px;color:var(--text3);">kcal total</label><div id="np-cal" style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%;font-size:13px;text-align:center;font-weight:600;">0</div></div>
          <div class="form-group"><label style="font-size:12px;color:var(--text3);">Protéines (g)</label><div id="np-prot" style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%;font-size:13px;text-align:center;font-weight:600;">0</div></div>
          <div class="form-group"><label style="font-size:12px;color:var(--text3);">Glucides (g)</label><div id="np-gluc" style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%;font-size:13px;text-align:center;font-weight:600;">0</div></div>
          <div class="form-group"><label style="font-size:12px;color:var(--text3);">Lipides (g)</label><div id="np-lip" style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%;font-size:13px;text-align:center;font-weight:600;">0</div></div>
        </div>
        <div id="np-meals">${buildNpMealHtml(1, [])}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
          <button class="btn btn-outline" onclick="addNpMeal()"><i class="fas fa-plus"></i> Repas</button>
          <button class="btn btn-red" onclick="saveNutritionPlanInline()"><i class="fas fa-save"></i> Enregistrer</button>
        </div>
      </div>`;
  });
}

function copyNutritionFromTemplate() {
  copyNutritionFromTemplateForType(window.currentNutriTab || 'training');
}

async function viewNutritionPlanDetail(id) {
  const { data: plan, error } = await supabaseClient
    .from('nutrition_plans')
    .select('*')
    .eq('id', id)
    .single();

  if (error) { notify('Erreur: ' + error.message, 'error'); return; }

  const el = document.getElementById('athlete-tab-content');

  let mealsHtml = '';
  if (plan.meals_data) {
    try {
      const meals = JSON.parse(plan.meals_data);
      mealsHtml = meals.map((meal, index) => {
        if (!meal || meal.length === 0) {
          return `
            <div class="meal-row" style="margin-bottom:16px;">
              <div class="meal-header">R${index + 1} - Vide</div>
              <div style="color:var(--text3);font-style:italic;">Aucun aliment pour ce repas</div>
            </div>`;
        }
        return `
          <div class="meal-row" style="margin-bottom:16px;">
            <div class="meal-header">R${index + 1}</div>
            ${meal.map(item => `
              <div class="food-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:var(--bg3);border-radius:6px;margin-bottom:8px;">
                <div style="flex:1;">
                  <div style="font-weight:600;">${item.aliment || item.nom || 'Aliment'}</div>
                  <div style="font-size:12px;color:var(--text3);">Quantité: ${item.qte}g</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:14px;font-weight:600;">${item.kcal || 0} kcal</div>
                  <div style="font-size:11px;color:var(--text3);">P:${item.p || 0}g | G:${item.g || 0}g | L:${item.l || 0}g</div>
                </div>
              </div>
            `).join('')}
          </div>`;
      }).join('');
    } catch(e) {
      mealsHtml = '<div style="color:var(--error);">Erreur dans le format des repas</div>';
    }
  } else {
    mealsHtml = '<div style="color:var(--text3);">Aucun repas enregistré</div>';
  }

  let totalCalories = 0, totalProteines = 0, totalGlucides = 0, totalLipides = 0;
  if (plan.meals_data) {
    try {
      const meals = JSON.parse(plan.meals_data);
      meals.forEach(meal => {
        if (meal && meal.length > 0) {
          meal.forEach(item => {
            totalCalories += parseFloat(item.kcal) || 0;
            totalProteines += parseFloat(item.p) || 0;
            totalGlucides += parseFloat(item.g) || 0;
            totalLipides += parseFloat(item.l) || 0;
          });
        }
      });
    } catch(e) {}
  }

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h2 style="margin:0;color:var(--primary);">${plan.nom}</h2>
          <div style="font-size:12px;color:var(--text3);margin-top:4px;">Créé le ${new Date(plan.created_at).toLocaleDateString('fr-FR')}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline" onclick="loadAthleteTabNutrition()"><i class="fas fa-arrow-left"></i> Retour</button>
          <button class="btn btn-red" onclick="editNutritionPlan('${plan.id}')"><i class="fas fa-pen"></i> Modifier</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;">
        <div style="text-align:center;padding:16px;background:var(--bg3);border-radius:8px;"><div style="font-size:24px;font-weight:700;color:var(--primary);">${plan.calories_objectif || 0}</div><div style="font-size:12px;color:var(--text3);">Objectif kcal</div></div>
        <div style="text-align:center;padding:16px;background:var(--bg3);border-radius:8px;"><div style="font-size:24px;font-weight:700;color:var(--primary);">${plan.proteines || 0}g</div><div style="font-size:12px;color:var(--text3);">Protéines</div></div>
        <div style="text-align:center;padding:16px;background:var(--bg3);border-radius:8px;"><div style="font-size:24px;font-weight:700;color:var(--primary);">${plan.glucides || 0}g</div><div style="font-size:12px;color:var(--text3);">Glucides</div></div>
        <div style="text-align:center;padding:16px;background:var(--bg3);border-radius:8px;"><div style="font-size:24px;font-weight:700;color:var(--primary);">${plan.lipides || 0}g</div><div style="font-size:12px;color:var(--text3);">Lipides</div></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;padding:16px;background:var(--bg2);border-radius:8px;">
        <div style="text-align:center;"><div style="font-size:20px;font-weight:600;">${totalCalories.toFixed(0)}</div><div style="font-size:11px;color:var(--text3);">Total kcal</div></div>
        <div style="text-align:center;"><div style="font-size:20px;font-weight:600;">${totalProteines.toFixed(1)}g</div><div style="font-size:11px;color:var(--text3);">Total P</div></div>
        <div style="text-align:center;"><div style="font-size:20px;font-weight:600;">${totalGlucides.toFixed(1)}g</div><div style="font-size:11px;color:var(--text3);">Total G</div></div>
        <div style="text-align:center;"><div style="font-size:20px;font-weight:600;">${totalLipides.toFixed(1)}g</div><div style="font-size:11px;color:var(--text3);">Total L</div></div>
      </div>
      <div>
        <h3 style="margin-bottom:16px;color:var(--primary);">Détail des repas</h3>
        ${mealsHtml}
      </div>
    </div>
  `;
}

// ===== INLINE NUTRITION PLAN EDITOR =====
function npEsc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function buildNpFoodOptions() {
  window._npFoodOptions = (window.alimentsDB || []).map(a =>
    `<option value="${a.id}" data-cal="${a.calories||0}" data-prot="${a.proteines||0}" data-gluc="${a.glucides||0}" data-lip="${a.lipides||0}">${npEsc(a.nom)}</option>`
  ).join('');
}

function buildNpFoodHtml(item) {
  const opts = '<option value="">— aliment —</option>' + (window.alimentsDB || []).map(a => {
    const sel = (item && item.aliment === a.nom) ? ' selected' : '';
    return `<option value="${a.id}"${sel} data-cal="${a.calories||0}" data-prot="${a.proteines||0}" data-gluc="${a.glucides||0}" data-lip="${a.lipides||0}">${npEsc(a.nom)}</option>`;
  }).join('');
  const inp = 'background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text);font-size:12px;outline:none;text-align:center;';
  const ro = 'background:var(--bg4);border:none;border-radius:6px;padding:5px 8px;color:var(--text3);font-size:12px;text-align:center;';
  return `
    <div class="food-item np-food-row" style="flex-wrap:wrap;gap:6px;margin-bottom:6px;">
      <select style="flex:2;min-width:150px;${inp.replace('text-align:center;','')}" onchange="calcNpMacros(this)">
        ${opts}
      </select>
      <input type="number" class="np-qty" value="${item?.qte||''}" placeholder="g" style="width:65px;${inp}" oninput="calcNpMacros(this)">
      <input type="text" class="np-kcal" value="${item?.kcal||''}" readonly placeholder="kcal" style="width:55px;${ro}">
      <input type="text" class="np-p" value="${item?.p||''}" readonly placeholder="P" style="width:40px;${ro}">
      <input type="text" class="np-g" value="${item?.g||''}" readonly placeholder="G" style="width:40px;${ro}">
      <input type="text" class="np-l" value="${item?.l||''}" readonly placeholder="L" style="width:40px;${ro}">
      <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="this.closest('.np-food-row').remove();updateNpTotals()">×</button>
    </div>`;
}

function buildNpMealHtml(n, items) {
  const foodsHtml = (items && items.length > 0 ? items : [null]).map(item => buildNpFoodHtml(item)).join('');
  return `
    <div class="meal-row np-meal-row" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="meal-header np-meal-label" style="margin-bottom:0;">R${n}</div>
          <span class="np-meal-totals" style="font-size:12px;color:var(--text3);"></span>
        </div>
        <div style="display:flex;gap:6px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="copyNpMeal(this)" title="Copier ce repas"><i class="fas fa-copy"></i></button>
          <button type="button" class="btn btn-outline btn-sm" onclick="pasteNpMeal(this)" title="Coller repas copié"><i class="fas fa-paste"></i></button>
          <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="removeNpMeal(this)">Supprimer</button>
        </div>
      </div>
      <div class="np-foods-list">${foodsHtml}</div>
      <button type="button" class="btn btn-outline btn-sm" style="margin-top:6px;" onclick="this.previousElementSibling.insertAdjacentHTML('beforeend', buildNpFoodHtml(null))">
        <i class="fas fa-plus"></i> Aliment
      </button>
    </div>`;
}

function addNpMeal() {
  const c = document.getElementById('np-meals');
  if (!c) return;
  const n = c.querySelectorAll('.np-meal-row').length + 1;
  c.insertAdjacentHTML('beforeend', buildNpMealHtml(n, []));
}

function removeNpMeal(btn) {
  const c = document.getElementById('np-meals');
  if (c.querySelectorAll('.np-meal-row').length <= 1) { notify('Minimum 1 repas', 'warning'); return; }
  btn.closest('.np-meal-row').remove();
  c.querySelectorAll('.np-meal-label').forEach((lbl, i) => { lbl.textContent = 'R' + (i+1); });
  updateNpTotals();
}

function calcNpMacros(el) {
  const row = el.closest('.np-food-row');
  if (!row) return;
  const sel = row.querySelector('select');
  const qte = parseFloat(row.querySelector('.np-qty')?.value) || 0;
  if (!sel?.value) return;
  const opt = sel.options[sel.selectedIndex];
  const f = (k) => parseFloat(opt.dataset[k]) || 0;
  row.querySelector('.np-kcal').value = (f('cal') * qte).toFixed(0);
  row.querySelector('.np-p').value = (f('prot') * qte).toFixed(1);
  row.querySelector('.np-g').value = (f('gluc') * qte).toFixed(1);
  row.querySelector('.np-l').value = (f('lip') * qte).toFixed(1);
  updateNpTotals();
}

function updateNpTotals() {
  let tk = 0, tp = 0, tg = 0, tl = 0;
  document.querySelectorAll('#np-meals .np-meal-row').forEach(mealRow => {
    let k = 0, p = 0, g = 0, l = 0;
    mealRow.querySelectorAll('.np-food-row').forEach(fr => {
      k += parseFloat(fr.querySelector('.np-kcal')?.value) || 0;
      p += parseFloat(fr.querySelector('.np-p')?.value) || 0;
      g += parseFloat(fr.querySelector('.np-g')?.value) || 0;
      l += parseFloat(fr.querySelector('.np-l')?.value) || 0;
    });
    tk += k; tp += p; tg += g; tl += l;
    const tot = mealRow.querySelector('.np-meal-totals');
    if (tot) tot.textContent = k > 0 ? `${k.toFixed(0)} kcal · P${p.toFixed(1)} G${g.toFixed(1)} L${l.toFixed(1)}` : '';
  });
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('np-cal', tk.toFixed(0));
  set('np-prot', tp.toFixed(1));
  set('np-gluc', tg.toFixed(1));
  set('np-lip', tl.toFixed(1));
}

function copyNpMeal(btn) {
  const mealRow = btn.closest('.np-meal-row');
  const foods = [];
  mealRow.querySelectorAll('.np-food-row').forEach(fr => {
    const sel = fr.querySelector('select');
    const opt = sel ? sel.options[sel.selectedIndex] : null;
    const nom = opt?.text;
    if (!nom || nom === '— aliment —') return;
    foods.push({
      aliment: nom,
      qte: parseFloat(fr.querySelector('.np-qty')?.value) || 0,
      cal: parseFloat(opt?.dataset?.cal) || 0,
      prot: parseFloat(opt?.dataset?.prot) || 0,
      gluc: parseFloat(opt?.dataset?.gluc) || 0,
      lip: parseFloat(opt?.dataset?.lip) || 0,
    });
  });
  window._npClipboard = foods;
  notify('Repas copié', 'success');
}

function pasteNpMeal(btn) {
  if (!window._npClipboard || !window._npClipboard.length) { notify('Aucun repas copié', 'warning'); return; }
  const mealRow = btn.closest('.np-meal-row');
  const list = mealRow.querySelector('.np-foods-list');
  const items = window._npClipboard.map(f => ({
    aliment: f.aliment,
    qte: f.qte,
    kcal: parseFloat((f.cal * f.qte).toFixed(0)),
    p: parseFloat((f.prot * f.qte).toFixed(1)),
    g: parseFloat((f.gluc * f.qte).toFixed(1)),
    l: parseFloat((f.lip * f.qte).toFixed(1)),
  }));
  list.innerHTML = items.map(item => buildNpFoodHtml(item)).join('');
  list.querySelectorAll('.np-food-row').forEach(row => {
    const sel = row.querySelector('select');
    if (sel && sel.value) calcNpMacros(sel);
  });
  notify('Repas collé', 'success');
}

function getNpMealData() {
  const meals = [];
  document.querySelectorAll('#np-meals .np-meal-row').forEach(row => {
    const foods = [];
    row.querySelectorAll('.np-food-row').forEach(fr => {
      const sel = fr.querySelector('select');
      const opt = sel ? sel.options[sel.selectedIndex] : null;
      const nom = opt?.text;
      if (!nom || nom === '— aliment —') return;
      const qte = parseFloat(fr.querySelector('.np-qty')?.value) || 0;
      const cal = parseFloat(opt?.dataset?.cal) || 0;
      const prot = parseFloat(opt?.dataset?.prot) || 0;
      const gluc = parseFloat(opt?.dataset?.gluc) || 0;
      const lip = parseFloat(opt?.dataset?.lip) || 0;
      foods.push({
        aliment: nom,
        qte,
        kcal: parseFloat((cal * qte).toFixed(0)),
        p: parseFloat((prot * qte).toFixed(1)),
        g: parseFloat((gluc * qte).toFixed(1)),
        l: parseFloat((lip * qte).toFixed(1))
      });
    });
    meals.push(foods);
  });
  return meals;
}

async function saveNutritionPlanInline() {
  const nom = document.getElementById('np-nom')?.value?.trim();
  if (!nom) { notify('Le nom est obligatoire', 'error'); return; }
  const planData = {
    nom,
    calories_objectif: Math.round(parseFloat(document.getElementById('np-cal')?.textContent) || 0),
    proteines: Math.round(parseFloat(document.getElementById('np-prot')?.textContent) || 0),
    glucides: Math.round(parseFloat(document.getElementById('np-gluc')?.textContent) || 0),
    lipides: Math.round(parseFloat(document.getElementById('np-lip')?.textContent) || 0),
    meals_data: JSON.stringify(getNpMealData()),
    meal_type: window._npMealType || 'training'
  };
  let error;
  if (window._npEditId) {
    ({ error } = await supabaseClient.from('nutrition_plans').update(planData).eq('id', window._npEditId));
  } else {
    ({ error } = await supabaseClient.from('nutrition_plans').insert({ ...planData, athlete_id: currentAthleteId, coach_id: currentUser.id }));
  }
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  notify('Plan sauvegardé !', 'success');
  window._npEditId = null;
  loadAthleteTabNutrition();
}
