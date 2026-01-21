import { eq, and, or, desc, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users,
  projects,
  documents,
  characters,
  timelineNodes,
  aiModelConfigs,
  aiUsageLogs,
  InsertProject,
  InsertDocument,
  InsertCharacter,
  InsertAiModelConfig,
  InsertAiUsageLog,
  InsertTimelineNode,
  InsertDocumentVersion,
  documentVersions,
  InsertCharacterRelationship,
  characterRelationships,
  InsertTimelineConnection,
  timelineConnections,
  InsertExportRecord,
  exportRecords,
  InsertWritingStatistic,
  writingStatistics,
  projectCollaborators,
  InsertProjectCollaborator,
  chatMessages,
  InsertChatMessage
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============= User Operations =============
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============= Project Operations =============
export async function createProject(project: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projects).values(project);
  return result[0].insertId;
}

export async function getUserProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt));
}

export async function getProjectById(projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return result[0];
}

export async function updateProject(projectId: number, updates: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(projects).set(updates).where(eq(projects.id, projectId));
}

export async function deleteProject(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(projects).where(eq(projects.id, projectId));
}

// ============= Document Operations =============
export async function createDocument(document: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(documents).values(document);
  return result[0].insertId;
}

export async function getProjectDocuments(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(documents)
    .where(and(eq(documents.projectId, projectId), eq(documents.isDeleted, false)))
    .orderBy(documents.order);
}

export async function getDocumentsByIds(documentIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  
  if (documentIds.length === 0) return [];
  
  return await db.select().from(documents)
    .where(inArray(documents.id, documentIds));
}

export async function getDocumentById(documentId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  return result[0];
}

export async function updateDocument(documentId: number, updates: Partial<InsertDocument>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(documents).set(updates).where(eq(documents.id, documentId));
}

export async function softDeleteDocument(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(documents).set({ isDeleted: true }).where(eq(documents.id, documentId));
}

// ============= Document Version Operations =============
export async function createDocumentVersion(version: InsertDocumentVersion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(documentVersions).values(version);
  return result[0].insertId;
}

export async function getDocumentVersions(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.versionNumber));
}

// ============= AI Operations =============
export async function getAiModelConfigById(configId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(aiModelConfigs).where(eq(aiModelConfigs.id, configId)).limit(1);
  return result[0];
}

export async function createAiUsageLog(log: InsertAiUsageLog) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create AI usage log: database not available");
    return;
  }
  try {
    await db.insert(aiUsageLogs).values(log);
  } catch (error) {
    console.error("[Database] Failed to create AI usage log:", error);
  }
}

// ============= Character Operations =============
export async function createCharacter(character: InsertCharacter) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(characters).values(character);
  return result[0].insertId;
}

export async function getProjectCharacters(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(characters).where(eq(characters.projectId, projectId));
}

export async function getCharacterById(characterId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1);
  return result[0];
}

export async function updateCharacter(characterId: number, updates: Partial<InsertCharacter>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(characters).set(updates).where(eq(characters.id, characterId));
}

export async function deleteCharacter(characterId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(characters).where(eq(characters.id, characterId));
}

// ============= Character Relationship Operations =============
export async function createCharacterRelationship(relationship: InsertCharacterRelationship) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(characterRelationships).values(relationship);
  return result[0].insertId;
}

export async function getProjectCharacterRelationships(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(characterRelationships).where(eq(characterRelationships.projectId, projectId));
}

export async function deleteCharacterRelationship(relationshipId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(characterRelationships).where(eq(characterRelationships.id, relationshipId));
}

// ============= Timeline Operations =============
export async function createTimelineNode(node: InsertTimelineNode) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(timelineNodes).values(node);
  return result[0].insertId;
}

export async function getProjectTimelineNodes(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(timelineNodes).where(eq(timelineNodes.projectId, projectId));
}

export async function updateTimelineNode(nodeId: number, updates: Partial<InsertTimelineNode>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(timelineNodes).set(updates).where(eq(timelineNodes.id, nodeId));
}

export async function deleteTimelineNode(nodeId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(timelineConnections).where(or(eq(timelineConnections.sourceNodeId, nodeId), eq(timelineConnections.targetNodeId, nodeId)));
  await db.delete(timelineNodes).where(eq(timelineNodes.id, nodeId));
}

