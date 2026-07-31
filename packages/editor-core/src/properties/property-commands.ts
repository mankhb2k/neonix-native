export type NodeTargetRef = {
  sceneId: string;
  nodeId: string;
};

export type TransformPatch = {
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
};

export type MetadataPatch = {
  name?: string;
  visible?: boolean;
};

export type DocumentPropertyCommand =
  | {
      type: "set-node-transform";
      targets: NodeTargetRef[];
      patch: TransformPatch;
    }
  | {
      type: "set-node-opacity";
      targets: NodeTargetRef[];
      opacity: number;
    }
  | {
      type: "set-node-metadata";
      targets: NodeTargetRef[];
      patch: MetadataPatch;
    };

export type PropertyDomainEvent =
  | {
      type: "node-transform-changed";
      targets: NodeTargetRef[];
    }
  | {
      type: "node-opacity-changed";
      targets: NodeTargetRef[];
    }
  | {
      type: "node-metadata-changed";
      targets: NodeTargetRef[];
    };
