import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { automationsSchema } from '@/models/Schema';
import type { AutomationTrigger, AutomationAction } from '@/types/motia';

type TriggerType = 'cron' | 'event' | 'webhook' | 'manual';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const automations = await db
    .select()
    .from(automationsSchema)
    .where(eq(automationsSchema.userId, userId))
    .orderBy(desc(automationsSchema.createdAt));

  return NextResponse.json({ automations });
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, trigger, actions, metadata } = body as {
    name: string;
    description?: string;
    trigger: AutomationTrigger;
    actions: AutomationAction[];
    metadata?: Record<string, unknown>;
  };

  if (!name || !trigger || !actions) {
    return NextResponse.json({ error: 'Name, trigger, and actions are required' }, { status: 400 });
  }

  const [automation] = await db
    .insert(automationsSchema)
    .values({
      userId,
      name,
      description,
      triggerType: trigger.type as TriggerType,
      triggerConfig: trigger,
      actions,
      metadata,
      status: 'active',
      runCount: 0,
    })
    .returning();

  return NextResponse.json({ automation }, { status: 201 });
}
