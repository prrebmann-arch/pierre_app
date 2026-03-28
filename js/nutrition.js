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
    handleError(error, 'loadAliments');
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

  const nom = document.getElementById('aliment-nom').value;
  const calories = parseFloat(document.getElementById('aliment-calories').value);
  const proteines = parseFloat(document.getElementById('aliment-proteines').value) || 0;
  const glucides = parseFloat(document.getElementById('aliment-glucides').value) || 0;
  const lipides = parseFloat(document.getElementById('aliment-lipides').value) || 0;

  const { data: existing } = await supabaseClient
    .from('aliments_db')
    .select('id, nom')
    .eq('coach_id', currentUser.id)
    .ilike('nom', nom)
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (!confirm(`L'aliment "${existing.nom}" existe déjà. Mettre à jour ?`)) return;
    const { error } = await supabaseClient.from('aliments_db').update({ calories, proteines, glucides, lipides }).eq('id', existing.id);
    if (error) { handleError(error, 'nutrition'); return; }
    notify('Aliment mis à jour avec succès !', 'success');
  } else {
    const alimentData = { nom, calories, proteines, glucides, lipides, coach_id: currentUser.id };

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

    if (error) { handleError(error, 'nutrition'); return; }
    notify('Aliment ajouté avec succès !', 'success');
  }
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
  if (error) { handleError(error, 'nutrition'); return; }
  notify('Aliment modifié !', 'success');
  closeModal('modal-edit-aliment');
  loadAliments();
});

async function deleteAliment(id) {
  if (!confirm('Supprimer cet aliment ?')) return;
  const { error } = await supabaseClient.from('aliments_db').delete().eq('id', id);
  if (error) { handleError(error, 'nutrition'); return; }
  closeModal('modal-edit-aliment');
  notify('Aliment supprimé !', 'success');
  loadAliments();
}

// ===== ALIMENTS PAGE SEARCH =====
let _alimentsPageSource = 'local';
let _alimentsOffDebounce = null;

