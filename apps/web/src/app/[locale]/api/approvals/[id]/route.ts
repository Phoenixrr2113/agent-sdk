import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { approvalsSchema } from '@/models/Schema';

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
    return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
  }

  const [approval] = await db
    .select()
    .from(approvalsSchema)
    .where(and(
      eq(approvalsSchema.id, id),
      eq(approvalsSchema.userId, userId),
    ))
    .limit(1);

  if (!approval) {
    return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
  }

  return NextResponse.json({ approval });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(approvalsSchema)
    .where(and(
      eq(approvalsSchema.id, id),
      eq(approvalsSchema.userId, userId),
    ))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
  }

  await db
    .delete(approvalsSchema)
    .where(eq(approvalsSchema.id, id));

  return NextResponse.json({ success: true });
}
