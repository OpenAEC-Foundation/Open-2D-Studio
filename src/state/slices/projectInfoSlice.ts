/**
 * Project Info Slice - Manages project metadata and ERPNext connection state
 */

import type { ProjectInfo } from '../../types/projectInfo';
import { DEFAULT_PROJECT_INFO } from '../../types/projectInfo';

// ============================================================================
// State Interface
// ============================================================================

export interface ProjectInfoState {
  projectInfo: ProjectInfo;
  projectInfoDialogOpen: boolean;
}

// ============================================================================
// Actions Interface
// ============================================================================

export interface ProjectInfoActions {
  setProjectInfo: (info: ProjectInfo) => void;
  updateProjectInfo: (partial: Partial<ProjectInfo>) => void;
  resetProjectInfo: () => void;
  setProjectInfoDialogOpen: (open: boolean) => void;
}

export type ProjectInfoSlice = ProjectInfoState & ProjectInfoActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialProjectInfoState: ProjectInfoState = {
  projectInfo: { ...DEFAULT_PROJECT_INFO },
  projectInfoDialogOpen: false,
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createProjectInfoSlice = (
  set: (fn: (state: any) => void) => void,
  _get: () => any
): ProjectInfoActions => ({
  setProjectInfo: (info) =>
    set((state) => {
      state.projectInfo = info;
    }),

  updateProjectInfo: (partial) =>
    set((state) => {
      Object.assign(state.projectInfo, partial);
    }),

  resetProjectInfo: () =>
    set((state) => {
      state.projectInfo = { ...DEFAULT_PROJECT_INFO };
    }),

  setProjectInfoDialogOpen: (open) =>
    set((state) => {
      state.projectInfoDialogOpen = open;
    }),
});