function setAlimentsSource(src, btn) {
  _alimentsPageSource = src;
  btn.parentElement.querySelectorAll('.np-src-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterAlimentsPage();
}

function filterAlimentsPage() {
  const query = (document.getElementById('aliments-search')?.value || '').trim().toLowerCase();
  const container = document.getElementById('aliments-list');
  if (!container) return;

  let html = '';

  // Local
  if (_alimentsPageSource === 'local' || _alimentsPageSource === 'both') {
    const db = window.alimentsDB || [];
    const local = query ? db.filter(a => a.nom.toLowerCase().includes(query)) : db;
    html += local.map(a => `
      <div class="card" style="margin-bottom:8px;padding:12px 16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-weight:600;font-size:14px;">${escHtml(a.nom)}</div>
            <div style="font-size:12px;color:var(--text3);margin-top:2px;">${a.calories||0} kcal · P${a.proteines||0}g · G${a.glucides||0}g · L${a.lipides||0}g</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-outline btn-sm" onclick="editAliment('${a.id}')"><i class="fas fa-pen"></i></button>
            <button class="btn btn-outline btn-sm" onclick="deleteAliment('${a.id}')" style="color:var(--danger);"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>`).join('');
    if (!local.length && _alimentsPageSource === 'local') {
      html += '<div style="text-align:center;padding:30px;color:var(--text3);">Aucun résultat</div>';
    }
  }

  // OFF
  if ((_alimentsPageSource === 'off' || _alimentsPageSource === 'both') && query.length >= 2) {
    clearTimeout(_alimentsOffDebounce);
    _alimentsOffDebounce = setTimeout(async () => {
      try {
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=20&fields=product_name,nutriments,brands&lc=fr&cc=fr`;
        const resp = await fetch(url);
        const data = await resp.json();
        const results = (data.products || [])
          .filter(p => p.product_name && p.nutriments?.['energy-kcal_100g'] != null)
          .map(p => ({
            nom: p.product_name + (p.brands ? ` — ${p.brands}` : ''),
            calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
            proteines: Math.round(p.nutriments['proteins_100g'] || 0),
            glucides: Math.round(p.nutriments['carbohydrates_100g'] || 0),
            lipides: Math.round(p.nutriments['fat_100g'] || 0),
          }));

        let offHtml = '';
        if (_alimentsPageSource === 'both') offHtml += '<div class="np-off-divider" style="margin:12px 0;">── Open Food Facts ──</div>';
        offHtml += results.map(a => `
          <div class="card" style="margin-bottom:8px;padding:12px 16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-weight:600;font-size:14px;">${escHtml(a.nom)} <span class="np-src-badge np-src-badge-off">OFF</span></div>
                <div style="font-size:12px;color:var(--text3);margin-top:2px;">${a.calories} kcal · P${a.proteines}g · G${a.glucides}g · L${a.lipides}g</div>
              </div>
              <button class="btn btn-outline btn-sm" onclick="importOffAliment(this, '${escHtml(a.nom).replace(/'/g, "\\'")}',${a.calories},${a.proteines},${a.glucides},${a.lipides})"><i class="fas fa-download"></i> Importer</button>
            </div>
          </div>`).join('');
        if (!results.length) offHtml += '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Aucun résultat OFF</div>';

        const offContainer = document.getElementById('aliments-off-results');
        if (offContainer) offContainer.innerHTML = offHtml;
      } catch (e) { devError('[nutrition] OFF search failed', e); }
    }, 400);

    // Placeholder for OFF results
    if (!document.getElementById('aliments-off-results')) {
      html += '<div id="aliments-off-results"><div style="padding:16px;text-align:center;color:var(--text3);font-size:12px;"><i class="fas fa-spinner fa-spin"></i> Recherche OFF...</div></div>';
    }
  }

  if (!html) html = '<div style="text-align:center;padding:40px;color:var(--text3);"><i class="fas fa-apple-alt" style="font-size:28px;margin-bottom:8px;display:block;"></i>Aucun aliment</div>';
  container.innerHTML = html;
  // Re-add OFF container if needed
  if ((_alimentsPageSource === 'off' || _alimentsPageSource === 'both') && query.length >= 2 && !document.getElementById('aliments-off-results')) {
    container.insertAdjacentHTML('beforeend', '<div id="aliments-off-results"></div>');
  }
}

async function importOffAliment(btn, nom, cal, p, g, l) {
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  const { data: existing } = await supabaseClient
    .from('aliments_db')
    .select('id, nom')
    .eq('coach_id', currentUser.id)
    .ilike('nom', nom)
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (!confirm(`L'aliment "${existing.nom}" existe déjà. Mettre à jour ?`)) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-download"></i> Importer';
      return;
    }
    const { error } = await supabaseClient.from('aliments_db').update({ calories: cal, proteines: p, glucides: g, lipides: l }).eq('id', existing.id);
    if (error) { handleError(error, 'nutrition'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Importer'; return; }
  } else {
    const { error } = await supabaseClient.from('aliments_db').insert({
      nom, calories: cal, proteines: p, glucides: g, lipides: l, coach_id: currentUser.id
    });
    if (error) { handleError(error, 'nutrition'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Importer'; return; }
  }

  btn.innerHTML = '<i class="fas fa-check" style="color:var(--success);"></i> Importé';
  window.alimentsDB = null;
  await loadAliments();
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

  planData.valid_from = new Date().toISOString().split('T')[0];
  planData.actif = true;

  if (window.editingPlanId) {
    // Deactivate old version, insert new one (keeps history for bilans)
    const { error: deactivateErr } = await supabaseClient.from('nutrition_plans').update({ actif: false }).eq('id', window.editingPlanId);
    if (deactivateErr) { handleError(deactivateErr, 'nutrition'); return; }
    const { data, error } = await supabaseClient
      .from('nutrition_plans')
      .insert(planData)
      .select();

    if (error) { handleError(error, 'nutrition'); return; }
    notify('Plan modifié avec succès !', 'success');
    window.editingPlanId = null;
  } else {
    const { data, error } = await supabaseClient
      .from('nutrition_plans')
      .insert(planData)
      .select();

    if (error) { handleError(error, 'nutrition'); return; }
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

// Temp state for unsaved tab data (survives ON/OFF tab switch)
window._npTempMeals = {};

function switchNpTab(targetType) {
  // Save current editor state before switching
  const currentType = window._npMealType || 'training';
  const nom = document.getElementById('np-nom')?.value?.trim() || '';
  window._npDietName = nom;
  window._npTempMeals[currentType] = { meals: getNpMealData(), nom };

  // Navigate to target
  const pair = window._npDietPair;
  const targetId = pair ? (targetType === 'training' ? pair.training : pair.rest) : '';
  if (targetId) {
    editNutritionPlan(targetId);
  } else {
    createNutritionPlanForType(targetType);
  }
}

function clearNpTempState() {
  window._npTempMeals = {};
  window._npDietName = '';
  window._npDietPair = null;
  window._npMacroOnly = false;
}

async function editNutritionPlan(id) {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';
  await loadAliments();
  const { data: plan, error } = await supabaseClient.from('nutrition_plans').select('*').eq('id', id).single();
  if (error || !plan) { notify('Erreur chargement plan', 'error'); loadAthleteTabNutrition(); return; }
  const mealType = plan.meal_type || 'training';
  // Check temp cache first (unsaved tab data)
  const temp = window._npTempMeals?.[mealType];
  let meals = [];
  let planName = plan.nom || '';
  if (temp) {
    meals = temp.meals;
    planName = temp.nom || planName;
    delete window._npTempMeals[mealType];
  } else {
    try { meals = typeof plan.meals_data === 'string' ? JSON.parse(plan.meals_data) : (plan.meals_data || []); } catch(e) {}
  }
  if (!meals.length) meals = [[]];
  window._npEditId = id;
  window._npMealType = mealType;
  window._npActiveMeal = 0;
  window._npMacroOnly = !!plan.macro_only;
  window._npMealTimesEnabled = !!(plan.meal_times && plan.meal_times.length);
  const label = mealType === 'training' ? 'Entraînement' : 'Repos';
  renderNpEditor(el, npEsc(planName), label, meals);
}

// ===== NUTRITION TABS =====

async function loadAthleteTabNutrition() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  await loadAliments();

  const { data: plans } = await supabaseClient
    .from('nutrition_plans')
    .select('*')
    .eq('athlete_id', currentAthleteId)
    .order('created_at', { ascending: false });

  window._allNutriPlans = plans || [];

  // Store active plans globally
  const activePlans = (plans || []).filter(p => p.actif === true);
  window.currentNutriPlans = {
    training: activePlans.find(p => p.meal_type === 'training' || p.meal_type === 'entrainement') || null,
    rest: activePlans.find(p => p.meal_type === 'rest' || p.meal_type === 'repos') || null
  };

  // Group plans by diet name → one card per diet
  const byName = {};
  (plans || []).forEach(p => {
    const name = p.nom || 'Diète';
    if (!byName[name]) byName[name] = [];
    byName[name].push(p);
  });

  // Build diet list data
  window._nutriDiets = [];
  Object.entries(byName).forEach(([name, dietPlans]) => {
    const sorted = [...dietPlans].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const tPlan = sorted.find(p => p.actif && (p.meal_type === 'training' || p.meal_type === 'entrainement'))
                || sorted.find(p => p.meal_type === 'training' || p.meal_type === 'entrainement') || null;
    const rPlan = sorted.find(p => p.actif && (p.meal_type === 'rest' || p.meal_type === 'repos'))
                || sorted.find(p => p.meal_type === 'rest' || p.meal_type === 'repos') || null;
    const isActive = dietPlans.some(p => p.actif);
    const versionCount = buildNutriVersions(dietPlans).length;
    window._nutriDiets.push({ name, tPlan, rPlan, isActive, versionCount, ids: dietPlans.map(p => p.id) });
  });

  // Sort: active first
  window._nutriDiets.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));

  const rowsHtml = window._nutriDiets.length ? window._nutriDiets.map((d, idx) => {
    const tK = d.tPlan ? (d.tPlan.calories_objectif || 0) : null;
    const rK = d.rPlan ? (d.rPlan.calories_objectif || 0) : null;
    const tMacro = d.tPlan ? `P:${d.tPlan.proteines||0} G:${d.tPlan.glucides||0} L:${d.tPlan.lipides||0}` : '';
    const rMacro = d.rPlan ? `P:${d.rPlan.proteines||0} G:${d.rPlan.glucides||0} L:${d.rPlan.lipides||0}` : '';
    return `
      <tr class="nd-tr ${d.isActive ? 'nd-tr-active' : ''}" onclick="editNutritionDiet('${d.tPlan?.id||''}','${d.rPlan?.id||''}')">
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-weight:700;color:var(--text);">${npEsc(d.name)}</span>
            ${d.isActive ? '<span style="font-size:9px;padding:2px 6px;border-radius:8px;background:var(--primary);color:#fff;font-weight:700;">ACTIF</span>' : ''}
          </div>
          ${d.versionCount > 1 ? `<span style="font-size:10px;color:var(--text3);">${d.versionCount} versions</span>` : ''}
        </td>
        <td style="text-align:right;">
          ${tK !== null ? `<div style="font-weight:700;color:var(--text);">${tK.toLocaleString('fr-FR')}</div><div style="font-size:10px;color:var(--text3);">${tMacro}</div>` : '<span style="color:var(--text3);">—</span>'}
        </td>
        <td style="text-align:right;">
          ${rK !== null ? `<div style="font-weight:700;color:var(--text);">${rK.toLocaleString('fr-FR')}</div><div style="font-size:10px;color:var(--text3);">${rMacro}</div>` : '<span style="color:var(--text3);">—</span>'}
        </td>
        <td onclick="event.stopPropagation();" style="text-align:center;">
          <label class="toggle-switch">
            <input type="checkbox" ${d.isActive ? 'checked' : ''} onchange="toggleNutriActive(this.checked, '${d.tPlan?.id||''}', '${d.rPlan?.id||''}')">
            <span class="switch"></span>
          </label>
        </td>
        <td onclick="event.stopPropagation();" style="text-align:right;white-space:nowrap;">
          ${d.versionCount > 1 ? `<button class="nd2-btn" onclick="viewNutritionVersions('${npEsc(d.name).replace(/'/g, "\\'")}')" title="Versions"><i class="fas fa-layer-group"></i> ${d.versionCount}</button>` : ''}
          <button class="nd2-btn nd2-btn-del" onclick="deleteDietByIdx(${idx})" title="Supprimer"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`;
  }).join('') : '';

  el.innerHTML = `
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px;">
      <button class="btn btn-outline" onclick="loadNutritionHistory()"><i class="fas fa-history"></i> Historique repas</button>
      <button class="btn btn-outline" onclick="copyNutritionFromTemplate()"><i class="fas fa-copy"></i> Copier template</button>
      <button class="btn btn-red" onclick="createNewDiet()"><i class="fas fa-plus"></i> Nouvelle diète</button>
    </div>
    ${window._nutriDiets.length ? `
      <div class="nd-table-wrap">
        <table class="nd-table">
          <thead>
            <tr>
              <th>Diète</th>
              <th style="text-align:right;"><span style="color:#e74c3c;">ON</span> kcal</th>
              <th style="text-align:right;"><span style="color:#3498db;">OFF</span> kcal</th>
              <th style="text-align:center;">Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    ` : `
      <div class="card">
        <div class="empty-state">
          <i class="fas fa-utensils"></i>
          <p>Aucune diète</p>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
            <button class="btn btn-outline" onclick="copyNutritionFromTemplate()"><i class="fas fa-copy"></i> Copier template</button>
            <button class="btn btn-red" onclick="createNewDiet()"><i class="fas fa-plus"></i> Créer une diète</button>
          </div>
        </div>
      </div>
    `}
  `;
}

function renderNutriCard(dietName, tM, rM, tPlan, rPlan, versionCount, isActive, lastDate) {
  function macroBlock(label, color, m) {
    if (!m) return `<div class="nd-macro-block nd-macro-empty"><span class="nd-macro-type" style="color:${color};">${label}</span><span class="nd-macro-dash">—</span></div>`;
    return `
      <div class="nd-macro-block">
        <span class="nd-macro-type" style="color:${color};">${label}</span>
        <span class="nd-macro-kcal">${m.k.toLocaleString('fr-FR')}</span>
        <span class="nd-macro-unit">kcal</span>
        <div class="nd-macro-detail">
          <span>P <strong>${m.p}g</strong></span>
          <span>G <strong>${m.g}g</strong></span>
          <span>L <strong>${m.l}g</strong></span>
        </div>
      </div>`;
  }
  const safeName = npEsc(dietName).replace(/'/g, "\\'");
  const dateLabel = lastDate ? new Date(lastDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
  const versionLabel = versionCount > 1 ? `${versionCount} versions` : '';
  const metaParts = [dateLabel, versionLabel].filter(Boolean).join(' · ');

  return `
    <div class="nd2-card ${isActive ? 'nd2-active' : ''}" onclick="editNutritionDiet('${tPlan?.id||''}','${rPlan?.id||''}')">
      <div class="nd2-header">
        <div class="nd2-title-row">
          <span class="nd2-name">${npEsc(dietName)}</span>
          ${isActive ? '<span class="nd2-badge">ACTIF</span>' : ''}
        </div>
        ${metaParts ? `<span class="nd2-meta">${metaParts}</span>` : ''}
      </div>
      <div class="nd2-macros">
        ${macroBlock('ON', '#e74c3c', tM)}
        <div class="nd2-sep"></div>
        ${macroBlock('OFF', '#3498db', rM)}
      </div>
      <div class="nd2-footer" onclick="event.stopPropagation()">
        <label class="toggle-switch">
          <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleNutriActive(this.checked, '${tPlan?.id||''}', '${rPlan?.id||''}')">
          <span class="switch"></span>
        </label>
        <div class="nd2-actions">
          ${versionCount > 1 ? `<button class="nd2-btn" onclick="viewNutritionVersions('${safeName}')" title="Versions"><i class="fas fa-layer-group"></i></button>` : ''}
          <button class="nd2-btn nd2-btn-del" onclick="deleteDiet('${safeName}')" title="Supprimer"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>`;
}

async function deleteDietByIdx(idx) {
  const diet = (window._nutriDiets || [])[idx];
  if (!diet) return;
  if (!confirm(`Supprimer "${diet.name}" et toutes ses versions ?`)) return;
  const { error } = await supabaseClient.from('nutrition_plans').delete().in('id', diet.ids);
  if (error) { handleError(error, 'nutrition'); return; }
  notify('Diète supprimée', 'success');
  loadAthleteTabNutrition();
}

async function toggleNutriActive(isActive, tId, rId) {
  if (isActive) {
    // Deactivate all then activate selected — in parallel where possible
    await supabaseClient.from('nutrition_plans').update({ actif: false }).eq('athlete_id', currentAthleteId);
    const activations = [];
    if (tId) activations.push(supabaseClient.from('nutrition_plans').update({ actif: true }).eq('id', tId));
    if (rId) activations.push(supabaseClient.from('nutrition_plans').update({ actif: true }).eq('id', rId));
    await Promise.all(activations);
    notify('Diète activée !', 'success');
    // Notification non-bloquante
    if (currentAthleteObj?.user_id) {
      const _t = 'Diète activée', _b = 'Votre coach a activé votre plan nutritionnel';
      notifyAthlete(currentAthleteObj.user_id, 'nutrition', _t, _b);
    }
  } else {
    const deactivations = [];
    if (tId) deactivations.push(supabaseClient.from('nutrition_plans').update({ actif: false }).eq('id', tId));
    if (rId) deactivations.push(supabaseClient.from('nutrition_plans').update({ actif: false }).eq('id', rId));
    await Promise.all(deactivations);
    notify('Diète désactivée', 'success');
  }
  loadAthleteTabNutrition();
}

function viewNutritionDiet() {
  const el = document.getElementById('athlete-tab-content');
  window.currentNutriTab = 'training';
  const tPlan = window.currentNutriPlans?.training;
  const rPlan = window.currentNutriPlans?.rest;

  el.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="np-editor-head">
        <div style="display:flex;align-items:center;gap:12px;">
          <button class="btn btn-outline btn-sm" onclick="loadAthleteTabNutrition()"><i class="fas fa-arrow-left"></i></button>
          <div class="card-title">${npEsc(tPlan?.nom || rPlan?.nom || 'Diète')}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="viewNutritionVersions()"><i class="fas fa-layer-group"></i> Versions</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;padding:14px 20px;border-bottom:1px solid var(--border-subtle);">
        <button class="athlete-tab-btn active" id="nutri-tab-training" onclick="switchNutriTab('training')"><i class="fas fa-dumbbell"></i> Jour Entraînement</button>
        <button class="athlete-tab-btn" id="nutri-tab-rest" onclick="switchNutriTab('rest')"><i class="fas fa-bed"></i> Jour Repos</button>
      </div>
      <div id="nutri-tab-content" style="padding:20px;"></div>
    </div>`;
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
  const mealType = type === 'training' ? 'training' : 'rest';

  if (!plan) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-utensils"></i>
        <p>Aucun plan pour les jours ${type === 'training' ? "d'entraînement" : "de repos"}</p>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
          <button class="btn btn-outline" onclick="openNutriTemplateSelector('jour')"><i class="fas fa-copy"></i> Copier template</button>
          <button class="btn btn-red" onclick="createNutritionPlanForType('${mealType}')"><i class="fas fa-plus"></i> Créer</button>
        </div>
      </div>`;
    return;
  }

  let meals = [];
  if (plan.meals_data) { try { meals = JSON.parse(plan.meals_data); } catch(e) {} }

  function calcItemMacros(item) {
    const qte = parseFloat(item.qte) || 0;
    const a = (window.alimentsDB || []).find(x => x.nom === (item.aliment || item.nom));
    if (a) return { kcal: parseFloat((a.calories*qte).toFixed(0)), p: parseFloat((a.proteines*qte).toFixed(1)), g: parseFloat((a.glucides*qte).toFixed(1)), l: parseFloat((a.lipides*qte).toFixed(1)) };
    return { kcal: parseFloat(item.kcal)||0, p: parseFloat(item.p)||0, g: parseFloat(item.g)||0, l: parseFloat(item.l)||0 };
  }

  const normMeals = meals.map(m => {
    if (m && !Array.isArray(m) && m.foods) return { items: m.foods, pw: m.pre_workout };
    return { items: Array.isArray(m) ? m : [], pw: false };
  });

  let totalK=0,totalP=0,totalG=0,totalL=0;
  normMeals.forEach(({items})=>items.forEach(item=>{const m=calcItemMacros(item);totalK+=m.kcal;totalP+=m.p;totalG+=m.g;totalL+=m.l;}));

  // Editable macro header
  const macroHeader = `
    <div class="nd-edit-macros">
      <div class="nd-em-group">
        <label>kcal</label>
        <input type="number" id="nd-kcal-${type}" value="${plan.calories_objectif||Math.round(totalK)}" class="nd-em-input nd-em-kcal">
      </div>
      <div class="nd-em-group"><label>P (g)</label><input type="number" id="nd-p-${type}" value="${plan.proteines||Math.round(totalP)}" class="nd-em-input"></div>
      <div class="nd-em-group"><label>G (g)</label><input type="number" id="nd-g-${type}" value="${plan.glucides||Math.round(totalG)}" class="nd-em-input"></div>
      <div class="nd-em-group"><label>L (g)</label><input type="number" id="nd-l-${type}" value="${plan.lipides||Math.round(totalL)}" class="nd-em-input"></div>
      <button class="btn btn-outline btn-sm" onclick="saveNutriMacrosInline('${plan.id}','${type}')" title="Sauvegarder les macros"><i class="fas fa-check"></i></button>
    </div>`;

  const mealsHtml = normMeals.map(({items, pw}, idx) => {
    let mk=0,mp=0,mg=0,ml=0;
    items.forEach(item=>{const m=calcItemMacros(item);mk+=m.kcal;mp+=m.p;mg+=m.g;ml+=m.l;});
    const pwBadge = pw ? ' <span class="np-pw-badge">Pré training</span>' : '';
    return `
      <div class="meal-row">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:8px;"><div class="meal-header" style="margin-bottom:0;">R${idx+1}</div>${pwBadge}</div>
          <div style="font-size:12px;font-weight:600;">${mk.toFixed(0)} kcal | P:${mp.toFixed(1)}g G:${mg.toFixed(1)}g L:${ml.toFixed(1)}g</div>
        </div>
        ${items.map(item=>{const m=calcItemMacros(item);return `
          <div class="food-item">
            <div style="flex:1;"><span style="font-weight:500;">${item.aliment||item.nom||'-'}</span><span style="font-size:11px;color:var(--text3);margin-left:8px;">${item.qte}g</span></div>
            <div style="font-size:12px;text-align:right;"><span style="font-weight:600;">${m.kcal} kcal</span><span style="color:var(--text3);margin-left:8px;">P:${m.p}g G:${m.g}g L:${m.l}g</span></div>
          </div>`;}).join('')}
      </div>`;
  }).join('');

  if (plan.macro_only) {
    container.innerHTML = `
      ${macroHeader}
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
        <button class="btn btn-red btn-sm" onclick="editNutritionPlan('${plan.id}')"><i class="fas fa-pen"></i> Modifier</button>
      </div>
      <div style="text-align:center;padding:30px;background:var(--bg3);border-radius:10px;">
        <i class="fas fa-utensils" style="font-size:24px;color:var(--text3);margin-bottom:10px;display:block;"></i>
        <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px;">Diète macros uniquement</div>
        <div style="font-size:12px;color:var(--text3);">L'athlète compose ses repas librement dans les macros définies</div>
      </div>`;
  } else {
    container.innerHTML = `
      ${macroHeader}
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
        <button class="btn btn-red btn-sm" onclick="editNutritionPlan('${plan.id}')"><i class="fas fa-pen"></i> Modifier les repas</button>
      </div>
      ${mealsHtml || '<div class="empty-state"><i class="fas fa-utensils"></i><p>Aucun repas</p></div>'}
    `;
  }
}

async function saveNutriMacrosInline(planId, type) {
  const kcal = parseInt(document.getElementById('nd-kcal-'+type)?.value) || 0;
  const p = parseInt(document.getElementById('nd-p-'+type)?.value) || 0;
  const g = parseInt(document.getElementById('nd-g-'+type)?.value) || 0;
  const l = parseInt(document.getElementById('nd-l-'+type)?.value) || 0;

  const { error } = await supabaseClient.from('nutrition_plans').update({
    calories_objectif: kcal, proteines: p, glucides: g, lipides: l
  }).eq('id', planId);
  if (error) { handleError(error, 'nutrition'); return; }

  // Update local cache
  const plan = window.currentNutriPlans?.[type];
  if (plan) { plan.calories_objectif = kcal; plan.proteines = p; plan.glucides = g; plan.lipides = l; }

  // Notify athlete
  if (currentAthleteObj?.user_id) {
    const _t = 'Macros mises à jour';
    const _b = `Votre coach a ajusté vos macros (${type === 'training' ? 'jour ON' : 'jour OFF'}) : ${kcal} kcal`;
    const { error: notifErr } = await supabaseClient.from('notifications').insert({ user_id: currentAthleteObj.user_id, type: 'nutrition', title: _t, body: _b });
    if (notifErr) { handleError(notifErr, 'nutrition'); }
    await sendExpoPush([currentAthleteObj.user_id], _t, _b);
  }
  notify('Macros sauvegardées !', 'success');
}

// ── Integrate individual changes (accumulate, then save as new version) ──
let _integrateQueue = []; // { planId, mealIdx, foodIdx, changeType }
let _integratePlanId = null;
let _integrateTimeout = null;

async function integrateOneChange(planId, mealIdx, foodIdx, changeType) {
  // Queue the change
  _integratePlanId = planId;
  _integrateQueue.push({ mealIdx, foodIdx, changeType });

  // Visual feedback — animate the whole food row
  const btn = event.target.closest('.nh-integrate-btn');
  const row = btn?.closest('.nh-food-row');
  if (row) {
    row.style.transition = 'all 0.4s ease';
    row.style.background = 'rgba(34,197,94,0.15)';
    row.style.borderLeft = '3px solid var(--success)';
    row.style.borderRadius = '6px';
    row.style.paddingLeft = '10px';
  }
  if (btn) {
    btn.innerHTML = '<i class="fas fa-check"></i>';
    btn.style.background = 'var(--success)';
    btn.style.color = '#fff';
    btn.style.borderColor = 'var(--success)';
    btn.disabled = true;
  }

  notify(`Changement accepté (${_integrateQueue.length} en attente — sauvegarde dans 3s)`, 'success');

  // Debounce: save after 3s of inactivity (batch multiple clicks)
  clearTimeout(_integrateTimeout);
  _integrateTimeout = setTimeout(() => flushIntegrateQueue(), 3000);
}

async function flushIntegrateQueue() {
  const planId = _integratePlanId;
  const queue = [..._integrateQueue];
  _integrateQueue = [];
  _integratePlanId = null;
  if (!queue.length || !planId) return;

  // Load plan
  const { data: oldPlan } = await supabaseClient.from('nutrition_plans').select('*').eq('id', planId).single();
  if (!oldPlan) { notify('Plan introuvable', 'error'); return; }

  let meals = [];
  try { meals = typeof oldPlan.meals_data === 'string' ? JSON.parse(oldPlan.meals_data) : (oldPlan.meals_data || []); } catch {}

  // Load log data
  const selectedDate = window._nutriHistSelectedDate;
  const allLogs = window._nutriHistLogs || [];
  const dayLog = allLogs.find(l => l.date === selectedDate && l.plan_id === planId);
  if (!dayLog) return;

  let logMeals = [];
  try { logMeals = typeof dayLog.meals_log === 'string' ? JSON.parse(dayLog.meals_log) : (dayLog.meals_log || []); } catch {}

  // Apply all queued changes
  for (const change of queue) {
    const meal = meals[change.mealIdx];
    if (!meal) continue;
    const isObj = meal && !Array.isArray(meal) && meal.foods;
    const foods = isObj ? meal.foods : (Array.isArray(meal) ? meal : []);
    const logMeal = logMeals[change.mealIdx];
    if (!logMeal) continue;

    if (change.changeType === 'replace') {
      const logFood = (logMeal.foods || [])[change.foodIdx];
      if (!logFood?.replacement) continue;
      const repName = logFood.replacement.aliment;
      const repQte = logFood.replacement.qte || foods[change.foodIdx]?.qte || 100;
      foods[change.foodIdx] = { aliment: repName, qte: repQte };

      // Auto-import the aliment to coach DB if not found
      await _ensureAlimentExists(repName, logFood.replacement);
    } else if (change.changeType === 'extra') {
      const extra = (logMeal.extras || [])[change.foodIdx];
      if (!extra) continue;
      foods.push({ aliment: extra.aliment, qte: extra.qte || 100 });
      await _ensureAlimentExists(extra.aliment, extra);
    }

    if (isObj) meal.foods = foods;
    else meals[change.mealIdx] = foods;
  }

  // Deactivate old plan
  await supabaseClient.from('nutrition_plans').update({ actif: false }).eq('id', planId);

  // Create new version
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabaseClient.from('nutrition_plans').insert({
    athlete_id: currentAthleteId,
    coach_id: currentUser.id,
    nom: oldPlan.nom,
    meal_type: oldPlan.meal_type,
    actif: true,
    calories_objectif: oldPlan.calories_objectif || 0,
    proteines: oldPlan.proteines || 0,
    glucides: oldPlan.glucides || 0,
    lipides: oldPlan.lipides || 0,
    meals_data: JSON.stringify(meals),
    valid_from: today,
    macro_only: oldPlan.macro_only || false,
    meal_times: oldPlan.meal_times,
  });
  if (error) { handleError(error, 'nutrition'); return; }

  notify(`${queue.length} changement(s) intégré(s) — nouvelle version créée !`, 'success');
  // Refresh
  window.alimentsDB = null;
  await loadAliments();
  loadNutritionHistory();
}

// Auto-import aliment to coach DB if it doesn't exist
async function _ensureAlimentExists(nom, macros) {
  if (!nom) return;
  const db = window.alimentsDB || [];
  const found = db.find(a => a.nom && a.nom.toLowerCase() === nom.toLowerCase());
  if (found) return; // already exists

  const cal = parseFloat(macros?.kcal) || 0;
  const p = parseFloat(macros?.p) || 0;
  const g = parseFloat(macros?.g) || 0;
  const l = parseFloat(macros?.l) || 0;
  // Only import if we have some nutritional data
  if (cal === 0 && p === 0 && g === 0 && l === 0) return;

  // Calculate per-gram values (macros from log are for the quantity eaten)
  const qte = parseFloat(macros?.qte) || 100;
  await supabaseClient.from('aliments_db').insert({
    nom,
    calories: cal / qte,
    proteines: p / qte,
    glucides: g / qte,
    lipides: l / qte,
    coach_id: currentUser.id
  });
}

function createNewDiet() {
  window._npEditId = null;
  window._npMealType = 'training';
  window._npActiveMeal = 0;
  window._npDietPair = null;
  window._npDietName = '';
  window._npMacroOnly = false;
  window._npMealTimesEnabled = false;
  const el = document.getElementById('athlete-tab-content');
  loadAliments().then(() => {
    renderNpEditor(el, '', 'Entraînement', [[]]);
  });
}

// Build versions: pair training+rest plans by diet name, each plan used once, sorted by created_at desc
function buildNutriVersions(allPlans) {
  const sorted = [...allPlans].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const used = new Set();
  const versions = [];
  sorted.forEach(p => {
    if (used.has(p.id)) return;
    used.add(p.id);
    const isT = p.meal_type === 'training' || p.meal_type === 'entrainement';
    const nom = p.nom || '';
    const v = { training: isT ? p : null, rest: isT ? null : p, actif: !!p.actif, date: p.valid_from || p.created_at?.split('T')[0] || '', nom };
    // Find partner: same diet name, different type, not yet used, closest in time
    const partnerType = isT ? ['rest','repos'] : ['training','entrainement'];
    const partner = sorted.find(q => !used.has(q.id) && partnerType.includes(q.meal_type) && (q.nom || '') === nom);
    if (partner) {
      used.add(partner.id);
      if (isT) v.rest = partner; else v.training = partner;
      if (partner.actif) v.actif = true;
    }
    versions.push(v);
  });
  return versions;
}

async function viewNutritionVersions(filterDietName) {
  const el = document.getElementById('athlete-tab-content');
  const allPlans = window._allNutriPlans || [];
  const filtered = filterDietName ? allPlans.filter(p => (p.nom || '') === filterDietName) : allPlans;
  const versions = buildNutriVersions(filtered);
  const title = filterDietName ? `Versions — ${npEsc(filterDietName)}` : 'Versions des diètes';

  const rowsHtml = versions.map((v, idx) => {
    const t = v.training, r = v.rest;
    const dateLabel = v.date ? new Date(v.date + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const tK = t?.calories_objectif || null;
    const rK = r?.calories_objectif || null;
    const tMacro = t ? `P:${t.proteines||0} G:${t.glucides||0} L:${t.lipides||0}` : '';
    const rMacro = r ? `P:${r.proteines||0} G:${r.glucides||0} L:${r.lipides||0}` : '';
    const vNum = versions.length - idx;

    return `
      <tr class="nd-tr ${v.actif ? 'nd-tr-active' : ''}" onclick="viewNutriVersionDetail('${t?.id||''}','${r?.id||''}')">
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-weight:700;color:var(--text);">V${vNum}</span>
            ${v.actif ? '<span style="font-size:9px;padding:2px 6px;border-radius:8px;background:var(--primary);color:#fff;font-weight:700;">ACTIF</span>' : ''}
          </div>
          <span style="font-size:10px;color:var(--text3);">${dateLabel}</span>
        </td>
        <td style="text-align:right;">
          ${tK !== null ? `<div style="font-weight:700;color:var(--text);">${tK.toLocaleString('fr-FR')}</div><div style="font-size:10px;color:var(--text3);">${tMacro}</div>` : '<span style="color:var(--text3);">—</span>'}
        </td>
        <td style="text-align:right;">
          ${rK !== null ? `<div style="font-weight:700;color:var(--text);">${rK.toLocaleString('fr-FR')}</div><div style="font-size:10px;color:var(--text3);">${rMacro}</div>` : '<span style="color:var(--text3);">—</span>'}
        </td>
        <td onclick="event.stopPropagation();" style="text-align:center;">
          ${!v.actif ? `<div style="display:flex;gap:6px;justify-content:center;"><button class="btn btn-outline btn-sm" onclick="activateNutriVersion('${t?.id||''}','${r?.id||''}')"><i class="fas fa-check"></i> Activer</button><button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="event.stopPropagation();deleteNutriVersion('${t?.id||''}','${r?.id||''}','${npEsc(filterDietName||'').replace(/'/g, "\\\\'")}')"><i class="fas fa-trash"></i></button></div>` : '<span style="font-size:11px;color:var(--success);font-weight:600;"><i class="fas fa-check-circle"></i> Active</span>'}
        </td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="margin:0;">${title}</h3>
      <button class="btn btn-outline" onclick="loadAthleteTabNutrition()"><i class="fas fa-arrow-left"></i> Retour</button>
    </div>
    ${versions.length ? `
      <div class="nd-table-wrap">
        <table class="nd-table">
          <thead>
            <tr>
              <th>Version</th>
              <th style="text-align:right;"><span style="color:#e74c3c;">ON</span> kcal</th>
              <th style="text-align:right;"><span style="color:#3498db;">OFF</span> kcal</th>
              <th style="text-align:center;">Statut</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    ` : '<div class="card"><div class="empty-state"><i class="fas fa-utensils"></i><p>Aucune version</p></div></div>'}
  `;
}

async function activateNutriVersion(tId, rId) {
  // Deactivate all current plans
  const { error: e1 } = await supabaseClient.from('nutrition_plans').update({ actif: false }).eq('athlete_id', currentAthleteId);
  if (e1) { handleError(e1, 'nutrition'); return; }
  // Activate selected
  if (tId) { const { error } = await supabaseClient.from('nutrition_plans').update({ actif: true }).eq('id', tId); if (error) { handleError(error, 'nutrition'); return; } }
  if (rId) { const { error } = await supabaseClient.from('nutrition_plans').update({ actif: true }).eq('id', rId); if (error) { handleError(error, 'nutrition'); return; } }

  if (currentAthleteObj?.user_id) {
    const _t = 'Diète mise à jour', _b = 'Votre coach a activé une nouvelle version de votre diète';
    const { error } = await supabaseClient.from('notifications').insert({ user_id: currentAthleteObj.user_id, type: 'nutrition', title: _t, body: _b });
    if (error) { handleError(error, 'nutrition'); }
    await sendExpoPush([currentAthleteObj.user_id], _t, _b);
  }
  notify('Version activée !', 'success');
  loadAthleteTabNutrition();
}

async function deleteNutriVersion(tId, rId, dietName) {
  if (!confirm('Supprimer cette version ?')) return;
  const ids = [tId, rId].filter(Boolean);
  if (!ids.length) return;
  const { error } = await supabaseClient.from('nutrition_plans').delete().in('id', ids);
  if (error) { handleError(error, 'nutrition'); return; }
  notify('Version supprimée', 'success');
  // Reload: refresh plans then re-open versions view
  const { data } = await supabaseClient.from('nutrition_plans').select('*').eq('athlete_id', currentAthleteId).order('created_at', { ascending: false });
  window._allNutriPlans = data || [];
  if (dietName) viewNutritionVersions(dietName);
  else loadAthleteTabNutrition();
}

function editNutritionDiet(tId, rId) {
  // Store the diet name for creating missing plan type (ON or OFF)
  const plan = (window._allNutriPlans || []).find(p => p.id === tId || p.id === rId);
  window._npDietName = plan?.nom || '';
  window._npDietPair = { training: tId || '', rest: rId || '' };
  editNutritionPlan(tId || rId);
}

async function viewNutriVersionDetail(tId, rId) {
  window._npDietPair = { training: tId || '', rest: rId || '' };
  editNutritionPlan(tId || rId);
}

function createNutritionPlanForType(mealType) {
  const el = document.getElementById('athlete-tab-content');
  window._npEditId = null;
  window._npMealType = mealType;
  window._npActiveMeal = 0;
  // Check temp cache first (unsaved tab data)
  const temp = window._npTempMeals?.[mealType];
  let meals = [[]];
  let name = window._npDietName || '';
  if (temp) {
    meals = temp.meals.length ? temp.meals : [[]];
    name = temp.nom || name;
    delete window._npTempMeals[mealType];
  }
  loadAliments().then(() => {
    const label = mealType === 'training' ? 'Entraînement' : 'Repos';
    renderNpEditor(el, name, label, meals);
  });
}

// Page principale nutrition → seulement templates diète
function copyNutritionFromTemplate() {
  openNutriTemplateSelector('diete', true);
}

// mode = 'diete' | 'jour' | 'repas', singleMode = hide tabs
async function openNutriTemplateSelector(tab, singleMode) {
  const { data: templates } = await supabaseClient.from('nutrition_templates').select('*').eq('coach_id', currentUser.id);
  if (!templates?.length) { notify('Aucun template disponible', 'error'); return; }
  window._ntplSelectorTemplates = templates;
  window._ntplSelectorTab = tab || 'diete';

  // Hide tabs in single mode, show them otherwise
  const tabsEl = document.getElementById('template-selector-tabs');
  tabsEl.style.display = singleMode ? 'none' : '';
  if (!singleMode) {
    document.querySelectorAll('#template-selector-tabs .athlete-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tpl-tab-' + (tab || 'diete'))?.classList.add('active');
  }

  renderNutriTemplateList(tab || 'diete', templates);
  openModal('modal-template-selector');
}

function switchTplSelectorTab(tab) {
  window._ntplSelectorTab = tab;
  document.querySelectorAll('#template-selector-tabs .athlete-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tpl-tab-' + tab)?.classList.add('active');
  renderNutriTemplateList(tab, window._ntplSelectorTemplates || []);
}

function renderNutriTemplateList(tab, templates) {
  const list = document.getElementById('template-selector-list');
  // Filter templates by type — show matching type + legacy (no type) in jour/repas
  const filtered = templates.filter(t => {
    const tt = t.template_type || 'jour';
    return tt === tab;
  });
  // For repas tab, also include individual meals from jour/diete templates
  if (tab === 'repas') {
    const repasTemplates = filtered;
    let html = '';
    // First: dedicated repas templates
    repasTemplates.forEach(t => {
      let meals = [];
      try { meals = typeof t.meals_data === 'string' ? JSON.parse(t.meals_data) : (t.meals_data || []); } catch(e) {}
      if (!Array.isArray(meals)) return;
      meals.forEach((meal, mi) => {
        const items = (meal && !Array.isArray(meal) && meal.foods) ? meal.foods : (Array.isArray(meal) ? meal : []);
        if (!items.length) return;
        let k=0, p=0, g=0, l=0;
        items.forEach(a => { k+=a.kcal||0; p+=a.p||0; g+=a.g||0; l+=a.l||0; });
        const foodNames = items.slice(0, 3).map(a => a.aliment || a.nom || '?').join(', ') + (items.length > 3 ? '...' : '');
        html += `
          <div class="card athlete-card" style="margin:4px 20px;padding:12px 16px;cursor:pointer;" onclick="pickNutriTemplateRepas('${t.id}', ${mi})">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-weight:600;font-size:13px;">${escHtml(t.nom)}</span>
              <span style="font-size:12px;color:var(--text2);">${escHtml(foodNames)}</span>
            </div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px;">${Math.round(k)} kcal · P${Math.round(p)}g G${Math.round(g)}g L${Math.round(l)}g</div>
          </div>`;
      });
    });
    // Also show meals from jour templates
    const jourTemplates = templates.filter(t => (t.template_type || 'jour') === 'jour');
    if (jourTemplates.length) {
      html += `<div style="padding:12px 20px 4px;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;border-top:1px solid var(--border-subtle);margin-top:8px;">Depuis templates jour</div>`;
      jourTemplates.forEach(t => {
        let meals = [];
        try { meals = typeof t.meals_data === 'string' ? JSON.parse(t.meals_data) : (t.meals_data || []); } catch(e) {}
        if (!Array.isArray(meals) || !meals.length) return;
        meals.forEach((meal, mi) => {
          const items = (meal && !Array.isArray(meal) && meal.foods) ? meal.foods : (Array.isArray(meal) ? meal : []);
          if (!items.length) return;
          let k=0, p=0, g=0, l=0;
          items.forEach(a => { k+=a.kcal||0; p+=a.p||0; g+=a.g||0; l+=a.l||0; });
          const foodNames = items.slice(0, 3).map(a => a.aliment || a.nom || '?').join(', ') + (items.length > 3 ? '...' : '');
          html += `
            <div class="card athlete-card" style="margin:4px 20px;padding:12px 16px;cursor:pointer;" onclick="pickNutriTemplateRepas('${t.id}', ${mi})">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-weight:600;font-size:13px;">${escHtml(t.nom)} · R${mi+1}</span>
                <span style="font-size:12px;color:var(--text2);">${escHtml(foodNames)}</span>
              </div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px;">${Math.round(k)} kcal · P${Math.round(p)}g G${Math.round(g)}g L${Math.round(l)}g</div>
            </div>`;
        });
      });
    }
    list.innerHTML = html || '<div style="padding:30px;text-align:center;color:var(--text3);">Aucun template repas</div>';
    return;
  }

  // Diète and Jour tabs
  const applyFn = tab === 'diete' ? 'applyNutriTemplateDiete' : 'applyNutriTemplateJour';
  if (!filtered.length) {
    list.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text3);">Aucun template ${tab}</div>`;
    return;
  }
  list.innerHTML = filtered.map(t => `
    <div class="card athlete-card" style="margin:8px 20px;padding:16px;cursor:pointer;" onclick="${applyFn}('${t.id}')">
      <div style="font-weight:600;">${escHtml(t.nom)}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:4px;">${t.calories_objectif||0} kcal · P:${t.proteines||0}g G:${t.glucides||0}g L:${t.lipides||0}g</div>
    </div>`).join('');
}

async function applyNutriTemplateDiete(templateId) {
  closeModal('modal-template-selector');
  const { data: tpl } = await supabaseClient.from('nutrition_templates').select('*').eq('id', templateId).single();
  if (!tpl) { notify('Template introuvable', 'error'); return; }
  const today = new Date().toISOString().split('T')[0];

  // Parse meals_data — diète format has { training: [...], rest: [...] }
  let parsed = {};
  try { parsed = typeof tpl.meals_data === 'string' ? JSON.parse(tpl.meals_data) : (tpl.meals_data || {}); } catch(e) {}

  let onMeals, offMeals;
  if (parsed.training || parsed.rest) {
    onMeals = parsed.training || [];
    offMeals = parsed.rest || [];
  } else {
    // Legacy or plain array → use same for both
    const arr = Array.isArray(parsed) ? parsed : [];
    onMeals = arr;
    offMeals = arr;
  }

  function calcTotals(meals) {
    let k=0,p=0,g=0,l=0;
    (meals||[]).forEach(m => {
      const items = (m && !Array.isArray(m) && m.foods) ? m.foods : (Array.isArray(m) ? m : []);
      items.forEach(a => { k+=a.kcal||0; p+=a.p||0; g+=a.g||0; l+=a.l||0; });
    });
    return { k: Math.round(k), p: Math.round(p), g: Math.round(g), l: Math.round(l) };
  }
  const onT = calcTotals(onMeals);
  const offT = calcTotals(offMeals);

  // Deactivate all plans
  const { error: deactErr } = await supabaseClient.from('nutrition_plans').update({ actif: false }).eq('athlete_id', currentAthleteId);
  if (deactErr) { handleError(deactErr, 'nutrition'); return; }

  // Create ON plan
  const { error: onErr } = await supabaseClient.from('nutrition_plans').insert({
    nom: tpl.nom, athlete_id: currentAthleteId, coach_id: currentUser.id,
    calories_objectif: onT.k, proteines: onT.p, glucides: onT.g, lipides: onT.l,
    meals_data: JSON.stringify(onMeals), meal_type: 'training', actif: true, valid_from: today
  });
  if (onErr) { handleError(onErr, 'nutrition'); return; }
  // Create OFF plan
  const { error: offErr } = await supabaseClient.from('nutrition_plans').insert({
    nom: tpl.nom, athlete_id: currentAthleteId, coach_id: currentUser.id,
    calories_objectif: offT.k, proteines: offT.p, glucides: offT.g, lipides: offT.l,
    meals_data: JSON.stringify(offMeals), meal_type: 'rest', actif: true, valid_from: today
  });
  if (offErr) { handleError(offErr, 'nutrition'); return; }

  notify('Diète copiée depuis le template !', 'success');
  if (currentAthleteObj?.user_id) {
    const _t = 'Nouvelle diète', _b = `Votre coach a créé la diète "${tpl.nom}"`;
    const { error } = await supabaseClient.from('notifications').insert({ user_id: currentAthleteObj.user_id, type: 'nutrition', title: _t, body: _b });
    if (error) { handleError(error, 'nutrition'); }
    await sendExpoPush([currentAthleteObj.user_id], _t, _b);
  }
  loadAthleteTabNutrition();
}

async function applyNutriTemplateJour(templateId) {
  closeModal('modal-template-selector');
  const { data: tpl } = await supabaseClient.from('nutrition_templates').select('*').eq('id', templateId).single();
  if (!tpl) { notify('Template introuvable', 'error'); return; }
  let meals = [];
  try { meals = typeof tpl.meals_data === 'string' ? JSON.parse(tpl.meals_data) : (tpl.meals_data || []); } catch(e) {}
  if (!meals.length) meals = [[]];

  // If we are in the editor → inject meals into current tab
  const editorEl = document.getElementById('np-meals');
  if (editorEl) {
    editorEl.innerHTML = meals.map((meal, i) => {
      const isObj = meal && !Array.isArray(meal) && meal.foods;
      const items = isObj ? meal.foods : (Array.isArray(meal) ? meal : []);
      const pw = isObj ? meal.pre_workout : false;
      return buildNpMealHtml(i + 1, items, i === 0, pw);
    }).join('');
    updateNpTotals();
    notify('Jour copié depuis le template !', 'success');
  } else {
    // Not in editor — open editor with template content
    const el = document.getElementById('athlete-tab-content');
    const mealType = window._npMealType || 'training';
    window._npEditId = null;
    window._npActiveMeal = 0;
    window._npDietPair = null;
    window._npDietName = tpl.nom;
    window._npMealType = mealType;
    await loadAliments();
    const label = mealType === 'training' ? 'Entraînement' : 'Repos';
    renderNpEditor(el, tpl.nom, label, meals);
    notify('Jour copié depuis le template !', 'success');
  }
}

async function applyNutriTemplateRepas(templateId, mealIndex) {
  closeModal('modal-template-selector');
  const { data: tpl } = await supabaseClient.from('nutrition_templates').select('*').eq('id', templateId).single();
  if (!tpl) { notify('Template introuvable', 'error'); return; }
  let meals = [];
  try { meals = typeof tpl.meals_data === 'string' ? JSON.parse(tpl.meals_data) : (tpl.meals_data || []); } catch(e) {}
  const meal = meals[mealIndex];
  if (!meal) { notify('Repas introuvable', 'error'); return; }
  const isObj = meal && !Array.isArray(meal) && meal.foods;
  const items = isObj ? meal.foods : (Array.isArray(meal) ? meal : []);

  // If we are in the editor → add as new meal
  const container = document.getElementById('np-meals');
  if (container) {
    const n = container.querySelectorAll('.np-meal-block').length + 1;
    container.insertAdjacentHTML('beforeend', buildNpMealHtml(n, items, false, isObj ? meal.pre_workout : false));
    setActiveNpMeal(n - 1);
    updateNpTotals();
    notify('Repas copié depuis le template !', 'success');
  } else {
    // Not in editor — open editor with just this meal
    const el = document.getElementById('athlete-tab-content');
    const mealType = window._npMealType || 'training';
    window._npEditId = null;
    window._npActiveMeal = 0;
    window._npDietPair = null;
    window._npDietName = '';
    window._npMealType = mealType;
    await loadAliments();
    const label = mealType === 'training' ? 'Entraînement' : 'Repos';
    renderNpEditor(el, '', label, [meal]);
    notify('Repas copié depuis le template !', 'success');
  }
}

// Dispatcher: inject into target meal if set, otherwise add as new meal
function pickNutriTemplateRepas(templateId, mealIndex) {
  if (window._ntplTargetMealIdx !== undefined) {
    applyNutriTemplateRepasInto(templateId, mealIndex);
  } else {
    applyNutriTemplateRepas(templateId, mealIndex);
  }
}

// Called from meal header button — stores target meal index, opens repas template selector
function loadRepasFromTemplate(btn) {
  const block = btn.closest('.np-meal-block');
  window._ntplTargetMealIdx = block ? parseInt(block.dataset.mealIdx) : 0;
  openNutriTemplateSelector('repas', true);
}

// Override: when _ntplTargetMealIdx is set, inject into that meal instead of adding new
async function applyNutriTemplateRepasInto(templateId, mealIndex) {
  closeModal('modal-template-selector');
  const { data: tpl } = await supabaseClient.from('nutrition_templates').select('*').eq('id', templateId).single();
  if (!tpl) { notify('Template introuvable', 'error'); return; }
  let meals = [];
  try { meals = typeof tpl.meals_data === 'string' ? JSON.parse(tpl.meals_data) : (tpl.meals_data || []); } catch(e) {}
  if (!Array.isArray(meals)) meals = [];
  const meal = meals[mealIndex];
  if (!meal) { notify('Repas introuvable', 'error'); return; }
  const isObj = meal && !Array.isArray(meal) && meal.foods;
  const items = isObj ? meal.foods : (Array.isArray(meal) ? meal : []);

  const targetIdx = window._ntplTargetMealIdx ?? -1;
  const blocks = document.querySelectorAll('#np-meals .np-meal-block');
  if (targetIdx >= 0 && blocks[targetIdx]) {
    // Replace foods in target meal
    const list = blocks[targetIdx].querySelector('.np-foods-list');
    if (list) {
      list.innerHTML = items.map(f => buildNpFoodHtml(f)).join('');
      updateNpTotals();
      notify('Repas importé depuis le template !', 'success');
    }
  }
  window._ntplTargetMealIdx = undefined;
}

async function viewNutritionPlanDetail(id) {
  const { data: plan, error } = await supabaseClient
    .from('nutrition_plans')
    .select('*')
    .eq('id', id)
    .single();

  if (error) { handleError(error, 'nutrition'); return; }

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

// buildNpFoodOptions removed — replaced by sidebar library

const _CONVERTIBLE_FOODS = ['riz', 'pomme de terre', 'pommes de terre', 'pâtes', 'pates'];

function _isConvertibleFood(nom) {
  if (!nom) return false;
  const lower = nom.toLowerCase();
  return _CONVERTIBLE_FOODS.some(f => lower.includes(f));
}

function buildNpFoodHtml(item) {
  const nom = item?.aliment || item?.nom || '';
  const a = nom ? (window.alimentsDB || []).find(x => x.nom === nom) : null;
  const cal = a ? a.calories : 0;
  const prot = a ? a.proteines : 0;
  const gluc = a ? a.glucides : 0;
  const lip = a ? a.lipides : 0;
  const qte = item?.qte || 100;
  const kcalV = (cal * qte).toFixed(0);
  const pV = (prot * qte).toFixed(1);
  const gV = (gluc * qte).toFixed(1);
  const lV = (lip * qte).toFixed(1);
  const convToggle = _isConvertibleFood(nom)
    ? `<label class="np-conv-toggle ${item.allow_conversion ? 'active' : ''}" onclick="this.classList.toggle('active');" title="Autoriser la conversion de glucides">
        <input type="checkbox" class="np-food-conv" ${item.allow_conversion ? 'checked' : ''} style="display:none;" onchange="this.parentElement.classList.toggle('active',this.checked)">
        <i class="fas fa-exchange-alt"></i>
      </label>`
    : '';
  return `
    <div class="np-food-row" data-nom="${npEsc(nom)}" data-cal="${cal}" data-prot="${prot}" data-gluc="${gluc}" data-lip="${lip}">
      <span class="np-food-name">${npEsc(nom) || '—'}${convToggle}</span>
      <input type="number" class="np-food-qty" value="${qte}" placeholder="g" oninput="calcNpFoodRow(this)">
      <span class="np-food-unit">g</span>
      <span class="np-food-macro np-kcal">${kcalV}</span>
      <span class="np-food-macro">${pV}p</span>
      <span class="np-food-macro">${gV}g</span>
      <span class="np-food-macro">${lV}l</span>
      <button type="button" class="np-food-rm" onclick="this.closest('.np-food-row').remove();updateNpTotals()">×</button>
    </div>`;
}

function buildNpMealHtml(n, items, isActive, preWorkout, mealTime) {
  const foodsHtml = (items && items.length > 0) ? items.map(item => buildNpFoodHtml(item)).join('') : '';
  const activeClass = isActive ? ' np-meal-active' : '';
  const pwAttr = preWorkout ? ' data-pre-workout="1"' : '';
  const pwBadge = preWorkout ? '<span class="np-pw-badge">Pré training</span>' : '';
  const pwBtnClass = preWorkout ? ' np-pw-btn-on' : '';
  return `
    <div class="np-meal-block${activeClass}"${pwAttr} data-meal-idx="${n-1}" onclick="setActiveNpMeal(${n-1})">
      <div class="np-meal-head">
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="np-meal-title np-meal-label">R${n}</span>
          <input type="time" class="np-meal-time" value="${mealTime || ''}" style="width:80px;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);color:var(--text);font-size:11px;display:${window._npMealTimesEnabled ? '' : 'none'};" onclick="event.stopPropagation()">
          <span class="np-pw-slot">${pwBadge}</span>
          <span class="np-meal-head-macros np-meal-totals"></span>
        </div>
        <div class="np-meal-actions">
          <button type="button" class="btn btn-outline btn-sm np-pw-btn${pwBtnClass}" onclick="event.stopPropagation();toggleNpPreWorkout(this)" title="Pré training"><i class="fas fa-running"></i></button>
          <button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation();loadRepasFromTemplate(this)" title="Copier repas depuis template"><i class="fas fa-file-import"></i></button>
          <button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation();copyNpMeal(this)" title="Copier"><i class="fas fa-copy"></i></button>
          <button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation();pasteNpMeal(this)" title="Coller"><i class="fas fa-paste"></i></button>
          <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="event.stopPropagation();removeNpMeal(this)"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="np-food-header">
        <span class="np-fh-name">Aliment</span>
        <span class="np-fh-qty">Qté</span>
        <span class="np-fh-kcal">kcal</span>
        <span class="np-fh-macro">P</span>
        <span class="np-fh-macro">G</span>
        <span class="np-fh-macro">L</span>
        <span class="np-fh-rm"></span>
      </div>
      <div class="np-foods-list">${foodsHtml}</div>
    </div>`;
}

function renderNpEditor(el, planName, label, meals) {
  const title = window._npEditId ? `Modifier — ${planName}` : `Nouveau plan — Jour ${label}`;
  const mealsHtml = meals.map((meal, i) => {
    const isObj = meal && !Array.isArray(meal) && meal.foods;
    const items = isObj ? meal.foods : (Array.isArray(meal) ? meal : []);
    const pw = isObj ? meal.pre_workout : false;
    const mealTime = isObj ? (meal.time || '') : '';
    return buildNpMealHtml(i + 1, items, i === 0, pw, mealTime);
  }).join('');

  // ON/OFF tabs — always shown, use switchNpTab to preserve unsaved state
  const isT = (window._npMealType || 'training') === 'training';
  const onBtn = isT
    ? `<button class="athlete-tab-btn active"><i class="fas fa-dumbbell"></i> Jour ON</button>`
    : `<button class="athlete-tab-btn" onclick="switchNpTab('training')"><i class="fas fa-dumbbell"></i> Jour ON</button>`;
  const offBtn = !isT
    ? `<button class="athlete-tab-btn active"><i class="fas fa-bed"></i> Jour OFF</button>`
    : `<button class="athlete-tab-btn" onclick="switchNpTab('rest')"><i class="fas fa-bed"></i> Jour OFF</button>`;
  const pairTabs = `<div style="display:flex;gap:4px;margin-left:12px;">${onBtn}${offBtn}</div>`;

  el.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="np-editor-head">
        <div style="display:flex;align-items:center;">
          <div class="card-title">${title}</div>
          ${pairTabs}
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline" onclick="clearNpTempState();loadAthleteTabNutrition()"><i class="fas fa-arrow-left"></i> Retour</button>
          <button class="btn btn-outline" onclick="openNutriTemplateSelector('jour', true)" title="Copier jour depuis template"><i class="fas fa-copy"></i> Copier jour</button>
          <button class="btn btn-red" onclick="saveNutritionPlanInline()"><i class="fas fa-save"></i> Enregistrer</button>
        </div>
      </div>
      <div class="np-editor-macros">
        <div class="form-group"><label>Nom</label><input type="text" id="np-nom" value="${npEsc(planName)}" placeholder="ex: Plan S1"></div>
        <div class="form-group"><label>kcal total</label><div class="np-macro-val" id="np-cal">0</div></div>
        <div class="form-group"><label>Protéines (g)</label><div class="np-macro-val" id="np-prot">0</div></div>
        <div class="form-group"><label>Glucides (g)</label><div class="np-macro-val" id="np-gluc">0</div></div>
        <div class="form-group"><label>Lipides (g)</label><div class="np-macro-val" id="np-lip">0</div></div>
      </div>
      <div class="np-options-bar">
        <label class="np-option-pill ${window._npMacroOnly ? 'active' : ''}" onclick="this.classList.toggle('active');document.getElementById('np-macro-only').checked=this.classList.contains('active');toggleMacroOnly(this.classList.contains('active'))">
          <input type="checkbox" id="np-macro-only" style="display:none;" ${window._npMacroOnly ? 'checked' : ''}>
          <i class="fas fa-sliders-h"></i> Macros uniquement
        </label>
        <label class="np-option-pill ${window._npMealTimesEnabled ? 'active' : ''}" onclick="this.classList.toggle('active');toggleMealTimes(this.classList.contains('active'))">
          <input type="checkbox" id="np-meal-times-toggle" style="display:none;" ${window._npMealTimesEnabled ? 'checked' : ''}>
          <i class="fas fa-clock"></i> Horaires + notifs
        </label>
      </div>
      <div class="tr-body">
        <div class="tr-library">
          <div class="tr-library-header">
            <i class="fas fa-apple-alt" style="color:var(--text3);"></i>
            <span class="tr-library-title">Bibliothèque d'aliments</span>
            <button class="np-lib-add-btn" onclick="toggleNpQuickAdd()" title="Ajouter un aliment"><i class="fas fa-plus"></i></button>
          </div>
          <div class="np-source-toggle">
            <button class="np-src-btn ${_npFoodSource === 'local' ? 'active' : ''}" onclick="setNpFoodSource('local')"><i class="fas fa-database"></i> Ma base</button>
            <button class="np-src-btn ${_npFoodSource === 'off' ? 'active' : ''}" onclick="setNpFoodSource('off')"><i class="fas fa-globe"></i> OFF</button>
            <button class="np-src-btn ${_npFoodSource === 'both' ? 'active' : ''}" onclick="setNpFoodSource('both')"><i class="fas fa-layer-group"></i> Les deux</button>
          </div>
          <div id="np-quick-add-form" style="display:none;"></div>
          <div class="tr-library-search">
            <i class="fas fa-search"></i>
            <input type="text" id="np-lib-search" placeholder="Rechercher un aliment..." oninput="filterNpLibrary()">
          </div>
          <div class="tr-library-results" id="np-lib-results-wrap">
            <div id="np-lib-results"></div>
            <div id="np-lib-off-results"></div>
          </div>
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
  // Apply macro-only state on render
  if (window._npMacroOnly) toggleMacroOnly(true);
  if (window._npMealTimesEnabled) toggleMealTimes(true);
}

function toggleMacroOnly(on) {
  window._npMacroOnly = on;
  const mealsArea = document.querySelector('.np-meals-area');
  const library = document.querySelector('.tr-library');
  if (mealsArea) mealsArea.style.display = on ? 'none' : '';
  if (library) library.style.display = on ? 'none' : '';
  if (on) {
    ['np-cal','np-prot','np-gluc','np-lip'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.tagName !== 'INPUT') {
        const val = el.textContent || '0';
        el.outerHTML = `<input type="number" id="${id}" class="np-macro-val" value="${val}" style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:6px;color:var(--text);font-weight:700;text-align:center;">`;
      }
    });
  }
}

function toggleMealTimes(on) {
  window._npMealTimesEnabled = on;
  document.querySelectorAll('.np-meal-time').forEach(el => {
    el.style.display = on ? '' : 'none';
  });
}

// ===== FOOD SOURCE TOGGLE =====
let _npFoodSource = localStorage.getItem('nutrition_food_source') || 'both';
let _npOffDebounce = null;
let _npOffResults = [];
let _npOffLoading = false;

function setNpFoodSource(src) {
  _npFoodSource = src;
  localStorage.setItem('nutrition_food_source', src);
  document.querySelectorAll('.np-src-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.np-src-btn[onclick*="'${src}'"]`)?.classList.add('active');
  filterNpLibrary();
}

function _renderFoodItem(a, badge) {
  const safeName = npEsc(a.nom).replace(/'/g, "\\'");
  return `
    <div class="np-lib-item" onclick="addFoodFromLibrary('${safeName}')">
      <div class="np-lib-icon"><i class="fas fa-apple-alt"></i></div>
      <div style="flex:1;min-width:0;">
        <div class="np-lib-name">${npEsc(a.nom)}${badge ? ` <span class="np-src-badge np-src-badge-${badge}">${badge === 'off' ? 'OFF' : 'Local'}</span>` : ''}</div>
        <div class="np-lib-macros">${Math.round(a.calories)||0} kcal · P${Math.round(a.proteines)||0} G${Math.round(a.glucides)||0} L${Math.round(a.lipides)||0}</div>
      </div>
    </div>`;
}

function filterNpLibrary() {
  const query = (document.getElementById('np-lib-search')?.value || '').trim().toLowerCase();
  const container = document.getElementById('np-lib-results');
  const offContainer = document.getElementById('np-lib-off-results');
  if (!container) return;

  const source = _npFoodSource;

  // ── Local results (instant, always re-rendered) ──
  let localHtml = '';
  if (source === 'local' || source === 'both') {
    const db = window.alimentsDB || [];
    const local = query
      ? db.filter(a => a.nom && a.nom.toLowerCase().includes(query)).slice(0, source === 'both' ? 20 : 40)
      : db.slice(0, source === 'both' ? 20 : 40);
    const badge = source === 'both' ? 'local' : null;
    if (local.length) {
      localHtml = `<div class="tr-library-results-title">Ma base (${local.length})</div>` + local.map(a => _renderFoodItem(a, badge)).join('');
    } else if (query) {
      localHtml = '<div style="padding:12px;text-align:center;color:var(--text3);font-size:11px;">Aucun résultat dans ma base</div>';
    }
  }
  container.innerHTML = localHtml;

  // ── OFF results (debounced, rendered separately) ──
  if (offContainer) {
    if ((source === 'off' || source === 'both') && query.length >= 2) {
      clearTimeout(_npOffDebounce);
      // Show spinner only if no cached results
      if (!_npOffResults.length && !_npOffLoading) {
        offContainer.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px;"><i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i>Recherche Open Food Facts...</div>';
      }
      _npOffDebounce = setTimeout(() => _searchOFF(query), 400);
    } else {
      _npOffResults = [];
      offContainer.innerHTML = source === 'off' && query.length < 2 ? '<div style="padding:20px;text-align:center;color:var(--text3);font-size:12px;">Tapez au moins 2 caractères</div>' : '';
    }
  }
}

async function _searchOFF(query) {
  const offContainer = document.getElementById('np-lib-off-results');
  if (!offContainer) return;

  _npOffLoading = true;
  offContainer.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px;"><i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i>Recherche Open Food Facts...</div>';

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=20&fields=product_name,nutriments,brands&lc=fr&cc=fr`;
    const resp = await fetch(url);
    const data = await resp.json();
    _npOffResults = (data.products || [])
      .filter(p => p.product_name && p.nutriments?.['energy-kcal_100g'] != null)
      .map(p => ({
        nom: p.product_name + (p.brands ? ` — ${p.brands}` : ''),
        calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
        proteines: Math.round(p.nutriments['proteins_100g'] || 0),
        glucides: Math.round(p.nutriments['carbohydrates_100g'] || 0),
        lipides: Math.round(p.nutriments['fat_100g'] || 0),
        source: 'openfoodfacts'
      }));
  } catch {
    _npOffResults = [];
    devLog('[OFF] Search failed for:', query);
  }
  _npOffLoading = false;

  // Render OFF results only
  const source = _npFoodSource;
  let html = '';
  if (_npOffResults.length) {
    if (source === 'both') html += '<div class="np-off-divider">── Open Food Facts ──</div>';
    else html += `<div class="tr-library-results-title">Open Food Facts (${_npOffResults.length})</div>`;
    html += _npOffResults.map(a => _renderFoodItem(a, 'off')).join('');
  } else {
    html = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px;">Aucun résultat OFF</div>';
  }
  offContainer.innerHTML = html;
}

// ===== QUICK ADD ALIMENT =====
function toggleNpQuickAdd() {
  const form = document.getElementById('np-quick-add-form');
  if (!form) return;
  if (form.style.display !== 'none') { form.style.display = 'none'; form.innerHTML = ''; return; }
  form.style.display = 'block';
  form.innerHTML = `
    <div class="np-quick-add">
      <input type="text" id="nqa-nom" placeholder="Nom de l'aliment" class="np-qa-input">
      <div class="np-qa-row">
        <input type="number" id="nqa-cal" placeholder="kcal" class="np-qa-input np-qa-sm">
        <input type="number" id="nqa-p" placeholder="P (g)" class="np-qa-input np-qa-sm">
        <input type="number" id="nqa-g" placeholder="G (g)" class="np-qa-input np-qa-sm">
        <input type="number" id="nqa-l" placeholder="L (g)" class="np-qa-input np-qa-sm">
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-red btn-sm" style="flex:1;" onclick="saveNpQuickAdd()"><i class="fas fa-plus"></i> Ajouter</button>
        <button class="btn btn-outline btn-sm" onclick="toggleNpQuickAdd()">Annuler</button>
      </div>
    </div>`;
}

async function saveNpQuickAdd() {
  const nom = document.getElementById('nqa-nom')?.value?.trim();
  if (!nom) { notify('Nom obligatoire', 'error'); return; }
  const calories = parseFloat(document.getElementById('nqa-cal')?.value) || 0;
  const proteines = parseFloat(document.getElementById('nqa-p')?.value) || 0;
  const glucides = parseFloat(document.getElementById('nqa-g')?.value) || 0;
  const lipides = parseFloat(document.getElementById('nqa-l')?.value) || 0;

  const { data: existing } = await supabaseClient
    .from('aliments_db')
    .select('id, nom')
    .eq('coach_id', currentUser.id)
    .ilike('nom', nom)
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (!confirm(`L'aliment "${existing.nom}" existe déjà. Mettre à jour ?`)) return;
    const { error } = await supabaseClient.from('aliments_db').update({ calories, proteines, glucides, lipides }).eq('id', existing.id);
    if (error) { handleError(error, 'nutrition'); return; }
    notify('Aliment mis à jour !', 'success');
  } else {
    const alimentData = { nom, calories, proteines, glucides, lipides, coach_id: currentUser.id };
    const { error } = await supabaseClient.from('aliments_db').insert(alimentData);
    if (error) { handleError(error, 'nutrition'); return; }
    notify('Aliment ajouté !', 'success');
  }

  // Refresh local DB
  window.alimentsDB = null;
  await loadAliments();
  toggleNpQuickAdd();
  filterNpLibrary();
}

function addFoodFromLibrary(nom) {
  const idx = window._npActiveMeal || 0;
  const blocks = document.querySelectorAll('#np-meals .np-meal-block');
  if (!blocks[idx]) return;
  const list = blocks[idx].querySelector('.np-foods-list');
  if (!list) return;
  const item = { aliment: nom, qte: 100 };
  list.insertAdjacentHTML('beforeend', buildNpFoodHtml(item));
  updateNpTotals();
}

function addNpMeal() {
  const c = document.getElementById('np-meals');
  if (!c) return;
  const n = c.querySelectorAll('.np-meal-block').length + 1;
  c.insertAdjacentHTML('beforeend', buildNpMealHtml(n, [], false));
  setActiveNpMeal(n - 1);
}

function removeNpMeal(btn) {
  const c = document.getElementById('np-meals');
  if (c.querySelectorAll('.np-meal-block').length <= 1) { notify('Minimum 1 repas', 'warning'); return; }
  btn.closest('.np-meal-block').remove();
  c.querySelectorAll('.np-meal-label').forEach((lbl, i) => { lbl.textContent = 'R' + (i+1); });
  c.querySelectorAll('.np-meal-block').forEach((b, i) => { b.dataset.mealIdx = i; b.setAttribute('onclick', `setActiveNpMeal(${i})`); });
  if (window._npActiveMeal >= c.querySelectorAll('.np-meal-block').length) window._npActiveMeal = 0;
  setActiveNpMeal(window._npActiveMeal);
  updateNpTotals();
}

function setActiveNpMeal(idx) {
  window._npActiveMeal = idx;
  document.querySelectorAll('#np-meals .np-meal-block').forEach((b, i) => {
    b.classList.toggle('np-meal-active', i === idx);
  });
}

function toggleNpPreWorkout(btn) {
  const block = btn.closest('.np-meal-block');
  const isOn = block.dataset.preWorkout === '1';
  const slot = block.querySelector('.np-pw-slot');
  if (isOn) {
    delete block.dataset.preWorkout;
    slot.innerHTML = '';
    btn.classList.remove('np-pw-btn-on');
  } else {
    block.dataset.preWorkout = '1';
    slot.innerHTML = '<span class="np-pw-badge">Pré training</span>';
    btn.classList.add('np-pw-btn-on');
  }
}

function calcNpFoodRow(el) {
  const row = el.closest('.np-food-row');
  if (!row) return;
  const qte = parseFloat(row.querySelector('.np-food-qty')?.value) || 0;
  const cal = parseFloat(row.dataset.cal) || 0;
  const prot = parseFloat(row.dataset.prot) || 0;
  const gluc = parseFloat(row.dataset.gluc) || 0;
  const lip = parseFloat(row.dataset.lip) || 0;
  const macros = row.querySelectorAll('.np-food-macro');
  if (macros[0]) macros[0].textContent = (cal * qte).toFixed(0);
  if (macros[1]) macros[1].textContent = (prot * qte).toFixed(1) + 'p';
  if (macros[2]) macros[2].textContent = (gluc * qte).toFixed(1) + 'g';
  if (macros[3]) macros[3].textContent = (lip * qte).toFixed(1) + 'l';
  updateNpTotals();
}

function updateNpTotals() {
  let tk = 0, tp = 0, tg = 0, tl = 0;
  document.querySelectorAll('#np-meals .np-meal-block').forEach(mealBlock => {
    let k = 0, p = 0, g = 0, l = 0;
    mealBlock.querySelectorAll('.np-food-row').forEach(fr => {
      const qte = parseFloat(fr.querySelector('.np-food-qty')?.value) || 0;
      k += (parseFloat(fr.dataset.cal) || 0) * qte;
      p += (parseFloat(fr.dataset.prot) || 0) * qte;
      g += (parseFloat(fr.dataset.gluc) || 0) * qte;
      l += (parseFloat(fr.dataset.lip) || 0) * qte;
    });
    tk += k; tp += p; tg += g; tl += l;
    const tot = mealBlock.querySelector('.np-meal-totals');
    if (tot) tot.textContent = k > 0 ? `${k.toFixed(0)} kcal · P${p.toFixed(1)} G${g.toFixed(1)} L${l.toFixed(1)}` : '';
  });
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('np-cal', tk.toFixed(0));
  set('np-prot', tp.toFixed(1));
  set('np-gluc', tg.toFixed(1));
  set('np-lip', tl.toFixed(1));
}

function copyNpMeal(btn) {
  const mealBlock = btn.closest('.np-meal-block');
  const foods = [];
  mealBlock.querySelectorAll('.np-food-row').forEach(fr => {
    const nom = fr.dataset.nom;
    if (!nom) return;
    foods.push({
      aliment: nom,
      qte: parseFloat(fr.querySelector('.np-food-qty')?.value) || 0,
    });
  });
  window._npClipboard = foods;
  notify('Repas copié', 'success');
}

function pasteNpMeal(btn) {
  if (!window._npClipboard || !window._npClipboard.length) { notify('Aucun repas copié', 'warning'); return; }
  const mealBlock = btn.closest('.np-meal-block');
  const list = mealBlock.querySelector('.np-foods-list');
  list.innerHTML = window._npClipboard.map(f => buildNpFoodHtml(f)).join('');
  updateNpTotals();
  notify('Repas collé', 'success');
}

function getNpMealData() {
  const meals = [];
  document.querySelectorAll('#np-meals .np-meal-block').forEach(block => {
    const foods = [];
    block.querySelectorAll('.np-food-row').forEach(fr => {
      const nom = fr.dataset.nom;
      if (!nom) return;
      const qte = parseFloat(fr.querySelector('.np-food-qty')?.value) || 0;
      const cal = parseFloat(fr.dataset.cal) || 0;
      const prot = parseFloat(fr.dataset.prot) || 0;
      const gluc = parseFloat(fr.dataset.gluc) || 0;
      const lip = parseFloat(fr.dataset.lip) || 0;
      const allowConversion = fr.querySelector('.np-food-conv')?.checked || false;
      foods.push({
        aliment: nom,
        qte,
        kcal: parseFloat((cal * qte).toFixed(0)),
        p: parseFloat((prot * qte).toFixed(1)),
        g: parseFloat((gluc * qte).toFixed(1)),
        l: parseFloat((lip * qte).toFixed(1)),
        allow_conversion: allowConversion
      });
    });
    const preWorkout = block.dataset.preWorkout === '1';
    const time = block.querySelector('.np-meal-time')?.value || '';
    const mealObj = { foods };
    if (preWorkout) mealObj.pre_workout = true;
    if (time) mealObj.time = time;
    meals.push(mealObj);
  });
  return meals;
}

async function saveNutritionPlanInline() {
  const nom = document.getElementById('np-nom')?.value?.trim();
  if (!nom) { notify('Le nom est obligatoire', 'error'); return; }
  const today = new Date().toISOString().split('T')[0];
  const currentType = window._npMealType || 'training';
  const otherType = currentType === 'training' ? 'rest' : 'training';

  // Check macro-only mode
  const isMacroOnly = window._npMacroOnly || false;

  // Build current tab data from editor
  const currentMeals = isMacroOnly ? [] : getNpMealData();
  function calcMealsTotal(meals) {
    let k=0,p=0,g=0,l=0;
    meals.forEach(m => {
      const items = (m && !Array.isArray(m) && m.foods) ? m.foods : (Array.isArray(m) ? m : []);
      items.forEach(a => { k+=a.kcal||0; p+=a.p||0; g+=a.g||0; l+=a.l||0; });
    });
    return { k: Math.round(k), p: Math.round(p), g: Math.round(g), l: Math.round(l) };
  }
  let currentTotals;
  if (isMacroOnly) {
    currentTotals = {
      k: Math.round(parseFloat(document.getElementById('np-cal')?.value) || 0),
      p: Math.round(parseFloat(document.getElementById('np-prot')?.value) || 0),
      g: Math.round(parseFloat(document.getElementById('np-gluc')?.value) || 0),
      l: Math.round(parseFloat(document.getElementById('np-lip')?.value) || 0)
    };
  } else {
    currentTotals = calcMealsTotal(currentMeals);
  }

  // Deactivate ALL plans for this athlete (only one diet active at a time)
  const { error: deactErr } = await supabaseClient.from('nutrition_plans').update({ actif: false }).eq('athlete_id', currentAthleteId);
  if (deactErr) { handleError(deactErr, 'nutrition'); return; }

  // Save current tab
  let error;
  const insertPayload = {
    nom, meal_type: currentType, meals_data: JSON.stringify(currentMeals),
    calories_objectif: currentTotals.k, proteines: currentTotals.p, glucides: currentTotals.g, lipides: currentTotals.l,
    valid_from: today, actif: true, athlete_id: currentAthleteId, coach_id: currentUser.id
  };
  if (isMacroOnly) insertPayload.macro_only = true;
  ({ error } = await supabaseClient.from('nutrition_plans').insert(insertPayload));
  if (error) { handleError(error, 'nutrition'); return; }

  // Save the other tab too if it has temp data
  const otherTemp = window._npTempMeals?.[otherType];
  if (otherTemp && otherTemp.meals && otherTemp.meals.length) {
    const hasFood = otherTemp.meals.some(m => {
      const items = (m && !Array.isArray(m) && m.foods) ? m.foods : (Array.isArray(m) ? m : []);
      return items.length > 0;
    });
    if (hasFood) {
      const otherTotals = calcMealsTotal(otherTemp.meals);
      const { error: otherErr } = await supabaseClient.from('nutrition_plans').insert({
        nom, meal_type: otherType, meals_data: JSON.stringify(otherTemp.meals),
        calories_objectif: otherTotals.k, proteines: otherTotals.p, glucides: otherTotals.g, lipides: otherTotals.l,
        valid_from: today, actif: true, athlete_id: currentAthleteId, coach_id: currentUser.id
      });
      if (otherErr) { handleError(otherErr, 'nutrition'); }
    }
  } else {
    // No temp data for other tab — re-activate existing paired plan if any
    const pair = window._npDietPair;
    if (pair) {
      const otherId = currentType === 'training' ? pair.rest : pair.training;
      if (otherId) { const { error: reactErr } = await supabaseClient.from('nutrition_plans').update({ actif: true }).eq('id', otherId); if (reactErr) { handleError(reactErr, 'nutrition'); } }
    }
  }

  notify('Diète sauvegardée !', 'success');
  if (currentAthleteObj?.user_id) {
    const _t = 'Plan nutrition mis à jour';
    const _b = `Votre coach a ${window._npEditId ? 'modifié' : 'créé'} votre plan nutritionnel "${nom}"`;
    const { error: notifErr } = await supabaseClient.from('notifications').insert({ user_id: currentAthleteObj.user_id, type: 'nutrition', title: _t, body: _b });
    if (notifErr) { handleError(notifErr, 'nutrition'); }
    await sendExpoPush([currentAthleteObj.user_id], _t, _b);
  }
  window._npEditId = null;
  window._npTempMeals = {};
  window._npDietName = '';
  window._npMacroOnly = false;
  loadAthleteTabNutrition();
}

// ===== NUTRITION HISTORY (Coach view) =====

async function loadNutritionHistory() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  // Get athlete info
  const { data: athlete } = await supabaseClient.from('athletes').select('id, user_id').eq('id', currentAthleteId).single();
  if (!athlete) { notify('Athlète introuvable', 'error'); loadAthleteTabNutrition(); return; }

  // Load logs (last 30 days) — try both id and user_id since athlete app may use either
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromDate = thirtyDaysAgo.toISOString().split('T')[0];

  const [{ data: logsByUserId }, { data: logsByAthleteId }, { data: plans }] = await Promise.all([
    supabaseClient.from('nutrition_logs').select('*').eq('athlete_id', athlete.user_id).gte('date', fromDate).order('date', { ascending: false }),
    supabaseClient.from('nutrition_logs').select('*').eq('athlete_id', athlete.id).gte('date', fromDate).order('date', { ascending: false }),
    supabaseClient.from('nutrition_plans').select('id, nom, meal_type, meals_data').eq('athlete_id', currentAthleteId)
  ]);

  // Merge — use whichever has results
  const logs = (logsByUserId?.length ? logsByUserId : logsByAthleteId) || [];

  await loadAliments();
  const allLogs = logs;
  const planMap = {};
  (plans || []).forEach(p => { planMap[p.id] = p; });

  window._nutriHistLogs = allLogs;
  window._nutriHistPlans = planMap;
  window._nutriHistAthleteUserId = athlete.user_id;

  // Build week navigation — start with current week
  window._nutriHistWeekOffset = 0;
  renderNutritionHistory(el);
}

function renderNutritionHistory(el) {
  if (!el) el = document.getElementById('athlete-tab-content');
  const allLogs = window._nutriHistLogs || [];
  const planMap = window._nutriHistPlans || {};
  const offset = window._nutriHistWeekOffset || 0;

  // Compute the week
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7) - (offset * 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weekStartStr = toDateStr(weekStart);
  const weekEndStr = toDateStr(weekEnd);

  // Days of the week
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push({ date: toDateStr(d), dayLabel: d.toLocaleDateString('fr-FR', { weekday: 'short' }), dayNum: d.getDate() });
  }

  const weekLabel = weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' - ' + weekEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  // Selected day
  const today = toDateStr(now);
  if (!window._nutriHistSelectedDate || window._nutriHistSelectedDate < weekStartStr || window._nutriHistSelectedDate > weekEndStr) {
    window._nutriHistSelectedDate = days.find(d => d.date === today)?.date || days[0].date;
  }
  const selectedDate = window._nutriHistSelectedDate;

  // Find log for selected day
  const dayLog = allLogs.find(l => l.date === selectedDate);
  const plan = dayLog ? planMap[dayLog.plan_id] : null;

  // Week days selector
  const daysHtml = days.map(d => {
    const hasLog = allLogs.some(l => l.date === d.date);
    const isSelected = d.date === selectedDate;
    const isToday = d.date === today;
    return `<button class="nh-day ${isSelected ? 'active' : ''} ${isToday ? 'nh-today' : ''}" onclick="selectNutriHistDay('${d.date}')">
      <span class="nh-day-label">${d.dayLabel}</span>
      <span class="nh-day-num">${d.dayNum}</span>
      ${hasLog ? '<span class="nh-day-dot"></span>' : ''}
    </button>`;
  }).join('');

  // Day content
  let dayContentHtml = '';
  if (!dayLog) {
    dayContentHtml = `
      <div style="text-align:center;padding:40px;color:var(--text3);">
        <i class="fas fa-utensils" style="font-size:28px;margin-bottom:12px;"></i>
        <div style="font-size:14px;">Aucun suivi nutritionnel ce jour</div>
        <div style="font-size:12px;margin-top:4px;">L'athlète n'a pas encore rempli son suivi pour cette journée</div>
      </div>`;
  } else {
    let mealsLog = [];
    try { mealsLog = (typeof dayLog.meals_log === 'string' ? JSON.parse(dayLog.meals_log) : dayLog.meals_log) || []; } catch(e) {}
    const planName = plan?.nom || 'Plan supprimé';
    const planType = plan?.meal_type === 'training' ? 'Entraînement' : plan?.meal_type === 'rest' ? 'Repos' : '';

    // Compute day totals (what was actually eaten)
    let actualK = 0, actualP = 0, actualG = 0, actualL = 0;
    let plannedK = 0, plannedP = 0, plannedG = 0, plannedL = 0;
    let followedCount = 0, replacedCount = 0, skippedCount = 0, extrasCount = 0, totalFoods = 0;

    mealsLog.forEach(meal => {
      (meal.foods || []).forEach(f => {
        totalFoods++;
        const orig = f.original || {};
        plannedK += parseFloat(orig.kcal) || 0;
        plannedP += parseFloat(orig.p) || 0;
        plannedG += parseFloat(orig.g) || 0;
        plannedL += parseFloat(orig.l) || 0;

        if (f.status === 'followed') {
          followedCount++;
          actualK += parseFloat(orig.kcal) || 0;
          actualP += parseFloat(orig.p) || 0;
          actualG += parseFloat(orig.g) || 0;
          actualL += parseFloat(orig.l) || 0;
        } else if (f.status === 'replaced' && f.replacement) {
          replacedCount++;
          actualK += parseFloat(f.replacement.kcal) || 0;
          actualP += parseFloat(f.replacement.p) || 0;
          actualG += parseFloat(f.replacement.g) || 0;
          actualL += parseFloat(f.replacement.l) || 0;
        } else {
          skippedCount++;
        }
      });
      // Extras added by athlete
      (meal.extras || []).forEach(ex => {
        extrasCount++;
        actualK += parseFloat(ex.kcal) || 0;
        actualP += parseFloat(ex.p) || 0;
        actualG += parseFloat(ex.g) || 0;
        actualL += parseFloat(ex.l) || 0;
      });
    });

    const adherenceRate = totalFoods > 0 ? Math.round((followedCount / totalFoods) * 100) : 0;

    // Meals detail
    const mealsHtml = mealsLog.map((meal, mIdx) => {
      const mealLabel = meal.meal_label || ('Repas ' + (mIdx + 1));
      const validated = meal.validated_all;

      const foodsHtml = (meal.foods || []).map((f, fIdx) => {
        const orig = f.original || {};
        const statusIcon = f.status === 'followed'
          ? '<span class="nh-status nh-followed"><i class="fas fa-check-circle"></i></span>'
          : f.status === 'replaced'
            ? '<span class="nh-status nh-replaced"><i class="fas fa-exchange-alt"></i></span>'
            : '<span class="nh-status nh-skipped"><i class="fas fa-times-circle"></i></span>';

        let foodLine = `
          <div class="nh-food-row ${f.status}">
            ${statusIcon}
            <div class="nh-food-info">
              <span class="nh-food-name">${escHtml(orig.aliment || '?')}</span>
              <span class="nh-food-qty">${orig.qte || 0}g</span>
            </div>
            <div class="nh-food-macros">
              <span>${Math.round(parseFloat(orig.kcal) || 0)} kcal</span>
              <span class="nh-food-detail">P:${Math.round(parseFloat(orig.p) || 0)} G:${Math.round(parseFloat(orig.g) || 0)} L:${Math.round(parseFloat(orig.l) || 0)}</span>
            </div>
          </div>`;

        if (f.status === 'replaced' && f.replacement) {
          const rep = f.replacement;
          foodLine += `
            <div class="nh-food-row nh-replacement">
              <span class="nh-status nh-replaced"><i class="fas fa-arrow-right"></i></span>
              <div class="nh-food-info">
                <span class="nh-food-name">${escHtml(rep.aliment || '?')}</span>
                <span class="nh-food-qty">${rep.qte || 0}g</span>
              </div>
              <div class="nh-food-macros">
                <span>${Math.round(parseFloat(rep.kcal) || 0)} kcal</span>
                <span class="nh-food-detail">P:${Math.round(parseFloat(rep.p) || 0)} G:${Math.round(parseFloat(rep.g) || 0)} L:${Math.round(parseFloat(rep.l) || 0)}</span>
              </div>
              ${dayLog?.plan_id ? `<button class="nh-integrate-btn" onclick="integrateOneChange('${dayLog.plan_id}',${mIdx},${fIdx},'replace')" title="Intégrer ce remplacement"><i class="fas fa-check"></i></button>` : ''}
            </div>`;
        }

        return foodLine;
      }).join('');

      // Extras added by athlete
      const extras = meal.extras || [];
      const extrasHtml = extras.length ? `
        <div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border-subtle);">
          <div style="font-size:11px;color:#3b82f6;font-weight:600;margin-bottom:4px;"><i class="fas fa-plus-circle" style="margin-right:4px;"></i>Ajouté par l'athlète</div>
          ${extras.map((ex, exIdx) => `
            <div class="nh-food-row">
              <span class="nh-status" style="color:#3b82f6;"><i class="fas fa-plus-circle"></i></span>
              <div class="nh-food-info">
                <span class="nh-food-name">${escHtml(ex.aliment || '?')}</span>
                <span class="nh-food-qty">${ex.qte || 0}g</span>
              </div>
              <div class="nh-food-macros">
                <span>${Math.round(parseFloat(ex.kcal) || 0)} kcal</span>
                <span class="nh-food-detail">P:${Math.round(parseFloat(ex.p) || 0)} G:${Math.round(parseFloat(ex.g) || 0)} L:${Math.round(parseFloat(ex.l) || 0)}</span>
              </div>
              ${dayLog?.plan_id ? `<button class="nh-integrate-btn" onclick="integrateOneChange('${dayLog.plan_id}',${mIdx},${exIdx},'extra')" title="Intégrer cet ajout"><i class="fas fa-check"></i></button>` : ''}
            </div>`).join('')}
        </div>` : '';

      return `
        <div class="nh-meal">
          <div class="nh-meal-header">
            <span class="nh-meal-label">${escHtml(mealLabel)}</span>
            ${validated ? '<span class="nh-meal-validated"><i class="fas fa-check"></i> Validé</span>' : ''}
          </div>
          ${foodsHtml}
          ${extrasHtml}
        </div>`;
    }).join('');

    const diffK = Math.round(actualK - plannedK);
    const diffColor = diffK > 50 ? 'var(--danger)' : diffK < -50 ? 'var(--warning)' : 'var(--success)';
    const diffSign = diffK > 0 ? '+' : '';

    dayContentHtml = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:14px;font-weight:700;color:var(--text);">${planName}</span>
          ${planType ? `<span style="font-size:10px;padding:2px 8px;border-radius:8px;background:${planType === 'Entraînement' ? 'rgba(231,76,60,0.15)' : 'rgba(52,152,219,0.15)'};color:${planType === 'Entraînement' ? '#e74c3c' : '#3498db'};font-weight:600;">${planType === 'Entraînement' ? 'ON' : 'OFF'}</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:16px;">
          <div style="display:flex;align-items:center;gap:6px;font-size:12px;">
            <span style="color:var(--success);font-weight:600;">${followedCount}<i class="fas fa-check" style="margin-left:2px;font-size:9px;"></i></span>
            ${replacedCount ? `<span style="color:#f59e0b;font-weight:600;">${replacedCount}<i class="fas fa-exchange-alt" style="margin-left:2px;font-size:9px;"></i></span>` : ''}
            ${skippedCount ? `<span style="color:var(--danger);font-weight:600;">${skippedCount}<i class="fas fa-times" style="margin-left:2px;font-size:9px;"></i></span>` : ''}
            ${extrasCount ? `<span style="color:#3b82f6;font-weight:600;">+${extrasCount}</span>` : ''}
          </div>
          <span style="font-size:18px;font-weight:800;color:var(--text);">${adherenceRate}%</span>
        </div>
      </div>

      <div style="display:flex;justify-content:center;margin-bottom:16px;">
        <div style="display:grid;grid-template-columns:1fr auto 1fr;background:var(--bg3);border-radius:12px;overflow:hidden;min-width:460px;max-width:580px;width:100%;">
          <div style="padding:16px 24px;text-align:center;">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Prévu</div>
            <div style="font-size:26px;font-weight:800;color:var(--text);line-height:1;">${Math.round(plannedK)}<span style="font-size:12px;font-weight:500;color:var(--text3);margin-left:4px;">kcal</span></div>
            <div style="display:flex;justify-content:center;gap:6px;margin-top:8px;">
              <span style="font-size:11px;font-weight:600;color:#e74c3c;background:rgba(231,76,60,0.12);padding:3px 8px;border-radius:6px;">P ${plannedP.toFixed(0)}g</span>
              <span style="font-size:11px;font-weight:600;color:#3498db;background:rgba(52,152,219,0.12);padding:3px 8px;border-radius:6px;">G ${plannedG.toFixed(0)}g</span>
              <span style="font-size:11px;font-weight:600;color:#f59e0b;background:rgba(245,158,11,0.12);padding:3px 8px;border-radius:6px;">L ${plannedL.toFixed(0)}g</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 18px;border-left:1px solid var(--border);border-right:1px solid var(--border);">
            <div style="font-size:20px;font-weight:800;color:${diffColor};line-height:1;white-space:nowrap;">${diffSign}${diffK}</div>
            <div style="font-size:9px;color:var(--text3);margin-top:3px;">kcal</div>
          </div>
          <div style="padding:16px 24px;text-align:center;">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Consommé</div>
            <div style="font-size:26px;font-weight:800;color:var(--text);line-height:1;">${Math.round(actualK)}<span style="font-size:12px;font-weight:500;color:var(--text3);margin-left:4px;">kcal</span></div>
            <div style="display:flex;justify-content:center;gap:6px;margin-top:8px;">
              <span style="font-size:11px;font-weight:600;color:#e74c3c;background:rgba(231,76,60,0.12);padding:3px 8px;border-radius:6px;">P ${actualP.toFixed(0)}g</span>
              <span style="font-size:11px;font-weight:600;color:#3498db;background:rgba(52,152,219,0.12);padding:3px 8px;border-radius:6px;">G ${actualG.toFixed(0)}g</span>
              <span style="font-size:11px;font-weight:600;color:#f59e0b;background:rgba(245,158,11,0.12);padding:3px 8px;border-radius:6px;">L ${actualL.toFixed(0)}g</span>
            </div>
          </div>
        </div>
      </div>

      ${mealsHtml}

      `;
  }

  const dateLong = new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  el.innerHTML = `
    <div class="tr-header">
      <div>
        <div class="tr-header-title"><i class="fas fa-history" style="color:var(--primary);margin-right:8px;"></i>Historique Nutrition</div>
        <div class="tr-header-sub">Suivi alimentaire jour par jour</div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-outline btn-sm" onclick="loadAthleteTabNutrition()"><i class="fas fa-arrow-left"></i> Plans</button>
      </div>
    </div>

    <div class="nh-week-nav">
      <button class="nh-week-btn" onclick="navigateNutriHistWeek(1)"><i class="fas fa-chevron-left"></i></button>
      <span class="nh-week-label">${weekLabel}</span>
      <button class="nh-week-btn" ${offset <= 0 ? 'disabled' : ''} onclick="navigateNutriHistWeek(-1)"><i class="fas fa-chevron-right"></i></button>
    </div>

    <div class="nh-days-row">${daysHtml}</div>

    <div class="nh-content">
      <div class="nh-date-label">${dateLong}</div>
      ${dayContentHtml}
    </div>`;
}

function selectNutriHistDay(dateStr) {
  window._nutriHistSelectedDate = dateStr;
  renderNutritionHistory();
}

function navigateNutriHistWeek(direction) {
  window._nutriHistWeekOffset = (window._nutriHistWeekOffset || 0) + direction;
  window._nutriHistSelectedDate = null;

  // Reload if we need older data
  if (window._nutriHistWeekOffset > 3) {
    loadNutritionHistory();
  } else {
    renderNutritionHistory();
  }
}
