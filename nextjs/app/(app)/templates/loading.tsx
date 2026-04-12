import Skeleton from '@/components/ui/Skeleton'

export default function TemplatesLoading() {
  return (
    <div>
      <Skeleton height={36} borderRadius={8} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} height={60} borderRadius={8} />
        ))}
      </div>
    </div>
  )
}
