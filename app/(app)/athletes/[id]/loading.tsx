export default function AthleteDetailLoading() {
  return (
    <div>
      {/* Tab content skeleton */}
      <div className="skeleton" style={{ width: '100%', height: 32, borderRadius: 10, marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
      </div>
      <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 16 }} />
    </div>
  )
}
