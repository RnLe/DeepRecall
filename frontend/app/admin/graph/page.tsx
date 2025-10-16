"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3Force from "d3-force";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/db/dexie";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from "lucide-react";
import { WorkCardCompact } from "@/app/library/WorkCardCompact";
import type { WorkExtended } from "@/src/schema/library";
import { useGraphUI, type GraphNode } from "@/src/stores/graph-ui";

interface GraphLink {
  source: GraphNode;
  target: GraphNode;
  type: "hasVersion" | "hasAsset" | "contains" | string;
}

const NODE_COLORS = {
  work: "#22c55e", // green
  version: "#3b82f6", // blue
  asset: "#f97316", // orange
  activity: "#a855f7", // purple
  collection: "#ec4899", // pink
};

const NODE_SIZES = {
  work: 30,
  version: 12,
  asset: 10,
  activity: 16,
  collection: 14,
};

function StatCard({
  label,
  count,
  color,
  type,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  type?: GraphNode["type"];
  onClick?: () => void;
}) {
  return (
    <div
      className={`p-3 bg-gray-900 border border-gray-800 rounded transition-colors ${
        onClick ? "cursor-pointer hover:border-gray-600" : ""
      }`}
      onClick={onClick}
      title={onClick ? `Select all ${label}` : undefined}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <span className="text-xs font-medium text-gray-300">{label}</span>
      </div>
      <p className="text-xl font-bold">{count}</p>
    </div>
  );
}

