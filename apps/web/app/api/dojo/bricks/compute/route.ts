/**
 * Dojo Brick Compute API
 *
 * POST /api/dojo/bricks/compute - Compute and update brick states based on attempts
 *
 * This endpoint should be called after completing an attempt to update
 * both the exercise brick and related concept bricks.
 */

import { NextRequest, NextResponse } from "next/server";
import { createPostgresPool } from "@/app/api/lib/postgres";
import { handleCorsOptions, addCorsHeaders } from "@/app/api/lib/cors";
import { requireAuth } from "@/app/api/lib/auth-helpers";
import { logger } from "@deeprecall/telemetry";
import { z } from "zod";
import {
  updateBrickMastery,
  generateExerciseBrickId,
  generateConceptBrickId,
  asExerciseBrickStateId,
  asConceptBrickStateId,
  asConceptNodeId,
  asUserId,
  asExerciseTemplateId,
} from "@deeprecall/dojo-core";
import {
  exerciseAttemptToDomain,
  subtaskAttemptToDomain,
  exerciseBrickToDomain,
  conceptBrickToDomain,
} from "@deeprecall/dojo-data";
import type {
  DojoExerciseAttemptRow,
  DojoSubtaskAttemptRow,
  DojoExerciseBrickRow,
  DojoConceptBrickRow,
  DojoExerciseTemplateRow,
  DbBrickMastery,
} from "@deeprecall/dojo-data";

const pool = createPostgresPool();

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

/**
 * Request schema for computing brick states
 */
const ComputeBrickRequestSchema = z.object({
  templateId: z.string().min(1),
  updateConcepts: z.boolean().optional().default(true),
});

