import React, { useState } from 'react';
import {
  CheckCircle2,
  Database as DbIcon,
  Download,
  FileSpreadsheet,
  FolderKanban,
  HardDrive,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  Trash2,
} from 'lucide-react';
import {
  AnalysisRun,
  Finding,
  Project,
  ReportRecord,
  SystemStatus,
} from '../types.ts';
import { downloadProjectCsvReport, downloadProjectPdfReport } from '../utils/reportExport.ts';

/* ============================================================================
 * 1. PROJECTS LIST VIEW
 * ========================================================================== */
interface ProjectsListViewProps {
  projects: Project[];
  onOpenProject: (projectId: string, tab?: 'overview' | 'files' | 'results' | 'reports') => void;
  onCreateNew: () => void;
  onDeleteProject: (projectId: string) => Promise<void>;
}

export const ProjectsListView: React.FC<ProjectsListViewProps> = ({
  projects,
  onOpenProject,
  onCreateNew,
  onDeleteProject,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = projects.filter((p) => {
    if (typeFilter !== 'All' && p.projectType !== typeFilter) return false;
    if (statusFilter !== 'All' && p.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !p.name.toLowerCase().includes(q) &&
        !p.referenceId.toLowerCase().includes(q) &&
        !p.clientName.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Projects Directory</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage kitchen and wardrobe design dossiers stored in your local SQLite database.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          New Project & Analysis
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by project name, reference ID, or client..."
            className="w-full rounded-lg border border-slate-300 py-1.5 pr-3 pl-8 text-xs text-slate-900 focus:border-blue-600 focus:outline-hidden"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
        >
          <option value="All">All Project Categories</option>
          <option value="Kitchen">Kitchen</option>
          <option value="Kitchen + Wardrobe">Kitchen + Wardrobe</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
        >
          <option value="All">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Files Uploaded">Files Uploaded</option>
          <option value="Processing">Processing</option>
          <option value="Analysis Complete">Analysis Complete</option>
          <option value="Awaiting Review">Awaiting Review</option>
          <option value="Approved">Approved</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No matching projects found.
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-6 py-3 font-semibold">Project Name & Reference</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Last Analysis</th>
                <th className="px-4 py-3 text-right font-semibold">Files</th>
                <th className="px-4 py-3 text-right font-semibold">Findings</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => onOpenProject(p.id, p.findingCount > 0 ? 'results' : 'overview')}
                      className="font-semibold text-slate-900 hover:text-blue-600 text-left"
                    >
                      {p.name}
                    </button>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                      {p.referenceId} {p.clientName ? `· ${p.clientName}` : ''}{' '}
                      {p.isDemoProject ? '· [Demo Sample]' : ''}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-700 whitespace-nowrap">{p.projectType}</td>
                  <td className="px-4 py-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                    {p.lastAnalysisAt ? new Date(p.lastAnalysisAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-4 text-right font-mono tabular-nums">{p.fileCount}</td>
                  <td className="px-4 py-4 text-right font-mono tabular-nums">
                    <span className={p.criticalHighCount > 0 ? 'font-semibold text-red-600' : 'text-slate-800'}>
                      {p.findingCount}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-800 whitespace-nowrap">{p.status}</td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    {deletingId === p.id ? (
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteProject(p.id);
                            setDeletingId(null);
                          }}
                          className="rounded bg-red-600 px-2.5 py-1 font-semibold text-white"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="text-slate-500"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onOpenProject(p.id, 'results')}
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          Open
                        </button>
                        <a
                          href={`/api/projects/${p.id}/export`}
                          className="text-slate-600 hover:text-slate-900"
                        >
                          JSON
                        </a>
                        <button
                          type="button"
                          onClick={() => setDeletingId(p.id)}
                          className="text-slate-400 hover:text-red-600"
                          title="Delete project"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. ANALYSIS HISTORY VIEW
 * ========================================================================== */
interface AnalysisHistoryViewProps {
  runs: AnalysisRun[];
  onOpenProjectResults: (projectId: string) => void;
}

export const AnalysisHistoryView: React.FC<AnalysisHistoryViewProps> = ({
  runs,
  onOpenProjectResults,
}) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analysis Run History</h1>
        <p className="mt-1 text-sm text-slate-600">
          Complete audit trail of technical dossier analysis jobs executed on this machine.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {runs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">No analysis runs recorded yet.</div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-6 py-3 font-semibold">Run Timestamp</th>
                <th className="px-4 py-3 font-semibold">Project</th>
                <th className="px-4 py-3 font-semibold">Execution Mode</th>
                <th className="px-4 py-3 font-semibold">Verdict</th>
                <th className="px-4 py-3 text-right font-semibold">Findings (Crit/High)</th>
                <th className="px-6 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                    {new Date(r.startedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-900">
                    {r.projectName || r.projectId}
                  </td>
                  <td className="px-4 py-4">
                    <span className={r.isDemoMode ? 'font-medium text-amber-700' : 'font-medium text-purple-700'}>
                      {r.mode}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-800">{r.overallVerdict}</td>
                  <td className="px-4 py-4 text-right font-mono tabular-nums">
                    {r.findingsCount} ({r.criticalCount + r.highCount} Crit/High)
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenProjectResults(r.projectId)}
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      Inspect Findings
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. REPORTS VIEW
 * ========================================================================== */
interface ReportsListViewProps {
  reports: ReportRecord[];
  projects: Project[];
  onDownloadReportForProject: (projectId: string, format: 'pdf' | 'csv') => Promise<void>;
}

export const ReportsListView: React.FC<ReportsListViewProps> = ({
  reports,
  onDownloadReportForProject,
}) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Technical Review Reports</h1>
        <p className="mt-1 text-sm text-slate-600">
          Download structured client-ready PDF, Excel (.XLSX), and CSV technical review reports.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {reports.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No reports generated yet. Run an analysis on a project to generate a technical review report.
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-6 py-3 font-semibold">Project Name</th>
                <th className="px-4 py-3 font-semibold">Report Date</th>
                <th className="px-4 py-3 font-semibold">Project Reference</th>
                <th className="px-4 py-3 text-right font-semibold">Total Findings</th>
                <th className="px-4 py-3 text-right font-semibold">Critical / High Issues</th>
                <th className="px-4 py-3 font-semibold">Reviewer</th>
                <th className="px-6 py-3 text-right font-semibold">Download Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {reports.map((rep) => (
                <tr key={rep.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{rep.projectName}</div>
                    {rep.isDemoReport && (
                      <div className="text-[11px] font-medium text-amber-700">
                        Demo Sample Report (Synthetic Data)
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                    {new Date(rep.reportDate).toLocaleString()}
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-800 whitespace-nowrap">
                    {rep.projectReference}
                  </td>
                  <td className="px-4 py-4 text-right font-mono tabular-nums">{rep.totalFindings}</td>
                  <td className="px-4 py-4 text-right font-mono font-semibold text-red-600 tabular-nums">
                    {rep.criticalHighIssues}
                  </td>
                  <td className="px-4 py-4 text-slate-700 whitespace-nowrap">{rep.reviewer}</td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onDownloadReportForProject(rep.projectId, 'pdf')}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 font-semibold text-blue-600 hover:bg-slate-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF Report
                      </button>
                      <a
                        href={`/api/projects/${rep.projectId}/reports/xlsx`}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 font-semibold text-emerald-700 hover:bg-slate-50"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Excel (.XLSX)
                      </a>
                      <button
                        type="button"
                        onClick={() => onDownloadReportForProject(rep.projectId, 'csv')}
                        className="rounded border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
                      >
                        CSV
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. SETTINGS VIEW
 * ========================================================================== */
interface SettingsViewProps {
  systemStatus: SystemStatus | null;
  projects: Project[];
  onClearDemoData: () => Promise<void>;
  onReloadDemoData: () => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  systemStatus,
  projects,
  onClearDemoData,
  onReloadDemoData,
  onDeleteProject,
}) => {
  const [checkResult, setCheckResult] = useState<{
    available: boolean;
    mode: string;
    message: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [selectedDeleteProjectId, setSelectedDeleteProjectId] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleCheckService = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/system/check-ai', { method: 'POST' });
      if (res.ok) {
        setCheckResult(await res.json());
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">System & Environment Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Inspect local SQLite storage, AI service connectivity, supported formats, and data retention controls.
        </p>
      </div>

      {actionMessage && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-900">
          {actionMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* AI Provider & Backend Connectivity */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">AI Service & Execution Mode</h2>
            <button
              type="button"
              disabled={checking}
              onClick={handleCheckService}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
              Check Backend & AI Service
            </button>
          </div>

          <dl className="space-y-3 text-xs">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">AI Provider</dt>
              <dd className="font-medium text-slate-900">{systemStatus?.aiProvider || 'Google Gemini API'}</dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Configured Vision/Text Model</dt>
              <dd className="font-mono font-semibold text-purple-700">{systemStatus?.modelName || 'gemini-3.8-flash'}</dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Server Environment API Key Status</dt>
              <dd className="font-semibold">
                {systemStatus?.apiKeyConfigured ? (
                  <span className="text-emerald-700">Configured on Backend (Hidden)</span>
                ) : (
                  <span className="text-amber-700">Not Configured — Demo / Local Rules Mode Active</span>
                )}
              </dd>
            </div>
          </dl>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-900">Server-Side API Key Configuration Instructions</div>
            <p>
              For security, WURFEL never exposes API keys in the browser. Configure <code className="font-mono text-slate-900">GEMINI_API_KEY</code> in your local <code className="font-mono text-slate-900">.env</code> file on the Node.js server and restart the server.
            </p>
          </div>

          {checkResult && (
            <div
              className={`rounded-lg border p-3.5 text-xs ${
                checkResult.available
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <div className="font-semibold">{checkResult.mode}</div>
              <p className="mt-1">{checkResult.message}</p>
            </div>
          )}
        </div>

        {/* Local Storage & Data Retention */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Local Storage & Data Management</h2>
          <dl className="space-y-3 text-xs">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Maximum Upload Size</dt>
              <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                {systemStatus?.maxUploadSizeMb || 25} MB per file
              </dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">SQLite Database Path</dt>
              <dd className="font-mono text-slate-700 truncate max-w-[280px]">{systemStatus?.databasePath}</dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Local Uploads Directory</dt>
              <dd className="font-mono text-slate-700 truncate max-w-[280px]">{systemStatus?.uploadsDir}</dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Data Retention Policy</dt>
              <dd className="text-slate-700">100% Local on-disk retention until explicitly deleted</dd>
            </div>
          </dl>

          <div className="space-y-3 border-t border-slate-200 pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  await onReloadDemoData();
                  setActionMessage('Demo project and synthetic findings reset to initial state.');
                }}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset / Reload Demo Project
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onClearDemoData();
                  setActionMessage('Cleared all synthetic demo data from local database.');
                }}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                Clear Demo Data
              </button>
            </div>

            {/* Delete or Export Selected Project */}
            {projects.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <select
                  value={selectedDeleteProjectId}
                  onChange={(e) => setSelectedDeleteProjectId(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
                >
                  <option value="">Select a project to export or delete...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.referenceId})
                    </option>
                  ))}
                </select>

                {selectedDeleteProjectId && (
                  <>
                    <a
                      href={`/api/projects/${selectedDeleteProjectId}/export`}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-slate-50"
                    >
                      Export Project JSON
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        await onDeleteProject(selectedDeleteProjectId);
                        setSelectedDeleteProjectId('');
                        setActionMessage('Selected project and its uploaded files were deleted.');
                      }}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Delete Selected Project
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Supported File Types Matrix */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Supported File Formats & Local Extraction Capabilities
          </h2>
        </div>
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <th className="px-6 py-3 font-semibold">File Extensions</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Support Level</th>
              <th className="px-6 py-3 font-semibold">Implementation Details & Limitations</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {(systemStatus?.supportedFormats ?? []).map((sf, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-6 py-3 font-mono font-semibold text-slate-900">{sf.extension}</td>
                <td className="px-4 py-3 text-slate-700">{sf.category}</td>
                <td className="px-4 py-3">
                  <span
                    className={`font-semibold ${
                      sf.supportLevel === 'Full Local Extraction'
                        ? 'text-emerald-700'
                        : sf.supportLevel === 'Preview + Metadata'
                        ? 'text-blue-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {sf.supportLevel}
                  </span>
                </td>
                <td className="px-6 py-3 text-slate-600">{sf.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
