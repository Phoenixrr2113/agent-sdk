import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/libs/DB';
import { missionsSchema, devicesSchema, approvalsSchema } from '@/models/Schema';
import { eq } from 'drizzle-orm';

export type UserContext = {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
};

export type MissionSummary = {
  id: string;
  goal: string;
  status: string;
  progress: number;
  createdAt: string;
};

export type DeviceSummary = {
  id: string;
  name: string;
  platform: string;
  connected: boolean;
};

export type ApprovalSummary = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
};

export type ChatContext = {
  user?: UserContext;
  activeMissions: MissionSummary[];
  pendingApprovals: ApprovalSummary[];
  connectedDevices: DeviceSummary[];
  timestamp: string;
};

export async function getUserContext(): Promise<UserContext | undefined> {
  try {
    const { userId } = await auth();
    if (!userId) return undefined;

    const user = await currentUser();
    if (!user) return { userId };

    return {
      userId,
      email: user.emailAddresses[0]?.emailAddress,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      fullName: user.fullName || undefined,
    };
  } catch {
    return undefined;
  }
}

export async function getActiveMissions(): Promise<MissionSummary[]> {
  try {
    const { userId } = await auth();
    if (!userId) return [];

    const missions = await db
      .select()
      .from(missionsSchema)
      .where(eq(missionsSchema.userId, userId));

    return missions
      .filter(m => !['completed', 'failed'].includes(m.status))
      .map(m => ({
        id: m.id,
        goal: m.goal,
        status: m.status,
        progress: m.progress,
        createdAt: m.createdAt.toISOString(),
      }));
  } catch {
    return [];
  }
}

export async function getPendingApprovals(): Promise<ApprovalSummary[]> {
  try {
    const { userId } = await auth();
    if (!userId) return [];

    const approvals = await db
      .select()
      .from(approvalsSchema)
      .where(eq(approvalsSchema.userId, userId));

    return approvals
      .filter(a => a.status === 'pending')
      .map(a => ({
        id: a.id,
        title: a.title,
        status: a.status,
        createdAt: a.createdAt.toISOString(),
      }));
  } catch {
    return [];
  }
}

export async function getConnectedDevices(): Promise<DeviceSummary[]> {
  try {
    const { userId } = await auth();
    if (!userId) return [];

    const devices = await db
      .select()
      .from(devicesSchema)
      .where(eq(devicesSchema.userId, userId));

    return devices.map(d => ({
      id: d.id,
      name: d.name,
      platform: d.platform,
      connected: d.status === 'connected',
    }));
  } catch {
    return [];
  }
}

export async function buildChatContext(): Promise<ChatContext> {
  const [user, missions, approvals, devices] = await Promise.all([
    getUserContext(),
    getActiveMissions(),
    getPendingApprovals(),
    getConnectedDevices(),
  ]);

  return {
    user,
    activeMissions: missions,
    pendingApprovals: approvals,
    connectedDevices: devices,
    timestamp: new Date().toISOString(),
  };
}

export function formatContextForPrompt(context: ChatContext): string {
  const parts: string[] = [];

  if (context.user) {
    parts.push('## User Information');
    if (context.user.fullName) parts.push(`Name: ${context.user.fullName}`);
    if (context.user.email) parts.push(`Email: ${context.user.email}`);
    parts.push(`User ID: ${context.user.userId}`);
    parts.push('');
  }

  if (context.activeMissions.length > 0) {
    parts.push('## Active Missions');
    context.activeMissions.forEach((m) => {
      parts.push(`- [${m.status.toUpperCase()}] ${m.goal} (${m.progress}% complete)`);
    });
    parts.push('');
  }

  if (context.pendingApprovals.length > 0) {
    parts.push('## Pending Approvals');
    context.pendingApprovals.forEach((a) => {
      parts.push(`- ${a.title} (ID: ${a.id})`);
    });
    parts.push('');
  }

  if (context.connectedDevices.length > 0) {
    parts.push('## Connected Devices');
    context.connectedDevices.forEach((d) => {
      const status = d.connected ? 'ONLINE' : 'OFFLINE';
      parts.push(`- [${status}] ${d.name} (${d.platform})`);
    });
    parts.push('');
  }

  if (parts.length === 0) {
    return 'No active missions, approvals, or devices.';
  }

  return parts.join('\n');
}
