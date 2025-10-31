/**
 * Example: Using the Inking API
 *
 * This file demonstrates the clear abstraction layers:
 * 1. Platform-specific pointer events → Platform-agnostic PointerSample
 * 2. PointerSample → Tool-specific inking behavior
 * 3. Inking behavior → StrokePoint (for storage)
 */

import {
  normalizePointerEvent,
  getCoalescedSamples,
  type PointerSample,
} from "./input";
import {
  getTool,
  getInkingTool,
  isInkingTool,
  type ToolId,
  type InkingTool,
} from "./tools";
import { createInkingEngine, type StrokePoint } from "./inking";
import { GestureFSM } from "./gestures";
import { logger } from "@deeprecall/telemetry";

/**
 * Example 1: Basic stroke creation with a pen tool
 */
export function exampleBasicStroke() {
  // 1. Get tool configuration
  const penTool = getInkingTool("pen");

  // 2. Create inking engine with tool's behavior
  const engine = createInkingEngine(penTool.inking, penTool.visual.baseWidth);

  // 3. Simulate pointer events (in real app, these come from the browser)
  const samples: PointerSample[] = [
    {
      x: 10,
      y: 10,
      pressure: 0.5,
      timestamp: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: "pen",
    },
    {
      x: 20,
      y: 15,
      pressure: 0.7,
      timestamp: 16,
      buttons: 1,
      pointerId: 1,
      pointerType: "pen",
    },
    {
      x: 30,
      y: 25,
      pressure: 0.9,
      timestamp: 32,
      buttons: 1,
      pointerId: 1,
      pointerType: "pen",
    },
    {
      x: 40,
      y: 40,
      pressure: 0.6,
      timestamp: 48,
      buttons: 1,
      pointerId: 1,
      pointerType: "pen",
    },
  ];

  // 4. Process samples through inking engine
  engine.start(samples[0]);
  for (let i = 1; i < samples.length; i++) {
    engine.addSample(samples[i]);
  }

  // 5. Get final stroke points (smoothed, with computed widths)
  const strokePoints: StrokePoint[] = engine.finalize();

  logger.debug("ink", "Created stroke", {
    pointCount: strokePoints.length,
    firstPoint: strokePoints[0],
    lastPoint: strokePoints[strokePoints.length - 1],
  });

  return strokePoints;
}

/**
 * Example 2: Real-time stroke preview during drawing
 */
export class StrokePreviewHandler {
  private engine: ReturnType<typeof createInkingEngine> | null = null;
  private currentTool: InkingTool | null = null;

  /**
   * Start drawing with a specific tool
   */
  startDrawing(toolId: ToolId, sample: PointerSample) {
    const tool = getTool(toolId);

    if (!isInkingTool(tool)) {
      throw new Error(`Tool ${toolId} is not an inking tool`);
    }

    this.currentTool = tool;
    this.engine = createInkingEngine(tool.inking, tool.visual.baseWidth);

    this.engine.start(sample);
  }

  /**
   * Continue drawing (called on pointer move)
   * Returns current preview points for rendering
   */
  continueDrawing(sample: PointerSample): StrokePoint[] {
    if (!this.engine) return [];

    const update = this.engine.addSample(sample);

    if (update.accepted) {
      return update.points;
    }

    // Append live cursor point so renderers can draw to the current pointer
    return [...update.points, update.livePoint];
  }

  /**
   * Finish drawing (called on pointer up)
   * Returns final stroke points for storage
   */
  finishDrawing(): StrokePoint[] {
    if (!this.engine) return [];

    const points = this.engine.finalize();
    this.engine = null;
    this.currentTool = null;

    return points;
  }

  /**
   * Cancel drawing
   */
  cancelDrawing() {
    if (this.engine) {
      this.engine.reset();
      this.engine = null;
      this.currentTool = null;
    }
  }
}

/**
 * Example 3: Complete gesture handling with tool switching
 */
export class DrawingController {
  private gestureFSM: GestureFSM;
  private inkingEngine: ReturnType<typeof createInkingEngine> | null = null;
  private canvasRect: DOMRect;

  constructor(canvas: HTMLCanvasElement, initialTool: ToolId = "pen") {
    this.gestureFSM = new GestureFSM(initialTool);
    this.canvasRect = canvas.getBoundingClientRect();

    // Set up event listeners
    canvas.addEventListener("pointerdown", this.handlePointerDown.bind(this));
    canvas.addEventListener("pointermove", this.handlePointerMove.bind(this));
    canvas.addEventListener("pointerup", this.handlePointerUp.bind(this));
    canvas.addEventListener(
      "pointercancel",
      this.handlePointerCancel.bind(this)
    );
  }

  /**
   * Switch to a different tool
   */
  setTool(toolId: ToolId) {
    this.gestureFSM.setTool(toolId);
    this.cancelCurrentStroke();
  }

  private handlePointerDown(e: PointerEvent) {
    // 1. Convert platform-specific event to platform-agnostic sample
    const samples = getCoalescedSamples(e, this.canvasRect);
    const sample = samples[samples.length - 1]; // Use latest

    // 2. Update gesture FSM
    const isPanButton = e.button === 1 || e.button === 2; // Middle or right click
    this.gestureFSM.onPointerDown(sample, isPanButton);

    // 3. If drawing gesture, create inking engine
    const state = this.gestureFSM.getState();
    if (state.type === "drawing") {
      const toolId = this.gestureFSM.getTool();
      const tool = getTool(toolId);

      if (isInkingTool(tool)) {
        this.inkingEngine = createInkingEngine(
          tool.inking,
          tool.visual.baseWidth
        );
        this.inkingEngine.start(sample);
      }
    }
  }

