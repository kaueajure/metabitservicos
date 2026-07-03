import { mysqlTable, serial, varchar, text, int, bigint, timestamp, longtext, index, uniqueIndex } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// Users table for local email/password authentication.
export const users = mysqlTable('users', {
  id: serial('id').primaryKey(),
  uid: varchar('uid', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  employeeName: varchar('employee_name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => [
  uniqueIndex('users_uid_unique').on(table.uid),
  uniqueIndex('users_email_unique').on(table.email),
  index('users_deleted_at_idx').on(table.deletedAt),
]);

export const roles = mysqlTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => [
  uniqueIndex('roles_slug_unique').on(table.slug),
  index('roles_deleted_at_idx').on(table.deletedAt),
]);

export const permissions = mysqlTable('permissions', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 150 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => [
  uniqueIndex('permissions_slug_unique').on(table.slug),
  index('permissions_deleted_at_idx').on(table.deletedAt),
]);

export const rolePermissions = mysqlTable('role_permissions', {
  roleId: bigint('role_id', { mode: 'number', unsigned: true })
    .references(() => roles.id, { onDelete: 'cascade' })
    .notNull(),
  permissionId: bigint('permission_id', { mode: 'number', unsigned: true })
    .references(() => permissions.id, { onDelete: 'cascade' })
    .notNull(),
}, (table) => [
  uniqueIndex('role_permissions_unique').on(table.roleId, table.permissionId),
  index('role_permissions_permission_idx').on(table.permissionId),
]);

export const userRoles = mysqlTable('user_roles', {
  userId: bigint('user_id', { mode: 'number', unsigned: true })
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  roleId: bigint('role_id', { mode: 'number', unsigned: true })
    .references(() => roles.id, { onDelete: 'cascade' })
    .notNull(),
}, (table) => [
  uniqueIndex('user_roles_unique').on(table.userId, table.roleId),
  index('user_roles_role_idx').on(table.roleId),
]);

// Municipalities table
export const municipalities = mysqlTable('municipalities', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  state: varchar('state', { length: 50 }).notNull(),
  responsible: varchar('responsible', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  observations: text('observations'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index('municipalities_name_idx').on(table.name),
  index('municipalities_state_idx').on(table.state),
]);

// Tasks table (the Excel cells representing a municipality obligation competence)
export const tasks = mysqlTable('tasks', {
  id: serial('id').primaryKey(),
  municipalityId: bigint('municipality_id', { mode: 'number', unsigned: true })
    .references(() => municipalities.id, { onDelete: 'cascade' })
    .notNull(),
  obligationCode: varchar('obligation_code', { length: 50 }).notNull(), // 'MSC', 'RREO', 'RGF', 'DCA', 'SIOPE', 'SIOPS'
  competence: varchar('competence', { length: 100 }).notNull(), // 'Janeiro', '1º Bimestre', etc.
  year: int('year').notNull(),
  status: varchar('status', { length: 100 }).default('Falta XML').notNull(), // 'Falta XML', 'Não iniciado', 'Trabalhando', 'Retificar', 'Enviado', 'Homologado'
  siopsMembros: varchar('siops_membros', { length: 100 }), // 'Não Solicitado', 'Solicitado', etc.
  siopeFolha: varchar('siope_folha', { length: 100 }), // 'Não Solicitado', 'Solicitado', etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex('tasks_unique_competence').on(table.municipalityId, table.obligationCode, table.competence, table.year),
  index('tasks_obligation_year_idx').on(table.obligationCode, table.year),
  index('tasks_status_idx').on(table.status),
]);

// History log table
export const history = mysqlTable('history', {
  id: serial('id').primaryKey(),
  taskId: bigint('task_id', { mode: 'number', unsigned: true })
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  fieldChanged: varchar('field_changed', { length: 100 }).notNull(), // 'status', 'siopsMembros', 'siopeFolha'
  oldValue: text('old_value'),
  newValue: text('new_value'),
  userWhoChanged: varchar('user_who_changed', { length: 255 }), // Optional 'Nome' entered in the dialog
  observation: text('observation'), // Optional multiline text
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index('history_task_created_idx').on(table.taskId, table.createdAt),
  index('history_field_changed_idx').on(table.fieldChanged),
]);

// Comments table
export const comments = mysqlTable('comments', {
  id: serial('id').primaryKey(),
  taskId: bigint('task_id', { mode: 'number', unsigned: true })
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  authorName: varchar('author_name', { length: 255 }).notNull(),
  text: text('text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('comments_task_created_idx').on(table.taskId, table.createdAt),
]);

// Attachments table
export const attachments = mysqlTable('attachments', {
  id: serial('id').primaryKey(),
  taskId: bigint('task_id', { mode: 'number', unsigned: true })
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  commentId: bigint('comment_id', { mode: 'number', unsigned: true }).references(() => comments.id, { onDelete: 'set null' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 100 }).notNull(),
  fileSize: int('file_size').notNull(),
  fileData: longtext('file_data').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
}, (table) => [
  index('attachments_task_uploaded_idx').on(table.taskId, table.uploadedAt),
  index('attachments_comment_idx').on(table.commentId),
]);

// Relations definitions
export const municipalitiesRelations = relations(municipalities, ({ many }) => ({
  tasks: many(tasks),
}));

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
  rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  municipality: one(municipalities, {
    fields: [tasks.municipalityId],
    references: [municipalities.id],
  }),
  history: many(history),
  comments: many(comments),
  attachments: many(attachments),
}));

export const historyRelations = relations(history, ({ one }) => ({
  task: one(tasks, {
    fields: [history.taskId],
    references: [tasks.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, {
    fields: [comments.taskId],
    references: [tasks.id],
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  task: one(tasks, {
    fields: [attachments.taskId],
    references: [tasks.id],
  }),
  comment: one(comments, {
    fields: [attachments.commentId],
    references: [comments.id],
  }),
}));
