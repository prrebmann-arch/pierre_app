# SQL à exécuter — Nettoyage onboarding

Exécuter dans Supabase SQL Editor :

```sql
-- Supprimer tous les onboardings dupliqués/orphelins pour cet athlète test
DELETE FROM athlete_onboarding WHERE athlete_id = '1b030792-487f-4a4e-bc00-dcb37d7d2100';

-- Vérifier qu'il n'en reste plus
SELECT count(*) as remaining FROM athlete_onboarding WHERE athlete_id = '1b030792-487f-4a4e-bc00-dcb37d7d2100';
```

Après exécution, relancer l'app mobile (`r` dans le terminal Expo).

L'athlète devrait arriver sur le Dashboard normalement. Le DashboardScreen détectera qu'il n'y a pas d'onboarding actif et ne naviguera pas vers l'écran d'onboarding.

Pour retester l'onboarding :
1. Supprimer l'athlète et le recréer avec un workflow
2. Se connecter → payer → le DashboardScreen naviguera vers l'onboarding
3. Compléter les étapes → retour au Dashboard
4. Reload → reste sur le Dashboard (pas de boucle)