  private handlePointerMove(e: PointerEvent) {
    // 1. Get coalesced samples for smooth stylus input
    const samples = getCoalescedSamples(e, this.canvasRect);

    // 2. Update gesture FSM
    let latestPreview: StrokePoint[] | null = null;

    for (const sample of samples) {
      this.gestureFSM.onPointerMove(sample);

      // 3. If drawing, add samples to inking engine
      if (this.inkingEngine) {
        const update = this.inkingEngine.addSample(sample);
        latestPreview = update.accepted
          ? update.points
          : [...update.points, update.livePoint];
      }
    }

    // 4. Get preview points and render
    if (this.inkingEngine && latestPreview) {
      this.renderStrokePreview(latestPreview);
    }
  }

  private handlePointerUp(e: PointerEvent) {
    const sample = normalizePointerEvent(e, this.canvasRect);

    // 1. Complete gesture
    const completedGesture = this.gestureFSM.onPointerUp(sample);

    // 2. If drawing gesture completed, finalize stroke
    if (completedGesture.type === "drawing" && this.inkingEngine) {
      const finalPoints = this.inkingEngine.finalize();
      this.commitStroke(finalPoints);
      this.inkingEngine = null;
    }
  }

  private handlePointerCancel(e: PointerEvent) {
    this.gestureFSM.cancel();
    this.cancelCurrentStroke();
  }

  private cancelCurrentStroke() {
    if (this.inkingEngine) {
      this.inkingEngine.reset();
      this.inkingEngine = null;
    }
    this.clearStrokePreview();
  }

  private renderStrokePreview(points: StrokePoint[]) {
    // TODO: Implement rendering logic
    logger.debug("ink", "Rendering preview", { pointCount: points.length });
  }

  private clearStrokePreview() {
    // TODO: Implement clear preview logic
    logger.debug("ink", "Clearing preview");
  }

  private commitStroke(points: StrokePoint[]) {
    // TODO: Save stroke to database
    logger.debug("ink", "Committing stroke", { pointCount: points.length });
    const toolId = this.gestureFSM.getTool();
    const tool = getTool(toolId);

    if (isInkingTool(tool)) {
      logger.debug("ink", "Stroke style", {
        color: tool.visual.color,
        opacity: tool.visual.opacity,
        toolId: tool.id,
      });
    }
  }
}

/**
 * Example 4: Comparing different smoothing algorithms
 */
export function exampleCompareSmoothingAlgorithms() {
  // Sample input points
  const samples: PointerSample[] = [
    {
      x: 0,
      y: 0,
      pressure: 0.5,
      timestamp: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: "pen",
    },
    {
      x: 10,
      y: 5,
      pressure: 0.6,
      timestamp: 16,
      buttons: 1,
      pointerId: 1,
      pointerType: "pen",
    },
    {
      x: 20,
      y: 15,
      pressure: 0.7,
      timestamp: 32,
      buttons: 1,
      pointerId: 1,
      pointerType: "pen",
    },
    {
      x: 30,
      y: 30,
      pressure: 0.8,
      timestamp: 48,
      buttons: 1,
      pointerId: 1,
      pointerType: "pen",
    },
  ];

  // Test with different tools (each has different smoothing)
  const toolIds: ToolId[] = ["pen", "highlighter", "pencil"];

  for (const toolId of toolIds) {
    const tool = getTool(toolId);

    if (isInkingTool(tool)) {
      const engine = createInkingEngine(tool.inking, tool.visual.baseWidth);

      engine.start(samples[0]);
      for (let i = 1; i < samples.length; i++) {
        engine.addSample(samples[i]);
      }

      const points = engine.finalize();
      logger.debug("ink", "Tool comparison", {
        toolName: tool.name,
        algorithm: tool.inking.smoothing.algorithm,
        pointCount: points.length,
      });
    }
  }
}

/**
 * Example 5: Custom tool configuration
 */
export function exampleCustomTool() {
  // Create a custom tool configuration
  const customTool: InkingTool = {
    id: "pen", // Reuse pen ID
    type: "inking",
    name: "Custom Pen",
    icon: "pen",
    visual: {
      color: "#ff0000", // Red
      baseWidth: 3,
      opacity: 0.9,
    },
    inking: {
      pointDistribution: {
        algorithm: "hybrid",
        minDistance: 1.5,
        minInterval: 8,
        speedAdaptive: true,
      },
      smoothing: {
        algorithm: "catmull-rom",
        segmentsPerSpan: 20, // More segments = smoother
        simplifyTolerance: 0.3,
      },
      pressureResponse: {
        curve: "ease-in-out",
        sensitivity: 0.8, // High pressure sensitivity
        minWidth: 0.3,
        maxWidth: 2.5,
      },
      speedResponse: {
        enabled: true,
        minSpeed: 0.1,
        maxSpeed: 3.0,
        widthMultiplier: 0.4, // Strong speed response
      },
    },
  };

  // Use custom tool
  const engine = createInkingEngine(
    customTool.inking,
    customTool.visual.baseWidth
  );

  logger.debug("ink", "Created custom tool", { toolName: customTool.name });
  return engine;
}
