/**
 * Repository for Version entities
 * Encapsulates all Dexie operations for Versions
 */

import { db } from "@/src/db/dexie";
import type { Version, VersionExtended } from "@/src/schema/library";
import { VersionSchema } from "@/src/schema/library";

/**
 * Create a new Version
 */
export async function createVersion(
  data: Omit<Version, "id" | "createdAt" | "updatedAt">
): Promise<Version> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const version: Version = {
    ...data,
    id,
    kind: "version",
    createdAt: now,
    updatedAt: now,
  };

  // Validate before inserting
  const validated = VersionSchema.parse(version);
  await db.versions.add(validated);
  return validated;
}

/**
 * Get a Version by ID
 */
export async function getVersion(id: string): Promise<Version | undefined> {
  return db.versions.get(id);
}

/**
 * Get a Version by ID with Work and Assets
 */
export async function getVersionExtended(
  id: string
): Promise<VersionExtended | undefined> {
  const version = await db.versions.get(id);
  if (!version) return undefined;

  const work = await db.works.get(version.workId);
  const assets = await db.assets.where("versionId").equals(id).toArray();

  return {
    ...version,
    work,
    assets,
  };
}

/**
 * List all Versions for a Work
 */
export async function listVersionsForWork(workId: string): Promise<Version[]> {
  return db.versions.where("workId").equals(workId).toArray();
}

/**
 * List all Versions for a Work with extended data
 */
export async function listVersionsExtendedForWork(
  workId: string
): Promise<VersionExtended[]> {
  const versions = await db.versions.where("workId").equals(workId).toArray();
  const work = await db.works.get(workId);

  return Promise.all(
    versions.map(async (version) => {
      const assets = await db.assets
        .where("versionId")
        .equals(version.id)
        .toArray();
      return {
        ...version,
        work,
        assets,
      };
    })
  );
}

/**
 * Update a Version
 */
export async function updateVersion(
  id: string,
  updates: Partial<Omit<Version, "id" | "kind" | "workId" | "createdAt">>
): Promise<Version | undefined> {
  const version = await db.versions.get(id);
  if (!version) return undefined;

  const updated: Version = {
    ...version,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Validate before updating
  const validated = VersionSchema.parse(updated);
  await db.versions.update(id, validated);
  return validated;
}

/**
 * Delete a Version and all its Assets
 */
export async function deleteVersion(id: string): Promise<void> {
  // Delete all assets for this version
  await db.assets.where("versionId").equals(id).delete();

  // Delete edges involving this version
  await db.edges.where("fromId").equals(id).delete();
  await db.edges.where("toId").equals(id).delete();

  // Delete the version
  await db.versions.delete(id);
}

/**
 * Mark a Version as read
 */
export async function markVersionAsRead(
  id: string
): Promise<Version | undefined> {
  const version = await db.versions.get(id);
  if (!version) return undefined;

  const updated: Version = {
    ...version,
    read: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.versions.update(id, updated);
  return updated;
}

/**
 * Unmark a Version as read
 */
export async function unmarkVersionAsRead(
  id: string
): Promise<Version | undefined> {
  const version = await db.versions.get(id);
  if (!version) return undefined;

  const updated: Version = {
    ...version,
    read: undefined,
    updatedAt: new Date().toISOString(),
  };

  await db.versions.update(id, updated);
  return updated;
}

/**
 * Toggle favorite status
 */
export async function toggleVersionFavorite(
  id: string
): Promise<Version | undefined> {
  const version = await db.versions.get(id);
  if (!version) return undefined;

  const updated: Version = {
    ...version,
    favorite: !version.favorite,
    updatedAt: new Date().toISOString(),
  };

  await db.versions.update(id, updated);
  return updated;
}

/**
 * List read Versions
 */
export async function listReadVersions(): Promise<Version[]> {
  return db.versions.filter((v) => v.read !== undefined).toArray();
}

/**
 * List favorite Versions
 */
export async function listFavoriteVersions(): Promise<Version[]> {
  return db.versions.where("favorite").equals(1).toArray();
}

/**
 * List Versions by year
 */
export async function listVersionsByYear(year: number): Promise<Version[]> {
  return db.versions.where("year").equals(year).toArray();
}

/**
 * Search Versions by journal
 */
export async function searchVersionsByJournal(
  query: string
): Promise<Version[]> {
  const lowerQuery = query.toLowerCase();
  return db.versions
    .filter(
      (version) => version.journal?.toLowerCase().includes(lowerQuery) ?? false
    )
    .toArray();
}
