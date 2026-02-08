"use client"

import { useRouter } from 'next/navigation'
import { MissionsPanel } from '@/features/dashboard/components/missions-panel'

export default function MissionsPage() {
  const router = useRouter()

  const handleMissionSelect = (missionId: string) => {
    router.push(`/dashboard/missions/${missionId}`)
  }

  return <MissionsPanel onSelectMission={handleMissionSelect} />
}
