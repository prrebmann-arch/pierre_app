export default function AthletesLoading() {
  return (
    <div>
      {/* Page header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 180, height: 28, borderRadius: 10 }} />
        <div className="skeleton" style={{ width: 140, height: 38, borderRadius: 10 }} />
      </div>

      {/* Athlete card grid skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}
