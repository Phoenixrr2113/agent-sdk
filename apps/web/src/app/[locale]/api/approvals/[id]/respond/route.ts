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

export async function POST(request: Request, { params }: Params) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
  }

  const body = await request.json();
  const { response } = body;

  if (!response || !['approved', 'rejected'].includes(response)) {
    return NextResponse.json({ error: 'Response must be "approved" or "rejected"' }, { status: 400 });
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

  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Approval already responded' }, { status: 400 });
  }

  const [approval] = await db
    .update(approvalsSchema)
    .set({
      status: response,
      respondedAt: new Date(),
    })
    .where(eq(approvalsSchema.id, id))
    .returning();

  return NextResponse.json({ approval });
}
