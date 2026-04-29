import styles from "@/styles/training.module.css";

interface EditedBadgeProps {
  editedAt: string | null;
}

export default function EditedBadge({ editedAt }: EditedBadgeProps) {
  if (!editedAt) return null;
  const date = new Date(editedAt);
  if (isNaN(date.getTime())) return null;

  const formatted = date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <span
      className={styles.editedBadge}
      title={`Modifié le ${formatted}`}
      aria-label={`Modifié le ${formatted}`}
    >
      <i className="fa-solid fa-pencil" />
      Édité
    </span>
  );
}
