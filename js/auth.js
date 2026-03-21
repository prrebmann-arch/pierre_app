// ===== AUTHENTICATION =====

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
    notify('Erreur: ' + error.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Se connecter';
  }
});

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  document.getElementById('user-name').textContent = currentUser.email.split('@')[0];
  document.getElementById('user-avatar').textContent = currentUser.email[0].toUpperCase();
  loadAthletes();
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    showApp();
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
  }
}
