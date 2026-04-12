import Skeleton from '@/components/ui/Skeleton'

export default function VideosLoading() {
  return (
    <div>
      <Skeleton height={36} borderRadius={8} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 20 }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} height={180} borderRadius={12} />
        ))}
      </div>
    </div>
  )
}
