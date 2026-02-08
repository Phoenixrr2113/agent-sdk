import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { conversationsSchema } from '@/models/Schema';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conversations = await db
    .select()
    .from(conversationsSchema)
    .where(eq(conversationsSchema.userId, userId))
    .orderBy(desc(conversationsSchema.updatedAt));

  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const title = body.title || 'New Conversation';

  const [conversation] = await db
    .insert(conversationsSchema)
    .values({
      userId,
      title,
      messageCount: 0,
    })
    .returning();

  return NextResponse.json(conversation, { status: 201 });
}
