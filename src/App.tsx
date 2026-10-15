import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  ChevronRight,
  ClipboardCheck,
  FileBarChart2,
  FolderKanban,
  History,
  LayoutDashboard,
  Menu,
  PlusCircle,
  Search,
  Settings,
  Sliders,
  X,
} from 'lucide-react';
import {
  ActivityLog,
  AnalysisRun,
  Finding,
  Project,
  ProjectFile,
  ReportRecord,
  SystemStatus,
  TechnicalRule,
} from './types.ts';
import { AnalysisResultsView } from './components/AnalysisResultsView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { NewAnalysisWizard } from './components/NewAnalysisWizard.tsx';
import {
  AnalysisHistoryView,
  ProjectsListView,
  ReportsListView,
  SettingsView,
} from './components/ProjectsAndReportsViews.tsx';
import { TechnicalRulesView } from './components/TechnicalRulesView.tsx';
import { downloadProjectCsvReport, downloadProjectPdfReport } from './utils/reportExport.ts';

type NavPage =
  | 'overview'
  | 'projects'
  | 'new-analysis'
  | 'history'
  | 'rules'
  | 'reports'
  | 'settings'
  | 'project-detail';

export function App() {
  const [activePage, setActivePage] = useState<NavPage>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global state from backend
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [rules, setRules] = useState<TechnicalRule[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Active Project Detail State
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<{
    project: Project;
    files: ProjectFile[];
    runs: AnalysisRun[];
    findings: Finding[];
    reports: ReportRecord[];
    activities: ActivityLog[];
  } | null>(null);
  const [projectDetailTab, setProjectDetailTab] = useState<
    'overview' | 'files' | 'results' | 'reports' | 'activity'
  >('results');

  // Wizard pre-selected project
  const [wizardProject, setWizardProject] = useState<{
    project: Project | null;
    files: ProjectFile[];
  }>({ project: null, files: [] });

  // Top bar search, notifications, profile menu
  const [globalSearch, setGlobalSearch] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const fetchAllData = useCallback(async () => {
    try {
      const [ovRes, projRes, runsRes, rulesRes, repRes, sysRes] = await Promise.all([
        fetch('/api/overview'),
        fetch('/api/projects'),
        fetch('/api/analysis-runs'),
        fetch('/api/rules'),
        fetch('/api/reports'),
        fetch('/api/system/status'),
      ]);

      if (ovRes.ok) setOverviewData(await ovRes.json());
      if (projRes.ok) setProjects(await projRes.json());
      if (runsRes.ok) setRuns(await runsRes.json());
      if (rulesRes.ok) setRules(await rulesRes.json());
      if (repRes.ok) setReports(await repRes.json());
      if (sysRes.ok) setSystemStatus(await sysRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjectDetail = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (res.ok) {
      const data = await res.json();
      setProjectDetail(data);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleOpenProject = async (
    projectId: string,
    tab: 'overview' | 'files' | 'results' | 'reports' | 'activity' = 'results'
  ) => {
    setSelectedProjectId(projectId);
    setProjectDetailTab(tab);
    await fetchProjectDetail(projectId);
    setActivePage('project-detail');
  };

  const handleLoadDemoProject = async () => {
    const res = await fetch('/api/demo/load', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      await fetchAllData();
      if (data.projectId) {
        await handleOpenProject(data.projectId, 'results');
      }
    }
  };

  const handleClearDemoData = async () => {
    await fetch('/api/demo/clear', { method: 'POST' });
    await fetchAllData();
  };

  const handleDeleteProject = async (projectId: string) => {
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchAllData();
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
        setProjectDetail(null);
        setActivePage('projects');
      }
    }
  };

  const handleUpdateRule = async (ruleId: string, updates: Partial<TechnicalRule>) => {
    const res = await fetch(`/api/rules/${ruleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      await fetchAllData();
    }
  };

  const handleDownloadReportForProject = async (projectId: string, format: 'pdf' | 'csv') => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (!res.ok) return;
    const data = await res.json();
    if (format === 'pdf') {
      downloadProjectPdfReport(data.project, data.runs[0], data.findings);
    } else {
      downloadProjectCsvReport(data.project, data.findings);
    }
  };

  const sidebarItems: Array<{ id: NavPage; label: string; icon: React.ComponentType<any> }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'new-analysis', label: 'New Analysis', icon: PlusCircle },
    { id: 'history', label: 'Analysis History', icon: History },
    { id: 'rules', label: 'Technical Rules', icon: Sliders },
    { id: 'reports', label: 'Reports', icon: FileBarChart2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const getBreadcrumbLabel = () => {
    if (activePage === 'project-detail' && projectDetail) {
      return `Projects / ${projectDetail.project.name}`;
    }
    const found = sidebarItems.find((s) => s.id === activePage);
    return found ? found.label : 'Overview';
  };

  const matchingSearchProjects = globalSearch.trim()
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
          p.referenceId.toLowerCase().includes(globalSearch.toLowerCase())
      )
    : [];

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Persistent Desktop Left Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white lg:flex">
        <div>
          {/* Top Brand Zone */}
          <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm tracking-wider">
              W
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-slate-900">WURFEL</div>
              <div className="text-[11px] text-slate-500">Intelligent Technical Review</div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-1 p-3">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                activePage === item.id ||
                (activePage === 'project-detail' && item.id === 'projects');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'new-analysis') {
                      setWizardProject({ project: null, files: [] });
                    }
                    setActivePage(item.id);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Brand & Local / AI Status Indicator */}
        <div className="border-t border-slate-200 bg-slate-50/70 p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900">WURFEL</span>
            <span className="font-mono text-[11px] text-slate-500">Prototype v1.0</span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1">
            <div className="text-[11px] font-medium text-slate-500">Execution Environment</div>
            <div className="font-semibold text-slate-800">Local SQLite + Express</div>
            <div className="text-[11px]">
              AI Mode:{' '}
              {systemStatus?.apiKeyConfigured ? (
                <span className="font-semibold text-purple-700">
                  Live Gemini ({systemStatus.modelName})
                </span>
              ) : (
                <span className="font-semibold text-amber-700">
                  Local Rules + Demo Mode
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex w-64 flex-col justify-between bg-white p-4">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-base font-bold text-slate-900">WURFEL</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-slate-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="mt-4 space-y-1">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.id === 'new-analysis') {
                          setWizardProject({ project: null, files: [] });
                        }
                        setActivePage(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <Icon className="h-4 w-4 text-slate-400" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3.5">
          {/* Left: Mobile Menu + Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
              <button
                type="button"
                onClick={() => setActivePage('overview')}
                className="font-medium text-slate-600 hover:text-slate-900"
              >
                WURFEL Workspace
              </button>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate font-semibold text-slate-900">
                {getBreadcrumbLabel()}
              </span>
            </div>
          </div>

          {/* Right: Global Search + Notifications + Reviewer Profile */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Global Project Quick-Search */}
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Jump to project or ref..."
                className="w-52 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-hidden"
              />
              {matchingSearchProjects.length > 0 && (
                <div className="absolute right-0 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  {matchingSearchProjects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setGlobalSearch('');
                        handleOpenProject(p.id, 'results');
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-50"
                    >
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{p.referenceId}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications Button & Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  setProfileOpen(false);
                }}
                className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Recent activity notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg text-xs">
                  <div className="mb-2 flex items-center justify-between font-semibold text-slate-900">
                    <span>Recent System Activity</span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      Close
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                    {(overviewData?.recentActivity || []).slice(0, 5).map((act: ActivityLog) => (
                      <div key={act.id} className="py-2">
                        <div className="font-medium text-slate-800">{act.action}</div>
                        <div className="text-[11px] text-slate-500">{act.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Reviewer Avatar & Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((o) => !o);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs hover:bg-slate-50"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 font-semibold text-[11px] text-white">
                  BC
                </div>
                <span className="hidden font-medium text-slate-800 md:inline">Bhaskara Char</span>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs space-y-2">
                  <div className="border-b border-slate-100 pb-2">
                    <div className="font-semibold text-slate-900">Bhaskara Char</div>
                    <div className="text-[11px] text-slate-500">Lead Technical Reviewer (Demo)</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      setActivePage('settings');
                    }}
                    className="block w-full rounded px-2 py-1.5 text-left text-slate-700 hover:bg-slate-50"
                  >
                    Environment & AI Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      handleLoadDemoProject();
                    }}
                    className="block w-full rounded px-2 py-1.5 text-left text-blue-600 font-medium hover:bg-slate-50"
                  >
                    Open Demo Project
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport Container */}
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-6 lg:p-8">
          {activePage === 'overview' && (
            <DashboardView
              data={overviewData}
              loading={loading}
              onNavigateNewAnalysis={() => {
                setWizardProject({ project: null, files: [] });
                setActivePage('new-analysis');
              }}
              onNavigateAllProjects={() => setActivePage('projects')}
              onOpenProject={(id, tab) => handleOpenProject(id, tab)}
              onLoadDemoProject={handleLoadDemoProject}
            />
          )}

          {activePage === 'projects' && (
            <ProjectsListView
              projects={projects}
              onOpenProject={(id, tab) => handleOpenProject(id, tab)}
              onCreateNew={() => {
                setWizardProject({ project: null, files: [] });
                setActivePage('new-analysis');
              }}
              onDeleteProject={handleDeleteProject}
            />
          )}

          {activePage === 'new-analysis' && (
            <NewAnalysisWizard
              initialProject={wizardProject.project}
              initialFiles={wizardProject.files}
              onAnalysisComplete={async (projectId) => {
                await fetchAllData();
                await handleOpenProject(projectId, 'results');
              }}
              onCancel={() => setActivePage('overview')}
            />
          )}

          {activePage === 'project-detail' && projectDetail && (
            <AnalysisResultsView
              project={projectDetail.project}
              files={projectDetail.files}
              runs={projectDetail.runs}
              findings={projectDetail.findings}
              reports={projectDetail.reports}
              activities={projectDetail.activities}
              activeTab={projectDetailTab}
              onTabChange={setProjectDetailTab}
              onRefreshProject={async () => {
                await fetchProjectDetail(projectDetail.project.id);
                await fetchAllData();
              }}
              onStartNewAnalysis={() => {
                setWizardProject({
                  project: projectDetail.project,
                  files: projectDetail.files,
                });
                setActivePage('new-analysis');
              }}
              onDeleteProject={handleDeleteProject}
            />
          )}

          {activePage === 'history' && (
            <AnalysisHistoryView
              runs={runs}
              onOpenProjectResults={(projectId) => handleOpenProject(projectId, 'results')}
            />
          )}

          {activePage === 'rules' && (
            <TechnicalRulesView rules={rules} onUpdateRule={handleUpdateRule} />
          )}

          {activePage === 'reports' && (
            <ReportsListView
              reports={reports}
              projects={projects}
              onDownloadReportForProject={handleDownloadReportForProject}
            />
          )}

          {activePage === 'settings' && (
            <SettingsView
              systemStatus={systemStatus}
              projects={projects}
              onClearDemoData={handleClearDemoData}
              onReloadDemoData={handleLoadDemoProject}
              onDeleteProject={handleDeleteProject}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
