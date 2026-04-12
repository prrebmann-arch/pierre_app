import Skeleton from '@/components/ui/Skeleton'

export default function BilansLoading() {
  return (
    <div>
      <Skeleton width={200} height={28} />
      <Skeleton width={300} height={16} />
      <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 20 }}>
        {[1, 2, 3, 4].map(i => <Skeleton key={i} width={100} height={36} />)}
      </div>
      <Skeleton height={300} />
    </div>
  )
}
