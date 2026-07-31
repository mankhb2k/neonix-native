/**
 * Phase 4 journal skeleton — disabled; recovery uses .bak from project-file-service.
 */

export type ProjectJournalEvent = {
  type: "open" | "save" | "saveAs" | "new";
  path?: string;
  projectId?: string;
  at: string;
};

export type ProjectJournalService = {
  enabled: boolean;
  record(event: ProjectJournalEvent): void;
};

export function createDisabledProjectJournal(): ProjectJournalService {
  return {
    enabled: false,
    record() {
      /* no-op until crash-recovery lands */
    },
  };
}
