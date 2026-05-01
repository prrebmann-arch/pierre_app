-- ============================================================
-- Backfill bilan_retours.execution_video_id pour les retours
-- envoyés AVANT l'ajout de la colonne. On retrouve le lien via
-- la table notifications (push d'origine) où NouveauRetourPanel
-- mettait `video_id` en metadata.
--
-- Date: 2026-05-01
-- À exécuter APRÈS bilan_retours_execution_video_id.sql
-- ============================================================

-- Sanity check d'abord : combien de candidats ?
-- SELECT count(*) FROM bilan_retours br
-- JOIN notifications n
--   ON (n.metadata->>'retour_id')::uuid = br.id
-- WHERE br.execution_video_id IS NULL
--   AND n.metadata->>'video_id' IS NOT NULL;

UPDATE bilan_retours br
SET execution_video_id = (n.metadata->>'video_id')::uuid
FROM notifications n,
     execution_videos ev
WHERE (n.metadata->>'retour_id')::uuid = br.id
  AND n.metadata->>'video_id' IS NOT NULL
  -- Ne backfill que si l'execution_video existe encore ET appartient au
  -- même athlete (évite de lier vers un row supprimé / mauvais athlete).
  AND ev.id = (n.metadata->>'video_id')::uuid
  AND ev.athlete_id = br.athlete_id
  -- Et seulement les rows pas encore liés.
  AND br.execution_video_id IS NULL;

-- Verify (à lire dans le résultat) :
-- SELECT count(*) AS linked FROM bilan_retours WHERE execution_video_id IS NOT NULL;
-- SELECT count(*) AS still_unlinked FROM bilan_retours WHERE execution_video_id IS NULL;
