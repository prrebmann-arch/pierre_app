-- =====================================================
-- Template Anamnèse — Bilan initial coaching
-- Source : ANAMNÈSE CLIENT - LUCAS.C - ANAMNÈSE COACH 3.numbers
-- + 3 questions photo (face/profil/dos) qui se syncrho automatiquement
--   sur la page Bilans à la date de soumission.
-- =====================================================

-- À exécuter dans Supabase SQL Editor.
-- Le coach_id est résolu via l'email du coach (auth.users).

INSERT INTO questionnaire_templates (coach_id, titre, description, questions)
SELECT
  id,
  'Anamnèse — Bilan initial',
  'Questionnaire complet de début de coaching : mesures, digestion, transit, sommeil, stress, santé. À remplir par l''athlète à l''entrée en suivi.',
  $JSON$[
    {"id":"q01","label":"Poids actuel (kg)","type":"text","required":true},
    {"id":"q02","label":"Taille (cm)","type":"text","required":true},
    {"id":"q03","label":"Total de kcal moyennes consommées par jour","type":"text"},
    {"id":"q04","label":"Nombre de repas par jour","type":"choice","options":["1-2","3","4","5+"]},
    {"id":"q05","label":"Hydratation quotidienne (litres d'eau)","type":"text"},
    {"id":"q06","label":"Consommation de sel","type":"choice","options":["Faible","Modérée","Élevée"]},
    {"id":"q07","label":"Nombre de pas par jour en moyenne","type":"text"},
    {"id":"q08","label":"Nombre de séances sportives par semaine","type":"choice","options":["0","1-2","3-4","5+"]},
    {"id":"q09","label":"Quel est ton emploi / activité professionnelle ?","type":"text"},
    {"id":"q10","label":"Pathologies présentes (diagnostiquées ou non)","type":"text"},

    {"id":"q11","label":"Comment se passe ta digestion en général ?","type":"text"},
    {"id":"q12","label":"As-tu des ballonnements ?","type":"yesno"},
    {"id":"q13","label":"Ressens-tu des lourdeurs digestives après les repas ?","type":"yesno"},
    {"id":"q14","label":"As-tu des reflux ou remontées acides ?","type":"yesno"},
    {"id":"q15","label":"As-tu des nausées ?","type":"yesno"},
    {"id":"q16","label":"Te sens-tu fatigué(e) après les repas ?","type":"yesno"},
    {"id":"q17","label":"Intolérances alimentaires connues (lactose, gluten, autre) ?","type":"text"},
    {"id":"q18","label":"Décris tes habitudes alimentaires (un repas type)","type":"text"},
    {"id":"q19","label":"Prends-tu des compléments alimentaires ? Si oui, lesquels ?","type":"text"},
    {"id":"q20","label":"Consommes-tu des prébiotiques (fibres fermentescibles) ?","type":"yesno"},
    {"id":"q21","label":"Consommation de fibres","type":"choice","options":["Peu","Modéré","Beaucoup"]},
    {"id":"q22","label":"Mode de mastication","type":"choice","options":["Rapide","Normal","Lent et conscient"]},

    {"id":"q23","label":"Comment se passe ton transit ?","type":"text"},
    {"id":"q24","label":"Fréquence des selles","type":"choice","options":["Plusieurs/jour","1/jour","Tous les 2-3 jours","Plus rare"]},
    {"id":"q25","label":"Présence de symptômes (douleurs, alternance constipation/diarrhée…)","type":"text"},
    {"id":"q26","label":"Prends-tu des prébiotiques ou probiotiques ?","type":"yesno"},
    {"id":"q27","label":"Sensation de vidange incomplète après être allé(e) aux toilettes ?","type":"yesno"},
    {"id":"q28","label":"Suis-tu un régime alimentaire particulier ?","type":"text"},
    {"id":"q29","label":"Décris ton activité physique (type, fréquence, intensité)","type":"text"},

    {"id":"q30","label":"Qualité de ton sommeil sur 10","type":"rating"},
    {"id":"q31","label":"Régularité des heures de coucher / lever","type":"choice","options":["Très régulier","Variable","Très irrégulier"]},
    {"id":"q32","label":"As-tu des difficultés à te lever le matin ?","type":"yesno"},
    {"id":"q33","label":"Décris ta routine avant le coucher","type":"text"},
    {"id":"q34","label":"As-tu des réveils nocturnes ?","type":"yesno"},

    {"id":"q35","label":"Niveau de stress ressenti sur 10","type":"rating"},
    {"id":"q36","label":"D''où vient principalement ton stress ?","type":"text"},
    {"id":"q37","label":"Comment gères-tu ton stress ?","type":"text"},

    {"id":"q38","label":"Comment se passent ta vie pro, sociale et familiale ?","type":"text"},
    {"id":"q39","label":"Te sens-tu posé(e) ou anxieux(se) chez toi ?","type":"choice","options":["Posé(e)","Mixte","Anxieux(se)"]},
    {"id":"q40","label":"Te sens-tu soutenu(e) par ton entourage sur 10","type":"rating"},

    {"id":"q41","label":"Comment étaient tes cycles avant contraception ? (si applicable)","type":"text"},
    {"id":"q42","label":"Durée des cycles (en jours)","type":"text"},
    {"id":"q43","label":"Symptômes pré-menstruels","type":"text"},
    {"id":"q44","label":"Type de contraception actuelle","type":"text"},
    {"id":"q45","label":"Changements ressentis depuis la contraception","type":"text"},
    {"id":"q46","label":"Comment décris-tu ton flux menstruel ?","type":"choice","options":["Léger","Moyen","Abondant","Non applicable"]},
    {"id":"q47","label":"Ressens-tu l''ovulation ?","type":"yesno"},
    {"id":"q48","label":"Impact hormonal ressenti (humeur, peau, énergie)","type":"text"},
    {"id":"q49","label":"Niveau de libido sur 10","type":"rating"},

    {"id":"q50","label":"As-tu des allergies ?","type":"text"},
    {"id":"q51","label":"Tombes-tu souvent malade ?","type":"yesno"},
    {"id":"q52","label":"Temps de guérison habituel","type":"text"},
    {"id":"q53","label":"Perte de cheveux ?","type":"yesno"},
    {"id":"q54","label":"Problèmes de concentration ?","type":"yesno"},
    {"id":"q55","label":"Supplémentations et traitements passés","type":"text"},
    {"id":"q56","label":"Historique familial (pathologies, allergies, prédispositions)","type":"text"},

    {"id":"q57","label":"Photo de face","type":"photo","position":"front","required":true},
    {"id":"q58","label":"Photo de profil","type":"photo","position":"side","required":true},
    {"id":"q59","label":"Photo de dos","type":"photo","position":"back","required":true}
  ]$JSON$::jsonb
FROM auth.users
WHERE email = 'pr.rebmann@gmail.com'
LIMIT 1;
