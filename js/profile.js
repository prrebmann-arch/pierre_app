// ===== COACH PROFILE & SETTINGS =====

let profileData = null;
let profileInvoices = [];

async function loadProfile() {
  const container = document.getElementById('profile-content');
  container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';

  // Load or create profile
  profileData = await loadCoachProfile();
  profileInvoices = await loadProfileInvoices();

  renderProfile();
}

async function loadCoachProfile() {
  const { data, error } = await supabaseClient
    .from('coach_profiles')
    .select('*')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    handleError(error, 'loadCoachProfile');
    return null;
  }

  // Auto-create profile if it doesn't exist
  if (!data) {
    const newProfile = {
      user_id: currentUser.id,
      display_name: currentUser.email.split('@')[0],
      email: currentUser.email,
      plan: 'athlete',
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    };
    const { data: created, error: createErr } = await supabaseClient
      .from('coach_profiles')
      .insert(newProfile)
      .select()
      .single();
    if (createErr) handleError(createErr, 'createCoachProfile');
    return created || newProfile;
  }
  return data;
}

async function loadProfileInvoices() {
  const { data } = await supabaseClient
    .from('platform_invoices')
    .select('*')
    .eq('coach_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(12);
  return data || [];
}

function renderProfile() {
  const container = document.getElementById('profile-content');
  const p = profileData;
  if (!p) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Erreur chargement profil</p></div>';
    return;
  }

  const connectStatus = p.stripe_onboarding_complete && p.stripe_charges_enabled;
  const trialActive = p.trial_ends_at && new Date(p.trial_ends_at) > new Date();
  const trialDaysLeft = trialActive ? Math.ceil((new Date(p.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)) : 0;

  container.innerHTML = `
    <div class="section-header">
      <h1><i class="fas fa-user-cog"></i> Profil & Paramètres</h1>
    </div>

    <!-- INFOS PERSONNELLES -->
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header">
        <h3><i class="fas fa-user"></i> Informations personnelles</h3>
        <button class="btn btn-sm" onclick="profileEditInfo()"><i class="fas fa-pen"></i> Modifier</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px;">
        <div>
          <div style="color:var(--text3);font-size:13px;">Nom</div>
          <div style="font-weight:600;margin-top:4px;" id="profile-display-name">${escHtml(p.display_name || '')}</div>
        </div>
        <div>
          <div style="color:var(--text3);font-size:13px;">Email</div>
          <div style="font-weight:600;margin-top:4px;">${escHtml(p.email || currentUser.email)}</div>
        </div>
      </div>
    </div>

    <!-- STRIPE CONNECT -->
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header">
        <h3><i class="fas fa-credit-card"></i> Paiements</h3>
      </div>
      <div style="padding:16px;">
        <!-- Stripe du coach -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border);">
          <div>
            <div style="font-weight:600;">Mon Stripe</div>
            <div style="color:var(--text3);font-size:13px;">
              ${connectStatus
                ? '<span style="color:#22c55e;"><i class="fas fa-check-circle"></i> Connecté</span> — Les paiements de vos athlètes arrivent sur votre Stripe'
                : 'Connectez votre Stripe pour prélever vos athlètes'
              }
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            ${connectStatus
              ? `<button class="btn btn-sm" onclick="profileOpenDashboard()"><i class="fas fa-external-link-alt"></i> Dashboard</button>
                 <button class="btn btn-sm" onclick="profileDisconnectStripe()" style="color:#ef4444;border-color:#ef4444;"><i class="fas fa-unlink"></i> Déconnecter</button>`
              : `<button class="btn btn-sm btn-primary" onclick="profileConnectStripe()"><i class="fab fa-stripe-s"></i> Connecter mon Stripe</button>`
            }
          </div>
        </div>

        <!-- Abonnement SaaS -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border);">
          <div>
            <div style="font-weight:600;">Mon abonnement</div>
            <div style="color:var(--text3);font-size:13px;">
              ${p.plan === 'free'
                ? '<span style="color:#22c55e;font-weight:600;">Gratuit</span>'
                : `Plan ${p.plan === 'business' ? 'Business' : 'Athlète'}${trialActive ? ` — <span style="color:#f59e0b;">Essai gratuit (${trialDaysLeft}j restants)</span>` : ''}`
              }
            </div>
          </div>
          ${p.plan !== 'free' ? `
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-sm ${p.plan === 'business' ? '' : 'btn-primary'}" onclick="profileChangePlan()">
              ${p.plan === 'business' ? 'Passer en Athlète' : 'Passer en Business'}
            </button>
          </div>` : ''}
        </div>

        <!-- Carte bancaire -->
        ${p.plan !== 'free' ? `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;">
          <div>
            <div style="font-weight:600;">Carte bancaire</div>
            <div style="color:var(--text3);font-size:13px;">
              ${p.has_payment_method ? 'Carte enregistrée' : 'Aucune carte enregistrée'}
            </div>` : `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;">
          <div>
            <div style="font-weight:600;">Carte bancaire</div>
            <div style="color:var(--text3);font-size:13px;">Non requis (plan gratuit)</div>`}
          </div>
          <button class="btn btn-sm" id="btn-setup-card" onclick="profileSetupPaymentMethod()">
            <i class="fas fa-${p.has_payment_method ? 'pen' : 'plus'}"></i>
            ${p.has_payment_method ? 'Modifier' : 'Ajouter'}
          </button>
        </div>
        <div id="stripe-card-container" style="display:none;padding:16px 0;">
          <div id="stripe-payment-element" style="margin-bottom:12px;"></div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-red" id="btn-confirm-card" onclick="profileConfirmCard()">
              <i class="fas fa-check"></i> Confirmer
            </button>
            <button class="btn btn-outline" onclick="profileCancelCard()">Annuler</button>
          </div>
          <div id="stripe-card-error" style="color:#ef4444;font-size:13px;margin-top:8px;"></div>
        </div>
      </div>
    </div>

    <!-- FACTURES PLATEFORME -->
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header">
        <h3><i class="fas fa-file-invoice"></i> Mes factures</h3>
      </div>
      <div style="padding:16px;">
        ${profileInvoices.length === 0
          ? '<div style="color:var(--text3);text-align:center;padding:20px;">Aucune facture</div>'
          : `<table style="width:100%;font-size:14px;">
              <thead>
                <tr style="color:var(--text3);text-align:left;border-bottom:1px solid var(--border);">
                  <th style="padding:8px;">Période</th>
                  <th style="padding:8px;">Athlètes</th>
                  <th style="padding:8px;">Montant</th>
                  <th style="padding:8px;">Statut</th>
                </tr>
              </thead>
              <tbody>
                ${profileInvoices.map(inv => `
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:8px;">${getMonthName(inv.month)} ${inv.year}</td>
                    <td style="padding:8px;">${inv.athlete_count}</td>
                    <td style="padding:8px;font-weight:600;">${(inv.total_amount / 100).toFixed(2)}€</td>
                    <td style="padding:8px;">${profileInvoiceStatusBadge(inv.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
        }
      </div>
    </div>

    <!-- INTÉGRATIONS -->
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header">
        <h3><i class="fas fa-plug"></i> Intégrations</h3>
      </div>
      <div style="padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;">
          <div>
            <div style="font-weight:600;"><i class="fab fa-instagram" style="color:#E4405F;margin-right:8px;"></i>Instagram</div>
            <div style="color:var(--text3);font-size:13px;">Sync DMs, stories, publications</div>
          </div>
          <button class="btn btn-sm" onclick="showSection('business'); setTimeout(() => { document.querySelector('[onclick*=\\'instagram\\']')?.click(); }, 200);">
            Configurer
          </button>
        </div>
      </div>
    </div>

    <!-- PRÉFÉRENCES -->
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header">
        <h3><i class="fas fa-cog"></i> Préférences</h3>
      </div>
      <div style="padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border);">
          <div>
            <div style="font-weight:600;">Prorata athlètes</div>
            <div style="color:var(--text3);font-size:13px;">Rembourser au prorata si un athlète annule en milieu de mois</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" ${p.allow_prorata ? 'checked' : ''} onchange="profileToggleProrata(this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;">
          <div>
            <div style="font-weight:600;">Devise</div>
            <div style="color:var(--text3);font-size:13px;">Devise utilisée pour les paiements</div>
          </div>
          <select style="background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font-size:14px;"
            onchange="profileUpdateCurrency(this.value)">
            <option value="eur" ${p.currency === 'eur' ? 'selected' : ''}>EUR (€)</option>
            <option value="usd" ${p.currency === 'usd' ? 'selected' : ''}>USD ($)</option>
            <option value="gbp" ${p.currency === 'gbp' ? 'selected' : ''}>GBP (£)</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

// ── Helpers ──

function getMonthName(m) {
  return ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][m] || '';
}

function profileInvoiceStatusBadge(status) {
  const map = {
    paid: { label: 'Payé', color: '#22c55e' },
    pending: { label: 'En attente', color: '#f59e0b' },
    failed: { label: 'Échoué', color: '#ef4444' },
    retry_1: { label: 'Relance 1', color: '#f59e0b' },
    retry_2: { label: 'Relance 2', color: '#f97316' },
    retry_3: { label: 'Relance 3', color: '#ef4444' },
    blocked: { label: 'Bloqué', color: '#ef4444' },
  };
  const s = map[status] || { label: status, color: '#888' };
  return `<span style="color:${s.color};font-weight:600;font-size:13px;">${s.label}</span>`;
}

// ── Actions ──

async function profileEditInfo() {
  const name = prompt('Nom affiché :', profileData.display_name || '');
  if (name === null) return;
  const { error } = await supabaseClient
    .from('coach_profiles')
    .update({ display_name: name })
    .eq('user_id', currentUser.id);
  if (error) { handleError(error, 'profileEditInfo'); return; }
  profileData.display_name = name;
  document.getElementById('profile-display-name').textContent = name;
  document.getElementById('user-name').textContent = name;
  notify('Nom mis à jour', 'success');
}

async function profileConnectStripe() {
  try {
    notify('Redirection vers Stripe...', 'success');
    const resp = await authFetch('/api/stripe?action=connect-start', {
      method: 'POST',
      body: JSON.stringify({ coachId: currentUser.id, email: currentUser.email })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    if (data.url) window.location.href = data.url;
  } catch (err) {
    handleError(err, 'profileConnectStripe');
  }
}

async function profileOpenDashboard() {
  try {
    const resp = await authFetch('/api/stripe?action=connect-dashboard', {
      method: 'POST',
      body: JSON.stringify({ coachId: currentUser.id })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    if (data.url) window.open(data.url, '_blank');
  } catch (err) {
    handleError(err, 'profileOpenDashboard');
  }
}

async function profileDisconnectStripe() {
  if (!confirm('Déconnecter votre Stripe ? Vos athlètes ne pourront plus être prélevés.')) return;
  const { error } = await supabaseClient
    .from('coach_profiles')
    .update({
      stripe_onboarding_complete: false,
      stripe_charges_enabled: false,
    })
    .eq('user_id', currentUser.id);
  if (error) { handleError(error, 'profileDisconnectStripe'); return; }
  profileData.stripe_onboarding_complete = false;
  profileData.stripe_charges_enabled = false;
  renderProfile();
  notify('Stripe déconnecté', 'success');
}

// Check Connect status on page load (e.g., after returning from Stripe onboarding)
async function profileCheckConnectReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('connect') === 'complete') {
    try {
      const resp = await authFetch(`/api/stripe?action=connect-complete&coachId=${currentUser.id}`);
      const data = await resp.json();
      if (data.connected) {
        notify('Stripe connecté avec succès !', 'success');
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname + '#profile');
        loadProfile();
      } else if (data.details_submitted === false) {
        notify('Onboarding Stripe incomplet. Cliquez sur "Connecter" pour finaliser.', 'error');
      }
    } catch (e) { devError('[profile] connect-complete check failed', e); }
  }
}

// Called from showApp() in auth.js after login

async function profileImportSubs() {
  try {
    notify('Chargement de vos abonnements Stripe...', 'success');
    const resp = await authFetch('/api/stripe?action=import-subscriptions', {
      method: 'POST',
      body: JSON.stringify({ coachId: currentUser.id })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);

    if (!data.subscriptions?.length) {
      notify('Aucun abonnement actif trouvé sur votre Stripe', 'error');
      return;
    }

    // Show modal with subscriptions to import
    const subs = data.subscriptions;
    const modal = document.createElement('div');
    modal.id = 'import-subs-modal';
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation();" style="max-width:600px;">
        <div class="modal-header">
          <h2 class="modal-title">Importer des abonnements (${subs.length})</h2>
          <button class="modal-close" onclick="document.getElementById('import-subs-modal').remove()">×</button>
        </div>
        <div style="padding:16px;max-height:400px;overflow-y:auto;">
          ${subs.map((s, i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid var(--border);">
              <div>
                <div style="font-weight:600;">${escHtml(s.customer_name || s.customer_email || 'Client')}</div>
                <div style="color:var(--text3);font-size:13px;">${escHtml(s.customer_email || '')} — ${(s.amount / 100).toFixed(0)}€/${s.interval}</div>
              </div>
              <button class="btn btn-sm" id="import-btn-${i}" onclick="profileDoImport(${i})">
                <i class="fas fa-download"></i> Importer
              </button>
            </div>
          `).join('')}
        </div>
        <div style="padding:16px;text-align:right;">
          <button class="btn btn-red" onclick="profileImportAll()">Tout importer</button>
        </div>
      </div>
    `;
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);

    // Store subs for import
    window._importSubs = subs;
  } catch (err) {
    handleError(err, 'profileImportSubs');
  }
}

async function profileDoImport(index) {
  const sub = window._importSubs?.[index];
  if (!sub) return;

  const btn = document.getElementById(`import-btn-${index}`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

  try {
    // Find matching athlete by email
    const { data: athlete } = await supabaseClient
      .from('athletes')
      .select('id')
      .eq('coach_id', currentUser.id)
      .eq('email', sub.customer_email)
      .maybeSingle();

    // Upsert stripe_customers
    await supabaseClient.from('stripe_customers').upsert({
      stripe_customer_id: sub.customer_id,
      stripe_subscription_id: sub.subscription_id,
      coach_id: currentUser.id,
      athlete_id: athlete?.id || null,
      subscription_status: sub.status,
      monthly_amount: sub.amount,
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
    }, { onConflict: 'stripe_customer_id' });

    // Create/update payment plan if athlete matched
    if (athlete) {
      await supabaseClient.from('athlete_payment_plans').upsert({
        coach_id: currentUser.id,
        athlete_id: athlete.id,
        is_free: false,
        amount: sub.amount,
        currency: sub.currency,
        frequency: sub.interval,
        frequency_interval: sub.interval_count,
        payment_status: 'active',
        stripe_subscription_id: sub.subscription_id,
        stripe_customer_id: sub.customer_id,
      }, { onConflict: 'coach_id,athlete_id' });

      await supabaseClient.from('athlete_activity_log').insert({
        coach_id: currentUser.id, athlete_id: athlete.id, event: 'added',
      });
    }

    if (btn) { btn.innerHTML = '<i class="fas fa-check" style="color:#22c55e;"></i> OK'; }
    notify(`${sub.customer_name || sub.customer_email} importé`, 'success');
  } catch (err) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Importer'; }
    handleError(err, 'profileDoImport');
  }
}

async function profileImportAll() {
  const subs = window._importSubs || [];
  for (let i = 0; i < subs.length; i++) {
    await profileDoImport(i);
  }
  notify(`${subs.length} abonnements importés`, 'success');
}

async function profileChangePlan() {
  const newPlan = profileData.plan === 'business' ? 'athlete' : 'business';
  const confirmMsg = newPlan === 'business'
    ? 'Passer au plan Business (60€/mois + 5€/athlète) ?'
    : 'Passer au plan Athlète (5€/athlète uniquement) ?';
  if (!confirm(confirmMsg)) return;

  const { error } = await supabaseClient
    .from('coach_profiles')
    .update({ plan: newPlan })
    .eq('user_id', currentUser.id);
  if (error) { handleError(error, 'profileChangePlan'); return; }
  profileData.plan = newPlan;
  renderProfile();
  notify(`Plan changé en ${newPlan === 'business' ? 'Business' : 'Athlète'}`, 'success');
}

let _stripeInstance = null;
let _stripeElements = null;
let _stripeClientSecret = null;

async function profileSetupPaymentMethod() {
  const container = document.getElementById('stripe-card-container');
  const btn = document.getElementById('btn-setup-card');
  const errorEl = document.getElementById('stripe-card-error');
  if (!container) return;

  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Chargement...'; }
    if (errorEl) errorEl.textContent = '';

    const resp = await authFetch('/api/stripe?action=coach-setup', {
      method: 'POST',
      body: JSON.stringify({ coachId: currentUser.id, email: currentUser.email })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);

    _stripeClientSecret = data.clientSecret;
    _stripeInstance = Stripe(data.publishableKey);
    _stripeElements = _stripeInstance.elements({
      clientSecret: data.clientSecret,
      appearance: {
        theme: 'night',
        variables: { colorPrimary: '#B30808', colorBackground: '#18181b', colorText: '#f4f4f5', borderRadius: '8px' },
      },
    });

    const paymentElement = _stripeElements.create('payment');
    const mountPoint = document.getElementById('stripe-payment-element');
    mountPoint.replaceChildren();
    paymentElement.mount(mountPoint);

    container.style.display = 'block';
    if (btn) btn.style.display = 'none';
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Ajouter'; }
    handleError(err, 'profileSetupPaymentMethod');
  }
}

async function profileConfirmCard() {
  const confirmBtn = document.getElementById('btn-confirm-card');
  const errorEl = document.getElementById('stripe-card-error');
  if (!_stripeInstance || !_stripeElements || !_stripeClientSecret) return;

  try {
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Vérification...'; }
    if (errorEl) errorEl.textContent = '';

    const { error } = await _stripeInstance.confirmSetup({
      elements: _stripeElements,
      confirmParams: { return_url: window.location.origin + '?setup=success#profile' },
      redirect: 'if_required',
    });

    if (error) {
      if (errorEl) errorEl.textContent = error.message;
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Confirmer'; }
      return;
    }

    notify('Carte enregistrée avec succès', 'success');
    profileData.has_payment_method = true;
    profileCancelCard();
    renderProfile();
  } catch (err) {
    if (errorEl) errorEl.textContent = err.message;
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Confirmer'; }
  }
}

function profileCancelCard() {
  const container = document.getElementById('stripe-card-container');
  const btn = document.getElementById('btn-setup-card');
  if (container) container.style.display = 'none';
  if (btn) { btn.style.display = ''; btn.disabled = false; btn.textContent = profileData?.has_payment_method ? 'Modifier' : 'Ajouter'; }
  _stripeElements = null;
  _stripeClientSecret = null;
}

async function profileToggleProrata(enabled) {
  const { error } = await supabaseClient
    .from('coach_profiles')
    .update({ allow_prorata: enabled })
    .eq('user_id', currentUser.id);
  if (error) handleError(error, 'profileToggleProrata');
  else {
    profileData.allow_prorata = enabled;
    notify(enabled ? 'Prorata activé' : 'Prorata désactivé', 'success');
  }
}

async function profileUpdateCurrency(currency) {
  const { error } = await supabaseClient
    .from('coach_profiles')
    .update({ currency })
    .eq('user_id', currentUser.id);
  if (error) handleError(error, 'profileUpdateCurrency');
  else {
    profileData.currency = currency;
    notify('Devise mise à jour', 'success');
  }
}
