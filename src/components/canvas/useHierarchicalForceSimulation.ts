import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3-force';
import type { CanvasNode, CanvasEdge } from '../../lib/api';

export interface HierarchicalSimNode extends d3.SimulationNodeDatum {
  id: string;
  canvasNode: CanvasNode;
  x: number;
  y: number;
}

interface SimLink extends d3.SimulationLinkDatum<HierarchicalSimNode> {
  source: string;
  target: string;
  strength: number;
}

interface UseHierarchicalForceSimulationProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  width: number;
  height: number;
}

interface UseHierarchicalForceSimulationResult {
  simNodes: HierarchicalSimNode[];
  isSimulating: boolean;
}

export function useHierarchicalForceSimulation({
  nodes,
  edges,
  width,
  height,
}: UseHierarchicalForceSimulationProps): UseHierarchicalForceSimulationResult {
  const [simNodes, setSimNodes] = useState<HierarchicalSimNode[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationRef = useRef<d3.Simulation<HierarchicalSimNode, undefined> | null>(null);

  useEffect(() => {
    // Clean up previous simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }

    if (nodes.length === 0 || width === 0 || height === 0) {
      setSimNodes(prev => prev.length === 0 ? prev : []);
      return;
    }

    const centerX = width / 2;
    const centerY = height / 2;

    // Initialize nodes at random positions around center
    const initialNodes: HierarchicalSimNode[] = nodes.map((node) => ({
      id: node.id,
      canvasNode: node,
      x: centerX + (Math.random() - 0.5) * Math.min(width, 600),
      y: centerY + (Math.random() - 0.5) * Math.min(height, 400),
    }));

    // Build links
    const links: SimLink[] = edges.map((edge) => ({
      source: edge.source_id,
      target: edge.target_id,
      strength: edge.weight * 0.3,
    }));

    // Collision radius varies by node type
    const getRadius = (d: HierarchicalSimNode) => {
      switch (d.canvasNode.node_type) {
        case 'category': return 120;
        case 'tag': return 100;
        case 'semantic_cluster': return 110;
        case 'atom': return 90;
        default: return 100;
      }
    };

    setIsSimulating(true);

    const simulation = d3
      .forceSimulation<HierarchicalSimNode>(initialNodes)
      .force('charge', d3.forceManyBody<HierarchicalSimNode>().strength(-300))
      .force('collide', d3.forceCollide<HierarchicalSimNode>().radius(getRadius))
      .force(
        'link',
        d3
          .forceLink<HierarchicalSimNode, SimLink>(links)
          .id((d) => d.id)
          .strength((d) => d.strength)
      )
      .force('center', d3.forceCenter(centerX, centerY))
      .force('x', d3.forceX(centerX).strength(0.05))
      .force('y', d3.forceY(centerY).strength(0.05))
      .alpha(1)
      .alphaDecay(0.06)
      .velocityDecay(0.4);

    let tickCount = 0;
    simulation.on('tick', () => {
      tickCount++;
      if (tickCount % 5 === 0) {
        setSimNodes([...initialNodes]);
      }
    });

    simulation.on('end', () => {
      setIsSimulating(false);
      setSimNodes([...initialNodes]);
    });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [nodes, edges, width, height]);

  return { simNodes, isSimulating };
}
