"use client";

import { Redo2, Scissors, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui";

/** Shared Lucide props for TransportBar edit icons. */
export const editActionIcon = {
  size: 16,
  strokeWidth: 2.25,
} as const;

/**
 * Edit actions left of the zoom cluster: Undo · Redo · Split · Delete.
 * Actions are wired as placeholders until undo/history lands.
 */
export function EditActions() {
  return (
    <div className="flex items-center gap-2.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        disabled
        aria-label="Hoàn tác"
        title="Hoàn tác"
        leftIcon={<Undo2 {...editActionIcon} />}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        disabled
        aria-label="Làm lại"
        title="Làm lại"
        leftIcon={<Redo2 {...editActionIcon} />}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        aria-label="Tách clip"
        title="Tách"
        leftIcon={<Scissors {...editActionIcon} />}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        aria-label="Xóa"
        title="Xóa"
        leftIcon={<Trash2 {...editActionIcon} />}
      />
    </div>
  );
}
