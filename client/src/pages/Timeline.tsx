import { useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
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
  MiniMap,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function Timeline() {
  const params = useParams();
  const projectId = params.projectId ? parseInt(params.projectId, 10) : 0;
  const [, setLocation] = useLocation();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const { data: timelineNodes } = trpc.timeline.nodes.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  const { data: timelineConnections } = trpc.timeline.connections.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  useEffect(() => {
    if (timelineNodes) {
      const flowNodes: Node[] = timelineNodes.map((node: any) => ({
        id: node.id.toString(),
        type: 'default',
        position: { x: node.timePosition, y: node.groupPosition * 100 },
        data: { label: node.title },
        style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.5rem',
            padding: '0.5rem',
            width: 150,
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        }
      }));
      setNodes(flowNodes);
    }
  }, [timelineNodes, setNodes]);

  useEffect(() => {
    if (timelineConnections) {
        const flowEdges: Edge[] = timelineConnections.map((conn: any) => ({
            id: conn.id.toString(),
            source: conn.sourceNodeId.toString(),
            target: conn.targetNodeId.toString(),
            label: conn.label,
            type: 'smoothstep',
            animated: true,
            style: { stroke: 'hsl(var(--primary))' },
        }));
        setEdges(flowEdges);
    }
  }, [timelineConnections, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleBack = () => {
    setLocation(`/project/${projectId}`);
  };

  return (
    <DashboardLayout mainClassName="h-[calc(100vh-2rem)] flex flex-col p-0 overflow-hidden relative">
        <div className="absolute top-4 left-4 z-10 flex gap-2">
            <Button variant="outline" size="sm" onClick={handleBack} className="gap-1 bg-background/80 backdrop-blur">
                <ArrowLeft className="h-4 w-4" />
                返回项目
            </Button>
            <Card className="px-3 py-1 flex items-center gap-2 bg-background/80 backdrop-blur border shadow-sm">
                <span className="text-sm font-medium">故事线图谱</span>
            </Card>
        </div>

        <div className="flex-1 w-full h-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                className="bg-muted/5"
            >
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                <Controls />
                <MiniMap 
                    nodeColor={() => 'hsl(var(--primary))'}
                    maskColor="hsl(var(--background) / 0.8)"
                    style={{ backgroundColor: 'hsl(var(--muted))' }}
                />
                <Panel position="top-right">
                    <Button size="sm" className="gap-1 shadow-md">
                        <Plus className="h-4 w-4" />
                        添加节点
                    </Button>
                </Panel>
            </ReactFlow>
        </div>
    </DashboardLayout>
  );
}
