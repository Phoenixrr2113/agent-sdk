"use client"

import { useRouter } from 'next/navigation'
import { AutomationsPanel } from '@/features/dashboard/components/automations-panel'

export default function AutomationsPage() {
  const router = useRouter()

  const handleAutomationSelect = (automationId: string) => {
    router.push(`/dashboard/automations/${automationId}`)
  }

  return <AutomationsPanel onSelectAutomation={handleAutomationSelect} />
}
