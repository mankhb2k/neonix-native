export const EXPLICIT_ID = /^[A-Za-z][A-Za-z0-9_-]{0,199}$/;
export const CLASS_TOKEN = /^-?(?:[A-Za-z_]|[A-Za-z_][A-Za-z0-9_-]*)[A-Za-z0-9_-]*$/;

export type Node = {
  tag: string;
  id?: string;
  atomicId: string;
  structuralPath: string;
  classes: string[];
  attributes: Map<string, string>;
  children: Node[];
  content: Array<Node | string>;
  parent: Node | null;
  order: number;
  style: Map<string, string>;
  text: string;
};
