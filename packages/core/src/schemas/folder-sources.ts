/**
 * Folder Source schema for multi-origin file ingestion
 * Tracks local folders, cloud stubs, and cache-only sources per device.
 */

import { z } from "zod";
import { Id, ISODate } from "./library";

export const FolderSourceTypeSchema = z.enum([
  "local",
  "cloud",
  "remote-cache",
]);

export type FolderSourceType = z.infer<typeof FolderSourceTypeSchema>;

export const FolderSourceStatusSchema = z.enum([
  "idle",
  "scanning",
  "syncing",
  "degraded",
  "error",
  "disabled",
]);

export type FolderSourceStatus = z.infer<typeof FolderSourceStatusSchema>;

export const FolderSourceSchema = z.object({
  id: Id,
  kind: z.literal("folder_source"),
  ownerId: z.string().uuid().optional(),
  deviceId: z.string(),
  type: FolderSourceTypeSchema.default("local"),
  displayName: z.string(),
  path: z.string().optional(),
  pathHash: z.string().optional(),
  uri: z.string().url().optional(),
  priority: z.number().int().min(0).max(100).default(50),
  isDefault: z.boolean().default(false),
  status: FolderSourceStatusSchema.default("idle"),
  lastScanStartedAt: ISODate.optional(),
  lastScanCompletedAt: ISODate.optional(),
  lastError: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: ISODate,
  updatedAt: ISODate,
});

export type FolderSource = z.infer<typeof FolderSourceSchema>;

export const FolderSourceRegistrationSchema = z.object({
  deviceId: z.string().optional(),
  displayName: z.string(),
  path: z.string().optional(),
  pathHash: z.string().optional(),
  uri: z.string().url().optional(),
  type: FolderSourceTypeSchema.default("local"),
  isDefault: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type FolderSourceRegistration = z.infer<
  typeof FolderSourceRegistrationSchema
>;
