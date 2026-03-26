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

  // Persist navigation state
  if (section !== 'athlete-detail') {
    location.hash = section;
  }

  if (section === 'dashboard') loadDashboard();
  if (section === 'athletes') {
    currentAthleteId = null;
    currentAthleteObj = null;
    loadAthletes();
  }
  if (section === 'athlete-detail') loadAthleteTabApercu();
  if (section === 'templates') loadTemplates();
  if (section === 'aliments') loadAliments();
  if (section === 'formations') loadFormations();
  if (section === 'bilans-overview') loadBilansOverview();
  if (section === 'videos') loadVideosSection();
  if (section === 'business') loadBusiness();
  if (section === 'exercices') loadExercicesPage();
}

function backToAthletesList() {
  showSection('athletes');
}

function switchAthleteTab(tab) {
  currentAthleteTab = tab;
  document.querySelectorAll('#athlete-detail-section .athlete-tab-btn').forEach(btn => btn.classList.remove('active'));
  const btn = document.querySelector(`#athlete-detail-section .athlete-tab-btn[onclick*="'${tab}'"]`);
  if (btn) btn.classList.add('active');
  switch (tab) {
    case 'apercu': loadAthleteTabApercu(); break;
    case 'infos': loadAthleteTabInfos(); break;
    case 'training': loadAthleteTabTraining(); break;
    case 'nutrition': loadAthleteTabNutrition(); break;
    case 'roadmap': loadAthleteTabRoadmap(); break;
    case 'bilans': loadAthleteTabBilans(); break;
    case 'videos': loadAthleteTabVideos(); break;
    case 'retours': loadAthleteTabRetours(); break;
    case 'posing': loadAthleteTabPosing(); break;
    case 'questionnaires': loadAthleteTabQuestionnaires(); break;
    case 'supplements': loadAthleteTabSupplements(); break;
  }
}

function switchTemplateTab(tab) {
  currentTemplateTab = tab;
  document.querySelectorAll('#templates-section .athlete-tab-btn').forEach(btn => btn.classList.remove('active'));
  const btn = document.querySelector(`#templates-section .athlete-tab-btn[onclick*="'${tab}'"]`);
  if (btn) btn.classList.add('active');
  loadTemplates();
}

// ===== THEME TOGGLE =====
function toggleTheme() {
  const html = document.documentElement;
  const isLight = html.getAttribute('data-theme') === 'light';
  if (isLight) {
    html.removeAttribute('data-theme');
    localStorage.setItem('prc-theme', 'dark');
  } else {
    html.setAttribute('data-theme', 'light');
    localStorage.setItem('prc-theme', 'light');
  }
  updateThemeIcon();
}

function updateThemeIcon() {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  icon.className = isLight ? 'fas fa-moon' : 'fas fa-sun';
}

// Apply on load
document.addEventListener('DOMContentLoaded', updateThemeIcon);

// ===== INITIALIZATION =====
checkSession();
