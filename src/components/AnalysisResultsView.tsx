import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  MessageSquare,
  Play,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ALL_CHECK_CATEGORIES,
  ActivityLog,
  AnalysisRun,
  Finding,
  FindingConfidence,
  FindingReviewStatus,
  FindingSeverity,
  FindingType,
  Project,
  ProjectFile,
  ReportRecord,
} from '../types.ts';
import { downloadProjectCsvReport, downloadProjectPdfReport } from '../utils/reportExport.ts';
import { DocumentViewerModal } from './DocumentViewerModal.tsx';

interface AnalysisResultsViewProps {
  project: Project;
  files: ProjectFile[];
  runs: AnalysisRun[];
  findings: Finding[];
  reports: ReportRecord[];
  activities: ActivityLog[];
  activeTab: 'overview' | 'files' | 'results' | 'reports' | 'activity';
  onTabChange: (tab: 'overview' | 'files' | 'results' | 'reports' | 'activity') => void;
  onRefreshProject: () => Promise<void>;
  onStartNewAnalysis: () => void;
  onDeleteProject: (projectId: string) => Promise<void>;
}

export const AnalysisResultsView: React.FC<AnalysisResultsViewProps> = ({
  project,
  files,
  runs,
  findings,
  reports,
  activities,
  activeTab,
  onTabChange,
  onRefreshProject,
  onStartNewAnalysis,
  onDeleteProject,
}) => {
  const latestRun = runs[0];

  // Filters for Findings Table
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Selected Finding for Details & Side-by-Side Source Evidence
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    findings[0]?.id || null
  );
  const [commentInput, setCommentInput] = useState('');
  const [savingFinding, setSavingFinding] = useState(false);

  // Document viewer modal state
  const [viewerFile, setViewerFile] = useState<ProjectFile | null>(null);
  const [viewerPage, setViewerPage] = useState<number>(1);

  // Project rename / approve state
  const [editingName, setEditingName] = useState(false);
  const [newNameInput, setNewNameInput] = useState(project.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedFinding = useMemo(
    () => findings.find((f) => f.id === selectedFindingId) || findings[0] || null,
    [findings, selectedFindingId]
  );

  React.useEffect(() => {
    if (selectedFinding) {
      setCommentInput(selectedFinding.reviewerComment || '');
    }
  }, [selectedFinding?.id]);

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (severityFilter !== 'All' && f.severity !== severityFilter) return false;
      if (categoryFilter !== 'All' && f.category !== categoryFilter) return false;
      if (typeFilter !== 'All' && f.findingType !== typeFilter) return false;
      if (confidenceFilter !== 'All' && f.confidence !== confidenceFilter) return false;
      if (statusFilter !== 'All' && f.status !== statusFilter) return false;
      if (
        sourceFilter !== 'All' &&
        !f.sourceFiles.some((s) => s.filename === sourceFilter)
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${f.title} ${f.description} ${f.evidence} ${f.category} ${f.expectedValue || ''} ${f.observedValue || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    findings,
    severityFilter,
    categoryFilter,
    typeFilter,
    sourceFilter,
    confidenceFilter,
    statusFilter,
    searchQuery,
  ]);

  const counts = useMemo(() => {
    return {
      total: findings.length,
      critical: findings.filter((f) => f.severity === 'Critical').length,
      high: findings.filter((f) => f.severity === 'High').length,
      medium: findings.filter((f) => f.severity === 'Medium').length,
      low: findings.filter((f) => f.severity === 'Low' || f.severity === 'Informational').length,
      needsReview: findings.filter((f) => f.humanReviewRequired || f.status === 'Open').length,
    };
  }, [findings]);

  const linkedSourcePreview = useMemo(() => {
    if (!selectedFinding || selectedFinding.sourceFiles.length === 0) return null;
    const primaryRef = selectedFinding.sourceFiles[0];
    const matchedFile =
      files.find((fl) => fl.id === primaryRef.fileId) ||
      files.find((fl) => fl.originalName === primaryRef.filename);
    if (!matchedFile) return null;

    const pageNumMatch = primaryRef.pageOrSheet.match(/Page\s*(\d+)|Sheet\s*(\d+)/i);
    const pageNum = pageNumMatch ? parseInt(pageNumMatch[1] || pageNumMatch[2], 10) : 1;
    const matchedPage =
      matchedFile.pages.find((p) => p.pageNumber === pageNum) || matchedFile.pages[0];

    return {
      file: matchedFile,
      page: matchedPage,
      pageNumber: matchedPage?.pageNumber || 1,
      refLabel: primaryRef.pageOrSheet,
      isApproximate: Boolean(primaryRef.isApproximate),
    };
  }, [selectedFinding, files]);

  const handleUpdateFindingStatus = async (status: FindingReviewStatus) => {
    if (!selectedFinding || savingFinding) return;
    setSavingFinding(true);
    try {
      const res = await fetch(`/api/findings/${selectedFinding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          reviewerComment: commentInput.trim(),
          reviewedBy: project.reviewerName || 'Elena Rostova',
        }),
      });
      if (res.ok) {
        await onRefreshProject();
      }
    } finally {
      setSavingFinding(false);
    }
  };

  const handleRenameProject = async () => {
    if (!newNameInput.trim()) return;
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newNameInput.trim() }),
    });
    setEditingName(false);
    await onRefreshProject();
  };

  const handleGenerateReportRecord = async () => {
    await fetch(`/api/projects/${project.id}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer: project.reviewerName || 'Elena Rostova' }),
    });
    downloadProjectPdfReport(project, latestRun, findings);
    await onRefreshProject();
  };

  const handleUploadMoreFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const formData = new FormData();
    Array.from(fileList).forEach((f) => formData.append('files', f));
    await fetch(`/api/projects/${project.id}/files`, {
      method: 'POST',
      body: formData,
    });
    await onRefreshProject();
  };

  const isDemo = Boolean(
    project.isDemoProject || latestRun?.isDemoMode || findings.some((f) => f.isDemoFinding)
  );

  return (
    <div className="space-y-6">
      {/* Top Project Header & Tab Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-800">{project.referenceId}</span>
              <span aria-hidden="true">·</span>
              <span>{project.projectType}</span>
              {project.clientName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Client: {project.clientName}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-blue-700">Status: {project.status}</span>
              {isDemo && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-amber-700">
                    Demo Sample Mode (Synthetic Evidence)
                  </span>
                </>
              )}
            </div>

            {editingName ? (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newNameInput}
                  onChange={(e) => setNewNameInput(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-base font-bold text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleRenameProject}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="text-xs text-slate-500"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
                <button
                  type="button"
                  onClick={() => {
                    setNewNameInput(project.name);
                    setEditingName(true);
                  }}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title="Rename project"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleGenerateReportRecord}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              Download PDF Report
            </button>

            <a
              href={`/api/projects/${project.id}/reports/xlsx`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Export Excel (.XLSX)
            </a>

            <button
              type="button"
              onClick={onStartNewAnalysis}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5" />
              Run New Analysis
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(
              [
                { id: 'results', label: `Analysis Results (${findings.length})` },
                { id: 'files', label: `Files & Viewer (${files.length})` },
                { id: 'overview', label: 'Project Overview' },
                { id: 'reports', label: `Reports (${reports.length})` },
                { id: 'activity', label: `Activity (${activities.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === t.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {confirmDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-red-700">Delete project permanently?</span>
              <button
                type="button"
                onClick={() => onDeleteProject(project.id)}
                className="rounded bg-red-600 px-2.5 py-1 font-semibold text-white hover:bg-red-700"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded border border-slate-200 px-2.5 py-1 text-slate-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Project
            </button>
          )}
        </div>
      </div>

      {/* TAB: ANALYSIS RESULTS */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          {/* Verdict Banner & Summary Explanation */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-500">Overall Dossier Verdict:</span>
                  <span
                    className={`font-bold ${
                      latestRun?.overallVerdict === 'Needs Attention'
                        ? 'text-red-600'
                        : latestRun?.overallVerdict === 'Review Required'
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {latestRun?.overallVerdict || 'Review Required'}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="font-medium text-purple-700">
                    {latestRun?.mode || 'Technical Rules + Demo Sample'}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-700">
                  {latestRun?.summaryText ||
                    'Technical review complete. Inspect each discrepancy and verify source drawings before approving for production.'}
                </p>
              </div>
              <div className="shrink-0 text-right text-[11px] text-slate-500">
                Note: WURFEL never sets "Production Approved" automatically. Human reviewer sign-off is required.
              </div>
            </div>

            {/* 6 Summary Metric Boxes */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">Total Findings</div>
                <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {counts.total}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-medium text-red-600">Critical Issues</div>
                <div className="mt-1 font-mono text-2xl font-bold text-red-600 tabular-nums">
                  {counts.critical}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-medium text-amber-700">High Priority</div>
                <div className="mt-1 font-mono text-2xl font-bold text-amber-700 tabular-nums">
                  {counts.high}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-medium text-blue-700">Medium Priority</div>
                <div className="mt-1 font-mono text-2xl font-bold text-blue-700 tabular-nums">
                  {counts.medium}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-600">Low / Info</div>
                <div className="mt-1 font-mono text-2xl font-bold text-slate-700 tabular-nums">
                  {counts.low}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-medium text-purple-700">Requires Review</div>
                <div className="mt-1 font-mono text-2xl font-bold text-purple-700 tabular-nums">
                  {counts.needsReview}
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search findings, codes, RAL, dimensions..."
                  className="w-full rounded-lg border border-slate-300 py-1.5 pr-3 pl-8 text-xs text-slate-900 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
              >
                <option value="All">All Severities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
                <option value="Informational">Informational</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
              >
                <option value="All">All Categories</option>
                {ALL_CHECK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
              >
                <option value="All">All Finding Types</option>
                <option value="Confirmed Discrepancy">Confirmed Discrepancy</option>
                <option value="Potential Issue">Potential Issue</option>
                <option value="Missing Information">Missing Information</option>
                <option value="Suggestion">Suggestion</option>
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
              >
                <option value="All">All Source Documents</option>
                {files.map((f) => (
                  <option key={f.id} value={f.originalName}>
                    {f.originalName}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
              >
                <option value="All">All Review Statuses</option>
                <option value="Open">Open</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
          </div>

          {/* Main Workspace Split: Left Findings Table + Right Detail Inspector */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            {/* Findings Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-7">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                <h2 className="text-sm font-semibold text-slate-900">
                  Detected Technical Findings ({filteredFindings.length})
                </h2>
                <button
                  type="button"
                  onClick={() => downloadProjectCsvReport(project, filteredFindings)}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  Download Filtered CSV
                </button>
              </div>

              {filteredFindings.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  No findings match the current filter criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <th className="px-4 py-2.5 font-semibold">Severity</th>
                        <th className="px-4 py-2.5 font-semibold">Finding & Category</th>
                        <th className="px-3 py-2.5 font-semibold">Source</th>
                        <th className="px-3 py-2.5 font-semibold">Conf.</th>
                        <th className="px-3 py-2.5 font-semibold">Review Status</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredFindings.map((f) => {
                        const isSelected = selectedFinding?.id === f.id;
                        return (
                          <tr
                            key={f.id}
                            onClick={() => setSelectedFindingId(f.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <span
                                className={`font-semibold ${
                                  f.severity === 'Critical'
                                    ? 'text-red-600'
                                    : f.severity === 'High'
                                    ? 'text-amber-700'
                                    : f.severity === 'Medium'
                                    ? 'text-blue-700'
                                    : 'text-slate-600'
                                }`}
                              >
                                {f.severity}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="font-semibold text-slate-900">{f.title}</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                                <span>{f.category}</span>
                                <span aria-hidden="true">·</span>
                                <span>{f.findingType}</span>
                                {f.isDemoFinding && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-medium text-amber-700">Demo Sample</span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 align-top text-[11px] text-slate-600">
                              <div className="max-w-[140px] truncate font-medium text-slate-800">
                                {f.sourceFiles[0]?.filename || 'Dossier'}
                              </div>
                              <div className="font-mono text-slate-500">
                                {f.sourceFiles[0]?.pageOrSheet}
                              </div>
                            </td>
                            <td className="px-3 py-3 align-top text-slate-600 whitespace-nowrap">
                              {f.confidence}
                            </td>
                            <td className="px-3 py-3 align-top whitespace-nowrap">
                              <span
                                className={`font-semibold ${
                                  f.status === 'Accepted' || f.status === 'Resolved'
                                    ? 'text-emerald-700'
                                    : f.status === 'Rejected'
                                    ? 'text-slate-400 line-through'
                                    : 'text-amber-700'
                                }`}
                              >
                                {f.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedFindingId(f.id);
                                }}
                                className="font-semibold text-blue-600 hover:text-blue-800"
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right Detail & Side-by-Side Source Evidence Panel */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 space-y-5">
              {!selectedFinding ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Select a finding from the table to inspect source evidence, expected vs observed values, and record review decisions.
                </div>
              ) : (
                <>
                  <div className="border-b border-slate-200 pb-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`font-bold ${
                          selectedFinding.severity === 'Critical'
                            ? 'text-red-600'
                            : selectedFinding.severity === 'High'
                            ? 'text-amber-700'
                            : 'text-blue-700'
                        }`}
                      >
                        {selectedFinding.severity} Severity
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-slate-600">{selectedFinding.findingType}</span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-purple-700 font-medium">
                        {selectedFinding.isDemoFinding
                          ? 'Synthetic Demo Sample'
                          : selectedFinding.analysisSource}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-base font-bold text-slate-900">
                      {selectedFinding.title}
                    </h3>
                    <div className="mt-1 text-xs text-slate-500">
                      Category: {selectedFinding.category} · Confidence: {selectedFinding.confidence}
                      {selectedFinding.humanReviewRequired ? ' · Human Review Mandatory' : ''}
                    </div>
                  </div>

                  {/* Explanation */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900">Technical Explanation</h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">
                      {selectedFinding.description}
                    </p>
                  </div>

                  {/* Expected vs Observed Values */}
                  {(selectedFinding.expectedValue || selectedFinding.observedValue) && (
                    <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-2">
                      <div>
                        <div className="text-[11px] font-medium text-slate-500">Expected Value</div>
                        <div className="mt-0.5 font-mono text-xs font-semibold text-emerald-800 tabular-nums">
                          {selectedFinding.expectedValue || 'Not specified'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-slate-500">Observed Value</div>
                        <div className="mt-0.5 font-mono text-xs font-semibold text-red-700 tabular-nums">
                          {selectedFinding.observedValue || 'Not specified'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Source Evidence & Side-by-Side Embedded Preview */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-slate-900">
                        Source Document Evidence
                      </h4>
                      {linkedSourcePreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setViewerFile(linkedSourcePreview.file);
                            setViewerPage(linkedSourcePreview.pageNumber);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open Full Document Viewer ({linkedSourcePreview.refLabel})
                        </button>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 font-mono text-xs text-slate-800">
                      {selectedFinding.evidence}
                    </div>

                    {/* Source files list */}
                    <div className="space-y-1">
                      {selectedFinding.sourceFiles.map((sf, idx) => {
                        const fileObj =
                          files.find((fl) => fl.id === sf.fileId) ||
                          files.find((fl) => fl.originalName === sf.filename);
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-1.5 text-xs"
                          >
                            <div className="truncate">
                              <span className="font-medium text-slate-800">{sf.filename}</span>
                              <span className="ml-2 font-mono text-slate-500">
                                ({sf.pageOrSheet}
                                {sf.isApproximate ? ' — Approximate Ref' : ''})
                              </span>
                            </div>
                            {fileObj && (
                              <button
                                type="button"
                                onClick={() => {
                                  const pMatch = sf.pageOrSheet.match(/(\d+)/);
                                  setViewerFile(fileObj);
                                  setViewerPage(pMatch ? parseInt(pMatch[1], 10) : 1);
                                }}
                                className="ml-2 shrink-0 font-semibold text-blue-600 hover:underline"
                              >
                                View Page
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Side-by-Side Embedded Visual / Table Snippet */}
                    {linkedSourcePreview?.page?.svgDrawingData && (
                      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2">
                        <div className="mb-1 text-[11px] font-medium text-slate-500">
                          Referenced Elevation Drawing ({linkedSourcePreview.page.label})
                        </div>
                        <div
                          className="max-h-52 overflow-hidden"
                          dangerouslySetInnerHTML={{
                            __html: linkedSourcePreview.page.svgDrawingData,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Suggested Correction */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3.5">
                    <div className="text-xs font-semibold text-slate-900">
                      Suggested Technical Correction
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-800">
                      {selectedFinding.suggestedCorrection}
                    </p>
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      Reason: {selectedFinding.reasonForSuggestion}
                    </p>
                  </div>

                  {/* Reviewer Actions & Persistent Comment */}
                  <div className="border-t border-slate-200 pt-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">
                        Reviewer Decision (Current: {selectedFinding.status})
                      </span>
                      {selectedFinding.reviewedAt && (
                        <span className="text-[11px] text-slate-400">
                          Updated by {selectedFinding.reviewedBy}
                        </span>
                      )}
                    </div>

                    <textarea
                      rows={2}
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Add technical reviewer comment, supplier confirmation, or workshop instruction..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-hidden"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={savingFinding}
                        onClick={() => handleUpdateFindingStatus('Accepted')}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Accept Finding
                      </button>
                      <button
                        type="button"
                        disabled={savingFinding}
                        onClick={() => handleUpdateFindingStatus('Resolved')}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Mark Resolved
                      </button>
                      <button
                        type="button"
                        disabled={savingFinding}
                        onClick={() => handleUpdateFindingStatus('Rejected')}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Reject (False Positive)
                      </button>
                      <button
                        type="button"
                        disabled={savingFinding}
                        onClick={() => handleUpdateFindingStatus(selectedFinding.status)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Save Comment
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Category Outcomes Matrix */}
          {latestRun && latestRun.categoryOutcomes.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-900">
                Checking Category Outcomes (Honest Evidence Verification)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Categories lacking required source documents are marked "Insufficient Evidence" rather than falsely claiming "Passed".
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {latestRun.categoryOutcomes.map((co) => (
                  <div key={co.category} className="rounded-lg border border-slate-200 p-3.5 text-xs">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-slate-900">{co.category}</span>
                      <span
                        className={
                          co.status === 'Passed'
                            ? 'text-emerald-700'
                            : co.status === 'Issue Found'
                            ? 'text-red-600'
                            : co.status === 'Insufficient Evidence'
                            ? 'text-amber-700'
                            : 'text-slate-500'
                        }
                      >
                        {co.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{co.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: FILES & DOCUMENT VIEWER */}
      {activeTab === 'files' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Uploaded Project Documents ({files.length})
              </h2>
              <p className="text-xs text-slate-500">
                Click any file to open the Document Viewer, inspect extracted pages/tables, or view OCR confidence.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
              <Upload className="h-3.5 w-3.5" />
              Upload Additional Files
              <input
                type="file"
                multiple
                onChange={(e) => handleUploadMoreFiles(e.target.files)}
                className="hidden"
              />
            </label>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-3 font-semibold">Document Name</th>
                  <th className="px-4 py-3 font-semibold">Assigned Role</th>
                  <th className="px-4 py-3 font-semibold">Extraction Method</th>
                  <th className="px-4 py-3 font-semibold">Pages / Sheets</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {files.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900">{f.originalName}</div>
                      <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {f.extension.toUpperCase()} · {(f.fileSize / 1024).toFixed(1)} KB
                        {f.ocrConfidence !== undefined ? ` · OCR ${f.ocrConfidence}%` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-800">{f.role}</td>
                    <td className="px-4 py-3.5 text-slate-600">{f.extractionMethod}</td>
                    <td className="px-4 py-3.5 font-mono tabular-nums text-slate-700">
                      {f.pages.length}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`font-semibold ${
                          f.extractionStatus === 'Extracted'
                            ? 'text-emerald-700'
                            : f.extractionStatus === 'Unsupported'
                            ? 'text-red-600'
                            : 'text-amber-700'
                        }`}
                      >
                        {f.extractionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setViewerFile(f);
                          setViewerPage(1);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-blue-600 hover:bg-slate-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Open Document Viewer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: PROJECT OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Project Specification & Metadata</h2>
            <p className="text-xs leading-relaxed text-slate-700">
              {project.description || 'No project description provided.'}
            </p>
            <dl className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Project Reference</dt>
                <dd className="mt-0.5 font-mono font-semibold text-slate-900">{project.referenceId}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Category</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{project.projectType}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Client Name</dt>
                <dd className="mt-0.5 text-slate-900">{project.clientName || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Site / Location</dt>
                <dd className="mt-0.5 text-slate-900">{project.siteLocation || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Assigned Technical Reviewer</dt>
                <dd className="mt-0.5 text-slate-900">{project.reviewerName || 'Elena Rostova'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Current Workflow Status</dt>
                <dd className="mt-0.5 font-semibold text-blue-700">{project.status}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Prior Analysis Runs ({runs.length})</h2>
            <div className="divide-y divide-slate-200 text-xs">
              {runs.map((r) => (
                <div key={r.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between font-semibold text-slate-900">
                    <span>{r.mode}</span>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {new Date(r.startedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 text-slate-600">
                    Verdict: <span className="font-semibold">{r.overallVerdict}</span> · {r.findingsCount} Findings
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: REPORTS */}
      {activeTab === 'reports' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Generated Project Reports</h2>
              <p className="text-xs text-slate-500">
                Download formatted PDF or Excel/CSV technical review reports for this project.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateReportRecord}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Download className="h-3.5 w-3.5" />
              Generate & Download PDF Report
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-3 font-semibold">Report Date</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Total Findings</th>
                  <th className="px-4 py-3 font-semibold">Critical / High</th>
                  <th className="px-4 py-3 font-semibold">Reviewer</th>
                  <th className="px-4 py-3 text-right font-semibold">Download Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-700 tabular-nums">
                      {new Date(rep.reportDate).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-800">{rep.projectReference}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{rep.totalFindings}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-red-600 tabular-nums">
                      {rep.criticalHighIssues}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{rep.reviewer}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => downloadProjectPdfReport(project, latestRun, findings)}
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          PDF
                        </button>
                        <a
                          href={`/api/projects/${project.id}/reports/xlsx`}
                          className="font-semibold text-emerald-700 hover:underline"
                        >
                          Excel (.XLSX)
                        </a>
                        <button
                          type="button"
                          onClick={() => downloadProjectCsvReport(project, findings)}
                          className="font-semibold text-slate-700 hover:underline"
                        >
                          CSV
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: ACTIVITY */}
      {activeTab === 'activity' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Project Audit & Review Log</h2>
          <div className="divide-y divide-slate-200 text-xs">
            {activities.map((a) => (
              <div key={a.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{a.action}</span>
                  <span className="font-mono text-slate-400 tabular-nums">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-0.5 text-slate-600">{a.detail}</p>
                <div className="mt-0.5 text-[11px] text-slate-400">Actor: {a.actor}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewerFile && (
        <DocumentViewerModal
          file={viewerFile}
          initialPageNumber={viewerPage}
          relatedFindings={findings.filter((f) =>
            f.sourceFiles.some((s) => s.fileId === viewerFile.id || s.filename === viewerFile.originalName)
          )}
          onClose={() => setViewerFile(null)}
          onSelectFinding={(f) => {
            setSelectedFindingId(f.id);
            onTabChange('results');
          }}
        />
      )}
    </div>
  );
};
