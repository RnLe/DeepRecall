/**
 * WhiteboardView - Main Canvas Component
 * Orchestrates all whiteboard functionality with modern UI
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { StrokePoint, StrokeStyle } from "@deeprecall/core";
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
  type Tool,
  normalizePointerEvent,
  getCoalescedSamples,
  shouldAddSample,
  type PointerSample,
  type BrushType,
  BRUSH_PRESETS,
} from "@deeprecall/whiteboard/ink";
import { DebugOverlay, type DebugStats } from "./DebugOverlay";

export interface WhiteboardViewProps {
  boardId: string;
  tool: Tool;
  onToolChange?: (tool: Tool) => void;
  brushColor?: string;
  brushWidth?: number;
  brushType?: BrushType;
  className?: string;
  showDebug?: boolean;
  onDebugClose?: () => void;
}

export function WhiteboardView({
  boardId,
  tool,
  onToolChange,
  brushColor = "#000000",
  brushWidth = 2,
  brushType = "pen",
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

  const [rendererMode, setRendererMode] = useState<
    "initializing" | "pixi" | "canvas"
  >("initializing");

  // State
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [currentStroke, setCurrentStroke] = useState<PointerSample[]>([]);
  const [strokeStartTime, setStrokeStartTime] = useState(0);
  const [lastAddedTime, setLastAddedTime] = useState(0);

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
    tool,
    brushType,
    brushColor,
    brushWidth,
    cursorScreen: { x: 0, y: 0 },
    cursorBoard: { x: 0, y: 0 },
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
  const toolRef = useRef(tool);
  const brushTypeRef = useRef(brushType);
  const brushColorRef = useRef(brushColor);
  const brushWidthRef = useRef(brushWidth);

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
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    brushTypeRef.current = brushType;
  }, [brushType]);

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
      gestureFSMRef.current = new GestureFSM(tool);
    } else {
      gestureFSMRef.current.setTool(tool);
    }

    if (!minimapRef.current && minimapCanvasRef.current) {
      minimapRef.current = new MinimapRenderer(minimapCanvasRef.current);
    }
  }, [canvasSize, tool]);

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
              tool: toolRef.current,
              brushType: brushTypeRef.current,
              brushColor: brushColorRef.current,
              brushWidth: brushWidthRef.current,
              cursorScreen,
              cursorBoard,
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

    const hasActiveStroke = currentStroke.length > 0 && tool === "pen";
    const activeStrokePoints: StrokePoint[] = hasActiveStroke
      ? currentStroke.map((sample) => {
          const boardPoint = camera.screenToBoard(sample.x, sample.y);
          return {
            x: boardPoint.x,
            y: boardPoint.y,
            pressure: sample.pressure,
            timestamp: sample.timestamp - strokeStartTime,
            tiltX: sample.tiltX,
            tiltY: sample.tiltY,
          } as StrokePoint;
        })
      : [];

    const activeStrokeStyle: StrokeStyle = {
      color: brushColor,
      width: brushWidth,
      opacity: brushType === "highlighter" ? 0.4 : 1,
      brushType: brushType === "eraser" ? "pen" : brushType,
    };

    if (rendererModeRef.current === "pixi" && pixiRendererRef.current) {
      const pixiRenderer = pixiRendererRef.current;
      const transform = camera.getTransform();
      pixiRenderer.applyTransform(transform, boardOffset);
      pixiRenderer.renderBoard("#f8f7ea");
      pixiRenderer.renderStrokes(strokeObjects);

      if (hasActiveStroke) {
        pixiRenderer.setActiveStroke(activeStrokePoints, activeStrokeStyle);
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

    if (hasActiveStroke) {
      const { ctx } = renderCtx;
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      activeStrokePoints.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }

    restoreTransform(renderCtx);
  }, [
    canvasSize,
    currentStroke,
    tool,
    brushColor,
    brushWidth,
    brushType,
    strokeStartTime,
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

    if (tool === "pen") {
      ctx.fillStyle = brushColor;
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (tool === "eraser") {
      const camera = cameraRef.current;
      if (!camera) return;
      const eraserRadius = brushWidth * 3 * camera.getState().scale;
      ctx.strokeStyle = "rgba(255, 100, 100, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, eraserRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [mousePos, tool, brushColor, brushWidth, canvasSize]);

  // Event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const gestureFSM = gestureFSMRef.current;
    if (!canvas || !camera || !gestureFSM) return;

    canvas.setPointerCapture(e.pointerId);
    const canvasRect = canvas.getBoundingClientRect();
    const sample = normalizePointerEvent(e.nativeEvent, canvasRect);
    const isPanButton = e.button === 2 || e.button === 1;
    gestureFSM.onPointerDown(sample, isPanButton);

    const state = gestureFSM.getState();
    if (state.type === "drawing") {
      setStrokeStartTime(sample.timestamp);
      setLastAddedTime(sample.timestamp);
      setCurrentStroke([sample]);
    } else if (state.type === "erasing") {
      setCurrentStroke([sample]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const gestureFSM = gestureFSMRef.current;
    if (!canvas || !camera || !gestureFSM) return;

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
      renderCanvas();
      return;
    }

    if (state.type === "drawing" || state.type === "erasing") {
      for (const sample of samples) {
        const prevSample = currentStroke[currentStroke.length - 1] || null;
        if (shouldAddSample(sample, prevSample, lastAddedTime)) {
          setCurrentStroke((prev) => [...prev, sample]);
          setLastAddedTime(sample.timestamp);
          if (state.type === "erasing") {
            checkEraserHit(sample);
          }
        }
        gestureFSM.onPointerMove(sample);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const gestureFSM = gestureFSMRef.current;
    if (!canvas || !camera || !gestureFSM) return;

    canvas.releasePointerCapture(e.pointerId);
    const canvasRect = canvas.getBoundingClientRect();
    const sample = normalizePointerEvent(e.nativeEvent, canvasRect);
    const completedGesture = gestureFSM.onPointerUp(sample);

    if (completedGesture.type === "drawing" && currentStroke.length > 1) {
      commitStroke();
    } else if (
      completedGesture.type === "erasing" &&
      eraserHitsRef.current.size > 0
    ) {
      commitErasure();
    }
    setCurrentStroke([]);
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

  const commitStroke = () => {
    const camera = cameraRef.current;
    if (!camera || currentStroke.length === 0) return;

    const points: StrokePoint[] = currentStroke.map((sample) => {
      const boardPos = camera.screenToBoard(sample.x, sample.y);
      return {
        x: boardPos.x,
        y: boardPos.y,
        pressure: sample.pressure,
        timestamp: sample.timestamp - strokeStartTime,
        tiltX: sample.tiltX,
        tiltY: sample.tiltY,
      };
    });

    const style: StrokeStyle = {
      color: brushColor,
      width: brushWidth,
      opacity: brushType === "highlighter" ? 0.4 : 1,
      brushType: brushType === "eraser" ? "pen" : brushType,
    };

    const boundingBox = calculateBoundingBox(points);

    // Commit to local database - optimistic layer handles instant UI
    createStroke.mutate({ boardId, points, style, boundingBox });
  };

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
