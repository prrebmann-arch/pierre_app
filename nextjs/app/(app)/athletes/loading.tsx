import Skeleton from '@/components/ui/Skeleton'

export default function AthletesLoading() {
  return (
    <div>
      <Skeleton height={40} borderRadius={8} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} height={60} borderRadius={12} />
        ))}
      </div>
    </div>
  )
}
