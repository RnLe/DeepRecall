/**
 * DexieGraphVisualization Component
 *
 * Visualizes the local Dexie database structure using d3-force layout.
 * Shows Works, Versions, Assets, Activities, Collections, and their relationships (Edges).
 *
 * MENTAL MODEL VISUALIZATION:
 * - Works (green) → Versions (blue) → Assets (orange)
 * - Activities (purple) ⟷ Assets/Works (via "contains" edges)
 * - Collections (pink) ⟷ Works/Assets (via "contains" edges)
 * - Unlinked Assets (red) = standalone with no edges
 */

"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3Force from "d3-force";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/db/dexie";
import { ZoomIn, ZoomOut, Maximize2, Info, RotateCcw } from "lucide-react";
import { WorkCardCompact } from "@/app/library/WorkCardCompact";
import type { WorkExtended } from "@/src/schema/library";
import { useWorksExtended } from "@/src/hooks/useLibrary";
import { useRouter } from "next/navigation";
import { useReaderUI } from "@/src/stores/reader-ui";

interface GraphNode {
  id: string;
  label: string;
  type: "work" | "version" | "asset" | "activity" | "collection";
  data?: any; // Original entity data
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: GraphNode;
  target: GraphNode;
  type: "hasVersion" | "hasAsset" | "contains" | "other";
}

const NODE_COLORS = {
  work: "#10b981", // green
  version: "#3b82f6", // blue
  asset: "#f97316", // orange
  activity: "#a855f7", // purple
  collection: "#ec4899", // pink
};

const NODE_SIZES = {
  work: 30, // Larger for works (will show card on hover)
  version: 12,
  asset: 10,
  activity: 16,
  collection: 14,
};

