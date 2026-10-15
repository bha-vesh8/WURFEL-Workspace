import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileCheck2,
  FolderKanban,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { ActivityLog, Project } from '../types.ts';

interface DashboardData {
  metrics: {
    totalProjects: number;
    projectsAnalysed: number;
    issuesDetected: number;
    awaitingReview: number;
  };
  severityCounts: {
    Critical: number;
    High: number;
    Medium: number;
    Low: number;
    Informational: number;
  };
  issuesByCategory: Array<{ category: string; count: number }>;
  recentProjects: Project[];
  recentActivity: ActivityLog[];
}

interface DashboardViewProps {
  data: DashboardData | null;
  loading: boolean;
  onNavigateNewAnalysis: () => void;
  onNavigateAllProjects: () => void;
  onOpenProject: (projectId: string, tab?: 'overview' | 'files' | 'results' | 'reports') => void;
  onLoadDemoProject: () => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  loading,
  onNavigateNewAnalysis,
  onNavigateAllProjects,
  onOpenProject,
  onLoadDemoProject,
}) => {
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-16 animate-pulse rounded-xl bg-slate-200/70" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 animate-pulse rounded-xl bg-slate-200/70" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl bg-slate-200/70" />
      </div>
    );
  }

  const maxCatCount = Math.max(1, ...data.issuesByCategory.map((c) => c.count));

  return (
    <div className="space-y-8">
      {/* Page Heading & Primary Actions */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Technical Review Overview</h1>
          <p className="mt-1 text-sm text-slate-600">
            Review kitchen and wardrobe dossiers before production.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onLoadDemoProject}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            Load Demo Project
          </button>

          <button
            type="button"
            onClick={onNavigateNewAnalysis}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Analysis
          </button>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Projects</span>
            <FolderKanban className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-3 font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {data.metrics.totalProjects}
          </div>
          <div className="mt-1 text-xs text-slate-500">Active kitchen & wardrobe dossiers</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Projects Analysed</span>
            <FileCheck2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-3 font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {data.metrics.projectsAnalysed}
          </div>
          <div className="mt-1 text-xs text-slate-500">Completed extraction & technical checks</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Issues Detected</span>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </div>
          <div className="mt-3 font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {data.metrics.issuesDetected}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            <span className="font-medium text-red-600 tabular-nums">{data.severityCounts.Critical} Critical</span>
            <span aria-hidden="true"> · </span>
            <span className="font-medium text-amber-700 tabular-nums">{data.severityCounts.High} High</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Projects Awaiting Review</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-3 font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {data.metrics.awaitingReview}
          </div>
          <div className="mt-1 text-xs text-slate-500">Pending human reviewer sign-off</div>
        </div>
      </div>

      {/* Recent Projects Table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Projects</h2>
            <p className="text-xs text-slate-500">
              Select a project to inspect uploaded documents, review findings, or download reports.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateAllProjects}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap"
          >
            View All Projects
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {data.recentProjects.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-800">No technical dossiers found in local storage.</p>
            <p className="mt-1 text-xs text-slate-500">
              Create a new project or load the synthetic sample kitchen & wardrobe demo project to explore the workflow.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={onLoadDemoProject}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Load Demo Project
              </button>
              <button
                type="button"
                onClick={onNavigateNewAnalysis}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Create First Project
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                  <th className="px-6 py-3 font-semibold">Project Name</th>
                  <th className="px-4 py-3 font-semibold">Project Type</th>
                  <th className="px-4 py-3 text-right font-semibold">Files</th>
                  <th className="px-4 py-3 font-semibold">Last Analysis</th>
                  <th className="px-4 py-3 text-right font-semibold">Issues</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.recentProjects.map((proj) => (
                  <tr key={proj.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5">
                      <button
                        type="button"
                        onClick={() => onOpenProject(proj.id, proj.findingCount > 0 ? 'results' : 'overview')}
                        className="text-left font-semibold text-slate-900 hover:text-blue-600"
                      >
                        {proj.name}
                      </button>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-mono">{proj.referenceId}</span>
                        {proj.clientName && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{proj.clientName}</span>
                          </>
                        )}
                        {proj.isDemoProject && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-amber-700">Demo Sample Data</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">{proj.projectType}</td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-700">{proj.fileCount}</td>
                    <td className="px-4 py-3.5 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {proj.lastAnalysisAt ? new Date(proj.lastAnalysisAt).toLocaleDateString() : 'Not run'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                      {proj.findingCount > 0 ? (
                        <span className={proj.criticalHighCount > 0 ? 'font-semibold text-red-600' : 'text-slate-800'}>
                          {proj.findingCount} ({proj.criticalHighCount} Crit/High)
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          proj.status === 'Approved'
                            ? 'text-emerald-700'
                            : proj.status === 'Awaiting Review'
                            ? 'text-amber-700'
                            : proj.status === 'Analysis Complete'
                            ? 'text-blue-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {proj.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onOpenProject(proj.id, 'results')}
                          className="font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Review Findings
                        </button>
                        <span aria-hidden="true" className="text-slate-300">
                          |
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenProject(proj.id, 'files')}
                          className="text-slate-600 hover:text-slate-900"
                        >
                          Files
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Split: Issues by Category Chart + Severity Summary & Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Issues by Category Bar Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Issues by Checking Category</h2>
              <p className="text-xs text-slate-500">Distribution of detected technical discrepancies across dossiers</p>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              Total: {data.metrics.issuesDetected}
            </span>
          </div>

          {data.issuesByCategory.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">No findings recorded yet.</p>
          ) : (
            <div className="space-y-3.5">
              {data.issuesByCategory.map((item) => {
                const widthPct = Math.max(6, Math.round((item.count / maxCatCount) * 100));
                return (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.category}</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">{item.count}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Severity Breakdown & Recent Activity */}
        <div className="space-y-6 lg:col-span-5">
          {/* Issue Severity Summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Issue Severity Summary</h2>
            <p className="mt-0.5 text-xs text-slate-500">Current open & reviewed findings by risk level</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-medium text-red-600">Critical</div>
                <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                  {data.severityCounts.Critical}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-medium text-amber-700">High</div>
                <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                  {data.severityCounts.High}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-medium text-blue-700">Medium</div>
                <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                  {data.severityCounts.Medium}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-medium text-slate-600">Low / Info</div>
                <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                  {data.severityCounts.Low + data.severityCounts.Informational}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Analysis Activity */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Recent Review Activity</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {data.recentActivity.slice(0, 5).map((act) => (
                <div key={act.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{act.action}</span>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">{act.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
