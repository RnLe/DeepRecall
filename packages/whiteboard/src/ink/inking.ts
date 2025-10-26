/**
 * Inking - Mathematical API for converting pointer samples to stroke points
 * This is the typographic control layer that defines how strokes are created
 */

import type { PointerSample } from "./input";

/**
 * Point distribution algorithms
 * Controls how points are placed along the stroke
 */
export type PointDistributionAlgorithm = "distance" | "time" | "hybrid";

export interface PointDistributionConfig {
  algorithm: PointDistributionAlgorithm;
  minDistance: number; // Minimum distance between points (world units)
  minInterval: number; // Minimum time between points (ms)
  speedAdaptive: boolean; // Adapt spacing based on pen speed
}

/**
 * Smoothing algorithms
 * Controls how raw points are interpolated
 */
export type SmoothingAlgorithm =
  | "none"
  | "catmull-rom"
  | "bezier"
  | "exponential";

export interface SmoothingConfig {
  algorithm: SmoothingAlgorithm;
  // For catmull-rom and bezier
  segmentsPerSpan?: number;
  // For exponential
  alpha?: number; // 0-1, smoothing factor
  // Simplification (applied after smoothing)
  simplifyTolerance?: number;
}

/**
 * Pressure response curves
 * Controls how pen pressure affects stroke width
 */
export type PressureCurve =
  | "constant"
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out";

export interface PressureResponseConfig {
  curve: PressureCurve;
  sensitivity: number; // 0-1, how much pressure affects width
  minWidth: number; // Multiplier for minimum pressure
  maxWidth: number; // Multiplier for maximum pressure
}

/**
 * Speed response configuration
 * Controls how pen speed affects stroke width/opacity
 */
export interface SpeedResponseConfig {
  enabled: boolean;
  minSpeed: number; // pixels per ms
  maxSpeed: number; // pixels per ms
  widthMultiplier: number; // How much speed affects width
}

/**
 * Complete inking behavior configuration
 */
export interface InkingBehaviorConfig {
  pointDistribution: PointDistributionConfig;
  smoothing: SmoothingConfig;
  pressureResponse: PressureResponseConfig;
  speedResponse: SpeedResponseConfig;
}

/**
 * Stroke point with computed width
 * Output format for storage (matches StrokePoint schema)
 */
export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  width?: number; // Computed effective width
  timestamp: number; // Relative to stroke start
  tiltX?: number;
  tiltY?: number;
}

export interface StrokeUpdate {
  /**
   * True when the distribution thresholds accepted the sample and a new point
   * was appended to the committed stroke.
   */
  accepted: boolean;
  /**
   * The latest committed point when {@link accepted} is true, otherwise null.
   */
  committedPoint: StrokePoint | null;
  /**
   * Live cursor point mapped to board space for real-time preview.
   */
  livePoint: StrokePoint;
  /**
   * Immutable snapshot of committed points after processing the sample.
   */
  points: StrokePoint[];
}

/**
 * Inking engine - converts pointer samples to stroke points
 * Stateful processor that maintains smoothing state
 */
export class InkingEngine {
  private config: InkingBehaviorConfig;
  private baseWidth: number;
  private samples: PointerSample[] = [];
  private committedPoints: StrokePoint[] = [];
  private lastAddedSample: PointerSample | null = null;
  private lastAddedTime: number = 0;
  private startTime: number = 0;
  private lastLivePoint: StrokePoint | null = null;

  constructor(config: InkingBehaviorConfig, baseWidth: number) {
    this.config = config;
    this.baseWidth = baseWidth;
  }

  /**
   * Start a new stroke and return the initial committed point.
   */
  start(sample: PointerSample): StrokePoint {
    this.reset();

    this.samples = [sample];
    this.lastAddedSample = sample;
    this.lastAddedTime = sample.timestamp;
    this.startTime = sample.timestamp;

    const initialPoint = this.sampleToStrokePoint(sample, null);
    this.committedPoints = [initialPoint];
    this.lastLivePoint = initialPoint;

    return initialPoint;
  }

  /**
   * Process a sample.
   * Returns detailed update information for rendering.
   */
  addSample(sample: PointerSample): StrokeUpdate {
    if (this.samples.length === 0) {
      const committed = this.start(sample);
      return {
        accepted: true,
        committedPoint: committed,
        livePoint: committed,
        points: this.committedPoints,
      };
    }

    this.samples.push(sample);

    const previousSample =
      this.samples.length > 1 ? this.samples[this.samples.length - 2] : null;
    const livePoint = this.sampleToStrokePoint(sample, previousSample);

    let accepted = false;
    let committedPoint: StrokePoint | null = null;

    if (this.shouldAddSample(sample)) {
      committedPoint = this.sampleToStrokePoint(sample, this.lastAddedSample);

      this.committedPoints = [...this.committedPoints, committedPoint];
      this.lastAddedSample = sample;
      this.lastAddedTime = sample.timestamp;
      accepted = true;
      this.lastLivePoint = committedPoint;
    } else {
      this.lastLivePoint = livePoint;
    }

    return {
      accepted,
      committedPoint,
      livePoint: this.lastLivePoint,
      points: this.committedPoints,
    };
  }

  /**
   * Get current stroke points (for live preview)
   * Minimal geometric smoothing - rely on rendering smoothing for visual quality
   */
  getCurrentPoints(): StrokePoint[] {
    return this.committedPoints;
  }

