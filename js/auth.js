// ===== LANDING / AUTH NAVIGATION =====
function showLanding() {
  document.getElementById('landing-screen').classList.add('active');
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'none';
  initLandingAnimations();
}

function showAuth(tab) {
  document.getElementById('landing-screen').classList.remove('active');
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
  window.scrollTo(0, 0);
  if (tab === 'register') {
    authMode = 'register';
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-tab')[1]?.classList.add('active');
    document.getElementById('auth-submit').textContent = "S'inscrire";
    const planChoice = document.getElementById('auth-plan-choice');
    if (planChoice) planChoice.style.display = 'block';
  }
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

let authMode = 'login';

function switchAuthTab(tab) {
  authMode = tab;
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('auth-submit').textContent = tab === 'login' ? 'Se connecter' : "S'inscrire";
  // Show/hide plan choice on register
  const planChoice = document.getElementById('auth-plan-choice');
  if (planChoice) planChoice.style.display = tab === 'register' ? 'block' : 'none';
}

// Plan radio toggle styling
document.addEventListener('change', (e) => {
  if (e.target.name === 'auth-plan') {
    const athleteLabel = document.getElementById('plan-athlete-label');
    const businessLabel = document.getElementById('plan-business-label');
    if (e.target.value === 'athlete') {
      athleteLabel.style.borderColor = 'var(--accent)';
      athleteLabel.style.background = 'rgba(99,102,241,0.08)';
      businessLabel.style.borderColor = 'var(--border)';
      businessLabel.style.background = 'transparent';
    } else {
      businessLabel.style.borderColor = 'var(--accent)';
      businessLabel.style.background = 'rgba(99,102,241,0.08)';
      athleteLabel.style.borderColor = 'var(--border)';
      athleteLabel.style.background = 'transparent';
    }
  }
});

document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const submitBtn = document.getElementById('auth-submit');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    let data, error;

    if (authMode === 'login') {
      ({ data, error } = await supabaseClient.auth.signInWithPassword({ email, password }));
    } else {
      // Inscription
      if (password.length < 6) throw new Error('Le mot de passe doit contenir au moins 6 caractères');
      ({ data, error } = await supabaseClient.auth.signUp({ email, password }));
      if (!error && data?.user) {
        // Get selected plan
        const selectedPlan = document.querySelector('input[name="auth-plan"]:checked')?.value || 'athlete';
        // Auto-create coach profile with trial
        await supabaseClient.from('coach_profiles').upsert({
          user_id: data.user.id,
          email,
          display_name: email.split('@')[0],
          plan: selectedPlan,
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'user_id' });
      }
    }
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

async function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('landing-screen').classList.remove('active');
  document.getElementById('user-name').textContent = currentUser.email.split('@')[0];
  document.getElementById('user-avatar').textContent = currentUser.email[0].toUpperCase();

  // Check if coach needs to add payment method (skip for free plan)
  const { data: profile } = await supabaseClient
    .from('coach_profiles')
    .select('has_payment_method, plan, trial_ends_at')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  const isFree = profile?.plan === 'free';
  const needsPayment = profile && !isFree && !profile.has_payment_method;

  // Handle ?setup=success return from Stripe
  const params = new URLSearchParams(window.location.search);
  if (params.get('setup') === 'success') {
    await supabaseClient.from('coach_profiles')
      .update({ has_payment_method: true })
      .eq('user_id', currentUser.id);
    window.history.replaceState({}, '', window.location.pathname + '#profile');
    notify('Carte enregistrée avec succès', 'success');
  }

  if (needsPayment && params.get('setup') !== 'success') {
    // Show payment wall
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('payment-wall').style.display = 'flex';
    return;
  }

  // Check Stripe Connect return
  await profileCheckConnectReturn();

  // Normal app access
  document.getElementById('payment-wall').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  loadAthletes();

  const hash = location.hash.replace('#', '');
  const validSections = ['dashboard','athletes','bilans-overview','videos','templates','aliments','exercices','formations','business','profile'];
  if (hash && validSections.includes(hash)) {
    showSection(hash);
  } else {
    showSection('dashboard');
  }
}

let _wallStripe = null;
let _wallElements = null;
let _wallClientSecret = null;

async function setupCoachPaymentMethod() {
  const btn = document.getElementById('payment-wall-btn');
  const container = document.getElementById('payment-wall-stripe');
  const errorEl = document.getElementById('payment-wall-error');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Chargement...'; }
    if (errorEl) errorEl.textContent = '';

    const resp = await authFetch('/api/stripe?action=coach-setup', {
      method: 'POST',
      body: JSON.stringify({ coachId: currentUser.id, email: currentUser.email })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);

    _wallClientSecret = data.clientSecret;
    _wallStripe = Stripe(data.publishableKey);
    _wallElements = _wallStripe.elements({
      clientSecret: data.clientSecret,
      appearance: {
        theme: 'night',
        variables: { colorPrimary: '#B30808', colorBackground: '#18181b', colorText: '#f4f4f5', borderRadius: '8px' },
      },
    });

    const paymentElement = _wallElements.create('payment');
    const mountPoint = document.getElementById('payment-wall-element');
    mountPoint.replaceChildren();
    paymentElement.mount(mountPoint);

    if (btn) btn.style.display = 'none';
    if (container) container.style.display = 'block';
  } catch (err) {
    handleError(err, 'setupCoachPaymentMethod');
    if (btn) { btn.disabled = false; btn.textContent = 'Ajouter ma carte'; }
  }
}

async function confirmPaymentWallCard() {
  const confirmBtn = document.getElementById('payment-wall-confirm');
  const errorEl = document.getElementById('payment-wall-error');
  if (!_wallStripe || !_wallElements) return;

  try {
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Vérification...'; }
    if (errorEl) errorEl.textContent = '';

    const { error } = await _wallStripe.confirmSetup({
      elements: _wallElements,
      confirmParams: { return_url: window.location.origin + '?setup=success' },
      redirect: 'if_required',
    });

    if (error) {
      if (errorEl) errorEl.textContent = error.message;
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Confirmer ma carte'; }
      return;
    }

    // Update DB
    await supabaseClient.from('coach_profiles')
      .update({ has_payment_method: true })
      .eq('user_id', currentUser.id);

    notify('Carte enregistrée !', 'success');
    // Hide payment wall, show app
    document.getElementById('payment-wall').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    loadAthletes();
    showSection('dashboard');
  } catch (err) {
    if (errorEl) errorEl.textContent = err.message;
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Confirmer ma carte'; }
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
