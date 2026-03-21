// ===== NAVIGATION & APP LOGIC =====

function showSection(section) {
  document.querySelectorAll('.section').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const sectionEl = document.getElementById(`${section}-section`);
  if (sectionEl) {
    sectionEl.classList.add('active');
    sectionEl.style.display = 'block';
  }

  const navBtn = document.querySelector(`.nav-item[onclick*="${section}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (section === 'athletes') {
    currentAthleteId = null;
    currentAthleteObj = null;
    loadAthletes();
  }
  if (section === 'athlete-detail') loadAthleteTabInfos();
  if (section === 'templates') loadTemplates();
  if (section === 'aliments') loadAliments();
}

function backToAthletesList() {
  showSection('athletes');
}

function switchAthleteTab(tab) {
  currentAthleteTab = tab;
  document.querySelectorAll('.athlete-tab-btn').forEach(btn => btn.classList.remove('active'));
  const btn = document.querySelector(`.athlete-tab-btn[onclick*="'${tab}'"]`);
  if (btn) btn.classList.add('active');
  switch (tab) {
    case 'infos': loadAthleteTabInfos(); break;
    case 'training': loadAthleteTabTraining(); break;
    case 'nutrition': loadAthleteTabNutrition(); break;
    case 'bilans': loadAthleteTabBilans(); break;
  }
}

function switchTemplateTab(tab) {
  currentTemplateTab = tab;
  document.querySelectorAll('#templates-section .btn-outline').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  loadTemplates();
}

// ===== INITIALIZATION =====
checkSession();
