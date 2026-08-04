import type { LibraryPayload } from "../../library/model/library-payload";

export interface ShapeItem {
  id: string;
  label: string;
  payload: LibraryPayload;
  icon: React.ReactNode;
}

export interface ShapeCategory {
  title: string;
  items: ShapeItem[];
}
