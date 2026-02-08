import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { approvalsSchema } from '@/models/Schema';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const approvals = await db
    .select()
    .from(approvalsSchema)
    .where(eq(approvalsSchema.userId, userId))
    .orderBy(desc(approvalsSchema.createdAt));

  return NextResponse.json({ approvals });
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, actionType, actionData, metadata } = body;

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const [approval] = await db
    .insert(approvalsSchema)
    .values({
      userId,
      title,
      description,
      actionType,
      actionData,
      metadata,
      status: 'pending',
    })
    .returning();

  return NextResponse.json({ approval }, { status: 201 });
}
