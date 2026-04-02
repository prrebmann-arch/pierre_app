import { redirect } from 'next/navigation'

export default async function AthleteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/athletes/${id}/apercu`)
}
