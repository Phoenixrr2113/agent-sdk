"use client"

import { useParams, useRouter } from 'next/navigation'
import { AutomationDetail } from '@/features/dashboard/components/automation-detail'

export default function AutomationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const automationId = params.id as string

  const handleBack = () => {
    router.push('/dashboard/automations')
  }

  return <AutomationDetail automationId={automationId} onBack={handleBack} />
}
