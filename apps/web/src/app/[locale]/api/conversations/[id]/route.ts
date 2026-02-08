import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { and, eq, asc } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { conversationsSchema, messagesSchema } from '@/models/Schema';

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

  const messages = await db
    .select()
    .from(messagesSchema)
    .where(eq(messagesSchema.conversationId, id))
    .orderBy(asc(messagesSchema.createdAt));

  return NextResponse.json({ conversation, messages });
}

export async function PUT(request: Request, { params }: Params) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const body = await request.json();

  const [existing] = await db
    .select()
    .from(conversationsSchema)
    .where(and(
      eq(conversationsSchema.id, id),
      eq(conversationsSchema.userId, userId),
    ))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const [conversation] = await db
    .update(conversationsSchema)
    .set({
      title: body.title ?? existing.title,
      preview: body.preview ?? existing.preview,
    })
    .where(eq(conversationsSchema.id, id))
    .returning();

  return NextResponse.json(conversation);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(conversationsSchema)
    .where(and(
      eq(conversationsSchema.id, id),
      eq(conversationsSchema.userId, userId),
    ))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  await db
    .delete(conversationsSchema)
    .where(eq(conversationsSchema.id, id));

  return NextResponse.json({ success: true });
}
