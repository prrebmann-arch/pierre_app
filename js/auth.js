// ===== LANDING / AUTH NAVIGATION =====
function showLanding() {
  document.getElementById('landing-screen').classList.add('active');
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'none';
  initLandingAnimations();
}

function showAuth() {
  document.getElementById('landing-screen').classList.remove('active');
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
  window.scrollTo(0, 0);
}

function initLandingAnimations() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('#landing-screen .fade-in').forEach(el => obs.observe(el));
  // Navbar scroll
  window.addEventListener('scroll', () => {
    const nb = document.getElementById('navbar');
    if (nb) { if (window.scrollY > 50) nb.classList.add('scrolled'); else nb.classList.remove('scrolled'); }
  });
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const icon = document.getElementById('menuIcon');
  if (!menu) return;
  menu.classList.toggle('open');
  if (menu.classList.contains('open')) { icon.classList.replace('fa-bars', 'fa-xmark'); document.body.style.overflow = 'hidden'; }
  else { icon.classList.replace('fa-xmark', 'fa-bars'); document.body.style.overflow = ''; }
}

function closeMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const icon = document.getElementById('menuIcon');
  if (!menu) return;
  menu.classList.remove('open');
  icon.classList.replace('fa-xmark', 'fa-bars');
  document.body.style.overflow = '';
}

// ===== AUTHENTICATION =====

const ADMIN_EMAIL = 'rebmannpierre1@gmail.com';

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('auth-submit').textContent = tab === 'login' ? 'Se connecter' : "S'inscrire";
}

document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const submitBtn = document.getElementById('auth-submit');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Admin → show admin dashboard (no redirect)
    if (data.user.email === ADMIN_EMAIL) {
      currentUser = data.user;
      showAdminApp();
      return;
    }

    // Verify this is NOT an athlete account
    const { data: athleteCheck } = await supabaseClient
      .from('athletes')
      .select('id')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (athleteCheck) {
      await supabaseClient.auth.signOut();
      throw new Error('Ce compte est un compte athlète. Utilisez l\'app athlète pour vous connecter.');
    }

    currentUser = data.user;
    showApp();
    notify('Connecté avec succès !', 'success');
  } catch (error) {
    handleError(error, 'auth');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Se connecter';
  }
});

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('landing-screen').classList.remove('active');
  document.getElementById('app-screen').style.display = 'block';
  document.getElementById('user-name').textContent = currentUser.email.split('@')[0];
  document.getElementById('user-avatar').textContent = currentUser.email[0].toUpperCase();
  loadAthletes(); // preload athletes list

  // Restore last section from URL hash, or default to dashboard
  const hash = location.hash.replace('#', '');
  const validSections = ['dashboard','athletes','bilans-overview','videos','templates','aliments','exercices','formations','business'];
  if (hash && validSections.includes(hash)) {
    showSection(hash);
  } else {
    showSection('dashboard');
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  adminCache = {};
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('admin-app').style.display = 'none';
  showLanding();
}

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    if (session.user.email === ADMIN_EMAIL) {
      showAdminApp();
    } else {
      showApp();
    }
  } else {
    showLanding();
  }
}
