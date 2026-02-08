import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { devicesSchema } from '@/models/Schema';

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  let query = db
    .select()
    .from(devicesSchema)
    .where(eq(devicesSchema.userId, userId))
    .orderBy(desc(devicesSchema.updatedAt));

  if (status) {
    query = db
      .select()
      .from(devicesSchema)
      .where(eq(devicesSchema.userId, userId))
      .orderBy(desc(devicesSchema.updatedAt));
  }

  const devices = await query;

  return NextResponse.json({ devices });
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, platform, metadata } = body;

  if (!name || !platform) {
    return NextResponse.json({ error: 'Name and platform are required' }, { status: 400 });
  }

  const validPlatforms = ['desktop', 'android', 'ios', 'web'];
  if (!validPlatforms.includes(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }

  const [device] = await db
    .insert(devicesSchema)
    .values({
      userId,
      name,
      platform,
      metadata: metadata || {},
      status: 'disconnected',
    })
    .returning();

  return NextResponse.json({ device }, { status: 201 });
}
