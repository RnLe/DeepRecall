/**
 * WhiteboardView - Main Canvas Component
 * Orchestrates all whiteboard functionality with modern UI
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { StrokePoint, StrokeStyle, ShapeMetadata } from "@deeprecall/core";
import {
  useStrokes,
  useCreateStroke,
  useDeleteStrokes,
} from "@deeprecall/data";
import {
  Camera,
  calculateBoundingBox,
  BOARD_CONFIG,
  type Point,
} from "@deeprecall/whiteboard/core";
import { BoardOrchestrator } from "@deeprecall/whiteboard/board";
import {
  strokeToSceneObject,
  type StrokeObject,
} from "@deeprecall/whiteboard/scene";
import {
  createRenderContext,
  clearCanvas,
  applyTransform,
  restoreTransform,
  drawBoard,
  drawObject,
  MinimapRenderer,
  PixiRenderer,
  createPixiApp,
  destroyPixiApp,
  resizePixiApp,
} from "@deeprecall/whiteboard/render";
import type { PixiApp } from "@deeprecall/whiteboard/render";
import {
  GestureFSM,
  type ToolId,
  normalizePointerEvent,
  getCoalescedSamples,
  type PointerSample,
  getTool,
  isInkingTool,
  isEraserTool,
  createInkingEngine,
  type InkingEngine,
  renderSmoothStroke,
  AidDetector,
  type AidState,
  createDefaultAidState,
  calculateVelocity,
  calculateRecentVelocity,
} from "@deeprecall/whiteboard/ink";
import { DebugOverlay, type DebugStats } from "./DebugOverlay";

export interface WhiteboardViewProps {
  boardId: string;
  toolId: ToolId;
  onToolChange?: (toolId: ToolId) => void;
  brushColor?: string;
  brushWidth?: number;
  className?: string;
  showDebug?: boolean;
  onDebugClose?: () => void;
}

export function WhiteboardView({
  boardId,
  toolId,
  onToolChange,
  brushColor = "#000000",
  brushWidth = 2,
  className = "",
  showDebug = false,
  onDebugClose,
}: WhiteboardViewProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);

  // Engine instances
  const cameraRef = useRef<Camera | null>(null);
  const orchestratorRef = useRef<BoardOrchestrator | null>(null);
  const gestureFSMRef = useRef<GestureFSM | null>(null);
  const inkingEngineRef = useRef<InkingEngine | null>(null);
  const minimapRef = useRef<MinimapRenderer | null>(null);
  const eraserHitsRef = useRef<Set<string>>(new Set());
  const renderCanvasRef = useRef<() => void>(() => {});
  const renderMinimapRef = useRef<() => void>(() => {});
  const pixiAppRef = useRef<PixiApp | null>(null);
  const pixiRendererRef = useRef<PixiRenderer | null>(null);
  const pixiTickerCallbackRef = useRef<(() => void) | null>(null);
  const initializationAttemptedRef = useRef<boolean>(false);
  const initializingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererModeRef = useRef<"initializing" | "pixi" | "canvas">(
    "initializing"
  );
  const aidDetectorRef = useRef<AidDetector | null>(null);
  const aidStateRef = useRef<AidState | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const velocityPollingRef = useRef<NodeJS.Timeout | null>(null); // For continuous velocity updates

  const [rendererMode, setRendererMode] = useState<
    "initializing" | "pixi" | "canvas"
  >("initializing");

  // State
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [currentStrokePreview, setCurrentStrokePreview] = useState<
    StrokePoint[]
  >([]);
  const [liveCursorPoint, setLiveCursorPoint] = useState<StrokePoint | null>(
    null
  ); // Live point that follows cursor during drawing

  // Debug state
  const [showStrokeVisualization, setShowStrokeVisualization] = useState(false);
  const [debugStats, setDebugStats] = useState<DebugStats>({
    fps: 0,
    frameTime: 0,
    renderer: "canvas",
    strokeCount: 0,
    pointCount: 0,
    visibleStrokes: 0,
    cameraX: 0,
    cameraY: 0,
    cameraZoom: 1,
    viewportWidth: 0,
    viewportHeight: 0,
    toolId,
    brushColor,
    brushWidth,
    cursorScreen: { x: 0, y: 0 },
    cursorBoard: { x: 0, y: 0 },
    aidStillness: false,
    aidCurrentStrokePoints: 0,
    aidStartEndDistance: 0,
    aidDetectedShape: null,
    aidCurrentVelocity: 0,
    aidStrokeDuration: 0,
  });

  // Data hooks
  const { data: strokes = [] } = useStrokes(boardId);
  const createStroke = useCreateStroke();
  const deleteStrokes = useDeleteStrokes();

  // Debug refs to avoid stale closures
  const showDebugRef = useRef(showDebug);
  const canvasSizeRef = useRef(canvasSize);
  const strokeMetricsRef = useRef({
    strokeCount: strokes.length,
    pointCount: strokes.reduce((sum, stroke) => sum + stroke.points.length, 0),
  });
  const visibleStrokeCountRef = useRef(0);
  const mousePosRef = useRef(mousePos);
  const toolIdRef = useRef(toolId);
  const brushColorRef = useRef(brushColor);
  const brushWidthRef = useRef(brushWidth);
  const aidStatsRef = useRef({
    stillness: false,
    currentStrokePoints: 0,
    startEndDistance: 0,
    detectedShape: null as string | null,
    currentVelocity: 0,
    strokeDuration: 0,
  });

  const resetAidStats = useCallback(() => {
    aidStatsRef.current = {
      stillness: false,
      currentStrokePoints: 0,
      startEndDistance: 0,
      detectedShape: null,
      currentVelocity: 0,
      strokeDuration: 0,
    };
  }, []);

  useEffect(() => {
    showDebugRef.current = showDebug;
  }, [showDebug]);

  useEffect(() => {
    if (!showDebug) {
      setShowStrokeVisualization(false);
    }
  }, [showDebug]);

  useEffect(() => {
    canvasSizeRef.current = canvasSize;
  }, [canvasSize]);

  useEffect(() => {
    strokeMetricsRef.current = {
      strokeCount: strokes.length,
      pointCount: strokes.reduce(
        (sum, stroke) => sum + stroke.points.length,
        0
      ),
    };
  }, [strokes]);

  useEffect(() => {
    mousePosRef.current = mousePos;
  }, [mousePos]);

  useEffect(() => {
    toolIdRef.current = toolId;
  }, [toolId]);

  useEffect(() => {
    brushColorRef.current = brushColor;
  }, [brushColor]);

  useEffect(() => {
    brushWidthRef.current = brushWidth;
  }, [brushWidth]);

  const handleDebugClose = useCallback(() => {
    setShowStrokeVisualization(false);
    if (onDebugClose) {
      onDebugClose();
    }
  }, [onDebugClose]);

  // Initialize engines
  useEffect(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0) return;

    if (!cameraRef.current) {
      cameraRef.current = new Camera(canvasSize);
    } else {
      cameraRef.current.setViewport(canvasSize);
    }

    if (!orchestratorRef.current) {
      orchestratorRef.current = new BoardOrchestrator();
    }

    if (!gestureFSMRef.current) {
      gestureFSMRef.current = new GestureFSM(toolId);
    } else {
      gestureFSMRef.current.setTool(toolId);
    }

    if (!minimapRef.current && minimapCanvasRef.current) {
      minimapRef.current = new MinimapRenderer(minimapCanvasRef.current);
    }

    if (!aidDetectorRef.current) {
      aidDetectorRef.current = new AidDetector();
    }
  }, [canvasSize, toolId]);

  // Initialize PixiJS once canvas size is known
  useEffect(() => {
    const canvas = canvasRef.current;
    const size = canvasSizeRef.current;

    console.log("[WhiteboardView] Init effect", {
      rendererMode: rendererModeRef.current,
      hasCanvas: !!canvas,
      canvasWidth: size.width,
      canvasHeight: size.height,
      pixiAppExists: !!pixiAppRef.current,
      initAttempted: initializationAttemptedRef.current,
    });

    if (!canvas) {
      return;
    }

    if (rendererModeRef.current !== "initializing") {
      return;
    }

    if (size.width === 0 || size.height === 0) {
      console.log("[WhiteboardView] Canvas size unavailable, waiting");
      return;
    }

    if (initializationAttemptedRef.current) {
      console.log("[WhiteboardView] Initialization already in progress");
      return;
    }

    initializationAttemptedRef.current = true;
    initializingCanvasRef.current = canvas;

    let cancelled = false;

    const run = async () => {
      console.log("[WhiteboardView] Starting PixiJS initialization...");
      try {
        const pixiApp = await createPixiApp(canvas, {
          backgroundColor: 0x1f2937,
        });

        if (cancelled) {
          console.log(
            "[WhiteboardView] Initialization cancelled before completion"
          );
          if (pixiApp) {
            destroyPixiApp(pixiApp);
          }
          initializationAttemptedRef.current = false;
          initializingCanvasRef.current = null;
          return;
        }

        if (!pixiApp) {
          console.log(
            "[WhiteboardView] PixiJS unavailable, falling back to Canvas 2D"
          );
          rendererModeRef.current = "canvas";
          setRendererMode("canvas");
          initializationAttemptedRef.current = false;
          initializingCanvasRef.current = null;
          return;
        }

        console.log("[WhiteboardView] PixiJS app created, setting up renderer");
        pixiAppRef.current = pixiApp;
        const pixiRenderer = new PixiRenderer(pixiApp);
        pixiRenderer.updateResolution(size.width, size.height);
        pixiRendererRef.current = pixiRenderer;

        const tickerCallback = () => {
          pixiRenderer.updateStats();

          if (showDebugRef.current && cameraRef.current) {
            const stats = pixiRenderer.getStats();
            const cameraState = cameraRef.current.getState();
            const cursorScreen = {
              x: mousePosRef.current.x,
              y: mousePosRef.current.y,
            };
            const cursorBoardPoint = cameraRef.current.screenToBoard(
              cursorScreen.x,
              cursorScreen.y
            );
            const cursorBoard = {
              x: cursorBoardPoint.x,
              y: cursorBoardPoint.y,
            };

            setDebugStats({
              fps: stats.fps,
              frameTime: stats.frameTime,
              renderer: pixiApp.renderer,
              strokeCount: strokeMetricsRef.current.strokeCount,
              pointCount: strokeMetricsRef.current.pointCount,
              visibleStrokes: visibleStrokeCountRef.current,
              cameraX: cameraState.panOffset.x,
              cameraY: cameraState.panOffset.y,
              cameraZoom: cameraState.scale,
              viewportWidth: canvasSizeRef.current.width,
              viewportHeight: canvasSizeRef.current.height,
              toolId: toolIdRef.current,
              brushColor: brushColorRef.current,
              brushWidth: brushWidthRef.current,
              cursorScreen,
              cursorBoard,
              aidStillness: aidStatsRef.current.stillness,
              aidCurrentStrokePoints: aidStatsRef.current.currentStrokePoints,
              aidStartEndDistance: aidStatsRef.current.startEndDistance,
              aidDetectedShape: aidStatsRef.current.detectedShape,
              aidCurrentVelocity: aidStatsRef.current.currentVelocity,
              aidStrokeDuration: aidStatsRef.current.strokeDuration,
            });
          }
        };
        pixiTickerCallbackRef.current = tickerCallback;
        pixiApp.app.ticker.add(tickerCallback);

        await new Promise((resolve) => {
          pixiApp.app.ticker.addOnce(() => resolve(undefined));
        });

        if (cancelled) {
          console.log(
            "[WhiteboardView] Initialization cancelled after readiness"
          );
          return;
        }

        console.log(
          "[WhiteboardView] PixiJS fully ready, setting renderer mode to pixi"
        );
        rendererModeRef.current = "pixi";
        setRendererMode("pixi");
      } catch (error) {
        if (!cancelled) {
          console.error("[WhiteboardView] PixiJS init error:", error);
          rendererModeRef.current = "canvas";
          setRendererMode("canvas");
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      if (!pixiAppRef.current) {
        initializationAttemptedRef.current = false;
        initializingCanvasRef.current = null;
      }
    };
  }, [rendererMode, canvasSize.width, canvasSize.height]);

  // Cleanup Pixi resources on unmount
  useEffect(() => {
    return () => {
      if (pixiRendererRef.current) {
        pixiRendererRef.current.destroy();
        pixiRendererRef.current = null;
      }

      if (pixiAppRef.current) {
        if (pixiTickerCallbackRef.current) {
          pixiAppRef.current.app.ticker.remove(pixiTickerCallbackRef.current);
        }
        destroyPixiApp(pixiAppRef.current);
        pixiAppRef.current = null;
      }

      pixiTickerCallbackRef.current = null;
      rendererModeRef.current = "initializing";
      initializationAttemptedRef.current = false;
      initializingCanvasRef.current = null;
    };
  }, []);

  // Resize PixiJS renderer when viewport changes
  useEffect(() => {
    if (
      rendererMode !== "pixi" ||
      !pixiAppRef.current ||
      canvasSize.width === 0 ||
      canvasSize.height === 0
    ) {
      return;
    }

    resizePixiApp(pixiAppRef.current, canvasSize.width, canvasSize.height);
    pixiRendererRef.current?.updateResolution(
      canvasSize.width,
      canvasSize.height
    );
  }, [canvasSize, rendererMode]);

  // Update canvas size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setCanvasSize({ width: rect.width, height: rect.height });
        }
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", updateSize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSize);

      // Clean up velocity polling on unmount
      if (velocityPollingRef.current) {
        clearInterval(velocityPollingRef.current);
        velocityPollingRef.current = null;
      }
    };
  }, []);

  // Render main canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const orchestrator = orchestratorRef.current;

    if (!camera || !orchestrator || canvasSize.width === 0) return;

    const objects = orchestrator.getVisibleObjects();
    const strokeObjects = objects.filter(
      (obj) => obj.kind === "stroke" && obj.visible
    ) as StrokeObject[];

    visibleStrokeCountRef.current = strokeObjects.length;

    const boardOffset = camera.getBoardOffset();

    // Get current tool config
    const currentTool = getTool(toolId);
    const isDrawing =
      isInkingTool(currentTool) && currentStrokePreview.length > 0;

    const activeStrokeStyle: StrokeStyle = {
      color: brushColor,
      width: brushWidth,
      opacity: toolId === "highlighter" ? 0.4 : 1,
      toolId: toolId,
    };

    if (rendererModeRef.current === "pixi" && pixiRendererRef.current) {
      const pixiRenderer = pixiRendererRef.current;
      const transform = camera.getTransform();
      pixiRenderer.applyTransform(transform, boardOffset);
      pixiRenderer.renderBoard("#f8f7ea");
      pixiRenderer.renderStrokes(strokeObjects);

      if (isDrawing) {
        const activePoints = liveCursorPoint
          ? [...currentStrokePreview, liveCursorPoint]
          : currentStrokePreview;
        pixiRenderer.setActiveStroke(activePoints, activeStrokeStyle);
      } else {
        pixiRenderer.clearActiveStroke();
      }

      // Apply stroke visualization (clears when disabled)
      pixiRenderer.setStrokeVisualization(
        showDebug && showStrokeVisualization,
        strokeObjects
      );

      return;
    }

    // Don't create 2D context while PixiJS is initializing
    // This prevents context conflicts
    if (rendererModeRef.current === "initializing") {
      return;
    }

    if (!canvas) return;

    const renderCtx = createRenderContext(canvas);
    if (!renderCtx) return;

    clearCanvas(renderCtx, "#1f2937");
    const transform = camera.getTransform();
    applyTransform(renderCtx, transform);
    drawBoard(renderCtx, boardOffset, "#f8f7ea");

    objects.forEach((obj) => drawObject(renderCtx, obj));

    if (isDrawing) {
      const { ctx } = renderCtx;
      // Combine static placed points with live cursor point
      const pointsToRender = liveCursorPoint
        ? [...currentStrokePreview, liveCursorPoint]
        : currentStrokePreview;

      // Use smooth curve rendering
      renderSmoothStroke(
        ctx,
        pointsToRender,
        brushColor,
        brushWidth,
        activeStrokeStyle.opacity
      );
    }

    restoreTransform(renderCtx);
  }, [
    canvasSize,
    currentStrokePreview,
    liveCursorPoint,
    toolId,
    brushColor,
    brushWidth,
    rendererMode,
    showDebug,
    showStrokeVisualization,
  ]);

  useEffect(() => {
    renderCanvasRef.current = renderCanvas;
  }, [renderCanvas]);

  // Render minimap
  const renderMinimap = useCallback(() => {
    const minimap = minimapRef.current;
    const camera = cameraRef.current;
    const orchestrator = orchestratorRef.current;

    if (!minimap || !camera || !orchestrator) return;

    const objects = orchestrator.getVisibleObjects();
    const strokeObjects = objects.filter(
      (obj) => obj.kind === "stroke"
    ) as StrokeObject[];
    const cameraState = camera.getState();
    const viewport = {
      x: -cameraState.panOffset.x / cameraState.scale,
      y: -cameraState.panOffset.y / cameraState.scale,
      width: canvasSize.width / cameraState.scale,
      height: canvasSize.height / cameraState.scale,
    };
    minimap.render(strokeObjects, viewport, cameraState.scale);
  }, [canvasSize]);

  useEffect(() => {
    renderMinimapRef.current = renderMinimap;
  }, [renderMinimap]);

  // Sync strokes to orchestrator - merged layer handles optimistic updates
  useEffect(() => {
    if (!orchestratorRef.current) return;

    const orchestrator = orchestratorRef.current;
    orchestrator.clear();

    // Add all merged strokes (includes local optimistic changes)
    strokes.forEach((stroke) => {
      const sceneObj = strokeToSceneObject(stroke);
      orchestrator.addObject(sceneObj);
    });

    // Re-render after orchestrator updates to reflect latest data immediately
    renderCanvasRef.current();
    renderMinimapRef.current();
  }, [strokes]);

  useEffect(() => {
    renderCanvas();
    renderMinimap();
  }, [renderCanvas, renderMinimap]);

  // Cursor overlay
  useEffect(() => {
    const cursorCanvas = cursorCanvasRef.current;
    if (!cursorCanvas || canvasSize.width === 0) return;

    const ctx = cursorCanvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    const gesture = gestureFSMRef.current?.getState();
    if (gesture?.type === "panning") return;

    const currentTool = getTool(toolId);

    if (isInkingTool(currentTool)) {
      // Cursor dot matches brush width
      const camera = cameraRef.current;
      if (!camera) return;
      const cursorRadius = (brushWidth * camera.getState().scale) / 2;
      ctx.fillStyle = brushColor;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, cursorRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    } else if (isEraserTool(currentTool)) {
      const camera = cameraRef.current;
      if (!camera) return;
      const eraserRadius = brushWidth * 3 * camera.getState().scale;
      ctx.strokeStyle = "rgba(255, 100, 100, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, eraserRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [mousePos, toolId, brushColor, brushWidth, canvasSize]);

  // Event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const gestureFSM = gestureFSMRef.current;
    const aidDetector = aidDetectorRef.current;
    if (!canvas || !camera || !gestureFSM || !aidDetector) return;

    canvas.setPointerCapture(e.pointerId);
    const canvasRect = canvas.getBoundingClientRect();
    const sample = normalizePointerEvent(e.nativeEvent, canvasRect);
    const isPanButton = e.button === 2 || e.button === 1;
    gestureFSM.onPointerDown(sample, isPanButton);

    const state = gestureFSM.getState();
    if (state.type === "drawing") {
      // Create InkingEngine for this stroke
      const currentTool = getTool(toolId);
      if (isInkingTool(currentTool)) {
        // Convert to board coordinates
        const boardPos = camera.screenToBoard(sample.x, sample.y);
        const boardSample = { ...sample, x: boardPos.x, y: boardPos.y };

        const engine = createInkingEngine(currentTool.inking, brushWidth);
        const initialPoint = engine.start(boardSample);
        inkingEngineRef.current = engine;

        setCurrentStrokePreview([initialPoint]);
        setLiveCursorPoint(initialPoint);

        // Initialize aid state for new stroke
        aidStateRef.current = createDefaultAidState();

        // Reset aid debug stats
        resetAidStats();
        aidStatsRef.current.currentStrokePoints = 1;

        if (aidStateRef.current) {
          // Initialize recent samples buffer with first point
          aidStateRef.current.recentSamples = [
            {
              x: boardSample.x,
              y: boardSample.y,
              timestamp: boardSample.timestamp,
            },
          ];
          aidStateRef.current.originalPoints = [initialPoint];

          // Start velocity polling (checks every 16ms = ~60fps)
          velocityPollingRef.current = setInterval(() => {
            const aidState = aidStateRef.current;
            if (
              !aidState ||
              !aidState.recentSamples ||
              aidState.recentSamples.length === 0
            ) {
              return;
            }

            // Calculate velocity from recent samples (100ms window for quick response)
            const velocity = calculateRecentVelocity(
              aidState.recentSamples,
              100
            );
            aidStatsRef.current.currentVelocity = velocity;

            // Clean up old samples (keep last 200ms for history)
            const now = performance.now();
            const cutoff = now - 200;
            aidState.recentSamples = aidState.recentSamples.filter(
              (s) => s.timestamp >= cutoff
            );

            // If no recent samples (last sample is old), force velocity to 0
            if (aidState.recentSamples.length > 0) {
              const lastSample =
                aidState.recentSamples[aidState.recentSamples.length - 1];
              const timeSinceLastSample = now - lastSample.timestamp;
              if (timeSinceLastSample > 100) {
                // No movement for 100ms = velocity is 0
                aidStatsRef.current.currentVelocity = 0;
              }
            }
          }, 16); // ~60 FPS polling
        }
      }
    } else if (state.type === "erasing") {
      // Start eraser gesture
      checkEraserHit(sample);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const gestureFSM = gestureFSMRef.current;
    const aidDetector = aidDetectorRef.current;
    const aidState = aidStateRef.current;
    if (!canvas || !camera || !gestureFSM || !aidDetector) return;

    const canvasRect = canvas.getBoundingClientRect();
    const screenPos = {
      x: e.clientX - canvasRect.left,
      y: e.clientY - canvasRect.top,
    };
    setMousePos(screenPos);

    const samples = getCoalescedSamples(e.nativeEvent, canvasRect);
    const state = gestureFSM.getState();

    if (state.type === "panning") {
      const lastSample = samples[samples.length - 1];
      const dx = lastSample.x - state.lastPoint.x;
      const dy = lastSample.y - state.lastPoint.y;
      camera.pan(dx, dy);
      gestureFSM.onPointerMove(lastSample);
      setLiveCursorPoint(null);
      renderCanvas();
      return;
    }

    if (state.type === "drawing" || state.type === "erasing") {
      if (state.type === "erasing") {
        setLiveCursorPoint(null);
      }

      // Track raw cursor position for velocity (BEFORE processing samples)
      if (state.type === "drawing" && aidState && !aidState.isAdjusting) {
        const lastSample = samples[samples.length - 1];
        const boardPos = camera.screenToBoard(lastSample.x, lastSample.y);

        const currentSample = {
          x: boardPos.x,
          y: boardPos.y,
          timestamp: lastSample.timestamp,
        };

        // Add to recent samples buffer (keep last 200ms worth)
        if (!aidState.recentSamples) {
          aidState.recentSamples = [];
        }
        aidState.recentSamples.push(currentSample);

        // Keep only samples from last 200ms
        const cutoff = currentSample.timestamp - 200;
        aidState.recentSamples = aidState.recentSamples.filter(
          (s) => s.timestamp >= cutoff
        );

        // Calculate velocity from recent samples
        const velocity = calculateRecentVelocity(aidState.recentSamples, 150);
        aidStatsRef.current.currentVelocity = velocity;
      }

      for (const sample of samples) {
        if (state.type === "drawing" && inkingEngineRef.current && aidState) {
          // Convert to board coordinates
          const boardPos = camera.screenToBoard(sample.x, sample.y);
          const boardSample = { ...sample, x: boardPos.x, y: boardPos.y };

          // Check if we're in adjustment mode
          if (aidState.isAdjusting && aidState.detectedShape) {
            // Update shape based on cursor position
            const adjustedShape = aidDetector.adjustShape(
              aidState.detectedShape,
              boardSample,
              aidState.adjustmentMetadata
            );
            const shapePoints = aidDetector.generatePoints(adjustedShape);
            setCurrentStrokePreview(shapePoints);
            setLiveCursorPoint(null);

            // Update detected shape in state
            aidState.detectedShape = adjustedShape;

            // Update debug stats
            aidStatsRef.current.detectedShape = adjustedShape.type;
          } else {
            // Normal inking - process sample in inking engine
            const update = inkingEngineRef.current.addSample(boardSample);

            const enoughPointsForHold = aidState.originalPoints.length >= 10;

            if (update.accepted) {
              setCurrentStrokePreview(update.points);

              // Store original points for shape detection (freeze once hold timer starts)
              if (!aidState.holdTimer) {
                aidState.originalPoints = update.points;
              }

              // Update debug stats for current stroke
              const firstPoint = update.points[0];
              const lastPoint = update.points[update.points.length - 1];
              const dx = lastPoint.x - firstPoint.x;
              const dy = lastPoint.y - firstPoint.y;
              aidStatsRef.current.currentStrokePoints = update.points.length;
              aidStatsRef.current.startEndDistance = Math.sqrt(
                dx * dx + dy * dy
              );
              aidStatsRef.current.strokeDuration =
                lastPoint.timestamp - firstPoint.timestamp;
            }
            setLiveCursorPoint(update.livePoint);

            // Hold detection logic
            if (aidState.enabled && !aidState.detectedShape) {
              // Get current velocity from samples tracked above
              const velocity = aidStatsRef.current.currentVelocity;
              const stillnessMet =
                velocity < aidDetector.config.holdVelocityThreshold &&
                enoughPointsForHold;
              aidStatsRef.current.stillness = stillnessMet;

              if (stillnessMet) {
                // Velocity low enough - start/continue hold timer
                if (!aidState.holdTimer) {
                  aidState.holdSnapshot = aidState.originalPoints.map(
                    (point) => ({ ...point })
                  );
                  aidState.holdTimer = setTimeout(() => {
                    // Hold completed - detect shape
                    const sourcePoints =
                      aidState.holdSnapshot && aidState.holdSnapshot.length > 0
                        ? aidState.holdSnapshot
                        : aidState.originalPoints;

                    if (sourcePoints.length < 10) {
                      aidState.holdTimer = null;
                      aidState.holdSnapshot = null;
                      aidStatsRef.current.detectedShape = null;
                      return;
                    }

                    const shape = aidDetector.detectShape(
                      sourcePoints,
                      toolIdRef.current
                    );
                    aidState.holdSnapshot = null;

                    if (shape) {
                      // Shape detected! Enter adjustment mode
                      aidState.detectedShape = shape;
                      aidState.isAdjusting = true;

                      // Update debug stats
                      aidStatsRef.current.detectedShape = shape.type;
                      aidStatsRef.current.stillness = false;

                      // Determine which corner/edge to adjust
                      if (update.livePoint) {
                        aidState.adjustmentMetadata =
                          aidDetector.determineAdjustmentPoint(
                            shape,
                            update.livePoint
                          );
                      }

                      // Update preview to show shape
                      const shapePoints = aidDetector.generatePoints(shape);
                      setCurrentStrokePreview(shapePoints);
                      setLiveCursorPoint(null);
                    }

                    aidState.holdTimer = null;
                  }, aidDetector.config.holdDuration);
                }
              } else {
                // Velocity too high - cancel hold timer
                if (aidState.holdTimer) {
                  clearTimeout(aidState.holdTimer);
                  aidState.holdTimer = null;
                  aidState.holdSnapshot = null;
                  aidStatsRef.current.detectedShape = null;
                }
              }
            }
          }
        } else if (state.type === "erasing") {
          // Check eraser hits
          checkEraserHit(sample);
        }
        gestureFSM.onPointerMove(sample);
      }
    } else {
      setLiveCursorPoint(null);
      // Reset aid stats when not drawing
      resetAidStats();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const gestureFSM = gestureFSMRef.current;
    const aidDetector = aidDetectorRef.current;
    const aidState = aidStateRef.current;
    if (!canvas || !camera || !gestureFSM || !aidDetector) return;

    canvas.releasePointerCapture(e.pointerId);
    const canvasRect = canvas.getBoundingClientRect();
    const sample = normalizePointerEvent(e.nativeEvent, canvasRect);
    const completedGesture = gestureFSM.onPointerUp(sample);

    if (completedGesture.type === "drawing" && inkingEngineRef.current) {
      // Clean up velocity polling
      if (velocityPollingRef.current) {
        clearInterval(velocityPollingRef.current);
        velocityPollingRef.current = null;
      }

      // Clean up hold timer if it exists
      if (aidState?.holdTimer) {
        clearTimeout(aidState.holdTimer);
        aidState.holdTimer = null;
      }

      // Check if we're committing a detected shape
      if (aidState?.isAdjusting && aidState.detectedShape) {
        // Commit shape with metadata
        const shapePoints = aidDetector.generatePoints(aidState.detectedShape);
        const shapeMetadata = {
          shapeType: aidState.detectedShape.type,
          descriptor: aidState.detectedShape as Record<string, any>,
          hasFill: aidDetector.shouldHaveFill(aidState.detectedShape),
          fillOpacity: aidDetector.getDefaultFillOpacity(
            aidState.detectedShape.type
          ),
        };

        commitStroke(shapePoints, shapeMetadata);
      } else {
        // Normal stroke commit
        const engine = inkingEngineRef.current;
        const finalPoints = engine.finalize();

        if (finalPoints.length > 0) {
          commitStroke(finalPoints);
        } else {
          setCurrentStrokePreview([]);
          setLiveCursorPoint(null);
        }
      }

      // Reset aid state
      aidStateRef.current = null;
      inkingEngineRef.current = null;
    } else if (
      completedGesture.type === "erasing" &&
      eraserHitsRef.current.size > 0
    ) {
      commitErasure();
      setLiveCursorPoint(null);
      inkingEngineRef.current = null;
    } else {
      setLiveCursorPoint(null);
      inkingEngineRef.current = null;
    }

    resetAidStats();
  };

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();

    const camera = cameraRef.current;
    const canvas = canvasRef.current;
    if (!camera || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mousePoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;

    camera.zoomAt(mousePoint, zoomFactor);
    renderCanvasRef.current();
    renderMinimapRef.current();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const wheelListener = (event: WheelEvent) => handleWheel(event);
    canvas.addEventListener("wheel", wheelListener, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", wheelListener);
    };
  }, [handleWheel]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const checkEraserHit = (sample: PointerSample) => {
    const camera = cameraRef.current;
    const orchestrator = orchestratorRef.current;
    if (!camera || !orchestrator) return;

    const boardPos = camera.screenToBoard(sample.x, sample.y);
    const hitRadius = brushWidth * 3;
    const candidates = orchestrator.queryRegion({
      x: boardPos.x - hitRadius,
      y: boardPos.y - hitRadius,
      width: hitRadius * 2,
      height: hitRadius * 2,
    });

    let removedAny = false;

    candidates.forEach((obj) => {
      if (obj.kind === "stroke") {
        const strokeObj = obj as StrokeObject;
        for (const point of strokeObj.points) {
          const dx = point.x - boardPos.x;
          const dy = point.y - boardPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < hitRadius + strokeObj.style.width / 2) {
            if (!eraserHitsRef.current.has(obj.id)) {
              eraserHitsRef.current.add(obj.id);
              orchestrator.removeObject(obj.id);
              removedAny = true;
            }
            break;
          }
        }
      }
    });

    if (removedAny) {
      renderCanvas();
      renderMinimap();
    }
  };

  const commitStroke = useCallback(
    (points: StrokePoint[], shapeMetadata?: ShapeMetadata) => {
      if (points.length === 0) return;

      setCurrentStrokePreview(points);
      setLiveCursorPoint(null);

      const style: StrokeStyle = {
        color: brushColor,
        width: brushWidth,
        opacity: toolId === "highlighter" ? 0.4 : 1,
        toolId: toolId,
      };

      const boundingBox = calculateBoundingBox(points);

      createStroke.mutate(
        { boardId, points, style, boundingBox, shapeMetadata },
        {
          onSettled: () => {
            setCurrentStrokePreview([]);
          },
        }
      );
    },
    [
      boardId,
      brushColor,
      brushWidth,
      toolId,
      createStroke,
      setCurrentStrokePreview,
      setLiveCursorPoint,
    ]
  );

  const commitErasure = () => {
    const idsToDelete = Array.from(eraserHitsRef.current);
    if (idsToDelete.length === 0) return;

    // Commit to local database - optimistic layer handles instant UI
    deleteStrokes.mutate({ ids: idsToDelete, boardId });

    // Clear the hits for next gesture
    eraserHitsRef.current.clear();
  };

  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-hidden relative bg-gray-900 ${className}`}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={handleContextMenu}
        className="touch-none absolute inset-0"
        style={{
          touchAction: "none",
          width: "100%",
          height: "100%",
          cursor:
            gestureFSMRef.current?.getState().type === "panning"
              ? "move"
              : "none",
        }}
      />
      <canvas
        ref={cursorCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      />
      <div className="absolute bottom-4 right-4 border-2 border-gray-700 rounded shadow-lg overflow-hidden">
        <canvas ref={minimapCanvasRef} className="block" />
      </div>

      {/* Debug Overlay */}
      {showDebug && onDebugClose && (
        <DebugOverlay
          stats={debugStats}
          showStrokeVisualization={showStrokeVisualization}
          onToggleVisualization={() =>
            setShowStrokeVisualization(!showStrokeVisualization)
          }
          onClose={handleDebugClose}
        />
      )}
    </div>
  );
}
