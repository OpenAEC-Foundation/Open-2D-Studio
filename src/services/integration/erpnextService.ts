/**
 * ERPNext Integration Service
 * Provides connectivity to ERPNext instances for project data synchronization
 */

import type { ERPNextConnection, ProjectInfo } from '../../types/projectInfo';

export interface ERPNextProject {
  name: string;
  project_name: string;
  status: string;
  company: string;
  expected_start_date?: string;
  expected_end_date?: string;
  notes?: string;
  customer?: string;
  // Custom fields may appear here
  [key: string]: any;
}

/**
 * Test connection to an ERPNext instance
 */
export async function testConnection(
  url: string,
  apiKey: string,
  apiSecret: string
): Promise<boolean> {
  try {
    const baseUrl = url.replace(/\/+$/, '');
    const response = await fetch(
      `${baseUrl}/api/method/frappe.auth.get_logged_user`,
      {
        method: 'GET',
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          Accept: 'application/json',
        },
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch list of projects from ERPNext
 */
export async function fetchProjects(
  connection: ERPNextConnection
): Promise<ERPNextProject[]> {
  const baseUrl = connection.url.replace(/\/+$/, '');
  const fields = JSON.stringify([
    'name',
    'project_name',
    'status',
    'company',
    'expected_start_date',
    'expected_end_date',
    'customer',
  ]);

  const response = await fetch(
    `${baseUrl}/api/resource/Project?fields=${encodeURIComponent(fields)}&limit_page_length=100`,
    {
      method: 'GET',
      headers: {
        Authorization: `token ${connection.apiKey}:${connection.apiSecret}`,
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Fetch a single project from ERPNext by ID
 */
export async function fetchProject(
  connection: ERPNextConnection,
  projectId: string
): Promise<ERPNextProject> {
  const baseUrl = connection.url.replace(/\/+$/, '');

  const response = await fetch(
    `${baseUrl}/api/resource/Project/${encodeURIComponent(projectId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `token ${connection.apiKey}:${connection.apiSecret}`,
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch project: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Map ERPNext project data to local ProjectInfo fields
 */
export function mapToProjectInfo(
  erpProject: ERPNextProject
): Partial<ProjectInfo> {
  return {
    projectName: erpProject.project_name || '',
    projectNumber: erpProject.name || '',
    client: erpProject.customer || '',
    status: erpProject.status || '',
    description: erpProject.notes || '',
    startDate: erpProject.expected_start_date || '',
    endDate: erpProject.expected_end_date || '',
  };
}
