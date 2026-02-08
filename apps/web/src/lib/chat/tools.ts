import { tool } from 'ai';
import { z } from 'zod';
import { db } from '@/libs/DB';
import { missionsSchema, automationsSchema, devicesSchema, approvalsSchema } from '@/models/Schema';
import { eq, desc } from 'drizzle-orm';

const createMissionSchema = z.object({
  goal: z.string().min(1).max(2000).describe('The goal or objective for the mission'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Optional metadata for the mission'),
});

const listMissionsSchema = z.object({
  status: z.enum(['planning', 'executing', 'awaiting_approval', 'paused', 'completed', 'failed']).optional(),
});

const getMissionStatusSchema = z.object({
  missionId: z.string().describe('The ID of the mission to retrieve'),
});

const approveActionSchema = z.object({
  approvalId: z.string().describe('The ID of the approval request'),
  approved: z.boolean().describe('Whether to approve (true) or reject (false) the action'),
});

const createAutomationSchema = z.object({
  name: z.string().min(1).max(200).describe('Name of the automation'),
  description: z.string().max(1000).optional(),
  trigger: z.object({
    type: z.enum(['cron', 'event', 'webhook', 'manual']),
    expression: z.string().optional(),
    eventName: z.string().optional(),
    path: z.string().optional(),
  }),
  actions: z.array(z.object({
    id: z.string(),
    type: z.string(),
    config: z.record(z.string(), z.unknown()),
    order: z.number(),
  })).min(1),
});

const listDevicesSchema = z.object({
  platform: z.enum(['desktop', 'android', 'ios', 'web']).optional(),
});

const listApprovalsSchema = z.object({});

export function createChatTools(userId: string) {
  const createMissionTool = tool({
    description: 'Create a new background mission to accomplish a complex goal.',
    inputSchema: createMissionSchema,
    execute: async ({ goal, metadata }) => {
      const [mission] = await db
        .insert(missionsSchema)
        .values({ userId, goal, metadata, status: 'planning', progress: 0 })
        .returning();
      return { success: true, missionId: mission?.id, status: mission?.status };
    },
  });

  const listMissionsTool = tool({
    description: 'List all missions for the current user.',
    inputSchema: listMissionsSchema,
    execute: async ({ status }) => {
      let query = db.select().from(missionsSchema).where(eq(missionsSchema.userId, userId));
      const missions = await query;
      const filtered = status ? missions.filter(m => m.status === status) : missions;
      return { success: true, missions: filtered, count: filtered.length };
    },
  });

  const getMissionStatusTool = tool({
    description: 'Get detailed status of a specific mission.',
    inputSchema: getMissionStatusSchema,
    execute: async ({ missionId }) => {
      const [mission] = await db
        .select()
        .from(missionsSchema)
        .where(eq(missionsSchema.id, missionId))
        .limit(1);
      if (!mission) return { success: false, error: 'Mission not found' };
      return { success: true, mission };
    },
  });

  const approveActionTool = tool({
    description: 'Approve or reject a pending action.',
    inputSchema: approveActionSchema,
    execute: async ({ approvalId, approved }) => {
      const [approval] = await db
        .update(approvalsSchema)
        .set({ status: approved ? 'approved' : 'rejected', respondedAt: new Date() })
        .where(eq(approvalsSchema.id, approvalId))
        .returning();
      return { success: true, status: approval?.status };
    },
  });

  const createAutomationTool = tool({
    description: 'Create a new automation.',
    inputSchema: createAutomationSchema,
    execute: async ({ name, description, trigger, actions }) => {
      const [automation] = await db
        .insert(automationsSchema)
        .values({
          userId,
          name,
          description,
          triggerType: trigger.type,
          triggerConfig: trigger,
          actions,
          status: 'active',
          runCount: 0,
        })
        .returning();
      return { success: true, automationId: automation?.id, name: automation?.name };
    },
  });

  const listDevicesTool = tool({
    description: 'List all devices connected to the user account.',
    inputSchema: listDevicesSchema,
    execute: async ({ platform }) => {
      const devices = await db
        .select()
        .from(devicesSchema)
        .where(eq(devicesSchema.userId, userId));
      const filtered = platform ? devices.filter(d => d.platform === platform) : devices;
      return { success: true, devices: filtered, count: filtered.length };
    },
  });

  const listApprovalsTool = tool({
    description: 'List all pending approval requests.',
    inputSchema: listApprovalsSchema,
    execute: async () => {
      const approvals = await db
        .select()
        .from(approvalsSchema)
        .where(eq(approvalsSchema.userId, userId))
        .orderBy(desc(approvalsSchema.createdAt));
      return { success: true, approvals: approvals.filter(a => a.status === 'pending'), count: approvals.length };
    },
  });

  return {
    create_mission: createMissionTool,
    list_missions: listMissionsTool,
    get_mission_status: getMissionStatusTool,
    approve_action: approveActionTool,
    create_automation: createAutomationTool,
    list_devices: listDevicesTool,
    list_approvals: listApprovalsTool,
  };
}
