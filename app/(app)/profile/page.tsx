'use client'

import dynamic from 'next/dynamic'

const ProfilePage = dynamic(() => import('@/components/profile/ProfilePage'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}>
      <div className="skeleton" style={{ height: 40, width: 200, borderRadius: 10 }} />
      <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
      <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
    </div>
  ),
})

export default function Profile() {
  return <ProfilePage />
}
