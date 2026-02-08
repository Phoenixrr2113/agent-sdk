"use client"

import { useParams, useRouter } from 'next/navigation'
import { MissionDetail } from '@/features/dashboard/components/mission-detail'

export default function MissionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const missionId = params.id as string

  const handleBack = () => {
    router.push('/dashboard/missions')
  }

  return <MissionDetail missionId={missionId} onBack={handleBack} />
}