export async function createTimelineConnection(connection: InsertTimelineConnection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(timelineConnections).values(connection);
  return result[0].insertId;
}

export async function getProjectTimelineConnections(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(timelineConnections).where(eq(timelineConnections.projectId, projectId));
}

export async function deleteTimelineConnection(connectionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(timelineConnections).where(eq(timelineConnections.id, connectionId));
}

// ============= AI Model Config Operations =============
export async function createAiModelConfig(config: InsertAiModelConfig) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(aiModelConfigs).values(config);
  return result[0].insertId;
}

export async function getUserAiModelConfigs(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(aiModelConfigs)
    .where(and(eq(aiModelConfigs.userId, userId), eq(aiModelConfigs.isActive, true)));
}

export async function updateAiModelConfig(configId: number, updates: Partial<InsertAiModelConfig>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(aiModelConfigs).set(updates).where(eq(aiModelConfigs.id, configId));
}

export async function deleteAiModelConfig(configId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(aiModelConfigs).set({ isActive: false }).where(eq(aiModelConfigs.id, configId));
}

export async function getDefaultAiModelConfig() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(aiModelConfigs)
    .where(and(eq(aiModelConfigs.isActive, true), eq(aiModelConfigs.isDefault, true)))
    .limit(1);
  return result[0];
}

export async function getUserAiUsageLogs(userId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(aiUsageLogs)
    .where(eq(aiUsageLogs.userId, userId))
    .orderBy(desc(aiUsageLogs.createdAt))
    .limit(limit);
}

// ============= Export Record Operations =============
export async function createExportRecord(record: InsertExportRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(exportRecords).values(record);
  return result[0].insertId;
}

export async function getExportRecordById(recordId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(exportRecords).where(eq(exportRecords.id, recordId)).limit(1);
  return result[0];
}

export async function updateExportRecord(recordId: number, updates: Partial<InsertExportRecord>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(exportRecords).set(updates).where(eq(exportRecords.id, recordId));
}

export async function getUserExportRecords(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(exportRecords)
    .where(eq(exportRecords.userId, userId))
    .orderBy(desc(exportRecords.createdAt));
}

// ============= Writing Statistics Operations =============
export async function createOrUpdateWritingStatistic(stat: InsertWritingStatistic) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if record exists for this user, project, and date
  const existing = await db.select().from(writingStatistics)
    .where(and(
      eq(writingStatistics.userId, stat.userId),
      eq(writingStatistics.projectId, stat.projectId ?? 0),
      eq(writingStatistics.date, stat.date)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing record
    await db.update(writingStatistics)
      .set({
        wordsWritten: (existing[0].wordsWritten || 0) + (stat.wordsWritten || 0),
        writingDuration: (existing[0].writingDuration || 0) + (stat.writingDuration || 0),
        aiGeneratedWords: (existing[0].aiGeneratedWords || 0) + (stat.aiGeneratedWords || 0),
        aiUsageCount: (existing[0].aiUsageCount || 0) + (stat.aiUsageCount || 0),
      })
      .where(eq(writingStatistics.id, existing[0].id));
    return existing[0].id;
  } else {
    // Create new record
    const result = await db.insert(writingStatistics).values(stat);
    return result[0].insertId;
  }
}

export async function getUserWritingStatistics(userId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(writingStatistics)
    .where(and(
      eq(writingStatistics.userId, userId),
      // Note: date comparison might need adjustment based on your DB
    ))
    .orderBy(desc(writingStatistics.date));
}

// ============= Project Collaborator Operations =============
export async function addProjectCollaborator(collaborator: InsertProjectCollaborator) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projectCollaborators).values(collaborator);
  return result[0].insertId;
}

export async function getProjectCollaborators(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(projectCollaborators).where(eq(projectCollaborators.projectId, projectId));
}

export async function removeProjectCollaborator(collaboratorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(projectCollaborators).where(eq(projectCollaborators.id, collaboratorId));
}

// ============= Chat Message Operations =============
export async function createChatMessage(message: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(chatMessages).values(message);
  return result[0].insertId;
}

export async function getChatMessages(projectId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  // return descending to get latest first, but client usually wants ascending. 
  // We'll return descending here and reverse in router or client.
  return await db.select().from(chatMessages)
    .where(eq(chatMessages.projectId, projectId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
}
