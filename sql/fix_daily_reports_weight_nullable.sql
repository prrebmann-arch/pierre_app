-- Rend la colonne weight nullable dans daily_reports.
-- Raison : un bilan peut être créé sans poids (ex: import photos seules,
-- ou athlète qui remplit énergie/sommeil sans peser). L'app athlete envoie
-- déjà weight=null dans ce cas, donc cette contrainte cause des fails silencieux.

ALTER TABLE daily_reports ALTER COLUMN weight DROP NOT NULL;