export default function DexieGraphVisualization() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [zoomTransform, setZoomTransform] = useState({ x: 0, y: 0, k: 1 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [draggedNode, setDraggedNode] = useState<GraphNode | null>(null);
  const simulationRef = useRef<d3Force.Simulation<GraphNode, GraphLink> | null>(
    null
  );
  const isPointerOverGraph = useRef(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isHoveringCard, setIsHoveringCard] = useState(false);

  // Router and reader UI for double-click navigation
  const router = useRouter();
  const { openTab, setLeftSidebarView } = useReaderUI();

  // Live query all Dexie data
  const works = useWorksExtended(); // Use extended works to get assets
  const assets = useLiveQuery(() => db.assets.toArray(), []);
  const activities = useLiveQuery(() => db.activities.toArray(), []);
  const collections = useLiveQuery(() => db.collections.toArray(), []);
  const edges = useLiveQuery(() => db.edges.toArray(), []);

  // Compute stats
  const stats = useMemo(() => {
    const unlinkedAssets = (assets || []).filter(
      (a) =>
        !a.workId &&
        !(edges || []).some((e) => e.relation === "contains" && e.toId === a.id)
    );

    return {
      works: works?.length || 0,
      assets: assets?.length || 0,
      activities: activities?.length || 0,
      collections: collections?.length || 0,
      edges: edges?.length || 0,
      unlinkedAssets: unlinkedAssets.length,
    };
  }, [works, assets, activities, collections, edges]);

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

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Build graph data
  useEffect(() => {
    if (!works || !assets || !activities || !collections || !edges) {
      return;
    }

    const newNodes: GraphNode[] = [];
    const newLinks: GraphLink[] = [];
    const nodeMap = new Map<string, GraphNode>();

    // Cluster nodes closer to center with smaller spread
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const spread = 150; // Reduced from full width/height

    // Add Works
    works.forEach((work) => {
      const node: GraphNode = {
        id: work.id,
        label: work.title.slice(0, 20) + (work.title.length > 20 ? "..." : ""),
        type: "work",
        data: work,
        x: centerX + (Math.random() - 0.5) * spread,
        y: centerY + (Math.random() - 0.5) * spread,
      };
      newNodes.push(node);
      nodeMap.set(work.id, node);
    });

    // Add Assets
    assets.forEach((asset) => {
      const node: GraphNode = {
        id: asset.id,
        label:
          asset.filename.slice(0, 15) +
          (asset.filename.length > 15 ? "..." : ""),
        type: "asset",
        data: asset,
        x: centerX + (Math.random() - 0.5) * spread,
        y: centerY + (Math.random() - 0.5) * spread,
      };
      newNodes.push(node);
      nodeMap.set(asset.id, node);
    });

    // Add Activities
    activities.forEach((activity) => {
      const node: GraphNode = {
        id: activity.id,
        label:
          activity.title.slice(0, 20) +
          (activity.title.length > 20 ? "..." : ""),
        type: "activity",
        data: activity,
        x: centerX + (Math.random() - 0.5) * spread,
        y: centerY + (Math.random() - 0.5) * spread,
      };
      newNodes.push(node);
      nodeMap.set(activity.id, node);
    });

    // Add Collections
    collections.forEach((collection) => {
      const node: GraphNode = {
        id: collection.id,
        label:
          collection.name.slice(0, 20) +
          (collection.name.length > 20 ? "..." : ""),
        type: "collection",
        data: collection,
        x: centerX + (Math.random() - 0.5) * spread,
        y: centerY + (Math.random() - 0.5) * spread,
      };
      newNodes.push(node);
      nodeMap.set(collection.id, node);
    });

    // Add links from Work → Version

    // Add links from Work → Asset
    assets.forEach((asset) => {
      if (asset.workId) {
        const sourceNode = nodeMap.get(asset.workId);
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
  }, [works, assets, activities, collections, edges, dimensions]);

  // Setup d3-force simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    // When dragging we pause the simulation completely so everything stays frozen
    if (draggedNode) {
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
      if (!draggedNode) {
        setNodes([...simulation.nodes()]);
      }
    });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [nodes.length, links, dimensions, draggedNode]);

  // Zoom controls
  const handleZoomIn = () => {
    setZoomTransform((t) => ({
      x: t.x,
      y: t.y,
      k: Math.min(t.k * 1.3, 4),
    }));
  };

  const handleZoomOut = () => {
    setZoomTransform((t) => ({
      x: t.x,
      y: t.y,
      k: Math.max(t.k * 0.7, 0.1),
    }));
  };

  const handleZoomReset = () => {
    setZoomTransform({ x: 0, y: 0, k: 1 });
  };

  const handleResetLayout = () => {
    // Rebuild nodes with fresh random positions
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
    }
  };

  // Mouse wheel zoom - zoom towards cursor
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Note: preventDefault is handled globally
    e.stopPropagation();

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Get mouse position relative to canvas
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;

    setZoomTransform((t) => {
      const newK = Math.max(0.1, Math.min(4, t.k * delta));

      // Calculate new position to zoom towards mouse
      const newX = mouseX - ((mouseX - t.x) / t.k) * newK;
      const newY = mouseY - ((mouseY - t.y) / t.k) * newK;

      return { x: newX, y: newY, k: newK };
    });
  }, []);

  // Panning
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - zoomTransform.x,
        y: e.clientY - zoomTransform.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setZoomTransform((t) => ({
        ...t,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    }

    // Handle node dragging - don't restart simulation, just update positions manually
    if (draggedNode) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - zoomTransform.x) / zoomTransform.k;
        const y = (e.clientY - rect.top - zoomTransform.y) / zoomTransform.k;
        draggedNode.fx = x;
        draggedNode.fy = y;
        draggedNode.x = x;
        draggedNode.y = y;
        setNodes([...nodes]); // Force re-render
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if (draggedNode) {
      draggedNode.fx = null;
      draggedNode.fy = null;
      setDraggedNode(null);
    }
  };

  // Node drag handlers
  const handleNodeDoubleClick = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
    e.preventDefault();

    // Only handle work nodes with PDF assets
    if (node.type === "work") {
      const work = node.data as WorkExtended;
      const pdfAsset = work.assets?.find(
        (asset) => asset.mime === "application/pdf"
      );
      if (pdfAsset) {
        openTab(pdfAsset.sha256, work.title || pdfAsset.filename);
        setLeftSidebarView("annotations");
        router.push("/reader");
      }
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
    setDraggedNode(node);
    // Stop ALL forces when picking up a node
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }
    node.fx = node.x;
    node.fy = node.y;
  };

  if (!works || !assets || !activities || !collections || !edges) {
    return (
      <div className="w-full h-[800px] flex items-center justify-center text-gray-400">
        Loading Dexie data...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Local Data Graph</h2>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Info className="w-4 h-4" />
            <span>Dexie (Browser IndexedDB)</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-7 gap-2 text-xs">
        <StatCard label="Works" count={stats.works} color="bg-green-500" />

        <StatCard label="Assets" count={stats.assets} color="bg-orange-500" />
        <StatCard
          label="Activities"
          count={stats.activities}
          color="bg-purple-500"
        />
        <StatCard
          label="Collections"
          count={stats.collections}
          color="bg-pink-500"
        />
        <StatCard label="Edges" count={stats.edges} color="bg-gray-500" />
        <StatCard
          label="Unlinked Assets"
          count={stats.unlinkedAssets}
          color="bg-red-500"
          highlight={stats.unlinkedAssets > 0}
        />
      </div>

      {/* Graph */}
      <div
        ref={containerRef}
        className="relative bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
        style={{
          height: 800,
          cursor: isPanning ? "grabbing" : draggedNode ? "grabbing" : "grab",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseEnter={() => {
          isPointerOverGraph.current = true;
        }}
        onMouseLeave={() => {
          isPointerOverGraph.current = false;
          handleMouseUp();
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
            onClick={handleZoomReset}
            className="p-2 bg-gray-800 rounded shadow-lg hover:bg-gray-700 transition-colors"
            title="Reset Zoom"
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
        <div className="absolute top-4 left-4 z-10 bg-gray-800 rounded shadow-lg p-3 text-xs space-y-1.5 max-w-[200px]">
          <div className="font-semibold text-gray-300 mb-2">Node Types</div>
          <LegendItem label="Work" color={NODE_COLORS.work} />
          <LegendItem label="Version" color={NODE_COLORS.version} />
          <LegendItem label="Asset" color={NODE_COLORS.asset} />
          <LegendItem label="Activity" color={NODE_COLORS.activity} />
          <LegendItem label="Collection" color={NODE_COLORS.collection} />
          <div className="pt-2 mt-2 border-t border-gray-700 text-gray-400 text-[10px]">
            Drag to pan • Scroll to zoom • Drag nodes
          </div>
        </div>

        {/* Canvas */}
        <svg
          width={dimensions.width}
          height={dimensions.height}
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
              const isHovered = hoveredNode?.id === node.id;
              const radius = NODE_SIZES[node.type];

              return (
                <g key={node.id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius}
                    fill={NODE_COLORS[node.type]}
                    stroke={isHovered ? "#ffffff" : "transparent"}
                    strokeWidth={isHovered ? 2 : 0}
                    style={{ cursor: "grab", pointerEvents: "all" }}
                    onDoubleClick={(e) => handleNodeDoubleClick(e as any, node)}
                    onMouseEnter={() => {
                      if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                      }
                      setHoveredNode(node);
                    }}
                    onMouseLeave={() => {
                      // Delay hiding to allow mouse to move to the card
                      hoverTimeoutRef.current = setTimeout(() => {
                        if (!isHoveringCard) {
                          setHoveredNode(null);
                        }
                      }, 150);
                    }}
                    onMouseDown={(e) => handleNodeMouseDown(e as any, node)}
                  />
                  <text
                    x={node.x}
                    y={node.y + radius + 12}
                    fontSize={9}
                    textAnchor="middle"
                    fill="#9ca3af"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Tooltip for hovered node */}
        {hoveredNode && (
          <div
            className="absolute z-20 pointer-events-auto"
            style={{
              left: hoveredNode.x * zoomTransform.k + zoomTransform.x + 20,
              top: hoveredNode.y * zoomTransform.k + zoomTransform.y - 10,
            }}
            onMouseEnter={() => {
              if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
                hoverTimeoutRef.current = null;
              }
              setIsHoveringCard(true);
            }}
            onMouseLeave={() => {
              setIsHoveringCard(false);
              setHoveredNode(null);
            }}
          >
            {hoveredNode.type === "work" ? (
              <div className="scale-75 origin-top-left" style={{ width: 400 }}>
                <WorkCardCompact work={hoveredNode.data as WorkExtended} />
              </div>
            ) : (
              <div className="px-3 py-2 bg-gray-800 text-white text-xs rounded shadow-lg max-w-xs">
                <div className="font-semibold">{hoveredNode.label}</div>
                <div className="text-gray-400 text-[10px] mt-0.5 font-mono">
                  {hoveredNode.id.slice(0, 24)}...
                </div>
                <div className="text-gray-300 mt-1">
                  Type: {hoveredNode.type}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper: Stat card
function StatCard({
  label,
  count,
  color,
  highlight = false,
}: {
  label: string;
  count: number;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded border ${
        highlight
          ? "bg-red-950/30 border-red-900"
          : "bg-gray-900 border-gray-800"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-gray-400 font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{count}</div>
    </div>
  );
}

// Helper: Legend item
function LegendItem({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-gray-300">{label}</span>
    </div>
  );
}
