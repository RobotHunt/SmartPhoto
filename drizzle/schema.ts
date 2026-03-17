import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 项目表 - 存储每次生成任务的信息
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  // 原始产品图片
  originalImageUrl: text("originalImageUrl").notNull(),
  originalImageKey: text("originalImageKey").notNull(),
  // 抠图后的白底图
  processedImageUrl: text("processedImageUrl"),
  processedImageKey: text("processedImageKey"),
  // 平台信息（多个平台用逗号分隔）
  platforms: text("platforms").notNull(), // 如: "alibaba,taobao,jd"
  // 图片类型：main（主图）或 detail（内页图）
  imageType: mysqlEnum("imageType", ["main", "detail"]).notNull(),
  // 产品信息
  productName: text("productName").notNull(),
  productParams: text("productParams"), // JSON格式存储产品参数
  productSellingPoints: text("productSellingPoints"), // JSON格式存储卖点
  // AI生成的营销文案
  marketingCopy: text("marketingCopy"),
  // 状态：draft（草稿）、processing（处理中）、completed（已完成）、failed（失败）
  status: mysqlEnum("status", ["draft", "processing", "completed", "failed"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * 生成图片表 - 存储AI生成的图片
 */
export const generatedImages = mysqlTable("generatedImages", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id),
  // 生成的图片
  imageUrl: text("imageUrl").notNull(),
  imageKey: text("imageKey").notNull(),
  // 生成时使用的提示词
  prompt: text("prompt").notNull(),
  // 图片序号（用于排序）
  orderIndex: int("orderIndex").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeneratedImage = typeof generatedImages.$inferSelect;
export type InsertGeneratedImage = typeof generatedImages.$inferInsert;