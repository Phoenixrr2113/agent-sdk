"use client"

import { useSearchParams } from 'next/navigation'
import { ActivityPanel } from '@/features/dashboard/components/activity-panel'

export default function ActivityPage() {
  const searchParams = useSearchParams()
  const filterParam = searchParams.get('filter')
  const initialFilter = filterParam === 'approvals' ? 'approvals' : 'all'

  return <ActivityPanel initialFilter={initialFilter} />
}
