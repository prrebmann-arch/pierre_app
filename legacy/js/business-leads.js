// ===== BUSINESS — LEADS CRM =====

const BIZ_LEAD_STATUSES = {
  new_lead:     { label: 'New lead',     color: '#ef4444', icon: 'fa-circle' },
  in_contact:   { label: 'In contact',   color: '#3b82f6', icon: 'fa-comment' },
  qualified:    { label: 'Qualified',     color: '#f59e0b', icon: 'fa-star' },
  unqualified:  { label: 'Unqualified',  color: '#6b7280', icon: 'fa-times' },
  call_booked:  { label: 'Call booked',  color: '#8b5cf6', icon: 'fa-calendar' },
  deposit:      { label: 'Deposit',      color: '#10b981', icon: 'fa-money-bill' },
  won:          { label: 'Won',          color: '#22c55e', icon: 'fa-check' },
  lost:         { label: 'Lost',         color: '#ef4444', icon: 'fa-ban' },
  no_show:      { label: 'No show',      color: '#f97316', icon: 'fa-user-slash' },
};

let _leadsFilter = { status: '', source: '', search: '' };

async function bizRenderLeads() {
  const el = document.getElementById('biz-tab-content');
  el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const { data: leads } = await supabaseClient.from('leads').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  window._bizLeads = leads || [];

  _renderLeadsView(el);
}

