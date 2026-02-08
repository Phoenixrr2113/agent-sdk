import { boolean, foreignKey, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const counterSchema = pgTable('counter', {
  id: serial('id').primaryKey(),
  count: integer('count').default(0),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const conversationsSchema = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').default('New Conversation').notNull(),
  preview: text('preview'),
  messageCount: integer('message_count').default(0).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index('conversations_user_id_idx').on(table.userId),
  index('conversations_updated_at_idx').on(table.updatedAt),
]);

export const conversationsRelations = relations(conversationsSchema, ({ many }) => ({
  messages: many(messagesSchema),
}));

export const messagesSchema = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').notNull(),
  role: text('role').notNull(),
  content: jsonb('content').$type<unknown>().notNull(),
  toolCalls: jsonb('tool_calls'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.conversationId],
    foreignColumns: [conversationsSchema.id],
    name: 'messages_conversation_id_conversations_id_fk',
  }).onDelete('cascade'),
  index('messages_conversation_id_idx').on(table.conversationId),
  index('messages_created_at_idx').on(table.createdAt),
]);

export const messagesRelations = relations(messagesSchema, ({ one }) => ({
  conversation: one(conversationsSchema, {
    fields: [messagesSchema.conversationId],
    references: [conversationsSchema.id],
  }),
}));

export const themeEnum = pgEnum('theme', ['light', 'dark', 'system']);

export const settingsSchema = pgTable('settings', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  theme: themeEnum('theme').default('system').notNull(),
  accentColor: varchar('accent_color', { length: 7 }),
  notificationEmail: boolean('notification_email').default(true).notNull(),
  notificationPush: boolean('notification_push').default(true).notNull(),
  notificationMissionComplete: boolean('notification_mission_complete').default(true).notNull(),
  notificationMissionFailed: boolean('notification_mission_failed').default(true).notNull(),
  notificationApprovalRequired: boolean('notification_approval_required').default(true).notNull(),
  notificationAutomationFailed: boolean('notification_automation_failed').default(true).notNull(),
  timezone: varchar('timezone', { length: 100 }),
  language: varchar('language', { length: 10 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  unique('settings_user_id_unique').on(table.userId),
  index('settings_user_id_idx').on(table.userId),
]);

export const profilesSchema = pgTable('profiles', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  displayName: text('display_name'),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  timezone: varchar('timezone', { length: 100 }),
  language: varchar('language', { length: 10 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  unique('profiles_user_id_unique').on(table.userId),
  index('profiles_user_id_idx').on(table.userId),
]);

export const apiKeyScopeEnum = pgEnum('api_key_scope', [
  'read:missions',
  'write:missions',
  'read:automations',
  'write:automations',
  'read:devices',
  'write:devices',
  'full_access',
]);

export const apiKeysSchema = pgTable('api_keys', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  keyPrefix: varchar('key_prefix', { length: 20 }).notNull(),
  keyHash: varchar('key_hash', { length: 64 }).notNull(),
  scopes: jsonb('scopes').$type<string[]>().notNull(),
  lastUsedAt: timestamp('last_used_at', { mode: 'date' }),
  expiresAt: timestamp('expires_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('api_keys_user_id_idx').on(table.userId),
  index('api_keys_key_hash_idx').on(table.keyHash),
]);

export const notificationChannelEnum = pgEnum('notification_channel', ['in_app', 'email', 'push', 'webhook']);
export const notificationPriorityEnum = pgEnum('notification_priority', ['low', 'normal', 'high', 'urgent']);

export const notificationsSchema = pgTable('notifications', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  channel: notificationChannelEnum('channel').default('in_app').notNull(),
  priority: notificationPriorityEnum('priority').default('normal').notNull(),
  actionUrl: text('action_url'),
  metadata: jsonb('metadata'),
  read: boolean('read').default(false).notNull(),
  readAt: timestamp('read_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('notifications_user_id_idx').on(table.userId),
  index('notifications_read_idx').on(table.read),
  index('notifications_created_at_idx').on(table.createdAt),
]);

export const devicePlatformEnum = pgEnum('device_platform', ['desktop', 'android', 'ios', 'web']);
export const connectionStatusEnum = pgEnum('connection_status', ['connected', 'disconnected', 'connecting', 'error']);

export const devicesSchema = pgTable('devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  platform: devicePlatformEnum('platform').notNull(),
  status: connectionStatusEnum('status').default('disconnected').notNull(),
  metadata: jsonb('metadata'),
  lastSeenAt: timestamp('last_seen_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index('devices_user_id_idx').on(table.userId),
  index('devices_status_idx').on(table.status),
]);

export const activityTypeEnum = pgEnum('activity_type', [
  'mission_started',
  'mission_completed',
  'mission_failed',
  'automation_triggered',
  'automation_completed',
  'automation_failed',
  'device_connected',
  'device_disconnected',
  'approval_requested',
  'approval_responded',
]);

export const activitySchema = pgTable('activity', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  type: activityTypeEnum('type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('activity_user_id_idx').on(table.userId),
  index('activity_type_idx').on(table.type),
  index('activity_created_at_idx').on(table.createdAt),
]);

export const approvalStatusEnum = pgEnum('approval_status', ['pending', 'approved', 'rejected']);

export const approvalsSchema = pgTable('approvals', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: approvalStatusEnum('status').default('pending').notNull(),
  actionType: text('action_type'),
  actionData: jsonb('action_data'),
  metadata: jsonb('metadata'),
  respondedAt: timestamp('responded_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index('approvals_user_id_idx').on(table.userId),
  index('approvals_status_idx').on(table.status),
  index('approvals_created_at_idx').on(table.createdAt),
]);

export const missionStatusEnum = pgEnum('mission_status', [
  'planning',
  'executing',
  'awaiting_approval',
  'paused',
  'completed',
  'failed',
]);

export const missionsSchema = pgTable('missions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  goal: text('goal').notNull(),
  status: missionStatusEnum('status').default('planning').notNull(),
  plan: jsonb('plan'),
  progress: integer('progress').default(0).notNull(),
  currentStepId: text('current_step_id'),
  approvalSettings: jsonb('approval_settings'),
  error: text('error'),
  metadata: jsonb('metadata'),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index('missions_user_id_idx').on(table.userId),
  index('missions_status_idx').on(table.status),
  index('missions_created_at_idx').on(table.createdAt),
]);

export const automationStatusEnum = pgEnum('automation_status', ['active', 'paused', 'disabled', 'error']);
export const triggerTypeEnum = pgEnum('trigger_type', ['cron', 'event', 'webhook', 'manual']);
export const runStatusEnum = pgEnum('run_status', ['pending', 'running', 'completed', 'failed', 'cancelled']);

export const automationsSchema = pgTable('automations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  status: automationStatusEnum('status').default('active').notNull(),
  triggerType: triggerTypeEnum('trigger_type').notNull(),
  triggerConfig: jsonb('trigger_config').notNull(),
  actions: jsonb('actions').notNull(),
  lastRunAt: timestamp('last_run_at', { mode: 'date' }),
  lastRunStatus: runStatusEnum('last_run_status'),
  runCount: integer('run_count').default(0).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index('automations_user_id_idx').on(table.userId),
  index('automations_status_idx').on(table.status),
  index('automations_created_at_idx').on(table.createdAt),
]);
