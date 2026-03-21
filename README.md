# Pierre Coaching - App Coach 🏋️‍♂️

Application web pour les coaches de fitness et musculation. Gérez vos athlètes, programmes d'entraînement, nutrition et bilans de performance en temps réel.

## 🎯 Fonctionnalités principales

### Gestion des Athlètes
- ➕ Ajouter des athlètes (création auto d'un compte)
- 👤 Profil athlète avec objectifs et mesures
- 📱 Génération de message WhatsApp avec identifiants
- 🗑️ Suppression en cascade (athlète + toutes ses données)

### Programmes d'Entraînement
- 📋 Création de programmes (pattern ou jours fixes)
- 💪 Gestion des séances (exercises, séries, reps, charge)
- 👁️ Vue détail avec résumé (exercices, séries totales)
- ✏️ Édition inline avec autocomplete des exercices
- 🔄 Copie depuis templates

### Nutrition
- 🍽️ Plans nutritionnels par type (entraînement/repos)
- 🥗 Gestion des repas avec macronutriments
- 📊 Calcul automatique des totaux (kcal, protéines, glucides, lipides)
- 🎯 Objectifs caloriques et macro

### Bilans & Suivi
- 📈 Bilans quotidiens (poids, sommeil, stress, énergie)
- 📊 Graphiques de performance
- 💭 Notes d'adhérence et ressenti
- 🎯 Mesures (tour de ventre, hanche, cuisse)

### Design & UX
- 🌙 Dark theme optimisé
- 📱 Responsive (mobile/tablet/desktop)
- ⚡ Interface rapide et intuitive
- 🔴 Couleur primaire rouge (#B30808)

---

## 🚀 Setup & Installation

### 1. Prérequis
- Supabase account (https://supabase.com)
- Vercel account (https://vercel.com)
- Clés API Supabase

### 2. Configuration Supabase

Récupérer vos credentials:
```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

### 3. Lancer localement

```bash
# Naviguer au dossier
cd "COACH APP"

# Serveur local (Python)
python -m http.server 3000

# Ou avec Node
npx http-server -p 3000

# App disponible: http://localhost:3000
```

### 4. Déployer sur Vercel

```bash
vercel deploy
```

---

## 📊 Architecture Base de Données

### Authentification
```sql
-- Table native Supabase Auth (auth.users)
-- Email, password, metadata (prenom, nom)
```

### Coaches & Athlètes
```sql
-- coaches → utilisés dans auth.users
-- athletes (athlète spécifique d'un coach)
```

### Tables Principales

#### `athletes`
```sql
CREATE TABLE athletes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL,
  prenom TEXT,
  nom TEXT,
  email TEXT,
  poids_actuel NUMERIC,
  poids_objectif NUMERIC,
  objectif TEXT,
  taille INTEGER,
  age INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### `workout_programs`
```sql
CREATE TABLE workout_programs (
  id UUID PRIMARY KEY,
  athlete_id UUID REFERENCES athletes(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL,
  nom TEXT NOT NULL,
  pattern_type TEXT ('pattern' ou 'fixed'),
  pattern_data JSONB, -- {pattern: "Haut/Bas/Repos"} ou {days: ["Lundi", "Mercredi"]}
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP
);
```

#### `workout_sessions`
```sql
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY,
  program_id UUID REFERENCES workout_programs(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  jour TEXT,
  exercices JSONB, -- [{nom, series, reps, charge}, ...]
  ordre INTEGER,
  created_at TIMESTAMP
);
```

#### `nutrition_plans`
```sql
CREATE TABLE nutrition_plans (
  id UUID PRIMARY KEY,
  athlete_id UUID REFERENCES athletes(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL,
  nom TEXT NOT NULL,
  meal_type TEXT ('training' ou 'rest'),
  meals_data JSONB, -- [[{aliment, qte, ...}, ...], ...]
  calories_objectif INTEGER,
  proteines NUMERIC,
  glucides NUMERIC,
  lipides NUMERIC,
  created_at TIMESTAMP
);
```

#### `daily_reports`
```sql
CREATE TABLE daily_reports (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE UNIQUE,
  weight NUMERIC,
  adherence INTEGER (0-100),
  enjoyment INTEGER (0-10),
  cardio_minutes INTEGER,
  steps INTEGER,
  sick_signs BOOLEAN,
  sleep_efficiency INTEGER (0-100),
  stress INTEGER (0-10),
  energy INTEGER (0-10),
  sleep_quality INTEGER (0-10),
  bedtime TIME,
  wakeup TIME,
  belly_measurement NUMERIC,
  hip_measurement NUMERIC,
  thigh_measurement NUMERIC,
  soreness INTEGER (0-10),
  general_notes TEXT,
  sessions_executed INTEGER,
  session_performance INTEGER (0-10),
  session_enjoyment INTEGER (0-10),
  positive_week TEXT,
  negative_week TEXT,
  created_at TIMESTAMP
);
```

#### Templates & Aliments
```sql
-- training_templates: modèles de programmes
-- nutrition_templates: modèles de plans nutrition
-- exercices: base d'exercices disponibles
-- aliments_db: base d'aliments avec macros
```

---

## 🔐 Sécurité - Row Level Security (RLS)

Les politiques RLS assurent que:
- ✅ Un coach ne voit que SES athlètes
- ✅ Un athlète ne voit que SES bilans
- ✅ Impossible de modifier les données d'un autre coach

```sql
-- Exemple pour athletes
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches see their own athletes"
  ON athletes FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());
```

---

## 📱 Stack Technique

| Couche | Tech |
|--------|------|
| **Frontend** | HTML5, CSS3, Vanilla JS |
| **Backend** | Supabase (PostgreSQL 14+) |
| **Auth** | Supabase Auth (JWT) |
| **API** | REST via @supabase/supabase-js |
| **Charting** | Chart.js |
| **Icons** | Font Awesome 6.4 |
| **Deploy** | Vercel |
| **Design** | Dark theme custom |

---

## 🎨 Variables CSS

```css
:root {
  --primary: #B30808;           /* Rouge principal */
  --primary-dark: #8a0606;      /* Rouge foncé */
  --primary-light: #d40a0a;     /* Rouge clair */
  --bg: #0f0f0f;                /* Fond principal */
  --bg2: #1a1a1a;               /* Fond secondaire */
  --bg3: #242424;               /* Fond tertiaire */
  --bg4: #2e2e2e;               /* Fond quaternaire */
  --text: #ffffff;              /* Texte principal */
  --text2: #b0b0b0;             /* Texte secondaire */
  --text3: #707070;             /* Texte tertiaire */
  --border: #333333;            /* Bordures */
  --success: #22c55e;           /* Vert succès */
  --warning: #f59e0b;           /* Orange alerte */
  --danger: #ef4444;            /* Rouge danger */
}
```

---

## 📋 Checklist de Déploiement

- [ ] Variables Supabase configurées
- [ ] Tables créées avec RLS actif
- [ ] Politiques de sécurité en place
- [ ] Templates de base créés
- [ ] Base d'exercices remplie
- [ ] Base d'aliments remplie
- [ ] Vercel déployé
- [ ] HTTPS activé
- [ ] Email de confirmation testé
- [ ] WhatsApp modal testé

---

## 🐛 Troubleshooting

### "Erreur connexion Supabase"
- Vérifier SUPABASE_URL et SUPABASE_ANON_KEY
- Vérifier que le projet Supabase est actif

### "Pas de données affichées"
- Vérifier les politiques RLS
- Vérifier que `coach_id` correspond à `auth.uid()`
- Vérifier les contraintes de clés étrangères

### "Doublons d'athlètes"
- Vérifier qu'il n'existe qu'un athlète par email
- Utiliser la SQL pour nettoyer les doublons

### "Athlete creation fails"
- Vérifier que RLS a `WITH CHECK` clause
- Vérifier que `coach_id = auth.uid()` est correct

---

## 🚀 Fonctionnalités à venir

- [ ] Export PDF des bilans
- [ ] Synchronisation Apple Health / Google Fit
- [ ] Notifications push
- [ ] Mode offline
- [ ] API REST publique pour intégrations
- [ ] Admin dashboard pour gérer coaches
- [ ] Analytics avancées

---

## 📝 Notes Importantes

### Création d'Athlète
1. Crée automatiquement un compte Supabase Auth
2. Génère un mot de passe temporaire
3. Affiche un message WhatsApp à copier-coller

### Suppression d'Athlète
⚠️ **Supprime en cascade:**
- Compte authentification
- Profil athlète
- Tous les programmes et séances
- Tous les plans nutrition
- Tous les bilans

### JSON Parse
⚠️ Supabase retourne les colonnes JSONB déjà parsées
```javascript
// ✅ Correct
const data = typeof obj === 'string' ? JSON.parse(obj) : obj;

// ❌ Incorrect
const data = JSON.parse(obj); // Crash si déjà parsé
```

---

## 👤 Auteur

Pierre Coaching - Application personnalisée pour coaches fitness

---

## 📄 Licence

MIT
