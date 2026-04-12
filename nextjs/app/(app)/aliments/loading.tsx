import Skeleton from '@/components/ui/Skeleton'

export default function AlimentsLoading() {
  return (
    <div>
      <Skeleton height={40} borderRadius={8} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} height={50} borderRadius={8} />
        ))}
      </div>
    </div>
  )
}
