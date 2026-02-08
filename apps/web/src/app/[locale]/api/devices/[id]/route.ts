import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { devicesSchema } from '@/models/Schema';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  const [device] = await db
    .select()
    .from(devicesSchema)
    .where(and(
      eq(devicesSchema.id, id),
      eq(devicesSchema.userId, userId),
    ))
    .limit(1);

  if (!device) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  return NextResponse.json({ device });
}

export async function PUT(request: Request, { params }: Params) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  const body = await request.json();

  const [existing] = await db
    .select()
    .from(devicesSchema)
    .where(and(
      eq(devicesSchema.id, id),
      eq(devicesSchema.userId, userId),
    ))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  const [device] = await db
    .update(devicesSchema)
    .set({
      name: body.name ?? existing.name,
      status: body.status ?? existing.status,
      metadata: body.metadata ?? existing.metadata,
      lastSeenAt: body.lastSeenAt ?? existing.lastSeenAt,
    })
    .where(eq(devicesSchema.id, id))
    .returning();

  return NextResponse.json({ device });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(devicesSchema)
    .where(and(
      eq(devicesSchema.id, id),
      eq(devicesSchema.userId, userId),
    ))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  await db
    .delete(devicesSchema)
    .where(eq(devicesSchema.id, id));

  return NextResponse.json({ success: true });
}
