import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { conversationsSchema, messagesSchema } from '@/models/Schema';

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
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const [conversation] = await db
    .select()
    .from(conversationsSchema)
    .where(and(
      eq(conversationsSchema.id, id),
      eq(conversationsSchema.userId, userId),
    ))
    .limit(1);

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const body = await request.json();

  const [message] = await db
    .insert(messagesSchema)
    .values({
      conversationId: id,
      role: body.role,
      content: body.content,
      toolCalls: body.toolCalls,
    })
    .returning();

  const preview = typeof body.content === 'string'
    ? body.content.slice(0, 100)
    : '';

  await db
    .update(conversationsSchema)
    .set({
      messageCount: sql`${conversationsSchema.messageCount} + 1`,
      preview,
    })
    .where(eq(conversationsSchema.id, id));

  return NextResponse.json(message, { status: 201 });
}
