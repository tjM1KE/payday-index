import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const forwardPaper = sqliteTable("forward_paper", {
  id: integer("id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});
