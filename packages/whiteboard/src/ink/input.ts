/**
 * Input - Pointer Events Normalization
 * Unified handling for pen, mouse, and touch input
 */

import type { Point } from "../core/math";

/**
 * Normalized pointer sample with pressure and tilt
 */
export interface PointerSample {
  x: number;
  y: number;
  pressure: number;
  timestamp: number; // Absolute time in ms
  tiltX?: number;
  tiltY?: number;
  buttons: number;
  pointerId: number;
  pointerType: "pen" | "mouse" | "touch";
}

/**
 * Pointer event type
 */
export type PointerEventType = "down" | "move" | "up" | "cancel";

/**
 * Normalize browser PointerEvent to our format
 */
export function normalizePointerEvent(
  e: PointerEvent,
  canvasRect: DOMRect
): PointerSample {
  return {
    x: e.clientX - canvasRect.left,
    y: e.clientY - canvasRect.top,
    pressure: e.pressure || (e.buttons > 0 ? 0.5 : 0),
    timestamp: e.timeStamp,
    tiltX: e.tiltX,
    tiltY: e.tiltY,
    buttons: e.buttons,
    pointerId: e.pointerId,
    pointerType: e.pointerType as "pen" | "mouse" | "touch",
  };
}

/**
 * Get coalesced events (for high-frequency stylus input)
 */
export function getCoalescedSamples(
  e: PointerEvent,
  canvasRect: DOMRect
): PointerSample[] {
  if (!e.getCoalescedEvents) {
    return [normalizePointerEvent(e, canvasRect)];
  }

  const coalescedEvents = e.getCoalescedEvents();
  if (coalescedEvents.length === 0) {
    return [normalizePointerEvent(e, canvasRect)];
  }

  return coalescedEvents.map((event) =>
    normalizePointerEvent(event, canvasRect)
  );
}

/**
 * Simple palm rejection heuristic
 * Returns true if the pointer should be ignored
 */
export function isPalmRejected(
  sample: PointerSample,
  prevSample?: PointerSample
): boolean {
  // Reject touch events if a pen is already active
  // (More sophisticated palm rejection would use contact size, timing, etc.)

  // For now, just accept all input
  return false;
}

/**
 * Sample rate throttling for different speeds
 * Returns true if this sample should be added to the stroke
 */
export function shouldAddSample(
  sample: PointerSample,
  prevSample: PointerSample | null,
  lastAddedTime: number
): boolean {
  if (!prevSample) return true;

  const timeDelta = sample.timestamp - lastAddedTime;
  const dx = sample.x - prevSample.x;
  const dy = sample.y - prevSample.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const speed = timeDelta > 0 ? distance / timeDelta : 0; // pixels per ms

  // Adaptive threshold: slower strokes need more filtering
  // Fast strokes (speed > 1): sample every 10ms, min 2px
  // Medium strokes (speed 0.3-1): sample every 20ms, min 3px
  // Slow strokes (speed < 0.3): sample every 40ms, min 5px
  let minInterval = 20;
  let minDistance = 3;

  if (speed > 1) {
    minInterval = 10;
    minDistance = 2;
  } else if (speed < 0.3) {
    minInterval = 40;
    minDistance = 5;
  }

  // Require BOTH time and distance thresholds
  return timeDelta >= minInterval && distance >= minDistance;
}
