/**
 * Project Information Types
 * Defines the structure for project metadata and ERPNext integration
 */

export interface ERPNextConnection {
  enabled: boolean;
  url: string;
  apiKey: string;
  apiSecret: string;
  linkedProjectId?: string;
}

export interface ProjectInfo {
  projectName: string;
  projectNumber: string;
  client: string;
  address: string;
  author: string;
  architect: string;
  contractor: string;
  phase: string;
  status: string;
  discipline: string;
  description: string;
  startDate: string;
  endDate: string;
  customFields: Record<string, string>;
  erpnext: ERPNextConnection;
}

export const DEFAULT_PROJECT_INFO: ProjectInfo = {
  projectName: '',
  projectNumber: '',
  client: '',
  address: '',
  author: '',
  architect: '',
  contractor: '',
  phase: '',
  status: '',
  discipline: '',
  description: '',
  startDate: '',
  endDate: '',
  customFields: {},
  erpnext: {
    enabled: false,
    url: '',
    apiKey: '',
    apiSecret: '',
  },
};
