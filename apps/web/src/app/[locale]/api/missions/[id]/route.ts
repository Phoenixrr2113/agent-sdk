import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { missionsSchema } from '@/models/Schema';

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
    return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
  }

  const [mission] = await db
    .select()
    .from(missionsSchema)
    .where(and(
      eq(missionsSchema.id, id),
      eq(missionsSchema.userId, userId),
    ))
    .limit(1);

  if (!mission) {
    return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
  }

  return NextResponse.json({ mission });
}

export async function PUT(request: Request, { params }: Params) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(missionsSchema)
    .where(and(
      eq(missionsSchema.id, id),
      eq(missionsSchema.userId, userId),
    ))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
  }

  const body = await request.json();
  const { goal, status, plan, progress, approvalSettings, metadata } = body;

  const [mission] = await db
    .update(missionsSchema)
    .set({
      ...(goal !== undefined && { goal }),
      ...(status !== undefined && { status }),
      ...(plan !== undefined && { plan }),
      ...(progress !== undefined && { progress }),
      ...(approvalSettings !== undefined && { approvalSettings }),
      ...(metadata !== undefined && { metadata }),
    })
    .where(eq(missionsSchema.id, id))
    .returning();

  return NextResponse.json({ mission });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(missionsSchema)
    .where(and(
      eq(missionsSchema.id, id),
      eq(missionsSchema.userId, userId),
    ))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
  }

  await db.delete(missionsSchema).where(eq(missionsSchema.id, id));

  return NextResponse.json({ success: true });
}
