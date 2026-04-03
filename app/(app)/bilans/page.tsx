'use client'

import dynamic from 'next/dynamic'

const BilansOverview = dynamic(() => import('@/components/bilans/BilansOverview'), { ssr: false })

export default function BilansPage() {
  return <BilansOverview />
}
