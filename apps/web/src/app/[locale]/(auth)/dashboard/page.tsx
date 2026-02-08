"use client"

import { useRouter, usePathname } from 'next/navigation'
import { DashboardPanel } from '@/features/dashboard/components/dashboard-panel'

export default function DashboardPage() {
  const router = useRouter()
  const pathname = usePathname()

  const handleNavigate = (page: string) => {
    const locale = pathname.split('/')[1]
    router.push(`/${locale}/dashboard/${page}`)
  }

  return <DashboardPanel onNavigate={handleNavigate} />
}
