"use client"

import { useParams, useRouter } from 'next/navigation'
import { useDevices } from '@/hooks/use-devices'
import { DeviceControl } from '@/features/dashboard/components/device-control'
import { Loader2 } from 'lucide-react'

export default function DeviceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const deviceId = params.id as string
  
  const { devices, isLoading } = useDevices()
  const device = devices.find(d => d.id === deviceId)

  const handleClose = () => {
    router.push('/dashboard/devices')
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!device) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Device not found</p>
        <button
          onClick={handleClose}
          className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
        >
          Back to Devices
        </button>
      </div>
    )
  }

  return <DeviceControl device={device} onClose={handleClose} />
}