/**
 * POST /api/dojo/bricks/compute
 * Compute and update brick states after an attempt
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();

    // Validate request
    const parseResult = ComputeBrickRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return addCorsHeaders(
        NextResponse.json(
          { error: "Invalid request", details: parseResult.error.issues },
          { status: 400 }
        ),
        req
      );
    }

    const { templateId, updateConcepts } = parseResult.data;
    const now = new Date().toISOString();

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get all attempts for this exercise
      const attemptsResult = await client.query<DojoExerciseAttemptRow>(
        `SELECT * FROM dojo_exercise_attempts 
         WHERE template_id = $1 AND owner_id = $2 
         ORDER BY started_at`,
        [templateId, user.userId]
      );

      if (attemptsResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return addCorsHeaders(
          NextResponse.json(
            { error: "No attempts found for this exercise" },
            { status: 404 }
          ),
          req
        );
      }

      // Get subtask attempts for all these attempts
      const attemptIds = attemptsResult.rows.map((r) => r.id);
      const subtasksResult = await client.query<DojoSubtaskAttemptRow>(
        `SELECT * FROM dojo_subtask_attempts WHERE attempt_id = ANY($1)`,
        [attemptIds]
      );

      // Group subtasks by attempt
      const subtasksByAttempt = new Map<string, DojoSubtaskAttemptRow[]>();
      for (const row of subtasksResult.rows) {
        const existing = subtasksByAttempt.get(row.attempt_id) || [];
        existing.push(row);
        subtasksByAttempt.set(row.attempt_id, existing);
      }

      // Convert to domain objects
      const attempts = attemptsResult.rows.map((row) => {
        const subtaskRows = subtasksByAttempt.get(row.id) || [];
        const subtaskAttempts = subtaskRows.map(subtaskAttemptToDomain);
        return exerciseAttemptToDomain(row, subtaskAttempts);
      });

      // Get existing exercise brick
      const existingBrickResult = await client.query<DojoExerciseBrickRow>(
        `SELECT * FROM dojo_exercise_bricks WHERE template_id = $1 AND owner_id = $2`,
        [templateId, user.userId]
      );

      const existingBrick = existingBrickResult.rows[0]
        ? exerciseBrickToDomain(existingBrickResult.rows[0])
        : undefined;

      // Get cram session IDs (sessions with mode = 'cram')
      const cramSessionsResult = await client.query<{ id: string }>(
        `SELECT id FROM dojo_sessions WHERE mode = 'cram' AND owner_id = $1`,
        [user.userId]
      );
      const cramSessionIds = new Set(cramSessionsResult.rows.map((r) => r.id));

      // Compute new mastery
      const newMetrics = updateBrickMastery(
        existingBrick?.metrics,
        attempts,
        cramSessionIds
      );

      // Keep track of recent attempts (last 10)
      const recentAttemptIds = attempts
        .sort(
          (a, b) =>
            new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
        )
        .slice(0, 10)
        .map((a) => a.id);

      // Upsert exercise brick
      const brickId =
        existingBrick?.id ||
        generateExerciseBrickId(
          asUserId(user.userId),
          asExerciseTemplateId(templateId)
        );
      const metricsJson: DbBrickMastery = {
        mastery_score: newMetrics.masteryScore,
        stability_score: newMetrics.stabilityScore,
        avg_accuracy: newMetrics.avgAccuracy,
        median_time_seconds: newMetrics.medianTimeSeconds,
        best_time_seconds: newMetrics.bestTimeSeconds,
        worst_time_seconds: newMetrics.worstTimeSeconds,
        last_practiced_at: newMetrics.lastPracticedAt,
        total_attempts: newMetrics.totalAttempts,
        total_variants: newMetrics.totalVariants,
        cram_sessions_count: newMetrics.cramSessionsCount,
        correct_streak: newMetrics.correctStreak,
        trend: newMetrics.trend,
        mastered_at: newMetrics.masteredAt,
      };

      await client.query(
        `INSERT INTO dojo_exercise_bricks (
          id, owner_id, template_id, metrics, recent_attempt_ids, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (template_id, owner_id) DO UPDATE SET
          metrics = $4,
          recent_attempt_ids = $5,
          updated_at = $7`,
        [
          brickId,
          user.userId,
          templateId,
          JSON.stringify(metricsJson),
          recentAttemptIds,
          existingBrick?.createdAt || now,
          now,
        ]
      );

      const exerciseBrick = {
        id: brickId,
        userId: asUserId(user.userId),
        templateId: asExerciseTemplateId(templateId),
        metrics: newMetrics,
        recentAttemptIds,
        createdAt: existingBrick?.createdAt || now,
        updatedAt: now,
      };

      // Update concept bricks if requested
      if (updateConcepts) {
        // Get exercise template to find linked concepts
        const templateResult = await client.query<DojoExerciseTemplateRow>(
          `SELECT * FROM dojo_exercise_templates WHERE id = $1 AND owner_id = $2`,
          [templateId, user.userId]
        );

        if (templateResult.rows.length > 0) {
          const template = templateResult.rows[0];
          const conceptIds = [
            ...(template.primary_concept_ids || []),
            ...(template.supporting_concept_ids || []),
          ];

          // For each concept, aggregate mastery from all linked exercises
          for (const conceptId of conceptIds) {
            // Get all exercise bricks for exercises linked to this concept
            const linkedBricksResult = await client.query<DojoExerciseBrickRow>(
              `SELECT eb.* FROM dojo_exercise_bricks eb
               JOIN dojo_exercise_templates et ON et.id = eb.template_id
               WHERE eb.owner_id = $1 
               AND ($2 = ANY(et.primary_concept_ids) OR $2 = ANY(et.supporting_concept_ids) OR $2 = ANY(et.concept_ids))`,
              [user.userId, conceptId]
            );

            if (linkedBricksResult.rows.length > 0) {
              // Average the mastery scores from linked exercises
              const linkedBricks = linkedBricksResult.rows.map(
                exerciseBrickToDomain
              );
              const avgMasteryScore = Math.round(
                linkedBricks.reduce(
                  (sum, b) => sum + b.metrics.masteryScore,
                  0
                ) / linkedBricks.length
              );
              const avgStabilityScore = Math.round(
                linkedBricks.reduce(
                  (sum, b) => sum + b.metrics.stabilityScore,
                  0
                ) / linkedBricks.length
              );
              const avgAccuracy =
                linkedBricks.reduce(
                  (sum, b) => sum + b.metrics.avgAccuracy,
                  0
                ) / linkedBricks.length;

              // Get existing concept brick
              const existingConceptBrickResult =
                await client.query<DojoConceptBrickRow>(
                  `SELECT * FROM dojo_concept_bricks WHERE concept_id = $1 AND owner_id = $2`,
                  [conceptId, user.userId]
                );

              const existingConceptBrick = existingConceptBrickResult.rows[0]
                ? conceptBrickToDomain(existingConceptBrickResult.rows[0])
                : undefined;

              const conceptBrickId =
                existingConceptBrick?.id ||
                generateConceptBrickId(
                  asUserId(user.userId),
                  asConceptNodeId(conceptId)
                );

              // Aggregate metrics for concept brick
              const conceptMetrics: DbBrickMastery = {
                mastery_score: avgMasteryScore,
                stability_score: avgStabilityScore,
                avg_accuracy: avgAccuracy,
                median_time_seconds: null,
                best_time_seconds: null,
                worst_time_seconds: null,
                last_practiced_at: newMetrics.lastPracticedAt,
                total_attempts: linkedBricks.reduce(
                  (sum, b) => sum + b.metrics.totalAttempts,
                  0
                ),
                total_variants: linkedBricks.reduce(
                  (sum, b) => sum + b.metrics.totalVariants,
                  0
                ),
                cram_sessions_count: linkedBricks.reduce(
                  (sum, b) => sum + b.metrics.cramSessionsCount,
                  0
                ),
                correct_streak: Math.max(
                  ...linkedBricks.map((b) => b.metrics.correctStreak)
                ),
                trend: newMetrics.trend, // Use the triggering exercise's trend
                mastered_at:
                  avgMasteryScore >= 70 &&
                  !existingConceptBrick?.metrics.masteredAt
                    ? now
                    : (existingConceptBrick?.metrics.masteredAt ?? null),
              };

              await client.query(
                `INSERT INTO dojo_concept_bricks (
                  id, owner_id, concept_id, metrics, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (concept_id, owner_id) DO UPDATE SET
                  metrics = $4,
                  updated_at = $6`,
                [
                  conceptBrickId,
                  user.userId,
                  conceptId,
                  JSON.stringify(conceptMetrics),
                  existingConceptBrick?.createdAt || now,
                  now,
                ]
              );
            }
          }
        }
      }

      await client.query("COMMIT");

      logger.info("api.dojo", "Computed brick states", {
        userId: user.userId,
        templateId,
        masteryScore: newMetrics.masteryScore,
        totalAttempts: newMetrics.totalAttempts,
      });

      return addCorsHeaders(
        NextResponse.json({
          exerciseBrick,
          conceptBricksUpdated: updateConcepts,
        }),
        req
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error("api.dojo", "Failed to compute bricks", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

    return addCorsHeaders(
      NextResponse.json({ error: "Failed to compute bricks" }, { status: 500 }),
      req
    );
  }
}
