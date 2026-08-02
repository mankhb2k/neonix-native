import type {
  CreateProjectInput,
  DesktopAPI,
  ProjectNewResult,
  ProjectOpenResult,
  RecentProject,
  SaveProjectAsInput,
  SaveProjectInput,
  SaveProjectResult,
} from "../../../shared/ipc/contracts";

export type ProjectRepository = {
  newProject(input?: CreateProjectInput): Promise<ProjectNewResult>;
  open(): Promise<ProjectOpenResult | null>;
  openRecent(id: string): Promise<ProjectOpenResult>;
  save(input: SaveProjectInput): Promise<SaveProjectResult>;
  saveAs(input: SaveProjectAsInput): Promise<SaveProjectResult>;
  getRecent(): Promise<RecentProject[]>;
};

export function createProjectRepository(api: DesktopAPI): ProjectRepository {
  return {
    newProject: (input) => api.project.create(input),
    open: () => api.project.open(),
    openRecent: (id) => api.project.openRecent(id),
    save: (input) => api.project.save(input),
    saveAs: (input) => api.project.saveAs(input),
    getRecent: () => api.project.getRecent(),
  };
}
