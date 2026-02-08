import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';
import { db } from '@/libs/DB';
import { apiKeysSchema } from '@/models/Schema';

type APIKeyScope =
  | 'read:missions'
  | 'write:missions'
  | 'read:automations'
  | 'write:automations'
  | 'read:devices'
  | 'write:devices'
  | 'full_access';

type APIKey = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: APIKeyScope[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type CreateAPIKeyResponse = APIKey & {
  key: string;
};

function generateApiKey(): string {
  const bytes = randomBytes(32);
  return `ctrl_${bytes.toString('base64url')}`;
}

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function toApiResponse(row: typeof apiKeysSchema.$inferSelect): APIKey {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: row.scopes as APIKeyScope[],
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keys = await db
    .select()
    .from(apiKeysSchema)
    .where(eq(apiKeysSchema.userId, userId));

  return NextResponse.json({ keys: keys.map(toApiResponse) });
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.name || body.name.length < 1) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!body.scopes || body.scopes.length < 1) {
    return NextResponse.json({ error: 'At least one scope is required' }, { status: 400 });
  }

  const key = generateApiKey();
  const keyHash = hashApiKey(key);
  const keyPrefix = key.slice(0, 12) + '...';
  const id = createHash('md5').update(keyHash).digest('hex').slice(0, 36);

  const [created] = await db
    .insert(apiKeysSchema)
    .values({
      id,
      userId,
      name: body.name,
      keyPrefix,
      keyHash,
      scopes: body.scopes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    })
    .returning();

  if (!created) {
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }

  const response: CreateAPIKeyResponse = {
    ...toApiResponse(created),
    key,
  };

  return NextResponse.json(response);
}
