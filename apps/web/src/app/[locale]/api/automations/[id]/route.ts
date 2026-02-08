import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { automationsSchema } from '@/models/Schema';

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
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
  }

  const [automation] = await db
    .select()
    .from(automationsSchema)
    .where(and(
      eq(automationsSchema.id, id),
      eq(automationsSchema.userId, userId),
    ))
    .limit(1);

  if (!automation) {
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
  }

  return NextResponse.json({ automation });
}

export async function PUT(request: Request, { params }: Params) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(automationsSchema)
    .where(and(
      eq(automationsSchema.id, id),
      eq(automationsSchema.userId, userId),
    ))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
  }

  const body = await request.json();
  const { name, description, status, triggerType, triggerConfig, actions, metadata } = body;

  const [automation] = await db
    .update(automationsSchema)
    .set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(triggerType !== undefined && { triggerType }),
      ...(triggerConfig !== undefined && { triggerConfig }),
      ...(actions !== undefined && { actions }),
      ...(metadata !== undefined && { metadata }),
    })
    .where(eq(automationsSchema.id, id))
    .returning();

  return NextResponse.json({ automation });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(automationsSchema)
    .where(and(
      eq(automationsSchema.id, id),
      eq(automationsSchema.userId, userId),
    ))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
  }

  await db.delete(automationsSchema).where(eq(automationsSchema.id, id));

  return NextResponse.json({ success: true });
}
