'use client'

export const dynamic = 'force-dynamic'

import nextDynamic from 'next/dynamic'
import Skeleton from '@/components/ui/Skeleton'

const InstagramAnalytics = nextDynamic(
  () => import('@/components/business/InstagramAnalytics'),
  {
    ssr: false,
    loading: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}>
        <Skeleton height={200} borderRadius={20} />
        <Skeleton height={300} borderRadius={20} />
      </div>
    ),
  },
)

export default function InstagramPage() {
  return <InstagramAnalytics />
}
