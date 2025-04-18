// PlannerCanvasView.tsx
"use client";

import React, { useEffect, useCallback } from "react";
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
// Import the new Planner12WeekGoals component
import Planner12WeekGoals from "./Planner12WeekGoals";
import PlannerVisions from "./PlannerVisions";

interface CanvasViewProps {
  selectedCard: string | null;
  onSelectCard: (cardId: string) => void;
  cardToCenter: string | null;
  clearCardToCenter: () => void;
}

// Define our node types with the new PlannerVisions node.
const nodeTypes = {
  planner12week: Planner12WeekGoals,
  plannerVisions: PlannerVisions,
};

// Add a new node for PlannerVisions to the canvas.
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
    position: { x: -700, y: 200 }, // Position it to the left of the 12-week node
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

  // When a node is clicked, update the selected card.
  const onNodeClick = useCallback(
    (_, node) => {
      onSelectCard(node.id);
    },
    [onSelectCard]
  );

  // Centering logic remains the same.
  useEffect(() => {
    if (cardToCenter) {
      if (cardToCenter === "ALL") {
        reactFlowInstance.fitView({ duration: 800 });
      } else {
        const node = nodes.find((n) => n.id === cardToCenter);
        if (node) {
          const width = node.style?.width || 0;
          const height = node.style?.height || 0;
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
        // Highlighting if a node is selected (optional)
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
      // Disable moving and connecting nodes
      nodesDraggable={false}
      nodesConnectable={false}
    >
      <Background variant="dots" gap={15} />
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
