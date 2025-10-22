"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Group } from "@visx/group";
import { Circle, Line } from "@visx/shape";
import { Text } from "@visx/text";
import { scaleOrdinal } from "@visx/scale";
import { schemeCategory10 } from "d3-scale-chromatic";
import * as d3Force from "d3-force";
import * as d3Zoom from "d3-zoom";
import * as d3Selection from "d3-selection";
import { ZoomIn, ZoomOut, Maximize2, Link2 } from "lucide-react";
import type { KnowledgeGraph, GraphNode, GraphLink } from "./types";
import GraphSettings from "./GraphSettings";

interface GraphVisualizationProps {
  data: KnowledgeGraph | null;
  selectedNode?: GraphNode | null;
  selectedNodes?: Set<string>;
  onNodeSelect?: (nodeId: string, shiftKey: boolean) => void;
  onLegendClick?: (nodeType: string) => void;
  onContextMenu?: (e: React.MouseEvent, nodeId?: string) => void;
  edgeConnector?: { active: boolean; firstNode?: string; secondNode?: string };
  onEdgeConnectorToggle?: () => void;
}

// Color scale for different node kinds
const colorScale = scaleOrdinal({
  domain: ["entity", "concept", "action", "resource", "place", "role", "norm"],
  range: [...schemeCategory10],
});

// Default settings
const DEFAULT_SETTINGS = {
  chargeStrength: -300,
  linkDistance: 80,
  linkStrength: 0.5,
  collisionRadius: 20,
  centerStrength: 0.1,
};