export default function GraphPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const simulationRef = useRef<d3Force.Simulation<GraphNode, GraphLink> | null>(
    null
  );
  const isPointerOverGraph = useRef(false);
  const hasAutoFittedRef = useRef(false);

  // Track initial positions for relative dragging
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(
    new Map()
  );
  const dragStartMouse = useRef<{ x: number; y: number } | null>(null);

  // Use Zustand store for UI state
  const {
    selectedNodeIds,
    isMultiSelectMode,
    hoveredNode,
    draggedNodes,
    isPanning,
    zoomTransform,
    selectNode,
    setSelection,
    clearSelection,
    isNodeSelected,
    setHoveredNode,
    startDragging,
    stopDragging,
    startPanning,
    stopPanning,
    updatePan,
    zoomIn,
    zoomOut,
    zoomReset,
    zoomTowardsCursor,
    setMultiSelectMode,
  } = useGraphUI();

  // Live query all Dexie data
  const works = useLiveQuery(() => db.works.toArray(), []);
  const versions = useLiveQuery(() => db.versions.toArray(), []);
  const assets = useLiveQuery(() => db.assets.toArray(), []);
  const activities = useLiveQuery(() => db.activities.toArray(), []);
  const collections = useLiveQuery(() => db.collections.toArray(), []);
  const edges = useLiveQuery(() => db.edges.toArray(), []);

  // Compute stats
  const stats = useMemo(() => {
    const unlinkedAssets = (assets || []).filter(
      (a) =>
        !a.versionId &&
        !(edges || []).some((e) => e.relation === "contains" && e.toId === a.id)
    );

    return {
      works: works?.length || 0,
      versions: versions?.length || 0,
      assets: assets?.length || 0,
      activities: activities?.length || 0,
      collections: collections?.length || 0,
      edges: edges?.length || 0,
      unlinkedAssets: unlinkedAssets.length,
    };
  }, [works, versions, assets, activities, collections, edges]);

  // Handle container resize
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Block page scrolling while cursor is over the graph
  useEffect(() => {
    const preventScroll = (event: WheelEvent) => {
      if (isPointerOverGraph.current) {
        event.preventDefault();
      }
    };

    window.addEventListener("wheel", preventScroll, {
      passive: false,
      capture: true,
    });
    return () => {
      window.removeEventListener("wheel", preventScroll, true);
    };
  }, []);

  // Track Shift key for multi-select mode and Escape to deselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setMultiSelectMode(true);
      } else if (e.key === "Escape") {
        clearSelection();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setMultiSelectMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [setMultiSelectMode, clearSelection]);

  // Build graph data
  useEffect(() => {
    if (!works || !versions || !assets || !activities || !collections || !edges)
      return;

    const newNodes: GraphNode[] = [];
    const newLinks: GraphLink[] = [];
    const nodeMap = new Map<string, GraphNode>();

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const spread = 150;

    // Create nodes for Works
    works.forEach((work) => {
      const node: GraphNode = {
        id: work.id,
        label: work.title || "Untitled Work",
        type: "work",
        data: work,
        x: centerX + (Math.random() - 0.5) * spread,
        y: centerY + (Math.random() - 0.5) * spread,
      };
      newNodes.push(node);
      nodeMap.set(work.id, node);
    });

    // Create nodes for Versions
    versions.forEach((version) => {
      const node: GraphNode = {
        id: version.id,
        label: `v${version.versionNumber}`,
        type: "version",
        data: version,
        x: centerX + (Math.random() - 0.5) * spread,
        y: centerY + (Math.random() - 0.5) * spread,
      };
      newNodes.push(node);
      nodeMap.set(version.id, node);
    });

    // Create nodes for Assets
    assets.forEach((asset) => {
      const node: GraphNode = {
        id: asset.id,
        label: asset.filename || "Asset",
        type: "asset",
        data: asset,
        x: centerX + (Math.random() - 0.5) * spread,
        y: centerY + (Math.random() - 0.5) * spread,
      };
      newNodes.push(node);
      nodeMap.set(asset.id, node);
    });

    // Create nodes for Activities
    activities.forEach((activity) => {
      const node: GraphNode = {
        id: activity.id,
        label: activity.title || "Activity",
        type: "activity",
        data: activity,
        x: centerX + (Math.random() - 0.5) * spread,
        y: centerY + (Math.random() - 0.5) * spread,
      };
      newNodes.push(node);
      nodeMap.set(activity.id, node);
    });

    // Create nodes for Collections
    collections.forEach((collection) => {
      const node: GraphNode = {
        id: collection.id,
        label: collection.name || "Collection",
        type: "collection",
        data: collection,
        x: centerX + (Math.random() - 0.5) * spread,
        y: centerY + (Math.random() - 0.5) * spread,
      };
      newNodes.push(node);
      nodeMap.set(collection.id, node);
    });

    // Add links from Work → Version
    versions.forEach((version) => {
      if (version.workId) {
        const sourceNode = nodeMap.get(version.workId);
        const targetNode = nodeMap.get(version.id);
        if (sourceNode && targetNode) {
          newLinks.push({
            source: sourceNode,
            target: targetNode,
            type: "hasVersion",
          });
        }
      }
    });

    // Add links from Version → Asset
    assets.forEach((asset) => {
      if (asset.versionId) {
        const sourceNode = nodeMap.get(asset.versionId);
        const targetNode = nodeMap.get(asset.id);
        if (sourceNode && targetNode) {
          newLinks.push({
            source: sourceNode,
            target: targetNode,
            type: "hasAsset",
          });
        }
      }
    });

    // Add edges (contains relations)
    edges.forEach((edge) => {
      const sourceNode = nodeMap.get(edge.fromId);
      const targetNode = nodeMap.get(edge.toId);
      if (sourceNode && targetNode) {
        newLinks.push({
          source: sourceNode,
          target: targetNode,
          type: edge.relation as any,
        });
      }
    });

    setNodes(newNodes);
    setLinks(newLinks);
  }, [works, versions, assets, activities, collections, edges, dimensions]);

  // Compute bounding box and centroid (average position) of all nodes
  const bounds = useMemo(() => {
    if (!nodes || nodes.length === 0) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity,
      sumX = 0,
      sumY = 0;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
      sumX += n.x;
      sumY += n.y;
    }
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const avgX = sumX / nodes.length;
    const avgY = sumY / nodes.length;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    return { minX, minY, maxX, maxY, width, height, avgX, avgY, midX, midY };
  }, [nodes]);

  // Helper: fit view to bounding box with +10% margin
  const fitToBounds = useCallback(() => {
    if (!bounds) return;
    const marginFactor = 1.1; // +10%
    const targetW = bounds.width * marginFactor;
    const targetH = bounds.height * marginFactor;
    const scaleX = dimensions.width / targetW;
    const scaleY = dimensions.height / targetH;
    const k = Math.max(0.1, Math.min(4, Math.min(scaleX, scaleY)));
    const x = dimensions.width / 2 - k * bounds.midX;
    const y = dimensions.height / 2 - k * bounds.midY;
    // Apply transform
    // Use setZoomTransform with object to avoid depending on previous state
    useGraphUI.getState().setZoomTransform({ x, y, k });
  }, [bounds, dimensions.width, dimensions.height]);

  // Auto-fit once on initial data load
  useEffect(() => {
    if (!hasAutoFittedRef.current && bounds) {
      fitToBounds();
      hasAutoFittedRef.current = true;
    }
  }, [bounds, fitToBounds]);

  // Setup d3-force simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    // When dragging we pause the simulation completely so everything stays frozen
    if (draggedNodes.length > 0) {
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
      return;
    }

    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }

    // Create simulation with reduced forces and sharp distance falloff
    const simulation = d3Force
      .forceSimulation<GraphNode>(nodes)
      .force(
        "charge",
        d3Force.forceManyBody<GraphNode>().strength(-150).distanceMax(120) // Tighter range so distant nodes are unaffected
      )
      .force(
        "link",
        d3Force
          .forceLink<GraphNode, GraphLink>(links)
          .id((d: any) => d.id)
          .distance(60)
          .strength(0.7)
      )
      .force(
        "center",
        d3Force
          .forceCenter(dimensions.width / 2, dimensions.height / 2)
          .strength(0.05)
      )
      .force(
        "collision",
        d3Force
          .forceCollide<GraphNode>()
          .radius((d: any) => NODE_SIZES[d.type] + 10)
      )
      .alphaDecay(0.05)
      .velocityDecay(0.6);

    simulation.on("tick", () => {
      if (draggedNodes.length === 0) {
        setNodes([...simulation.nodes()]);
      }
    });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [nodes.length, links, dimensions, draggedNodes.length]);

  // Zoom controls (delegated to store)
  const handleZoomIn = zoomIn;
  const handleZoomOut = zoomOut;
  const handleCenterToFit = fitToBounds;

  const handleResetLayout = () => {
    if (simulationRef.current) {
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const spread = 150;

      const resetNodes = nodes.map((node) => ({
        ...node,
        x: centerX + (Math.random() - 0.5) * spread,
        y: centerY + (Math.random() - 0.5) * spread,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
      }));

      setNodes(resetNodes);
      simulationRef.current.nodes(resetNodes);
      simulationRef.current.alpha(1).restart();
      // After resetting layout, center to current bounds
      setTimeout(() => {
        fitToBounds();
      }, 0);
    }
  };

  // Mouse wheel zoom - zoom towards cursor
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      zoomTowardsCursor({ x: e.clientX, y: e.clientY }, e.deltaY, rect);
    },
    [zoomTowardsCursor]
  );

  // Panning and dragging handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start panning if clicking on canvas background (not on a node)
    if (e.target === e.currentTarget) {
      startPanning({
        x: e.clientX - zoomTransform.x,
        y: e.clientY - zoomTransform.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      updatePan({ x: e.clientX, y: e.clientY });
    }

    // Handle multi-node dragging with relative positioning
    if (draggedNodes.length > 0 && dragStartMouse.current) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const currentX =
          (e.clientX - rect.left - zoomTransform.x) / zoomTransform.k;
        const currentY =
          (e.clientY - rect.top - zoomTransform.y) / zoomTransform.k;

        // Calculate delta from drag start
        const dx = currentX - dragStartMouse.current.x;
        const dy = currentY - dragStartMouse.current.y;

        // Update all dragged nodes relative to their original positions
        draggedNodes.forEach((node) => {
          const startPos = dragStartPositions.current.get(node.id);
          if (startPos) {
            node.fx = startPos.x + dx;
            node.fy = startPos.y + dy;
            node.x = startPos.x + dx;
            node.y = startPos.y + dy;
          }
        });

        setNodes([...nodes]);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // Clear selection only if clicking on canvas (and not dragging nodes)
    if (e.target === e.currentTarget && draggedNodes.length === 0) {
      clearSelection();
    }

    stopPanning();

    if (draggedNodes.length > 0) {
      // Release all dragged nodes but keep them selected
      draggedNodes.forEach((node) => {
        node.fx = null;
        node.fy = null;
      });
      stopDragging();
    }

    // Reset tracking
    dragStartMouse.current = null;
    dragStartPositions.current.clear();
  };

  // Node interaction handlers
  const handleNodeMouseDown = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent native drag/select behavior

    // Compute next selection atomically to avoid stale reads during the same event
    const currentlySelected = new Set(selectedNodeIds);
    const isSelected = currentlySelected.has(node.id);
    // Rule:
    // - Shift held: toggle clicked node in selection
    // - No Shift:
    //   - If clicked node is already selected: KEEP current multi-selection (do not collapse)
    //   - If clicked node is not selected: select ONLY the clicked node
    const nextSelected = new Set(currentlySelected);
    if (isMultiSelectMode) {
      if (isSelected) nextSelected.delete(node.id);
      else nextSelected.add(node.id);
    } else {
      if (!isSelected) {
        nextSelected.clear();
        nextSelected.add(node.id);
      }
      // If already selected and no shift: keep selection as-is
    }
    setSelection(nextSelected);

    // Nodes to drag are exactly the next selection
    const nodesToDrag = nodes.filter((n) => nextSelected.has(n.id));

    // Store initial positions for relative dragging
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      dragStartMouse.current = {
        x: (e.clientX - rect.left - zoomTransform.x) / zoomTransform.k,
        y: (e.clientY - rect.top - zoomTransform.y) / zoomTransform.k,
      };

      dragStartPositions.current.clear();
      nodesToDrag.forEach((n) => {
        dragStartPositions.current.set(n.id, { x: n.x, y: n.y });
        n.fx = n.x;
        n.fy = n.y;
      });
    }

    startDragging(nodesToDrag);

    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }
  };

  // Helper to select all nodes of a specific type
  const handleSelectByType = useCallback(
    (type: GraphNode["type"]) => {
      clearSelection();
      const nodeIds = nodes.filter((n) => n.type === type).map((n) => n.id);
      nodeIds.forEach((id) => selectNode(id, true));
    },
    [nodes, clearSelection, selectNode]
  );

  if (!works || !versions || !assets || !activities || !collections || !edges) {
    return (
      <div className="w-full h-screen flex items-center justify-center text-gray-400">
        Loading graph data...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left sidebar - Stats (10% width) */}
      <div className="w-[10%] min-w-[120px] bg-gray-950 border-r border-gray-800 p-4 flex flex-col gap-3 overflow-y-auto">
        <StatCard
          label="Works"
          count={stats.works}
          color="bg-green-500"
          type="work"
          onClick={() => handleSelectByType("work")}
        />
        <StatCard
          label="Versions"
          count={stats.versions}
          color="bg-blue-500"
          type="version"
          onClick={() => handleSelectByType("version")}
        />
        <StatCard
          label="Assets"
          count={stats.assets}
          color="bg-orange-500"
          type="asset"
          onClick={() => handleSelectByType("asset")}
        />
        <StatCard
          label="Activities"
          count={stats.activities}
          color="bg-purple-500"
          type="activity"
          onClick={() => handleSelectByType("activity")}
        />
        <StatCard
          label="Collections"
          count={stats.collections}
          color="bg-pink-500"
          type="collection"
          onClick={() => handleSelectByType("collection")}
        />
        <StatCard label="Edges" count={stats.edges} color="bg-gray-500" />
        <StatCard
          label="Unlinked"
          count={stats.unlinkedAssets}
          color="bg-red-500"
        />
      </div>

      {/* Graph area (90% width) */}
      <div
        ref={containerRef}
        className="flex-1 relative bg-gray-900 select-none touch-none"
        style={{
          cursor: isPanning
            ? "grabbing"
            : draggedNodes.length > 0
              ? "grabbing"
              : "grab",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseEnter={() => {
          isPointerOverGraph.current = true;
        }}
        onMouseLeave={(e) => {
          isPointerOverGraph.current = false;
          handleMouseUp(e);
        }}
        onWheel={handleWheel}
      >
        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="p-2 bg-gray-800 rounded shadow-lg hover:bg-gray-700 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-gray-800 rounded shadow-lg hover:bg-gray-700 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={handleCenterToFit}
            className="p-2 bg-gray-800 rounded shadow-lg hover:bg-gray-700 transition-colors"
            title="Center to Bounds"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleResetLayout}
            className="p-2 bg-gray-800 rounded shadow-lg hover:bg-gray-700 transition-colors"
            title="Reset Layout"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        {/* Zoom level */}
        <div className="absolute bottom-4 left-4 z-10 px-3 py-1 bg-gray-800 rounded shadow-lg text-sm font-mono">
          {Math.round(zoomTransform.k * 100)}%
        </div>

        {/* Legend */}
        <div className="absolute top-4 left-4 z-10 bg-gray-800 rounded shadow-lg p-3 text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Work</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Version</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span>Asset</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>Activity</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-pink-500" />
            <span>Collection</span>
          </div>
        </div>

        {/* Canvas */}
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          style={{ pointerEvents: "none" }}
        >
          <defs>
            <pattern
              id="grid"
              width="50"
              height="50"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="25" cy="25" r="1" fill="#374151" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <g
            transform={`translate(${zoomTransform.x},${zoomTransform.y}) scale(${zoomTransform.k})`}
          >
            {/* Bounding box and centroid overlay */}
            {bounds && (
              <g style={{ pointerEvents: "none" }}>
                {/* Bounding box */}
                <rect
                  x={bounds.minX}
                  y={bounds.minY}
                  width={bounds.width}
                  height={bounds.height}
                  fill="none"
                  stroke="#9CA3AF"
                  strokeDasharray="4 4"
                  opacity={0.25}
                />
                {/* Average position as faint X */}
                <g opacity={0.35}>
                  <line
                    x1={bounds.avgX - 6}
                    y1={bounds.avgY - 6}
                    x2={bounds.avgX + 6}
                    y2={bounds.avgY + 6}
                    stroke="#9CA3AF"
                    strokeWidth={1}
                  />
                  <line
                    x1={bounds.avgX - 6}
                    y1={bounds.avgY + 6}
                    x2={bounds.avgX + 6}
                    y2={bounds.avgY - 6}
                    stroke="#9CA3AF"
                    strokeWidth={1}
                  />
                </g>
              </g>
            )}
            {/* Render links */}
            {links.map((link, i) => {
              const sx = link.source.x;
              const sy = link.source.y;
              const tx = link.target.x;
              const ty = link.target.y;

              return (
                <line
                  key={`link-${i}`}
                  x1={sx}
                  y1={sy}
                  x2={tx}
                  y2={ty}
                  stroke="#4b5563"
                  strokeWidth={link.type === "contains" ? 2 : 1}
                  strokeOpacity={0.6}
                  strokeDasharray={link.type === "contains" ? "5,5" : "0"}
                />
              );
            })}

            {/* Render nodes */}
            {nodes.map((node) => {
              const isSelected = isNodeSelected(node.id);
              const isHovered = hoveredNode?.id === node.id;

              return (
                <g
                  key={node.id}
                  style={{ cursor: "pointer", pointerEvents: "all" }}
                  onMouseDown={(e) => handleNodeMouseDown(e as any, node)}
                  onDragStart={(e) => e.preventDefault()}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={NODE_SIZES[node.type]}
                    fill={NODE_COLORS[node.type]}
                    stroke={isSelected ? "#ffffff" : "#1f2937"}
                    strokeWidth={isSelected ? 3 : 2}
                    opacity={isHovered ? 1 : 0.8}
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover card for Works */}
        {hoveredNode && hoveredNode.type === "work" && (
          <div
            className="absolute z-20 pointer-events-none"
            style={{
              left: hoveredNode.x * zoomTransform.k + zoomTransform.x + 40,
              top: hoveredNode.y * zoomTransform.k + zoomTransform.y,
            }}
          >
            <WorkCardCompact work={hoveredNode.data as WorkExtended} />
          </div>
        )}
      </div>
    </div>
  );
}
