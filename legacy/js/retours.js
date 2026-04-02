// ===== RETOURS VIDÉO =====

async function loadAthleteTabRetours() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const { data: retours } = await supabaseClient
    .from('bilan_retours')
    .select('*')
    .eq('athlete_id', currentAthleteId)
    .order('created_at', { ascending: false });

  const list = retours || [];

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="font-size:18px;font-weight:600;">Retours vidéo envoyés</h2>
      <button class="btn btn-red" onclick="openModal('modal-retour-video')">
        <i class="fas fa-video"></i> Envoyer un retour vidéo
      </button>
    </div>`;

  if (list.length) {
    list.forEach(r => {
      const date = new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const icon = r.audio_url && !r.loom_url ? 'fa-microphone' : r.loom_url ? 'fa-video' : 'fa-comment';
      const audioHtml = r.audio_url ? `<div style="margin-top:6px;"><audio controls src="${escHtml(r.audio_url)}" style="height:28px;max-width:250px;"></audio></div>` : '';
      const loomBtn = r.loom_url ? `<a href="${escHtml(r.loom_url)}" target="_blank" class="btn btn-outline btn-sm"><i class="fas fa-external-link-alt"></i> Voir</a>` : '';
      html += `
        <div style="background:var(--bg2);border:var(--card-border);border-radius:var(--radius);padding:16px;margin-bottom:10px;display:flex;align-items:flex-start;justify-content:space-between;">
          <div style="display:flex;align-items:flex-start;gap:14px;">
            <div style="width:40px;height:40px;border-radius:10px;background:rgba(179,8,8,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i class="fas ${icon}" style="color:var(--primary);"></i>
            </div>
            <div>
              <div style="font-weight:600;font-size:14px;">${escHtml(r.titre || 'Retour bilan')}</div>
              ${r.commentaire ? `<div style="font-size:12px;color:var(--text2);margin-top:2px;">${escHtml(r.commentaire)}</div>` : ''}
              ${audioHtml}
              <div style="font-size:11px;color:var(--text3);margin-top:4px;">${date}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            ${loomBtn}
            <button class="btn btn-outline btn-sm" onclick="deleteRetour('${r.id}')" style="color:var(--danger);"><i class="fas fa-trash"></i></button>
          </div>
        </div>`;
    });
  } else {
    html += `
      <div style="text-align:center;padding:60px;color:var(--text3);">
        <i class="fas fa-video" style="font-size:32px;margin-bottom:12px;opacity:0.4;display:block;"></i>
        <div style="font-size:14px;">Aucun retour vidéo envoyé</div>
      </div>`;
  }

  el.innerHTML = html;
}

async function submitRetourVideo() {
  const loomUrl = document.getElementById('retour-loom-url').value.trim();
  if (!loomUrl) { notify('L\'URL Loom est obligatoire', 'error'); return; }

  const titre = document.getElementById('retour-titre').value.trim() || 'Retour bilan';
  const commentaire = document.getElementById('retour-commentaire').value.trim() || null;

  const { error } = await supabaseClient.from('bilan_retours').insert({
    athlete_id: currentAthleteId,
    coach_id: currentUser.id,
    loom_url: loomUrl,
    titre,
    commentaire
  });
  if (error) { handleError(error, 'retours'); return; }

  // Notify athlete
  if (currentAthleteObj?.user_id) {
    const _t = 'Nouveau retour vidéo';
    const _b = `Votre coach vous a envoyé un retour : ${titre}`;
    const meta = { loom_url: loomUrl, titre };
    await supabaseClient.from('notifications').insert({
      user_id: currentAthleteObj.user_id, type: 'retour', title: _t, body: _b, metadata: meta
    });
    await sendExpoPush([currentAthleteObj.user_id], _t, _b, { type: 'retour', ...meta });
  }

  closeModal('modal-retour-video');
  document.getElementById('retour-form').reset();
  notify('Retour vidéo envoyé !', 'success');
  loadAthleteTabRetours();
}

async function deleteRetour(id) {
  if (!confirm('Supprimer ce retour vidéo ?')) return;
  const { error } = await supabaseClient.from('bilan_retours').delete().eq('id', id);
  if (error) { handleError(error, 'retours'); return; }
  notify('Retour supprimé', 'success');
  loadAthleteTabRetours();
}
