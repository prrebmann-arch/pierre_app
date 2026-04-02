// ===== BUSINESS — AUTOMATISATIONS =====

let _autoStep = 0;
let _autoData = { name: '', trigger_type: 'dm', messages: [{ text: '', delay: 0 }] };

async function bizRenderAutomations() {
  const el = document.getElementById('biz-tab-content');
  el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const { data: automations } = await supabaseClient.from('automations')
    .select('*, automation_messages(*)').eq('user_id', currentUser.id).order('created_at', { ascending: false });

  window._bizAutomations = automations || [];

  if (!automations?.length) {
    el.innerHTML = `
      <div style="text-align:center;padding:60px;">
        <i class="fas fa-robot" style="font-size:48px;color:var(--text3);margin-bottom:16px;display:block;opacity:0.4;"></i>
        <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:8px;">C'est vide ici</div>
        <div style="font-size:13px;color:var(--text3);margin-bottom:20px;">Créez une automatisation pour répondre automatiquement aux DMs et commentaires</div>
        <button class="btn btn-red" onclick="bizStartAutoWizard()"><i class="fas fa-plus" style="margin-right:6px;"></i>Nouvelle Automatisation</button>
      </div>`;
    return;
  }

  const rows = automations.map(a => {
    const msgs = a.automation_messages || [];
    const triggerLabel = a.trigger_type === 'dm' ? 'DM reçu' : a.trigger_type === 'comment_reply' ? 'Commentaire' : 'Story reply';
    const triggerIcon = a.trigger_type === 'dm' ? 'fa-comment' : a.trigger_type === 'comment_reply' ? 'fa-comments' : 'fa-circle';
    return `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:40px;height:40px;border-radius:10px;background:${a.is_active ? 'rgba(34,197,94,0.12)' : 'var(--bg4)'};display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-robot" style="color:${a.is_active ? 'var(--success)' : 'var(--text3)'};"></i>
          </div>
          <div>
            <div style="font-weight:600;font-size:14px;color:var(--text);">${escHtml(a.name)}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px;">
              <i class="fas ${triggerIcon}" style="margin-right:4px;"></i>${triggerLabel}
              ${a.trigger_keyword ? ` · mot-clé: "${escHtml(a.trigger_keyword)}"` : ''}
              · ${msgs.length} message${msgs.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <label class="toggle-switch">
            <input type="checkbox" ${a.is_active ? 'checked' : ''} onchange="bizToggleAuto('${a.id}',this.checked)">
            <span class="switch"></span>
          </label>
          <button class="nd2-btn nd2-btn-del" onclick="bizDeleteAuto('${a.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
      <button class="btn btn-red btn-sm" onclick="bizStartAutoWizard()"><i class="fas fa-plus"></i> Nouvelle Automatisation</button>
    </div>
    ${rows}`;
}

async function bizToggleAuto(id, on) {
  await supabaseClient.from('automations').update({ is_active: on }).eq('id', id);
  notify(on ? 'Automatisation activée' : 'Automatisation désactivée', 'success');
}

async function bizDeleteAuto(id) {
  if (!confirm('Supprimer cette automatisation ?')) return;
  await supabaseClient.from('automations').delete().eq('id', id);
  notify('Automatisation supprimée', 'success');
  bizRenderAutomations();
}

// ── Wizard 4 étapes ──
function bizStartAutoWizard() {
  _autoStep = 1;
  _autoData = { name: '', trigger_type: 'dm', trigger_keyword: '', messages: [{ text: '', delay: 0 }] };
  _renderAutoWizard();
}

function _renderAutoWizard() {
  const el = document.getElementById('biz-tab-content');

  if (_autoStep === 1) {
    el.innerHTML = `
      <div style="max-width:500px;margin:0 auto;padding:40px 0;">
        <div style="font-size:12px;color:var(--text3);margin-bottom:8px;">Étape 1/4</div>
        <h2 style="font-size:20px;font-weight:700;margin-bottom:20px;">Nommez votre automatisation</h2>
        <input type="text" id="auto-name" class="bt-input" placeholder="Ex: New Customer outreach" value="${escHtml(_autoData.name)}" style="font-size:15px;padding:14px;">
        <div style="display:flex;gap:8px;margin-top:24px;">
          <button class="btn btn-outline" onclick="bizRenderAutomations()">Annuler</button>
          <button class="btn btn-red" onclick="_autoData.name=document.getElementById('auto-name').value.trim();if(!_autoData.name){notify('Nom obligatoire','error');return;}_autoStep=2;_renderAutoWizard()">Continuer</button>
        </div>
      </div>`;
  }

  else if (_autoStep === 2) {
    const opt = (type, icon, label) => `
      <label class="biz-auto-trigger ${_autoData.trigger_type===type?'active':''}" onclick="_autoData.trigger_type='${type}';document.querySelectorAll('.biz-auto-trigger').forEach(t=>t.classList.remove('active'));this.classList.add('active')">
        <i class="fas ${icon}" style="font-size:20px;"></i>
        <span>${label}</span>
      </label>`;
    el.innerHTML = `
      <div style="max-width:500px;margin:0 auto;padding:40px 0;">
        <div style="font-size:12px;color:var(--text3);margin-bottom:8px;">Étape 2/4</div>
        <h2 style="font-size:20px;font-weight:700;margin-bottom:20px;">Quand déclencher ?</h2>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${opt('dm', 'fa-comment', 'Quelqu\'un m\'envoie un DM')}
          ${opt('comment_reply', 'fa-comments', 'Quelqu\'un commente un post ou reel')}
          ${opt('story_reply', 'fa-circle', 'Quelqu\'un répond à ma story')}
        </div>
        <div style="margin-top:16px;">
          <input type="text" id="auto-keyword" class="bt-input" placeholder="Mot-clé déclencheur (optionnel)" value="${escHtml(_autoData.trigger_keyword||'')}">
        </div>
        <div style="display:flex;gap:8px;margin-top:24px;">
          <button class="btn btn-outline" onclick="_autoStep=1;_renderAutoWizard()">Retour</button>
          <button class="btn btn-red" onclick="_autoData.trigger_keyword=document.getElementById('auto-keyword')?.value?.trim()||'';_autoStep=3;_renderAutoWizard()">Continuer</button>
        </div>
      </div>`;
  }

  else if (_autoStep === 3) {
    const delays = [
      { v: 0, l: 'Aucun' }, { v: 60, l: '1 minute' }, { v: 300, l: '5 minutes' },
      { v: 900, l: '15 minutes' }, { v: 1800, l: '30 minutes' }, { v: 3600, l: '1 heure' },
      { v: 7200, l: '2 heures' }, { v: 86400, l: '1 jour' },
    ];
    const msgsHtml = _autoData.messages.map((m, i) => `
      <div style="background:var(--bg3);border-radius:10px;padding:14px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:600;color:var(--text3);">Message ${i + 1}</span>
          ${i > 0 ? `<button class="nd2-btn nd2-btn-del" onclick="_autoData.messages.splice(${i},1);_renderAutoWizard()"><i class="fas fa-times"></i></button>` : ''}
        </div>
        <textarea class="bt-input auto-msg-text" rows="3" placeholder="Votre message..." style="margin-bottom:8px;">${escHtml(m.text)}</textarea>
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Délai</div>
        <select class="bt-input auto-msg-delay">
          ${delays.map(d => `<option value="${d.v}" ${m.delay===d.v?'selected':''}>${d.l}</option>`).join('')}
        </select>
      </div>`).join('');

    el.innerHTML = `
      <div style="max-width:500px;margin:0 auto;padding:40px 0;">
        <div style="font-size:12px;color:var(--text3);margin-bottom:8px;">Étape 3/4</div>
        <h2 style="font-size:20px;font-weight:700;margin-bottom:20px;">Message de réponse</h2>
        ${msgsHtml}
        <button class="btn btn-outline btn-sm" onclick="_autoData.messages.push({text:'',delay:0});_renderAutoWizard()" style="margin-bottom:16px;"><i class="fas fa-plus"></i> Ajouter un message</button>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-outline" onclick="_autoStep=2;_renderAutoWizard()">Retour</button>
          <button class="btn btn-red" onclick="_collectAutoMsgs();_autoStep=4;_renderAutoWizard()">Continuer</button>
        </div>
      </div>`;
  }

  else if (_autoStep === 4) {
    const triggerLabel = _autoData.trigger_type === 'dm' ? 'DM reçu' : _autoData.trigger_type === 'comment_reply' ? 'Commentaire' : 'Story reply';
    el.innerHTML = `
      <div style="max-width:500px;margin:0 auto;padding:40px 0;">
        <div style="font-size:12px;color:var(--text3);margin-bottom:8px;">Étape 4/4</div>
        <h2 style="font-size:20px;font-weight:700;margin-bottom:20px;">Confirmation</h2>
        <div style="background:var(--bg3);border-radius:10px;padding:20px;">
          <div style="margin-bottom:12px;"><span style="font-size:11px;color:var(--text3);">Nom</span><div style="font-weight:600;">${escHtml(_autoData.name)}</div></div>
          <div style="margin-bottom:12px;"><span style="font-size:11px;color:var(--text3);">Déclencheur</span><div style="font-weight:600;">${triggerLabel}${_autoData.trigger_keyword ? ` (mot-clé: "${escHtml(_autoData.trigger_keyword)}")` : ''}</div></div>
          <div><span style="font-size:11px;color:var(--text3);">Messages</span><div style="font-weight:600;">${_autoData.messages.length} message${_autoData.messages.length > 1 ? 's' : ''}</div></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:24px;">
          <button class="btn btn-outline" onclick="_autoStep=3;_renderAutoWizard()">Retour</button>
          <button class="btn btn-red" onclick="bizCreateAutomation()"><i class="fas fa-check" style="margin-right:4px;"></i>Créer l'automatisation</button>
        </div>
      </div>`;
  }
}

function _collectAutoMsgs() {
  const texts = document.querySelectorAll('.auto-msg-text');
  const delays = document.querySelectorAll('.auto-msg-delay');
  _autoData.messages = Array.from(texts).map((t, i) => ({
    text: t.value.trim(),
    delay: parseInt(delays[i]?.value) || 0,
  })).filter(m => m.text);
  if (!_autoData.messages.length) _autoData.messages = [{ text: '', delay: 0 }];
}

async function bizCreateAutomation() {
  const { data: auto, error: e1 } = await supabaseClient.from('automations').insert({
    user_id: currentUser.id,
    name: _autoData.name,
    trigger_type: _autoData.trigger_type,
    trigger_keyword: _autoData.trigger_keyword || null,
    is_active: true,
  }).select().single();
  if (e1 || !auto) { handleError(e1, 'automations'); return; }

  // Insert messages
  const msgs = _autoData.messages.filter(m => m.text).map((m, i) => ({
    automation_id: auto.id,
    message_text: m.text,
    delay_seconds: m.delay,
    position: i + 1,
  }));
  if (msgs.length) {
    const { error: e2 } = await supabaseClient.from('automation_messages').insert(msgs);
    if (e2) { handleError(e2, 'automations'); }
  }

  notify('Automatisation créée !', 'success');
  bizRenderAutomations();
}
