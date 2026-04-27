import type { Metadata } from 'next'
import styles from '@/styles/profile.module.css'

export const metadata: Metadata = {
  title: 'Suppression de compte -- Momentum Athlete',
}

export default function DeleteAccountPage() {
  return (
    <div className={styles.privacyPage}>
      <h1>Suppression de compte Momentum Athlete</h1>
      <p className={styles.privacyDate}>Derniere mise a jour : 27 avril 2026</p>

      <p>
        Cette page decrit la procedure permettant aux utilisateurs de l&apos;application
        <strong> Momentum Athlete </strong> (developpee par Pierre Rebmann, EI &mdash; SIREN 942948613)
        de demander la suppression de leur compte ainsi que des donnees associees.
      </p>

      <h2>1. Comment demander la suppression</h2>
      <p>
        Envoyez un e-mail a <a href="mailto:support@momentum-coaching.fr?subject=Suppression%20de%20compte">
        support@momentum-coaching.fr</a> avec :
      </p>
      <ul>
        <li>L&apos;adresse e-mail associee a votre compte Momentum Athlete</li>
        <li>L&apos;objet : &laquo; Suppression de compte &raquo;</li>
        <li>(Facultatif) La raison de votre demande</li>
      </ul>
      <p>
        Vous pouvez egalement demander directement a votre coach de supprimer votre compte
        depuis son espace Momentum Coach.
      </p>

      <h2>2. Delai de traitement</h2>
      <p>
        Votre demande sera traitee sous <strong>30 jours maximum</strong> apres reception, conformement au
        Reglement General sur la Protection des Donnees (RGPD).
      </p>

      <h2>3. Donnees supprimees</h2>
      <p>
        Lors de la suppression de votre compte, les donnees suivantes sont definitivement effacees :
      </p>
      <ul>
        <li>Profil utilisateur (prenom, nom, e-mail, date de naissance, telephone)</li>
        <li>Donnees de sante saisies (poids, mesures, blessures, allergies, medicaments)</li>
        <li>Historique des entrainements, des bilans et des questionnaires</li>
        <li>Photos et enregistrements audio que vous avez televerses</li>
        <li>Plans nutritionnels et journaux de suivi</li>
        <li>Notifications et messages echanges avec votre coach</li>
        <li>Identifiants de notifications push (token)</li>
      </ul>

      <h2>4. Donnees conservees</h2>
      <p>
        Pour des raisons legales et comptables, certaines donnees peuvent etre conservees
        de maniere anonymisee ou pseudonymisee :
      </p>
      <ul>
        <li>
          Donnees de facturation et historique des transactions : conservees pendant la duree
          legale obligatoire (10 ans, article L123-22 du Code de commerce)
        </li>
        <li>
          Logs techniques anonymises : conserves jusqu&apos;a 12 mois pour des raisons de
          securite et de prevention de la fraude
        </li>
      </ul>

      <h2>5. Confirmation</h2>
      <p>
        Une fois la suppression effectuee, vous recevrez un e-mail de confirmation a l&apos;adresse
        utilisee pour la demande. Apres confirmation, l&apos;application Momentum Athlete refusera
        toute connexion avec ces identifiants.
      </p>

      <h2>6. Contact</h2>
      <p>
        Pour toute question relative a la suppression de compte ou au traitement de vos donnees
        personnelles, contactez : <a href="mailto:support@momentum-coaching.fr">support@momentum-coaching.fr</a>
      </p>
    </div>
  )
}
