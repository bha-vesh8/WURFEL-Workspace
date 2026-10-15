import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  Eye,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ALL_CHECK_CATEGORIES,
  AnalysisRun,
  CheckCategory,
  DocumentRole,
  Finding,
  Project,
  ProjectCategory,
  ProjectFile,
} from '../types.ts';
import { DocumentViewerModal } from './DocumentViewerModal.tsx';

const DOCUMENT_ROLES: DocumentRole[] = [
  'FR / Site Measurement',
  'TeoWin Export',
  'Technical Dossier',
  'Costing Sheet',
  'Technical Drawing',
  'Reference Image',
  'Other',
];

interface NewAnalysisWizardProps {
  initialProject?: Project | null;
  initialFiles?: ProjectFile[];
  onAnalysisComplete: (projectId: string, runId: string) => void;
  onCancel: () => void;
}

export const NewAnalysisWizard: React.FC<NewAnalysisWizardProps> = ({
  initialProject = null,
  initialFiles = [],
  onAnalysisComplete,
  onCancel,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialProject ? 2 : 1);
  const [project, setProject] = useState<Project | null>(initialProject);

  // Step 1 fields
  const [name, setName] = useState(initialProject?.name || '');
  const [referenceId, setReferenceId] = useState(
    initialProject?.referenceId || `KW-2026-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [projectType, setProjectType] = useState<ProjectCategory>(
    initialProject?.projectType || 'Kitchen + Wardrobe'
  );
  const [clientName, setClientName] = useState(initialProject?.clientName || '');
  const [siteLocation, setSiteLocation] = useState(initialProject?.siteLocation || '');
  const [description, setDescription] = useState(initialProject?.description || '');
  const [reviewerName, setReviewerName] = useState(initialProject?.reviewerName || 'Elena Rostova');

  // Step 2 files
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Step 3 checks
  const [selectedChecks, setSelectedChecks] = useState<CheckCategory[]>([...ALL_CHECK_CATEGORIES]);

  // Step 4 running job
  const [activeRun, setActiveRun] = useState<AnalysisRun | null>(null);
  const [startingAnalysis, setStartingAnalysis] = useState(false);

  useEffect(() => {
    if (initialProject) {
      setProject(initialProject);
      setFiles(initialFiles);
    }
  }, [initialProject, initialFiles]);

  useEffect(() => {
    if (step !== 4 || !activeRun || activeRun.status !== 'Running') return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/analysis-runs/${activeRun.id}`);
        if (res.ok) {
          const data = await res.json();
          setActiveRun(data.run);
          if (data.run.status === 'Completed' && project) {
            clearInterval(timer);
            setTimeout(() => {
              onAnalysisComplete(project.id, data.run.id);
            }, 600);
          } else if (data.run.status === 'Failed') {
            clearInterval(timer);
          }
        }
      } catch {
        // Ignore transient poll glitch
      }
    }, 450);
    return () => clearInterval(timer);
  }, [step, activeRun, project, onAnalysisComplete]);

  const handleSaveStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    if (!name.trim()) {
      setUploadError('Please enter a project name.');
      return;
    }

    try {
      if (!project) {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            referenceId: referenceId.trim(),
            projectType,
            clientName: clientName.trim(),
            siteLocation: siteLocation.trim(),
            description: description.trim(),
            reviewerName: reviewerName.trim(),
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create project');
        }
        const created: Project = await res.json();
        setProject(created);
      } else {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            referenceId: referenceId.trim(),
            projectType,
            clientName: clientName.trim(),
            siteLocation: siteLocation.trim(),
            description: description.trim(),
            reviewerName: reviewerName.trim(),
          }),
        });
        if (res.ok) {
          setProject(await res.json());
        }
      }
      setStep(2);
    } catch (err: any) {
      setUploadError(err?.message || 'Could not save project details.');
    }
  };

  const handleUploadFiles = async (fileList: FileList | File[]) => {
    if (!project || fileList.length === 0) return;
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      Array.from(fileList).forEach((f) => formData.append('files', f));
      const res = await fetch(`/api/projects/${project.id}/files`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'File upload failed');
      }
      const created: ProjectFile[] = await res.json();
      setFiles((prev) => [...prev, ...created]);
    } catch (err: any) {
      setUploadError(err?.message || 'Error uploading files.');
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateSampleTestBundle = async () => {
    const frContent = `FR SITE MEASUREMENT SHEET - REF ${referenceId}
Kitchen North Wall Available Span: 3610 mm (soffit 3604 mm)
NE Structural Pillar: 180x220 mm cannot be chased.
Wardrobe Wall B Clear Width: 4045 mm, Height: 2695 mm.`;

    const dossierContent = `# TECHNICAL DOSSIER - ${name || 'Project'} (${referenceId})
- Primary Front Finish: LAC-RAL7035-GL (RAL 7035 High-Gloss)
- Total North Wall Run: 3650 mm (C1 600 + C2 600 + B1 800 + B2 900 + B3 600 + Fillers 150 mm)
- Hob Cabinet B2-900 fitted with Cutlery Insert ACC-CUT-800
- Wardrobe W-03 (1000 mm) fitted with Shoe Rack ACC-SR-900
- Wardrobe Doors: 8x Full-height 2540 mm leaves in 22mm MDF, 3 hinges per leaf (BLUM-71B3550)
- Under-cabinet Lighting: 4x LGT-LED-3000K-900 (72W total load) on 1x DRV-24V-60W driver
- Island Worktop: 20mm Dekton Sirius, overhang = 420 mm unsupported
- Pocket Door C2 Note: verify spindle recess on site; Hob cutout dimensions TBC before CNC`;

    const csvContent = `Row,ItemCode,Description,Finish,Qty,UnitPrice_EUR,StatedTotal_EUR
1,CAB-KIT,Kitchen Base & Tall Units,LAC-RAL7039-SM,5,1420,7100
2,HAWA-CONCEPTA-25,Hawa Concepta 25 Pocket Door Set,Anodized,2,790,1380
3,LGT-LED-3000K-900,Recessed LED Bar 900mm,Black,2,95,190
4,BLUM-71B3550,Blum 110 Hinge,Nickel,24,8.5,204`;

    const f1 = new File([frContent], `FR_Site_Survey_${referenceId}.txt`, { type: 'text/plain' });
    const f2 = new File([dossierContent], `Technical_Dossier_${referenceId}.md`, { type: 'text/markdown' });
    const f3 = new File([csvContent], `Costing_Schedule_${referenceId}.csv`, { type: 'text/csv' });

    await handleUploadFiles([f1, f2, f3]);
  };

  const handleChangeRole = async (fileId: string, newRole: DocumentRole) => {
    const res = await fetch(`/api/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      const updated: ProjectFile = await res.json();
      setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
    }
  };

  const handleUpdateFile = async (fileId: string, updates: Partial<ProjectFile>) => {
    const res = await fetch(`/api/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated: ProjectFile = await res.json();
      setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
      if (previewFile && previewFile.id === fileId) {
        setPreviewFile(updated);
      }
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
    if (res.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    }
  };

  const toggleCheck = (cat: CheckCategory) => {
    setSelectedChecks((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleStartAnalysis = async () => {
    if (!project || startingAnalysis) return;
    if (files.length === 0) {
      setUploadError('Please upload at least one project file before starting analysis.');
      return;
    }
    if (selectedChecks.length === 0) {
      setUploadError('Please select at least one checking category.');
      return;
    }

    setStartingAnalysis(true);
    setUploadError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedChecks }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Could not start technical analysis');
      }
      const run: AnalysisRun = await res.json();
      setActiveRun(run);
      setStep(4);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to start analysis job.');
    } finally {
      setStartingAnalysis(false);
    }
  };

  const rolesPresent = new Set(files.map((f) => f.role));
  const missingRoleWarnings: string[] = [];
  if (selectedChecks.includes('FR measurements and site constraints') && !rolesPresent.has('FR / Site Measurement')) {
    missingRoleWarnings.push(
      'No file is assigned the "FR / Site Measurement" role. Site constraint and wall-length checks will be marked as Insufficient Evidence.'
    );
  }
  if (selectedChecks.includes('Costing consistency') && !rolesPresent.has('Costing Sheet')) {
    missingRoleWarnings.push(
      'No file is assigned the "Costing Sheet" role. Costing arithmetic and BOM price checks require a costing spreadsheet or schedule.'
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header & Progress Stepper */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {step === 4 ? 'Technical Dossier Analysis in Progress' : 'Create Project & Run Technical Analysis'}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Upload exported TeoWin files, site measurements, technical dossiers, and costing sheets for automated cross-checking.
            </p>
          </div>
          {step !== 4 && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              Cancel & Return
            </button>
          )}
        </div>

        {/* 3-Step Progress Bar */}
        {step !== 4 && (
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-100 pt-5">
            {[
              { num: 1, title: '01. Project Details', desc: 'Category & metadata' },
              { num: 2, title: '02. Upload & Inspect Files', desc: 'Assign roles & extract' },
              { num: 3, title: '03. Configure Checks & Run', desc: '12 technical categories' },
            ].map((item) => {
              const isActive = step === item.num;
              const isDone = step > item.num;
              return (
                <div
                  key={item.num}
                  className={`rounded-lg border px-4 py-3 ${
                    isActive
                      ? 'border-blue-600 bg-blue-50/40'
                      : isDone
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div
                    className={`text-xs font-semibold ${
                      isActive ? 'text-blue-700' : isDone ? 'text-emerald-700' : 'text-slate-700'
                    }`}
                  >
                    {item.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{item.desc}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {uploadError && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* STEP 1: PROJECT DETAILS */}
      {step === 1 && (
        <form onSubmit={handleSaveStep1} className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-800">
                Project Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Villa Dubois — Handleless Island Kitchen & Walk-in Wardrobe"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800">
                Project Reference ID <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800">
                Project Category <span className="text-red-600">*</span>
              </label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value as ProjectCategory)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-hidden"
              >
                <option value="Kitchen">Kitchen</option>
                <option value="Kitchen + Wardrobe">Kitchen + Wardrobe</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800">Technical Reviewer Name</label>
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="e.g., Elena Rostova"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800">Client Name (Optional)</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g., Architect Studio Vermeulen"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800">Site / Location (Optional)</label>
              <input
                type="text"
                value={siteLocation}
                onChange={(e) => setSiteLocation(e.target.value)}
                placeholder="e.g., Brussels — Lot 14"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800">Project Description & Notes (Optional)</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Specify special finishes, appliance packages, pocket door mechanisms, or site access constraints..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Continue to File Upload
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: UPLOAD FILES & ASSIGN ROLES */}
      {step === 2 && project && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Upload Dossier Documents for "{project.name}"
                </h2>
                <p className="text-xs text-slate-500">
                  Supported: .PDF, .XLSX, .XLS, .CSV, .DOCX, .PPTX, .PNG, .JPG, .WEBP, .TXT, .MD, .JSON, .XML, .DXF.
                  Unsupported formats (.DWG, native .TEO) are explicitly flagged with export guidance.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateSampleTestBundle}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
              >
                <FilePlus2 className="h-3.5 w-3.5 text-blue-600" />
                Attach 3 Sample Test Files
              </button>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.length) {
                  handleUploadFiles(e.dataTransfer.files);
                }
              }}
              className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-6 py-8 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/20"
            >
              <Upload className="h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-800">
                Drag and drop project files here, or click to browse
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Upload FR site surveys, TeoWin exports, technical dossiers, drawings, and costing sheets (Max 25 MB/file)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Uploading & Running Local Extraction...
                  </>
                ) : (
                  'Browse Computer Files'
                )}
              </button>
            </div>

            {/* Uploaded Files Table */}
            {files.length > 0 && (
              <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="px-4 py-2.5 font-semibold">Filename</th>
                      <th className="px-3 py-2.5 font-semibold">Format / Size</th>
                      <th className="px-3 py-2.5 font-semibold">Assigned Document Role</th>
                      <th className="px-3 py-2.5 font-semibold">Extraction Status</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {files.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{f.originalName}</div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {f.extractionMethod} · {f.pages.length} page/sheet(s)
                          </div>
                          {f.unsupportedReason && (
                            <div className="mt-1 text-[11px] font-medium text-red-600">
                              {f.unsupportedReason} ({f.recommendedFormat})
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                          {f.extension.toUpperCase()} · {(f.fileSize / 1024).toFixed(1)} KB
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={f.role}
                            onChange={(e) => handleChangeRole(f.id, e.target.value as DocumentRole)}
                            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-hidden"
                          >
                            {DOCUMENT_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          {f.role === f.suggestedRole && (
                            <div className="mt-0.5 text-[10px] text-slate-400">Auto-suggested</div>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              f.extractionStatus === 'Extracted'
                                ? 'text-emerald-700'
                                : f.extractionStatus === 'Unsupported' || f.extractionStatus === 'Error'
                                ? 'text-red-600'
                                : 'text-amber-700'
                            }`}
                          >
                            {f.extractionStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewFile(f)}
                              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Inspect
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(f.id)}
                              className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                              title="Remove file"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Details
              </button>
              <button
                type="button"
                disabled={files.length === 0}
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Continue to Check Selection
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW & SELECT CHECKS */}
      {step === 3 && project && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Review Dossier & Select Technical Checks</h2>
              <p className="text-xs text-slate-500">
                Project: <span className="font-semibold text-slate-800">{project.name}</span> ({project.referenceId}) ·{' '}
                {project.projectType} · {files.length} uploaded file(s)
              </p>
            </div>

            {missingRoleWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Document Role Coverage Advisories
                </div>
                <ul className="mt-1.5 space-y-1 text-xs text-amber-800">
                  {missingRoleWarnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">
                  Selectable Technical Checking Categories ({selectedChecks.length} of {ALL_CHECK_CATEGORIES.length}{' '}
                  selected)
                </span>
                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedChecks([...ALL_CHECK_CATEGORIES])}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedChecks([])}
                    className="font-medium text-slate-500 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {ALL_CHECK_CATEGORIES.map((cat) => {
                  const checked = selectedChecks.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCheck(cat)}
                      className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left text-xs transition-colors ${
                        checked
                          ? 'border-blue-600 bg-blue-50/30 font-medium text-slate-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {checked ? (
                        <CheckSquare className="h-4 w-4 shrink-0 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <span>{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Files
              </button>

              <button
                type="button"
                disabled={startingAnalysis || selectedChecks.length === 0}
                onClick={handleStartAnalysis}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                {startingAnalysis ? 'Starting Analysis Pipeline...' : 'Start Technical Analysis'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: DEDICATED REAL-TIME ANALYSIS PROGRESS SCREEN */}
      {step === 4 && activeRun && project && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-mono">{project.referenceId}</span>
                <span aria-hidden="true">·</span>
                <span>{files.length} Files</span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-purple-700">{activeRun.mode}</span>
              </div>
              <h2 className="mt-1 text-lg font-bold text-slate-900">{project.name}</h2>
            </div>

            <div className="text-right font-mono">
              <div className="text-2xl font-bold text-blue-600 tabular-nums">{activeRun.progressPercent}%</div>
              <div className="text-xs text-slate-500 tabular-nums">
                {activeRun.findingsCount} Finding(s) Discovered
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${activeRun.progressPercent}%` }}
            />
          </div>

          {activeRun.currentFileBeingProcessed && (
            <div className="text-xs text-slate-600">
              Currently inspecting:{' '}
              <span className="font-mono font-medium text-slate-900">{activeRun.currentFileBeingProcessed}</span>
            </div>
          )}

          {/* 8 Stages Checklist */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {activeRun.stages.map((st) => (
              <div
                key={st.stageIndex}
                className={`flex items-start gap-3 rounded-lg border p-3.5 text-xs ${
                  st.status === 'completed'
                    ? 'border-emerald-200 bg-emerald-50/30 text-slate-800'
                    : st.status === 'active'
                    ? 'border-blue-600 bg-blue-50/40 text-slate-900'
                    : 'border-slate-200 bg-slate-50/40 text-slate-400'
                }`}
              >
                {st.status === 'completed' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : st.status === 'active' ? (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-600" />
                ) : (
                  <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-slate-300" />
                )}
                <div>
                  <div className="font-semibold">
                    0{st.stageIndex + 1}. {st.stageName}
                  </div>
                  {st.detail && <div className="mt-0.5 text-[11px] text-slate-500">{st.detail}</div>}
                </div>
              </div>
            ))}
          </div>

          {activeRun.status === 'Failed' && (
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800">
              <span>Analysis job failed: {activeRun.errorMessage || 'Unexpected error'}</span>
              <button
                type="button"
                onClick={handleStartAnalysis}
                className="inline-flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry Analysis
              </button>
            </div>
          )}
        </div>
      )}

      {previewFile && (
        <DocumentViewerModal
          file={previewFile}
          relatedFindings={[]}
          onClose={() => setPreviewFile(null)}
          onUpdateFile={handleUpdateFile}
        />
      )}
    </div>
  );
};