function _renderLeadsView(el) {
  if (!el) el = document.getElementById('biz-tab-content');
  const allLeads = window._bizLeads || [];

  // Apply filters
  let filtered = allLeads;
  if (_leadsFilter.status) filtered = filtered.filter(l => l.status === _leadsFilter.status);
  if (_leadsFilter.source) filtered = filtered.filter(l => l.source === _leadsFilter.source);
  if (_leadsFilter.search) {
    const s = _leadsFilter.search.toLowerCase();
    filtered = filtered.filter(l => (l.name||'').toLowerCase().includes(s) || (l.instagram_handle||'').toLowerCase().includes(s));
  }

  // Status counts
  const counts = {};
  allLeads.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });

  // Filters bar
  const statusOpts = Object.entries(BIZ_LEAD_STATUSES).map(([k, v]) =>
    `<option value="${k}" ${_leadsFilter.status===k?'selected':''}>${v.label} (${counts[k]||0})</option>`
  ).join('');

  const filtersHtml = `
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
      <input type="text" placeholder="Rechercher..." value="${escHtml(_leadsFilter.search)}" oninput="_leadsFilter.search=this.value;_renderLeadsView()" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:12px;width:200px;">
      <select onchange="_leadsFilter.status=this.value;_renderLeadsView()" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:12px;">
        <option value="">Tous les statuts (${allLeads.length})</option>
        ${statusOpts}
      </select>
      <select onchange="_leadsFilter.source=this.value;_renderLeadsView()" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:12px;">
        <option value="">Toutes sources</option>
        <option value="dm" ${_leadsFilter.source==='dm'?'selected':''}>DM</option>
        <option value="comment" ${_leadsFilter.source==='comment'?'selected':''}>Commentaire</option>
        <option value="story_reply" ${_leadsFilter.source==='story_reply'?'selected':''}>Story</option>
        <option value="outbound" ${_leadsFilter.source==='outbound'?'selected':''}>Outbound</option>
        <option value="manual" ${_leadsFilter.source==='manual'?'selected':''}>Manuel</option>
      </select>
      <div style="flex:1;"></div>
      <button class="btn btn-red btn-sm" onclick="bizAddLead()"><i class="fas fa-plus"></i> Nouveau lead</button>
    </div>`;

  // Table
  const rows = filtered.map(l => {
    const st = BIZ_LEAD_STATUSES[l.status] || BIZ_LEAD_STATUSES.new_lead;
    const date = new Date(l.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const msgBadge = l.message_count ? `<span style="background:#3b82f6;color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:10px;margin-left:6px;">${l.message_count}</span>` : '';
    const tags = (l.tags || []).map(t => `<span style="font-size:9px;padding:1px 6px;border-radius:8px;background:var(--bg4);color:var(--text3);margin-right:3px;">${escHtml(t)}</span>`).join('');

    return `
      <tr class="nd-tr" onclick="bizEditLead('${l.id}')">
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:32px;height:32px;border-radius:8px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--text2);flex-shrink:0;">${escHtml((l.name||'?')[0].toUpperCase())}</div>
            <div>
              <span style="font-weight:600;color:var(--text);">${escHtml(l.name)}</span>${msgBadge}
              ${l.instagram_handle ? `<div style="font-size:10px;color:var(--text3);">@${escHtml(l.instagram_handle)}</div>` : ''}
            </div>
          </div>
        </td>
        <td><span style="font-size:11px;padding:3px 10px;border-radius:12px;background:${st.color}20;color:${st.color};font-weight:600;white-space:nowrap;"><i class="fas ${st.icon}" style="margin-right:3px;font-size:8px;"></i>${st.label}</span></td>
        <td style="font-size:11px;">${tags}</td>
        <td style="font-size:11px;color:var(--text3);">${l.source || '—'}</td>
        <td style="font-size:11px;color:var(--text3);">${date}</td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    ${filtersHtml}
    <div class="nd-table-wrap">
      <table class="nd-table">
        <thead><tr>
          <th>Lead</th><th>Statut</th><th>Tags</th><th>Source</th><th>Date</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text3);">Aucun lead</td></tr>'}</tbody>
      </table>
    </div>`;
}

function bizAddLead() {
  const popup = document.createElement('div');
  popup.id = 'biz-lead-modal';
  popup.className = 'bt-popup-overlay';
  popup.onclick = e => { if (e.target === popup) popup.remove(); };
  popup.innerHTML = `
    <div class="bt-popup" style="width:440px;">
      <div class="bt-popup-header">
        <span style="font-weight:700;">Nouveau lead</span>
        <button class="bt-close" onclick="document.getElementById('biz-lead-modal')?.remove()"><i class="fas fa-times"></i></button>
      </div>
      <div class="bt-popup-body" style="display:flex;flex-direction:column;gap:10px;">
        <input type="text" id="lead-name" placeholder="Nom *" class="bt-input">
        <input type="text" id="lead-ig" placeholder="@instagram (optionnel)" class="bt-input">
        <input type="email" id="lead-email" placeholder="Email (optionnel)" class="bt-input">
        <input type="tel" id="lead-phone" placeholder="Téléphone (optionnel)" class="bt-input">
        <select id="lead-source" class="bt-input">
          <option value="dm">DM</option>
          <option value="comment">Commentaire</option>
          <option value="story_reply">Story reply</option>
          <option value="outbound">Outbound</option>
          <option value="manual">Manuel</option>
        </select>
        <textarea id="lead-notes" placeholder="Notes" class="bt-input" rows="2"></textarea>
      </div>
      <div class="bt-popup-footer">
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('biz-lead-modal')?.remove()">Annuler</button>
        <button class="btn btn-red" onclick="bizSaveLead()"><i class="fas fa-plus" style="margin-right:4px;"></i>Ajouter</button>
      </div>
    </div>`;
  document.body.appendChild(popup);
}

async function bizSaveLead() {
  const name = document.getElementById('lead-name')?.value?.trim();
  if (!name) { notify('Nom obligatoire', 'error'); return; }

  const { error } = await supabaseClient.from('leads').insert({
    user_id: currentUser.id,
    name,
    instagram_handle: document.getElementById('lead-ig')?.value?.trim() || null,
    email: document.getElementById('lead-email')?.value?.trim() || null,
    phone: document.getElementById('lead-phone')?.value?.trim() || null,
    source: document.getElementById('lead-source')?.value || 'manual',
    notes: document.getElementById('lead-notes')?.value?.trim() || null,
    status: 'new_lead',
  });
  if (error) { handleError(error, 'leads'); return; }

  document.getElementById('biz-lead-modal')?.remove();
  notify('Lead ajouté !', 'success');
  bizRenderLeads();
}

function bizEditLead(leadId) {
  const lead = (window._bizLeads || []).find(l => l.id === leadId);
  if (!lead) return;

  const statusOpts = Object.entries(BIZ_LEAD_STATUSES).map(([k, v]) =>
    `<option value="${k}" ${lead.status===k?'selected':''}>${v.label}</option>`
  ).join('');

  const popup = document.createElement('div');
  popup.id = 'biz-lead-modal';
  popup.className = 'bt-popup-overlay';
  popup.onclick = e => { if (e.target === popup) popup.remove(); };
  popup.innerHTML = `
    <div class="bt-popup" style="width:440px;">
      <div class="bt-popup-header">
        <span style="font-weight:700;">${escHtml(lead.name)}</span>
        <button class="bt-close" onclick="document.getElementById('biz-lead-modal')?.remove()"><i class="fas fa-times"></i></button>
      </div>
      <div class="bt-popup-body" style="display:flex;flex-direction:column;gap:10px;">
        <select id="lead-edit-status" class="bt-input">${statusOpts}</select>
        <input type="text" id="lead-edit-ig" value="${escHtml(lead.instagram_handle||'')}" placeholder="@instagram" class="bt-input">
        <input type="email" id="lead-edit-email" value="${escHtml(lead.email||'')}" placeholder="Email" class="bt-input">
        <input type="tel" id="lead-edit-phone" value="${escHtml(lead.phone||'')}" placeholder="Téléphone" class="bt-input">
        <textarea id="lead-edit-notes" class="bt-input" rows="3" placeholder="Notes">${escHtml(lead.notes||'')}</textarea>
      </div>
      <div class="bt-popup-footer">
        <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="bizDeleteLead('${lead.id}')"><i class="fas fa-trash"></i></button>
        <div style="flex:1;"></div>
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('biz-lead-modal')?.remove()">Annuler</button>
        <button class="btn btn-red" onclick="bizUpdateLead('${lead.id}')"><i class="fas fa-check" style="margin-right:4px;"></i>Sauvegarder</button>
      </div>
    </div>`;
  document.body.appendChild(popup);
}

async function bizUpdateLead(id) {
  const { error } = await supabaseClient.from('leads').update({
    status: document.getElementById('lead-edit-status')?.value || 'new_lead',
    instagram_handle: document.getElementById('lead-edit-ig')?.value?.trim() || null,
    email: document.getElementById('lead-edit-email')?.value?.trim() || null,
    phone: document.getElementById('lead-edit-phone')?.value?.trim() || null,
    notes: document.getElementById('lead-edit-notes')?.value?.trim() || null,
  }).eq('id', id);
  if (error) { handleError(error, 'leads'); return; }
  document.getElementById('biz-lead-modal')?.remove();
  notify('Lead mis à jour !', 'success');
  bizRenderLeads();
}

async function bizDeleteLead(id) {
  if (!confirm('Supprimer ce lead ?')) return;
  await supabaseClient.from('leads').delete().eq('id', id);
  document.getElementById('biz-lead-modal')?.remove();
  notify('Lead supprimé', 'success');
  bizRenderLeads();
}
