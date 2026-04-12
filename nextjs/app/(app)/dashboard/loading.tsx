import Skeleton from '@/components/ui/Skeleton'

export default function DashboardLoading() {
  return (
    <div>
      <Skeleton height={100} borderRadius={16} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 28 }}>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} height={80} borderRadius={20} />
        ))}
      </div>
      <Skeleton height={400} borderRadius={16} />
    </div>
  )
}
