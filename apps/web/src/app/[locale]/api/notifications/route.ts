import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { notificationsSchema } from '@/models/Schema';

type Notification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  channel: 'in_app' | 'email' | 'push' | 'webhook';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
  updatedAt: string;
};

function toApiResponse(row: typeof notificationsSchema.$inferSelect): Notification {
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

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const unreadOnly = searchParams.get('unread') === 'true';

  let query = db
    .select()
    .from(notificationsSchema)
    .where(eq(notificationsSchema.userId, userId))
    .orderBy(desc(notificationsSchema.createdAt))
    .limit(limit)
    .offset(offset);

  if (unreadOnly) {
    query = db
      .select()
      .from(notificationsSchema)
      .where(and(
        eq(notificationsSchema.userId, userId),
        eq(notificationsSchema.read, false),
      ))
      .orderBy(desc(notificationsSchema.createdAt))
      .limit(limit)
      .offset(offset);
  }

  const notifications = await query;

  return NextResponse.json({ notifications: notifications.map(toApiResponse) });
}
