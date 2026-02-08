import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { notificationsSchema } from '@/models/Schema';

type Params = { params: Promise<{ id: string }> };

function toApiResponse(row: typeof notificationsSchema.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    body: row.body,
    channel: row.channel,
    priority: row.priority,
    actionUrl: row.actionUrl ?? undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.createdAt.toISOString(),
  };
}

export async function GET(_request: Request, { params }: Params) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [notification] = await db
    .select()
    .from(notificationsSchema)
    .where(and(
      eq(notificationsSchema.id, id),
      eq(notificationsSchema.userId, userId),
    ))
    .limit(1);

  if (!notification) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  }

  return NextResponse.json(toApiResponse(notification));
}

export async function PUT(request: Request, { params }: Params) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [existing] = await db
    .select()
    .from(notificationsSchema)
    .where(and(
      eq(notificationsSchema.id, id),
      eq(notificationsSchema.userId, userId),
    ))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  }

  const body = await request.json();
  const updateValues: Partial<typeof notificationsSchema.$inferInsert> = {};

  if (body.read !== undefined) {
    updateValues.read = body.read;
    if (body.read) {
      updateValues.readAt = new Date();
    }
  }

  const [updated] = await db
    .update(notificationsSchema)
    .set(updateValues)
    .where(eq(notificationsSchema.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }

  return NextResponse.json(toApiResponse(updated));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [existing] = await db
    .select()
    .from(notificationsSchema)
    .where(and(
      eq(notificationsSchema.id, id),
      eq(notificationsSchema.userId, userId),
    ))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  }

  await db
    .delete(notificationsSchema)
    .where(eq(notificationsSchema.id, id));

  return NextResponse.json({ success: true });
}
