import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { missionsSchema } from '@/models/Schema';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const missions = await db
    .select()
    .from(missionsSchema)
    .where(eq(missionsSchema.userId, userId))
    .orderBy(desc(missionsSchema.createdAt));

  return NextResponse.json({ missions, total: missions.length });
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { goal, approvalSettings, metadata } = body;

  if (!goal) {
    return NextResponse.json({ error: 'Goal is required' }, { status: 400 });
  }

  const [mission] = await db
    .insert(missionsSchema)
    .values({
      userId,
      goal,
      approvalSettings,
      metadata,
      status: 'planning',
      progress: 0,
    })
    .returning();

  return NextResponse.json({ mission }, { status: 201 });
}
