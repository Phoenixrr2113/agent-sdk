import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { settingsSchema } from '@/models/Schema';

type UserSettings = {
  theme: 'light' | 'dark' | 'system';
  accentColor?: string;
  notifications: {
    email: boolean;
    push: boolean;
    missionComplete: boolean;
    missionFailed: boolean;
    approvalRequired: boolean;
    automationFailed: boolean;
  };
  timezone?: string;
  language?: string;
};

const defaultSettings: UserSettings = {
  theme: 'system',
  accentColor: '#00ff88',
  notifications: {
    email: true,
    push: true,
    missionComplete: true,
    missionFailed: true,
    approvalRequired: true,
    automationFailed: true,
  },
};

function toApiResponse(row: typeof settingsSchema.$inferSelect): UserSettings {
  return {
    theme: row.theme,
    accentColor: row.accentColor ?? undefined,
    notifications: {
      email: row.notificationEmail,
      push: row.notificationPush,
      missionComplete: row.notificationMissionComplete,
      missionFailed: row.notificationMissionFailed,
      approvalRequired: row.notificationApprovalRequired,
      automationFailed: row.notificationAutomationFailed,
    },
    timezone: row.timezone ?? undefined,
    language: row.language ?? undefined,
  };
}

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [settings] = await db
    .select()
    .from(settingsSchema)
    .where(eq(settingsSchema.userId, userId))
    .limit(1);

  if (!settings) {
    return NextResponse.json(defaultSettings);
  }

  return NextResponse.json(toApiResponse(settings));
}

export async function PUT(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: Partial<UserSettings> = await request.json();

  const [existing] = await db
    .select()
    .from(settingsSchema)
    .where(eq(settingsSchema.userId, userId))
    .limit(1);

  const updateValues: Partial<typeof settingsSchema.$inferInsert> = {};

  if (body.theme !== undefined) {
    updateValues.theme = body.theme;
  }
  if (body.accentColor !== undefined) {
    updateValues.accentColor = body.accentColor;
  }
  if (body.timezone !== undefined) {
    updateValues.timezone = body.timezone;
  }
  if (body.language !== undefined) {
    updateValues.language = body.language;
  }
  if (body.notifications) {
    if (body.notifications.email !== undefined) {
      updateValues.notificationEmail = body.notifications.email;
    }
    if (body.notifications.push !== undefined) {
      updateValues.notificationPush = body.notifications.push;
    }
    if (body.notifications.missionComplete !== undefined) {
      updateValues.notificationMissionComplete = body.notifications.missionComplete;
    }
    if (body.notifications.missionFailed !== undefined) {
      updateValues.notificationMissionFailed = body.notifications.missionFailed;
    }
    if (body.notifications.approvalRequired !== undefined) {
      updateValues.notificationApprovalRequired = body.notifications.approvalRequired;
    }
    if (body.notifications.automationFailed !== undefined) {
      updateValues.notificationAutomationFailed = body.notifications.automationFailed;
    }
  }

  if (existing) {
    const [updated] = await db
      .update(settingsSchema)
      .set(updateValues)
      .where(eq(settingsSchema.userId, userId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json(toApiResponse(updated));
  }

  const [created] = await db
    .insert(settingsSchema)
    .values({
      userId,
      theme: body.theme ?? defaultSettings.theme,
      accentColor: body.accentColor ?? defaultSettings.accentColor,
      notificationEmail: body.notifications?.email ?? defaultSettings.notifications.email,
      notificationPush: body.notifications?.push ?? defaultSettings.notifications.push,
      notificationMissionComplete: body.notifications?.missionComplete ?? defaultSettings.notifications.missionComplete,
      notificationMissionFailed: body.notifications?.missionFailed ?? defaultSettings.notifications.missionFailed,
      notificationApprovalRequired: body.notifications?.approvalRequired ?? defaultSettings.notifications.approvalRequired,
      notificationAutomationFailed: body.notifications?.automationFailed ?? defaultSettings.notifications.automationFailed,
      timezone: body.timezone,
      language: body.language,
    })
    .returning();

  if (!created) {
    return NextResponse.json({ error: 'Failed to create settings' }, { status: 500 });
  }

  return NextResponse.json(toApiResponse(created));
}
