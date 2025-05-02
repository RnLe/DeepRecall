// PlannerCanvasView.tsx – updated to include DayTemplates node
"use client";

import React, { useEffect, useCallback } from "react";
import ReactFlow, {
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Node,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import Planner12WeekGoals from "./Planner12WeekGoals";
import PlannerVisions from "./PlannerVisions";
import DayTemplates from "./DayTemplates";

interface CanvasViewProps {
  selectedCard: string | null;
  onSelectCard: (cardId: string) => void;
  cardToCenter: string | null;
  clearCardToCenter: () => void;
}

// Register our custom node components
const nodeTypes = {
  planner12week: Planner12WeekGoals,
  plannerVisions: PlannerVisions,
  plannerDayTemplates: DayTemplates,
};

// Initial nodes placed on the canvas
const nodesInitial: Node[] = [
  {
    id: "planner12week",
    type: "planner12week",
    data: {},
    position: { x: 300, y: 200 },
  },
  {
    id: "plannerVisions",
    type: "plannerVisions",
    data: {},
    position: { x: -700, y: 200 },
  },
  {
    id: "plannerDayTemplates",
    type: "plannerDayTemplates",
    data: {},
    position: { x: -200, y: -1000 },
  },
];

const PlannerCanvasInner: React.FC<CanvasViewProps> = ({
  selectedCard,
  onSelectCard,
  cardToCenter,
  clearCardToCenter,
}) => {
  const [nodes, , onNodesChange] = useNodesState(nodesInitial);
  const [edges, , onEdgesChange] = useEdgesState([]);
  const reactFlowInstance = useReactFlow();

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      onSelectCard(node.id);
    },
    [onSelectCard]
  );

  // Centering logic
  useEffect(() => {
    if (cardToCenter) {
      if (cardToCenter === "ALL") {
        reactFlowInstance.fitView({ duration: 800 });
      } else {
        const node = nodes.find((n) => n.id === cardToCenter);
        if (node) {
          const width = Number(node.style?.width) || 0;
          const height = Number(node.style?.height) || 0;
          reactFlowInstance.setCenter(
            node.position.x + width / 2,
            node.position.y + height / 2,
            { zoom: 1.2, duration: 800 }
          );
        }
      }
      clearCardToCenter();
    }
  }, [cardToCenter, nodes, reactFlowInstance, clearCardToCenter]);

  return (
    <ReactFlow
      nodes={nodes.map((n) => ({
        ...n,
        style: {
          ...n.style,
          border: selectedCard === n.id ? "2px solid #93c5fd" : "1px solid #555",
        },
      }))}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      minZoom={0.01}
      maxZoom={20}
      fitView
      nodesDraggable={false}
      nodesConnectable={false}
      className="text-gray-800"
    >
      <Background variant={BackgroundVariant.Dots} gap={15} />
      <Controls />
    </ReactFlow>
  );
};

const PlannerCanvasView: React.FC<CanvasViewProps> = (props) => (
  <div className="flex-1 h-full" id="reactflow-container">
    <ReactFlowProvider>
      <PlannerCanvasInner {...props} />
    </ReactFlowProvider>
  </div>
);

export default PlannerCanvasView;