export default function GraphVisualization({
  data,
  selectedNode,
  selectedNodes = new Set(),
  onNodeSelect,
  onLegendClick,
  onContextMenu,
  edgeConnector = { active: false },
  onEdgeConnectorToggle,
}: GraphVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const simulationRef = useRef<d3Force.Simulation<GraphNode, GraphLink> | null>(
    null
  );
  const isDraggingRef = useRef(false);
  const draggedNodeRef = useRef<GraphNode | null>(null);
  const zoomBehaviorRef = useRef<d3Zoom.ZoomBehavior<
    SVGSVGElement,
    unknown
  > | null>(null);

  // Calculate connection counts for each node
  const nodeConnectionCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    links.forEach((link) => {
      const srcId =
        typeof link.source === "string"
          ? link.source
          : (link.source as any).canon_id;
      const tgtId =
        typeof link.target === "string"
          ? link.target
          : (link.target as any).canon_id;
      counts[srcId] = (counts[srcId] || 0) + 1;
      counts[tgtId] = (counts[tgtId] || 0) + 1;
    });
    return counts;
  }, [links]);

  // Get radius for a node based on its connections (linear scaling)
  const getNodeRadius = (nodeId: string) => {
    const baseRadius = 8;
    const connectionCount = nodeConnectionCounts[nodeId] || 0;
    // Linear growth: add 1 pixel per connection, capped at reasonable size
    return Math.min(baseRadius + connectionCount * 0.8, 30);
  };

  // Check if an edge is connected to the selected node
  const isEdgeConnectedToSelected = (link: GraphLink) => {
    if (!selectedNode) return false;
    const srcId =
      typeof link.source === "string"
        ? link.source
        : (link.source as any).canon_id;
    const tgtId =
      typeof link.target === "string"
        ? link.target
        : (link.target as any).canon_id;
    return srcId === selectedNode.canon_id || tgtId === selectedNode.canon_id;
  };

  // Settings state
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Calculate node type counts for legend
  const nodeTypeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    nodes.forEach((node) => {
      counts[node.kind] = (counts[node.kind] || 0) + 1;
    });
    return counts;
  }, [nodes]);

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

  // Initialize zoom behavior
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = d3Selection.select(svgRef.current);
    const g = d3Selection.select(gRef.current);

    const zoom = d3Zoom
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    return () => {
      svg.on(".zoom", null);
    };
  }, [data]); // Re-initialize when data changes

  // Initialize nodes and links when data changes
  useEffect(() => {
    if (!data) {
      setNodes([]);
      setLinks([]);
      return;
    }

    // Initialize nodes with random positions
    const initialNodes: GraphNode[] = data.nodes.map((node) => ({
      ...node,
      x: Math.random() * dimensions.width,
      y: Math.random() * dimensions.height,
      vx: 0,
      vy: 0,
    }));

    // Create links
    const initialLinks: GraphLink[] = data.edges.map((edge) => ({
      source: edge.src,
      target: edge.tgt,
      kind: edge.kind,
      weight: edge.weight,
      justification: edge.justification,
    }));

    setNodes(initialNodes);
    setLinks(initialLinks);
  }, [data, dimensions.width, dimensions.height]);

  // Setup and run d3-force simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    // Stop previous simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    // Create new simulation
    const simulation = d3Force
      .forceSimulation<GraphNode>(nodes)
      .force(
        "charge",
        d3Force.forceManyBody<GraphNode>().strength(settings.chargeStrength)
      )
      .force(
        "link",
        d3Force
          .forceLink<GraphNode, GraphLink>(links)
          .id((d: any) => d.canon_id)
          .distance(settings.linkDistance)
          .strength(settings.linkStrength)
      )
      .force(
        "center",
        d3Force
          .forceCenter<GraphNode>(dimensions.width / 2, dimensions.height / 2)
          .strength(settings.centerStrength)
      )
      .force(
        "collision",
        d3Force.forceCollide<GraphNode>().radius((node: any) => {
          return getNodeRadius(node.canon_id) + 5; // Add padding
        })
      )
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simulation.on("tick", () => {
      // Only update if not dragging
      if (!isDraggingRef.current) {
        setNodes([...simulation.nodes()]);
      }
    });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
    };
  }, [nodes.length, links, dimensions.width, dimensions.height, settings]);

  // Handle node dragging
  const handleMouseDown = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    draggedNodeRef.current = node;

    if (simulationRef.current) {
      simulationRef.current.alphaTarget(0.3).restart();
      node.fx = node.x;
      node.fy = node.y;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !draggedNodeRef.current || !svgRef.current)
      return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();

    // Get current zoom transform
    const transform = zoomBehaviorRef.current
      ? d3Zoom.zoomTransform(svg as any)
      : { k: 1, x: 0, y: 0 };

    // Calculate position accounting for zoom and pan
    const x = (e.clientX - rect.left - transform.x) / transform.k;
    const y = (e.clientY - rect.top - transform.y) / transform.k;

    draggedNodeRef.current.fx = x;
    draggedNodeRef.current.fy = y;

    if (simulationRef.current) {
      simulationRef.current.alpha(0.3).restart();
    }
  };

  const handleMouseUp = () => {
    if (
      isDraggingRef.current &&
      draggedNodeRef.current &&
      simulationRef.current
    ) {
      isDraggingRef.current = false;
      draggedNodeRef.current.fx = null;
      draggedNodeRef.current.fy = null;
      draggedNodeRef.current = null;
      simulationRef.current.alphaTarget(0);
    }
  };

  // Handle node click
  const handleNodeClick = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
    if (!isDraggingRef.current) {
      console.log("Node clicked:", node.canon_id, "Shift:", e.shiftKey);
      onNodeSelect?.(node.canon_id, e.shiftKey);
    }
  };

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3Selection.select(svgRef.current);
    svg.transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.3);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3Selection.select(svgRef.current);
    svg.transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.7);
  }, []);

  const handleZoomReset = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3Selection.select(svgRef.current);
    svg
      .transition()
      .duration(300)
      .call(zoomBehaviorRef.current.transform, d3Zoom.zoomIdentity);
  }, []);

  // Settings handlers
  const handleResetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  if (!data) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        Select a knowledge graph file to visualize
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${
        edgeConnector.active
          ? "bg-purple-50 dark:bg-purple-950"
          : "bg-gray-50 dark:bg-gray-900"
      }`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => onContextMenu?.(e)}
    >
      <GraphSettings
        chargeStrength={settings.chargeStrength}
        onChargeStrengthChange={(v) =>
          setSettings((s) => ({ ...s, chargeStrength: v }))
        }
        linkDistance={settings.linkDistance}
        onLinkDistanceChange={(v) =>
          setSettings((s) => ({ ...s, linkDistance: v }))
        }
        linkStrength={settings.linkStrength}
        onLinkStrengthChange={(v) =>
          setSettings((s) => ({ ...s, linkStrength: v }))
        }
        collisionRadius={settings.collisionRadius}
        onCollisionRadiusChange={(v) =>
          setSettings((s) => ({ ...s, collisionRadius: v }))
        }
        centerStrength={settings.centerStrength}
        onCenterStrengthChange={(v) =>
          setSettings((s) => ({ ...s, centerStrength: v }))
        }
        onReset={handleResetSettings}
      />

      {/* Edge connector toggle & Zoom controls */}
      <div className="absolute bottom-20 right-4 z-10 flex flex-col gap-2">
        {onEdgeConnectorToggle && (
          <>
            <button
              onClick={onEdgeConnectorToggle}
              className={`p-2 rounded shadow-lg transition-colors ${
                edgeConnector.active
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
              title={
                edgeConnector.active
                  ? "Exit Edge Connector Mode"
                  : "Edge Connector Mode"
              }
            >
              <Link2 className="w-5 h-5" />
            </button>
            <div className="h-px bg-gray-300 dark:bg-gray-600 my-1"></div>
          </>
        )}
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white dark:bg-gray-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white dark:bg-gray-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={handleZoomReset}
          className="p-2 bg-white dark:bg-gray-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Reset Zoom"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-white dark:bg-gray-800 rounded shadow-lg p-3 max-w-xs">
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
          Node Types
        </h3>
        <div className="space-y-1.5">
          {Object.entries(nodeTypeCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([kind, count]) => (
              <button
                key={kind}
                onClick={() => onLegendClick?.(kind)}
                className="w-full flex items-center gap-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded transition-colors cursor-pointer"
                title={`Click to select all ${kind} nodes`}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: colorScale(kind) }}
                />
                <span className="flex-1 text-left text-gray-700 dark:text-gray-300">
                  {kind}
                </span>
                <span className="text-gray-500 dark:text-gray-400 font-mono">
                  ({count})
                </span>
              </button>
            ))}
        </div>
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          Total: {nodes.length} nodes
        </div>
      </div>

      {/* Edge connector status */}
      {edgeConnector.active && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 px-4 py-2 bg-purple-600 text-white rounded-lg shadow-lg text-sm font-medium">
          {edgeConnector.firstNode ? (
            <span>Select target node to create edge</span>
          ) : (
            <span>Edge Connector Mode: Select source node</span>
          )}
        </div>
      )}

      {/* Zoom level indicator */}
      <div className="absolute bottom-4 right-4 z-10 px-3 py-1 bg-white dark:bg-gray-800 rounded shadow-lg text-sm font-mono">
        {Math.round(zoomLevel * 100)}%
      </div>

      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ cursor: isDraggingRef.current ? "grabbing" : "grab" }}
      >
        <Group innerRef={gRef}>
          {/* Render edges */}
          {links.map((link, i) => {
            const sourceNode = nodes.find(
              (n) =>
                n.canon_id ===
                (typeof link.source === "string"
                  ? link.source
                  : (link.source as any).canon_id)
            );
            const targetNode = nodes.find(
              (n) =>
                n.canon_id ===
                (typeof link.target === "string"
                  ? link.target
                  : (link.target as any).canon_id)
            );

            if (!sourceNode || !targetNode) return null;

            const isHighlighted = isEdgeConnectedToSelected(link);
            // Base width is 1.5, weight scales it between 1x and 2x
            const baseWidth = 1.5;
            const weight = link.weight ?? 1;
            // Normalize weight to 0-1 range (assuming weights are 0-1), then scale to 1-2x
            const widthMultiplier = 1 + Math.min(Math.max(weight, 0), 1);
            const strokeWidth = baseWidth * widthMultiplier;

            // Calculate midpoint for label
            const midX = (sourceNode.x! + targetNode.x!) / 2;
            const midY = (sourceNode.y! + targetNode.y!) / 2;

            return (
              <Group key={`link-${i}`}>
                <Line
                  from={{ x: sourceNode.x!, y: sourceNode.y! }}
                  to={{ x: targetNode.x!, y: targetNode.y! }}
                  stroke={isHighlighted ? "#ffffff" : "#999"}
                  strokeWidth={strokeWidth}
                  strokeOpacity={isHighlighted ? 0.9 : 0.6}
                />
                {/* Edge label */}
                <Text
                  x={midX}
                  y={midY}
                  fontSize={9}
                  textAnchor="middle"
                  fill={isHighlighted ? "#ffffff" : "#666"}
                  style={{
                    pointerEvents: "none",
                    userSelect: "none",
                    opacity: isHighlighted ? 1 : 0.5,
                  }}
                >
                  {link.kind}
                </Text>
              </Group>
            );
          })}

          {/* Render nodes */}
          {nodes.map((node) => {
            const isSelected = selectedNode?.canon_id === node.canon_id;
            const isInMultiSelection = selectedNodes.has(node.canon_id);
            const isHovered = hoveredNode?.canon_id === node.canon_id;
            const isFirstInConnector =
              edgeConnector.firstNode === node.canon_id;
            const radius = getNodeRadius(node.canon_id);

            // Edge connector mode: orange for first node, purple for others
            // Multi-selection: purple, Single selection: blue
            let strokeColor = "#fff";
            let strokeWidth = 1;

            if (isFirstInConnector) {
              strokeColor = "#f97316"; // orange
              strokeWidth = 4;
            } else if (edgeConnector.active) {
              strokeColor = "#a855f7"; // purple
              strokeWidth = 2;
            } else if (isInMultiSelection) {
              strokeColor = selectedNodes.size > 1 ? "#a855f7" : "#3b82f6";
              strokeWidth = 3;
            } else if (isSelected) {
              strokeColor = "#3b82f6";
              strokeWidth = 3;
            } else if (isHovered) {
              strokeColor = "#64748b";
              strokeWidth = 2;
            }

            return (
              <Group key={node.canon_id} top={node.y} left={node.x}>
                <Circle
                  r={radius}
                  fill={colorScale(node.kind)}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  style={{
                    cursor: edgeConnector.active ? "crosshair" : "pointer",
                  }}
                  onMouseDown={(e) =>
                    !edgeConnector.active && handleMouseDown(e, node)
                  }
                  onClick={(e) => handleNodeClick(e, node)}
                  onContextMenu={(e) => {
                    e.stopPropagation();
                    onContextMenu?.(e, node.canon_id);
                  }}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                />
                <Text
                  x={0}
                  y={radius + 12}
                  fontSize={10}
                  textAnchor="middle"
                  fill="currentColor"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {node.display_name ||
                    node.canon_id.split(".").pop() ||
                    node.canon_id}
                </Text>
              </Group>
            );
          })}
        </Group>
      </svg>

      {/* Tooltip for hovered node */}
      {hoveredNode && (
        <div
          className="absolute z-30 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg pointer-events-none max-w-xs"
          style={{
            left: (hoveredNode.x || 0) + 20,
            top: (hoveredNode.y || 0) - 10,
          }}
        >
          <div className="font-semibold">
            {hoveredNode.display_name || hoveredNode.canon_id}
          </div>
          {hoveredNode.display_name && (
            <div className="text-gray-400 text-[10px] mt-0.5">
              {hoveredNode.canon_id}
            </div>
          )}
          <div className="text-gray-300 mt-1">Kind: {hoveredNode.kind}</div>
          {hoveredNode.tags && hoveredNode.tags.length > 0 && (
            <div className="text-gray-300 mt-1">
              Tags: {hoveredNode.tags.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
