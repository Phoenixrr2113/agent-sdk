import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { activitySchema } from '@/models/Schema';

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  let query = db
    .select()
    .from(activitySchema)
    .where(eq(activitySchema.userId, userId))
    .orderBy(desc(activitySchema.createdAt))
    .limit(limit)
    .offset(offset);

  const activity = await query;

  return NextResponse.json({ activity });
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { type, title, description, metadata } = body;

  if (!type || !title) {
    return NextResponse.json({ error: 'Type and title are required' }, { status: 400 });
  }

  const [entry] = await db
    .insert(activitySchema)
    .values({
      userId,
      type,
      title,
      description,
      metadata,
    })
    .returning();

  return NextResponse.json({ activity: entry }, { status: 201 });
}
