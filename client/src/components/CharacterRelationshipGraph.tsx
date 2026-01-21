import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { trpc } from "@/lib/trpc";

interface CharacterRelationshipGraphProps {
  projectId: number;
}

export default function CharacterRelationshipGraph({ projectId }: CharacterRelationshipGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const { data: characters } = trpc.characters.list.useQuery({ projectId });
  const { data: relationships } = trpc.characters.relationships.useQuery({ projectId });

  useEffect(() => {
    if (!characters || !relationships) return;

    // Convert characters to nodes
    const newNodes: Node[] = characters.map((char, index) => ({
      id: char.id.toString(),
      type: "default",
      position: {
        x: 250 + (index % 3) * 300,
        y: 100 + Math.floor(index / 3) * 200,
      },
      data: {
        label: (
          <div className="flex flex-col items-center gap-2 p-2">
            {char.avatarUrl && (
              <img
                src={char.avatarUrl}
                alt={char.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            )}
            <div className="font-semibold text-sm">{char.name}</div>
            <div className="text-xs text-muted-foreground">{char.role}</div>
          </div>
        ),
      },
      style: {
        background: "hsl(var(--card) / 0.8)",
        backdropFilter: "blur(12px)",
        border: "1px solid hsl(var(--border) / 0.5)",
        borderRadius: "12px",
        padding: "10px",
        minWidth: "160px",
        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      },
    }));

    // Convert relationships to edges
    const newEdges: Edge[] = relationships.map((rel: any) => ({
      id: rel.id.toString(),
      source: rel.characterAId.toString(),
      target: rel.characterBId.toString(),
      label: rel.relationshipType,
      type: "smoothstep",
      animated: true,
      style: {
        stroke: "hsl(var(--primary))",
        strokeWidth: 2,
      },
      labelStyle: {
        fill: "hsl(var(--foreground))",
        fontSize: 12,
        fontWeight: 500,
      },
    }));

    setNodes(newNodes);
    setEdges(newEdges);
  }, [characters, relationships, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  if (!characters || characters.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p>还没有角色</p>
          <p className="text-sm mt-2">创建角色后即可查看关系图谱</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls className="!bg-background/80 !backdrop-blur-md !border-border/50 !text-foreground !shadow-lg rounded-lg overflow-hidden" />
        <MiniMap className="!bg-background/80 !backdrop-blur-md !border-border/50 !shadow-lg rounded-lg overflow-hidden" maskColor="hsl(var(--muted) / 0.5)" />
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="hsl(var(--muted-foreground) / 0.2)" />
      </ReactFlow>
    </div>
  );
}
