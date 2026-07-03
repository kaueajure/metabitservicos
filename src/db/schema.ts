import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table (Firebase Auth backed)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase UID
  email: text('email').notNull(),
  name: text('name'),
  employeeName: text('employee_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Municipalities table
export const municipalities = pgTable('municipalities', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  state: text('state').notNull(),
  responsible: text('responsible').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  observations: text('observations'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Tasks table (the Excel cells representing a municipality obligation competence)
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  municipalityId: integer('municipality_id')
    .references(() => municipalities.id, { onDelete: 'cascade' })
    .notNull(),
  obligationCode: text('obligation_code').notNull(), // 'MSC', 'RREO', 'RGF', 'DCA', 'SIOPE', 'SIOPS'
  competence: text('competence').notNull(), // 'Janeiro', '1º Bimestre', etc.
  year: integer('year').notNull(),
  status: text('status').default('Falta XML').notNull(), // 'Falta XML', 'Não iniciado', 'Trabalhando', 'Retificar', 'Enviado', 'Homologado'
  siopsMembros: text('siops_membros'), // 'Não Solicitado', 'Solicitado', etc.
  siopeFolha: text('siope_folha'), // 'Não Solicitado', 'Solicitado', etc.
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// History log table (never deleted/updated)
export const history = pgTable('history', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  fieldChanged: text('field_changed').notNull(), // 'status', 'siopsMembros', 'siopeFolha'
  oldValue: text('old_value'),
  newValue: text('new_value'),
  userWhoChanged: text('user_who_changed'), // Optional 'Nome' entered in the dialog
  observation: text('observation'), // Optional multiline text
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Comments table
export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  authorName: text('author_name').notNull(),
  text: text('text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Attachments table
export const attachments = pgTable('attachments', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  commentId: integer('comment_id'), // optional if uploaded as a comment attachment
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  fileSize: integer('file_size').notNull(),
  fileData: text('file_data').notNull(), // Base64 representation of file
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

// Relations definitions
export const municipalitiesRelations = relations(municipalities, ({ many }) => ({
  tasks: many(tasks),
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
}));
