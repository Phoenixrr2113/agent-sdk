import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { profilesSchema } from '@/models/Schema';

type UserProfile = {
  userId: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  timezone?: string;
  language?: string;
  createdAt: string;
  updatedAt: string;
};

function toApiResponse(row: typeof profilesSchema.$inferSelect): UserProfile {
  return {
    userId: row.userId,
    displayName: row.displayName ?? undefined,
    bio: row.bio ?? undefined,
    avatarUrl: row.avatarUrl ?? undefined,
    timezone: row.timezone ?? undefined,
    language: row.language ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [profile] = await db
    .select()
    .from(profilesSchema)
    .where(eq(profilesSchema.userId, userId))
    .limit(1);

  if (!profile) {
    const now = new Date();
    return NextResponse.json({
      userId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    } satisfies UserProfile);
  }

  return NextResponse.json(toApiResponse(profile));
}

export async function PUT(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: Partial<UserProfile> = await request.json();

  const [existing] = await db
    .select()
    .from(profilesSchema)
    .where(eq(profilesSchema.userId, userId))
    .limit(1);

  const updateValues: Partial<typeof profilesSchema.$inferInsert> = {};

  if (body.displayName !== undefined) {
    updateValues.displayName = body.displayName;
  }
  if (body.bio !== undefined) {
    updateValues.bio = body.bio;
  }
  if (body.avatarUrl !== undefined) {
    updateValues.avatarUrl = body.avatarUrl;
  }
  if (body.timezone !== undefined) {
    updateValues.timezone = body.timezone;
  }
  if (body.language !== undefined) {
    updateValues.language = body.language;
  }

  if (existing) {
    const [updated] = await db
      .update(profilesSchema)
      .set(updateValues)
      .where(eq(profilesSchema.userId, userId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json(toApiResponse(updated));
  }

  const [created] = await db
    .insert(profilesSchema)
    .values({
      userId,
      displayName: body.displayName,
      bio: body.bio,
      avatarUrl: body.avatarUrl,
      timezone: body.timezone,
      language: body.language,
    })
    .returning();

  if (!created) {
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }

  return NextResponse.json(toApiResponse(created));
}
