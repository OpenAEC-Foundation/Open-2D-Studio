import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Wifi, WifiOff, Check, AlertCircle, ChevronDown } from 'lucide-react';
import { useAppStore } from '../../../state/appStore';
import type { ProjectInfo, ERPNextConnection } from '../../../types/projectInfo';
import { DEFAULT_PROJECT_INFO } from '../../../types/projectInfo';
import {
  testConnection,
  fetchProjects,
  fetchProject,
  mapToProjectInfo,
  type ERPNextProject,
} from '../../../services/integration/erpnextService';

interface ProjectInfoPanelProps {
  isOpen: boolean;
}

const inputClass = 'w-full bg-cad-bg border border-cad-border px-2 py-1 text-xs text-cad-text focus:border-cad-accent focus:outline-none';
const labelClass = 'block text-xs text-cad-text-dim mb-0.5';
const sectionClass = 'text-sm font-semibold text-cad-text mb-2 mt-4 first:mt-0';

export function ProjectInfoPanel({ isOpen }: ProjectInfoPanelProps) {
  const projectInfo = useAppStore(s => s.projectInfo);
  const setProjectInfo = useAppStore(s => s.setProjectInfo);
  const setModified = useAppStore(s => s.setModified);

  // Local form state
  const [form, setForm] = useState<ProjectInfo>({ ...DEFAULT_PROJECT_INFO });
  const [customFieldKey, setCustomFieldKey] = useState('');
  const [customFieldValue, setCustomFieldValue] = useState('');
  const [saved, setSaved] = useState(false);

  // ERPNext state
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [erpProjects, setErpProjects] = useState<ERPNextProject[]>([]);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Initialize form from store when panel opens
  useEffect(() => {
    if (isOpen) {
      setForm(JSON.parse(JSON.stringify(projectInfo)));
      setConnectionStatus('idle');
      setSyncStatus('idle');
      setStatusMessage('');
      setSaved(false);
    }
  }, [isOpen, projectInfo]);

  const updateField = useCallback((field: keyof ProjectInfo, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }, []);

  const updateErpField = useCallback((field: keyof ERPNextConnection, value: any) => {
    setForm(prev => ({
      ...prev,
      erpnext: { ...prev.erpnext, [field]: value },
    }));
    setSaved(false);
  }, []);

  const handleAddCustomField = useCallback(() => {
    if (!customFieldKey.trim()) return;
    setForm(prev => ({
      ...prev,
      customFields: { ...prev.customFields, [customFieldKey.trim()]: customFieldValue },
    }));
    setCustomFieldKey('');
    setCustomFieldValue('');
    setSaved(false);
  }, [customFieldKey, customFieldValue]);

  const handleRemoveCustomField = useCallback((key: string) => {
    setForm(prev => {
      const next = { ...prev.customFields };
      delete next[key];
      return { ...prev, customFields: next };
    });
    setSaved(false);
  }, []);

  const handleTestConnection = useCallback(async () => {
    setConnectionStatus('testing');
    setStatusMessage('Testing connection...');
    try {
      const ok = await testConnection(form.erpnext.url, form.erpnext.apiKey, form.erpnext.apiSecret);
      if (ok) {
        setConnectionStatus('success');
        setStatusMessage('Connection successful');
        try {
          const projects = await fetchProjects(form.erpnext);
          setErpProjects(projects);
        } catch {
          // Connection works but project list failed
        }
      } else {
        setConnectionStatus('error');
        setStatusMessage('Connection failed - check credentials');
      }
    } catch {
      setConnectionStatus('error');
      setStatusMessage('Connection failed - check URL');
    }
  }, [form.erpnext]);

  const handleSync = useCallback(async () => {
    if (!form.erpnext.linkedProjectId) {
      setStatusMessage('Select a project to sync');
      return;
    }
    setSyncStatus('syncing');
    setStatusMessage('Syncing project data...');
    try {
      const erpProject = await fetchProject(form.erpnext, form.erpnext.linkedProjectId);
      const mapped = mapToProjectInfo(erpProject);
      setForm(prev => ({ ...prev, ...mapped }));
      setSyncStatus('success');
      setStatusMessage('Project data synced successfully');
      setSaved(false);
    } catch (err) {
      setSyncStatus('error');
      setStatusMessage(`Sync failed: ${err}`);
    }
  }, [form.erpnext]);

  const handleSelectProject = useCallback((project: ERPNextProject) => {
    updateErpField('linkedProjectId', project.name);
    setShowProjectPicker(false);
  }, [updateErpField]);

  const handleSave = useCallback(() => {
    setProjectInfo(form);
    setModified(true);
    setSaved(true);
  }, [form, setProjectInfo, setModified]);

  return (
    <div className="p-8 h-full flex flex-col">
      <h2 className="text-lg font-semibold text-cad-text mb-4">Project Information</h2>

      <div className="flex-1 overflow-y-auto max-w-xl">

        {/* Connection Section */}
        <div className={sectionClass}>Connection</div>
        <div className="flex items-center gap-3 mb-2">
          <label className="flex items-center gap-1.5 text-xs text-cad-text cursor-pointer">
            <input
              type="radio"
              name="connectionMode"
              checked={!form.erpnext.enabled}
              onChange={() => updateErpField('enabled', false)}
              className="accent-cad-accent"
            />
            <WifiOff size={12} />
            Offline
          </label>
          <label className="flex items-center gap-1.5 text-xs text-cad-text cursor-pointer">
            <input
              type="radio"
              name="connectionMode"
              checked={form.erpnext.enabled}
              onChange={() => updateErpField('enabled', true)}
              className="accent-cad-accent"
            />
            <Wifi size={12} />
            ERPNext
          </label>
        </div>

        {form.erpnext.enabled && (
          <div className="bg-cad-bg/50 border border-cad-border p-3 mb-3 space-y-2 rounded">
            <div>
              <label className={labelClass}>ERPNext URL</label>
              <input
                type="text"
                className={inputClass}
                placeholder="https://myinstance.erpnext.com"
                value={form.erpnext.url}
                onChange={e => updateErpField('url', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>API Key</label>
                <input
                  type="text"
                  className={inputClass}
                  value={form.erpnext.apiKey}
                  onChange={e => updateErpField('apiKey', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>API Secret</label>
                <input
                  type="password"
                  className={inputClass}
                  value={form.erpnext.apiSecret}
                  onChange={e => updateErpField('apiSecret', e.target.value)}
                />
              </div>
            </div>

            {/* Linked Project */}
            <div>
              <label className={labelClass}>Linked Project</label>
              <div className="relative">
                <button
                  className={`${inputClass} text-left flex items-center justify-between cursor-default`}
                  onClick={() => {
                    if (connectionStatus === 'success') setShowProjectPicker(!showProjectPicker);
                  }}
                  disabled={connectionStatus !== 'success'}
                >
                  <span className={form.erpnext.linkedProjectId ? '' : 'text-cad-text-dim'}>
                    {form.erpnext.linkedProjectId || 'Select a project...'}
                  </span>
                  <ChevronDown size={12} />
                </button>
                {showProjectPicker && erpProjects.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 bg-cad-surface border border-cad-border shadow-lg max-h-40 overflow-y-auto">
                    {erpProjects.map(p => (
                      <button
                        key={p.name}
                        className="w-full text-left px-2 py-1 text-xs text-cad-text hover:bg-cad-hover cursor-default"
                        onClick={() => handleSelectProject(p)}
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-cad-text-dim ml-1">— {p.project_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Connection Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                className="px-2 py-1 text-xs bg-cad-accent text-white hover:bg-cad-accent/80 disabled:opacity-50 flex items-center gap-1"
                onClick={handleTestConnection}
                disabled={!form.erpnext.url || !form.erpnext.apiKey || !form.erpnext.apiSecret || connectionStatus === 'testing'}
              >
                {connectionStatus === 'testing' ? (
                  <RefreshCw size={11} className="animate-spin" />
                ) : connectionStatus === 'success' ? (
                  <Check size={11} />
                ) : connectionStatus === 'error' ? (
                  <AlertCircle size={11} />
                ) : null}
                Test Connection
              </button>
              <button
                className="px-2 py-1 text-xs bg-cad-accent text-white hover:bg-cad-accent/80 disabled:opacity-50 flex items-center gap-1"
                onClick={handleSync}
                disabled={connectionStatus !== 'success' || !form.erpnext.linkedProjectId || syncStatus === 'syncing'}
              >
                <RefreshCw size={11} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                Sync
              </button>
              {statusMessage && (
                <span className={`text-xs ${connectionStatus === 'error' || syncStatus === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                  {statusMessage}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Project Fields */}
        <div className={sectionClass}>General</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div>
            <label className={labelClass}>Project Name</label>
            <input
              type="text"
              className={inputClass}
              value={form.projectName}
              onChange={e => updateField('projectName', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Project Number</label>
            <input
              type="text"
              className={inputClass}
              value={form.projectNumber}
              onChange={e => updateField('projectNumber', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Client</label>
            <input
              type="text"
              className={inputClass}
              value={form.client}
              onChange={e => updateField('client', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <input
              type="text"
              className={inputClass}
              value={form.status}
              onChange={e => updateField('status', e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Address</label>
            <input
              type="text"
              className={inputClass}
              value={form.address}
              onChange={e => updateField('address', e.target.value)}
            />
          </div>
        </div>

        <div className={sectionClass}>Team</div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-2">
          <div>
            <label className={labelClass}>Author</label>
            <input
              type="text"
              className={inputClass}
              value={form.author}
              onChange={e => updateField('author', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Architect</label>
            <input
              type="text"
              className={inputClass}
              value={form.architect}
              onChange={e => updateField('architect', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Contractor</label>
            <input
              type="text"
              className={inputClass}
              value={form.contractor}
              onChange={e => updateField('contractor', e.target.value)}
            />
          </div>
        </div>

        <div className={sectionClass}>Details</div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-2">
          <div>
            <label className={labelClass}>Phase</label>
            <input
              type="text"
              className={inputClass}
              value={form.phase}
              onChange={e => updateField('phase', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Discipline</label>
            <input
              type="text"
              className={inputClass}
              value={form.discipline}
              onChange={e => updateField('discipline', e.target.value)}
            />
          </div>
          <div />
          <div>
            <label className={labelClass}>Start Date</label>
            <input
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={e => updateField('startDate', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>End Date</label>
            <input
              type="date"
              className={inputClass}
              value={form.endDate}
              onChange={e => updateField('endDate', e.target.value)}
            />
          </div>
        </div>

        <div className="mt-2">
          <label className={labelClass}>Description</label>
          <textarea
            className={`${inputClass} resize-none`}
            rows={3}
            value={form.description}
            onChange={e => updateField('description', e.target.value)}
          />
        </div>

        {/* Custom Fields */}
        <div className={sectionClass}>Custom Fields</div>
        {Object.entries(form.customFields).length > 0 && (
          <div className="space-y-1 mb-2">
            {Object.entries(form.customFields).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs text-cad-text-dim w-28 truncate" title={key}>{key}</span>
                <input
                  type="text"
                  className={`${inputClass} flex-1`}
                  value={value}
                  onChange={e => {
                    setForm(prev => ({
                      ...prev,
                      customFields: { ...prev.customFields, [key]: e.target.value },
                    }));
                    setSaved(false);
                  }}
                />
                <button
                  className="p-0.5 hover:bg-cad-hover rounded text-cad-text-dim hover:text-red-400 cursor-default"
                  onClick={() => handleRemoveCustomField(key)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            className={`${inputClass} w-28`}
            placeholder="Key"
            value={customFieldKey}
            onChange={e => setCustomFieldKey(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddCustomField(); }}
          />
          <input
            type="text"
            className={`${inputClass} flex-1`}
            placeholder="Value"
            value={customFieldValue}
            onChange={e => setCustomFieldValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddCustomField(); }}
          />
          <button
            className="p-0.5 hover:bg-cad-hover rounded text-cad-text-dim hover:text-cad-accent cursor-default"
            onClick={handleAddCustomField}
            disabled={!customFieldKey.trim()}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Save button */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          className="px-4 py-1.5 text-xs bg-cad-accent text-white hover:bg-cad-accent/80"
        >
          Save
        </button>
        {saved && (
          <span className="text-xs text-green-400 flex items-center gap-1">
            <Check size={12} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
