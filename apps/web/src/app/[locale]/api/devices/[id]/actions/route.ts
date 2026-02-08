import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { sharedDeviceRegistry as registry } from '@/lib/devices';
import type { DeviceAction } from '@/lib/types/device';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as DeviceAction;

    const device = registry.getDevice(id);
    if (!device) {
      return NextResponse.json({
        result: { success: false, error: 'Device not found or not connected', code: 'NOT_FOUND' }
      }, { status: 404 });
    }

    if (device.connection.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!registry.isConnected(id)) {
      return NextResponse.json({
        result: { success: false, error: 'Device not connected', code: 'NOT_FOUND' }
      }, { status: 400 });
    }

    const result = await device.driver.execute(body);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to dispatch action';
    return NextResponse.json({
      result: { success: false, error: message, code: 'UNKNOWN' }
    }, { status: 500 });
  }
}
