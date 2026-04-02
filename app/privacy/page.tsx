import type { Metadata } from 'next'
import styles from '@/styles/profile.module.css'

export const metadata: Metadata = {
  title: 'Politique de confidentialite -- Momentum',
}

export default function PrivacyPage() {
  return (
    <div className={styles.privacyPage}>
      <h1>Politique de confidentialite</h1>
      <p className={styles.privacyDate}>Derniere mise a jour : 26 mars 2026</p>

      <p>
        Momentum (&laquo; nous &raquo;, &laquo; notre &raquo;) exploite l&apos;application mobile et le site web
        Momentum. Cette page vous informe de notre politique en matiere de collecte, d&apos;utilisation et de protection
        des donnees personnelles.
      </p>

      <h2>1. Donnees collectees</h2>
      <p>Nous collectons les donnees suivantes lorsque vous utilisez notre service :</p>
      <ul>
        <li>Nom, prenom et adresse e-mail (lors de la creation de compte)</li>
        <li>Donnees d&apos;entrainement et de suivi sportif que vous saisissez</li>
        <li>Photos et videos que vous partagez dans le cadre du suivi coaching</li>
      </ul>

      <h2>2. Utilisation des donnees</h2>
      <p>Vos donnees sont utilisees exclusivement pour :</p>
      <ul>
        <li>Fournir et ameliorer le service de coaching sportif</li>
        <li>Permettre la communication entre le coach et l&apos;athlete</li>
        <li>Envoyer des notifications liees a votre suivi</li>
      </ul>

      <h2>3. Hebergement et securite</h2>
      <p>
        Les donnees sont hebergees par Supabase (serveurs de l&apos;Union Europeenne) et protegees par des mesures de
        securite conformes aux standards de l&apos;industrie, incluant le chiffrement en transit (HTTPS) et au repos.
      </p>

      <h2>4. Partage des donnees</h2>
      <p>
        Nous ne vendons ni ne partageons vos donnees personnelles avec des tiers a des fins commerciales. Les donnees
        peuvent etre partagees uniquement avec :
      </p>
      <ul>
        <li>Votre coach, dans le cadre du suivi sportif</li>
        <li>Nos sous-traitants techniques (Supabase, Vercel) necessaires au fonctionnement du service</li>
      </ul>

      <h2>5. Connexion via Facebook</h2>
      <p>
        Si vous vous connectez via Facebook, nous accedons uniquement a votre nom et adresse e-mail. Nous ne publions
        rien sur votre compte Facebook.
      </p>

      <h2>6. Vos droits</h2>
      <p>Conformement au RGPD, vous disposez des droits suivants :</p>
      <ul>
        <li>Droit d&apos;acces, de rectification et de suppression de vos donnees</li>
        <li>Droit a la portabilite de vos donnees</li>
        <li>Droit d&apos;opposition au traitement</li>
      </ul>
      <p>
        Pour exercer ces droits, contactez-nous a : <strong>pr.rebmann@gmail.com</strong>
      </p>

      <h2>7. Suppression des donnees</h2>
      <p>
        Vous pouvez demander la suppression de votre compte et de toutes vos donnees en nous contactant par e-mail. La
        suppression sera effectuee dans un delai de 30 jours.
      </p>

      <h2>8. Contact</h2>
      <p>
        Pierre Rebmann -- Momentum
        <br />
        8 rue des vergers, 67117 Ittenheim
        <br />
        pr.rebmann@gmail.com
      </p>
    </div>
  )
}
