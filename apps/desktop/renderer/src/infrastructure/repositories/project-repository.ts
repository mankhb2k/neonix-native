import type {
  DesktopAPI,
  ProjectOpenResult,
  RecentProject,
  SaveProjectResult,
} from "../../../../src/shared/ipc/contracts";

export type ProjectRepository = {
  newProject(): Promise<{
    projectId: string;
    documentJson: string;
    name: string;
  }>;
  open(): Promise<ProjectOpenResult | null>;
  openPath(path: string): Promise<ProjectOpenResult>;
  save(input: {
    path?: string;
    documentJson: string;
  }): Promise<SaveProjectResult>;
  saveAs(input: {
    suggestedName?: string;
    documentJson: string;
  }): Promise<SaveProjectResult>;
  getRecent(): Promise<RecentProject[]>;
};

export function createProjectRepository(api: DesktopAPI): ProjectRepository {
  return {
    newProject: () => api.project.create(),
    open: () => api.project.open(),
    openPath: (filePath) => api.project.openPath(filePath),
    save: (input) => api.project.save(input),
    saveAs: (input) => api.project.saveAs(input),
    getRecent: () => api.project.getRecent(),
  };
}