  /**
   * Finalize the stroke and return final points
   */
  finalize(): StrokePoint[] {
    if (this.lastLivePoint && this.committedPoints.length > 0) {
      const lastPoint = this.committedPoints[this.committedPoints.length - 1];
      if (!this.arePointsNear(lastPoint, this.lastLivePoint)) {
        const finalPoint: StrokePoint = {
          ...this.lastLivePoint,
          timestamp: Math.max(
            this.lastLivePoint.timestamp,
            lastPoint.timestamp
          ),
        };
        this.committedPoints = [...this.committedPoints, finalPoint];
      }
    }

    const points = this.committedPoints;
    this.reset();
    return points;
  }

  /**
   * Reset engine state
   */
  reset(): void {
    this.samples = [];
    this.committedPoints = [];
    this.lastAddedSample = null;
    this.lastAddedTime = 0;
    this.startTime = 0;
    this.lastLivePoint = null;
  }

  /**
   * Get number of samples collected
   */
  getSampleCount(): number {
    return this.samples.length;
  }

  // Private methods

  /**
   * Check if sample should be added based on distribution config
   */
  private shouldAddSample(sample: PointerSample): boolean {
    if (!this.lastAddedSample) return true;

    const config = this.config.pointDistribution;
    const timeDelta = sample.timestamp - this.lastAddedTime;
    const dx = sample.x - this.lastAddedSample.x;
    const dy = sample.y - this.lastAddedSample.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Calculate speed (pixels per ms)
    const speed = timeDelta > 0 ? distance / timeDelta : 0;

    // Adaptive thresholds based on speed
    let minDistance = config.minDistance;
    let minInterval = config.minInterval;

    if (config.speedAdaptive) {
      // Fast strokes: tighter sampling for accuracy
      if (speed > 1.0) {
        minDistance *= 0.8;
        minInterval *= 0.7;
      }
      // Slow strokes: normal sampling
      else if (speed < 0.2) {
        minDistance *= 1.2;
        minInterval *= 1.3;
      }
    }

    // Check based on algorithm
    switch (config.algorithm) {
      case "distance":
        return distance >= minDistance;

      case "time":
        return timeDelta >= minInterval;

      case "hybrid":
        // Require BOTH distance and time thresholds
        return distance >= minDistance && timeDelta >= minInterval;

      default:
        return true;
    }
  }

  private sampleToStrokePoint(
    sample: PointerSample,
    previousSample: PointerSample | null
  ): StrokePoint {
    const speed = this.config.speedResponse.enabled
      ? this.calculateSpeed(sample, previousSample)
      : 0;

    const width = this.calculateWidth(sample.pressure, speed, this.baseWidth);

    return {
      x: sample.x,
      y: sample.y,
      pressure: sample.pressure,
      width,
      timestamp: sample.timestamp - this.startTime,
      tiltX: sample.tiltX,
      tiltY: sample.tiltY,
    };
  }

  private calculateSpeed(
    current: PointerSample,
    previous: PointerSample | null
  ): number {
    if (!previous) return 0;

    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const timeDelta = current.timestamp - previous.timestamp;

    if (timeDelta <= 0) {
      return 0;
    }

    return distance / timeDelta;
  }

  /**
   * Calculate effective width based on pressure and speed
   */
  private calculateWidth(
    pressure: number,
    speed: number,
    baseWidth: number
  ): number {
    const pressureConfig = this.config.pressureResponse;
    const speedConfig = this.config.speedResponse;

    // Apply pressure curve
    const normalizedPressure = this.applyPressureCurve(
      pressure,
      pressureConfig.curve
    );

    // Map to width range
    const pressureWidth =
      pressureConfig.minWidth +
      (pressureConfig.maxWidth - pressureConfig.minWidth) *
        normalizedPressure *
        pressureConfig.sensitivity;

    let width = baseWidth * pressureWidth;

    // Apply speed response
    if (speedConfig.enabled && speed > 0) {
      const speedRange = speedConfig.maxSpeed - speedConfig.minSpeed;
      const normalizedSpeed = Math.max(
        0,
        Math.min(1, (speed - speedConfig.minSpeed) / speedRange)
      );

      // Faster = thinner (inverse relationship)
      const speedMultiplier = 1 - normalizedSpeed * speedConfig.widthMultiplier;
      width *= speedMultiplier;
    }

    return Math.max(baseWidth, width);
  }

  /**
   * Apply pressure curve transformation
   */
  private applyPressureCurve(pressure: number, curve: PressureCurve): number {
    // Clamp pressure to 0-1
    const p = Math.max(0, Math.min(1, pressure));

    switch (curve) {
      case "constant":
        return 0.5; // Ignore pressure, use middle value

      case "linear":
        return p;

      case "ease-in":
        return p * p; // Quadratic ease-in

      case "ease-out":
        return 1 - (1 - p) * (1 - p); // Quadratic ease-out

      case "ease-in-out":
        return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

      default:
        return p;
    }
  }

  private arePointsNear(a: StrokePoint, b: StrokePoint): boolean {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const distanceSq = dx * dx + dy * dy;
    return distanceSq < 0.25; // ~0.5 world units tolerance
  }
}

/**
 * Create an inking engine from a tool configuration
 */
export function createInkingEngine(
  config: InkingBehaviorConfig,
  baseWidth: number
): InkingEngine {
  return new InkingEngine(config, baseWidth);
}
