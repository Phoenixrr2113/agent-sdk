import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { apiKeysSchema } from '@/models/Schema';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [existing] = await db
    .select()
    .from(apiKeysSchema)
    .where(and(
      eq(apiKeysSchema.id, id),
      eq(apiKeysSchema.userId, userId),
    ))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 });
  }

  await db
    .delete(apiKeysSchema)
    .where(eq(apiKeysSchema.id, id));

  return NextResponse.json({ success: true });
}
