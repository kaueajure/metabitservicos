import { mysqlTable, serial, varchar, text, int, timestamp, longtext } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// Users table (Local Email/Password Auth backed)
export const users = mysqlTable('users', {
  id: serial('id').primaryKey(),
  uid: varchar('uid', { length: 255 }).notNull().unique(), // Local unique UID
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(), // BCrypt hashed password
  name: varchar('name', { length: 255 }),
  employeeName: varchar('employee_name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

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
});

// Tasks table (the Excel cells representing a municipality obligation competence)
export const tasks = mysqlTable('tasks', {
  id: serial('id').primaryKey(),
  municipalityId: int('municipality_id')
    .references(() => municipalities.id, { onDelete: 'cascade' })
    .notNull(),
  obligationCode: varchar('obligation_code', { length: 50 }).notNull(), // 'MSC', 'RREO', 'RGF', 'DCA', 'SIOPE', 'SIOPS'
  competence: varchar('competence', { length: 100 }).notNull(), // 'Janeiro', '1º Bimestre', etc.
  year: int('year').notNull(),
  status: varchar('status', { length: 100 }).default('Falta XML').notNull(), // 'Falta XML', 'Não iniciado', 'Trabalhando', 'Retificar', 'Enviado', 'Homologado'
  siopsMembros: varchar('siops_membros', { length: 100 }), // 'Não Solicitado', 'Solicitado', etc.
  siopeFolha: varchar('siope_folha', { length: 100 }), // 'Não Solicitado', 'Solicitado', etc.
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// History log table (never deleted/updated)
export const history = mysqlTable('history', {
  id: serial('id').primaryKey(),
  taskId: int('task_id')
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  fieldChanged: varchar('field_changed', { length: 100 }).notNull(), // 'status', 'siopsMembros', 'siopeFolha'
  oldValue: text('old_value'),
  newValue: text('new_value'),
  userWhoChanged: varchar('user_who_changed', { length: 255 }), // Optional 'Nome' entered in the dialog
  observation: text('observation'), // Optional multiline text
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Comments table
export const comments = mysqlTable('comments', {
  id: serial('id').primaryKey(),
  taskId: int('task_id')
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  authorName: varchar('author_name', { length: 255 }).notNull(),
  text: text('text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Attachments table
export const attachments = mysqlTable('attachments', {
  id: serial('id').primaryKey(),
  taskId: int('task_id')
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  commentId: int('comment_id'), // optional if uploaded as a comment attachment
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 100 }).notNull(),
  fileSize: int('file_size').notNull(),
  fileData: longtext('file_data').notNull(), // Base64 representation of file
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
