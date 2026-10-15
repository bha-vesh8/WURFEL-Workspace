import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Layers,
  Square,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Finding, ProjectFile } from '../types.ts';

interface DocumentViewerModalProps {
  file: ProjectFile;
  initialPageNumber?: number;
  relatedFindings: Finding[];
  onClose: () => void;
  onUpdateFile?: (fileId: string, updates: Partial<ProjectFile>) => Promise<void>;
  onSelectFinding?: (finding: Finding) => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  file,
  initialPageNumber = 1,
  relatedFindings,
  onClose,
  onUpdateFile,
  onSelectFinding,
}) => {
  const pages = file.pages && file.pages.length > 0 ? file.pages : [];
  const [currentPageIdx, setCurrentPageIdx] = useState(() => {
    const idx = pages.findIndex((p) => p.pageNumber === initialPageNumber);
    return idx >= 0 ? idx : 0;
  });
  const [zoom, setZoom] = useState(100);
  const [activeTab, setActiveTab] = useState<'preview' | 'text' | 'metadata'>('preview');

  const currentPage = pages[currentPageIdx];
  const isImageFile = ['.png', '.jpg', '.jpeg', '.webp'].includes(file.extension);

  const handleTogglePageSelection = async () => {
    if (!currentPage || !onUpdateFile) return;
    const nextPages = pages.map((p, idx) =>
      idx === currentPageIdx ? { ...p, selectedForReview: p.selectedForReview === false ? true : false } : p
    );
    await onUpdateFile(file.id, { pages: nextPages });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{file.role}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono uppercase">{file.extension}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{(file.fileSize / 1024).toFixed(1)} KB</span>
              {file.isDemoSynthetic && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-amber-700">Synthetic Sample Document</span>
                </>
              )}
            </div>
            <h2 className="truncate text-base font-semibold text-slate-900">{file.originalName}</h2>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'preview' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Visual / Table View
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'text' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Extracted Text & Values
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('metadata')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'metadata' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Metadata ({relatedFindings.length} Findings)
              </button>
            </div>

            <a
              href={`/api/files/${file.id}/raw`}
              download={file.originalName}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              Download Original
            </a>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close viewer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sub-toolbar: Page Navigation & Zoom */}
        {pages.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPageIdx <= 0}
                onClick={() => setCurrentPageIdx((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <span className="font-mono font-medium text-slate-800 tabular-nums">
                Page / Sheet {currentPageIdx + 1} of {pages.length}
              </span>
              <button
                type="button"
                disabled={currentPageIdx >= pages.length - 1}
                onClick={() => setCurrentPageIdx((i) => Math.min(pages.length - 1, i + 1))}
                className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <span className="ml-2 text-slate-500">{currentPage?.label}</span>
            </div>

            <div className="flex items-center gap-4">
              {onUpdateFile && currentPage && (
                <button
                  type="button"
                  onClick={handleTogglePageSelection}
                  className="inline-flex items-center gap-1.5 text-slate-700 hover:text-slate-900"
                >
                  {currentPage.selectedForReview !== false ? (
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Square className="h-4 w-4 text-slate-400" />
                  )}
                  <span>Include page in detailed AI review</span>
                </button>
              )}

              <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(60, z - 20))}
                  className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
                  title="Zoom out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="w-12 text-center font-mono tabular-nums text-slate-700">{zoom}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(200, z + 20))}
                  className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
                  title="Zoom in"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Body Split: Left Document Canvas + Right Evidence & Findings Sidebar */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12">
          {/* Document Content Area */}
          <div className="overflow-auto bg-slate-100/70 p-6 lg:col-span-8">
            {file.extractionStatus === 'Unsupported' ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-6 text-slate-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Unsupported Format ({file.extension}) — Cannot Render Local Preview
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-700">{file.unsupportedReason}</p>
                    {file.recommendedFormat && (
                      <p className="text-xs font-medium text-amber-900">
                        Recommended Action: {file.recommendedFormat}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : activeTab === 'preview' ? (
              <div
                className="mx-auto origin-top transition-transform duration-150"
                style={{ width: `${zoom}%`, maxWidth: zoom > 100 ? 'none' : '100%' }}
              >
                {/* 1. Synthetic Technical Drawing SVG */}
                {currentPage?.svgDrawingData ? (
                  <div className="space-y-4">
                    <div
                      className="overflow-hidden rounded-lg border border-slate-300 bg-white p-3 shadow-xs"
                      dangerouslySetInnerHTML={{ __html: currentPage.svgDrawingData }}
                    />
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="mb-1.5 text-xs font-semibold text-slate-900">
                        Extracted Drawing Annotations & Callouts ({currentPage.label})
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-700">
                        {currentPage.text}
                      </pre>
                    </div>
                  </div>
                ) : isImageFile && !file.isDemoSynthetic ? (
                  /* 2. Real Uploaded Raster Image */
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white p-4 text-center">
                      <img
                        src={`/api/files/${file.id}/raw`}
                        alt={file.originalName}
                        referrerPolicy="no-referrer"
                        className="mx-auto max-h-[540px] object-contain"
                      />
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="mb-1 text-xs font-semibold text-slate-900">
                        OCR Output {currentPage?.ocrConfidence !== undefined ? `(Confidence: ${currentPage.ocrConfidence}%)` : ''}
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-xs text-slate-700">{currentPage?.text || file.extractedText}</pre>
                    </div>
                  </div>
                ) : currentPage?.tables && currentPage.tables.length > 0 ? (
                  /* 3. Spreadsheet / XML BOM Structured Table Preview */
                  <div className="space-y-4">
                    {currentPage.tables.map((tbl, tIdx) => (
                      <div key={tIdx} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                          <span className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                            Table: {tbl.name} ({tbl.rows.length} rows)
                          </span>
                          <span className="font-mono text-xs text-slate-500">Programmatic Arithmetic Checked</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                                {tbl.headers.map((h) => (
                                  <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                              {tbl.rows.map((r, rIdx) => {
                                const hasMathMismatch =
                                  r.StatedTotal_EUR !== undefined &&
                                  r.CalculatedTotal_EUR !== undefined &&
                                  Number(r.StatedTotal_EUR) !== Number(r.CalculatedTotal_EUR);
                                return (
                                  <tr
                                    key={rIdx}
                                    className={hasMathMismatch ? 'bg-red-50/70 text-red-900' : 'hover:bg-slate-50'}
                                  >
                                    {tbl.headers.map((h) => (
                                      <td key={h} className="px-3 py-2 whitespace-nowrap">
                                        {String(r[h] ?? '')}
                                      </td>
                                    ))}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* 4. Formatted Document Page Sheet */
                  <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xs">
                    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                      <span className="text-xs font-semibold text-slate-900">{currentPage?.label || 'Document Content'}</span>
                      {currentPage?.ocrConfidence !== undefined && (
                        <span className="font-mono text-xs text-slate-500 tabular-nums">
                          OCR Confidence: {currentPage.ocrConfidence}%
                        </span>
                      )}
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-800">
                      {currentPage?.text || file.extractedText || 'No extractable text found on this page.'}
                    </pre>
                  </div>
                )}
              </div>
            ) : activeTab === 'text' ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <h3 className="mb-3 text-xs font-semibold text-slate-900">
                    Normalized Extracted Text ({file.extractionMethod})
                  </h3>
                  <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-700">
                    {file.extractedText || 'No text extracted.'}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Document Normalization Metadata</h3>
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                    <div className="border-b border-slate-100 pb-2">
                      <dt className="text-slate-500">Internal File ID</dt>
                      <dd className="mt-0.5 font-mono text-slate-900">{file.id}</dd>
                    </div>
                    <div className="border-b border-slate-100 pb-2">
                      <dt className="text-slate-500">Assigned Document Role</dt>
                      <dd className="mt-0.5 font-medium text-slate-900">{file.role}</dd>
                    </div>
                    <div className="border-b border-slate-100 pb-2">
                      <dt className="text-slate-500">Extraction Pipeline Method</dt>
                      <dd className="mt-0.5 text-slate-900">{file.extractionMethod}</dd>
                    </div>
                    <div className="border-b border-slate-100 pb-2">
                      <dt className="text-slate-500">OCR Confidence</dt>
                      <dd className="mt-0.5 font-mono text-slate-900 tabular-nums">
                        {file.ocrConfidence !== undefined ? `${file.ocrConfidence}%` : 'N/A (Digital Native)'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </div>

          {/* Right Inspection Sidebar: Detected Tokens, Warnings, Related Findings */}
          <div className="flex flex-col justify-between overflow-y-auto border-t border-slate-200 bg-white p-5 lg:col-span-4 lg:border-t-0 lg:border-l">
            <div className="space-y-5">
              {/* Warnings */}
              {(file.warnings.length > 0 || (currentPage?.warnings && currentPage.warnings.length > 0)) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    Extraction & OCR Advisories
                  </div>
                  <ul className="space-y-1 text-xs text-amber-800">
                    {[...file.warnings, ...(currentPage?.warnings || [])].map((w, idx) => (
                      <li key={idx}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Detected Values on Current Page */}
              {currentPage?.detectedValues && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-900">
                    Detected Values on {currentPage.label.split('—')[0]}
                  </h3>

                  {currentPage.detectedValues.dimensions && currentPage.detectedValues.dimensions.length > 0 && (
                    <div>
                      <div className="text-xs text-slate-500">Explicit Dimensions</div>
                      <div className="mt-1 font-mono text-xs text-slate-800 tabular-nums">
                        {currentPage.detectedValues.dimensions.join(' · ')}
                      </div>
                    </div>
                  )}

                  {currentPage.detectedValues.finishCodes && currentPage.detectedValues.finishCodes.length > 0 && (
                    <div>
                      <div className="text-xs text-slate-500">Finish & Material Codes</div>
                      <div className="mt-1 font-mono text-xs text-blue-700">
                        {currentPage.detectedValues.finishCodes.join(' · ')}
                      </div>
                    </div>
                  )}

                  {currentPage.detectedValues.productCodes && currentPage.detectedValues.productCodes.length > 0 && (
                    <div>
                      <div className="text-xs text-slate-500">Hardware / Module / Accessory Codes</div>
                      <div className="mt-1 font-mono text-xs text-slate-800">
                        {currentPage.detectedValues.productCodes.join(' · ')}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Related Findings referencing this document */}
              <div className="border-t border-slate-200 pt-4">
                <h3 className="mb-2.5 text-xs font-semibold text-slate-900">
                  Related Technical Findings ({relatedFindings.length})
                </h3>
                {relatedFindings.length === 0 ? (
                  <p className="text-xs text-slate-500">No findings currently reference this document.</p>
                ) : (
                  <div className="space-y-2.5">
                    {relatedFindings.map((f) => {
                      const srcRef = f.sourceFiles.find(
                        (s) => s.fileId === file.id || s.filename === file.originalName
                      );
                      return (
                        <div
                          key={f.id}
                          onClick={() => {
                            if (onSelectFinding) {
                              onSelectFinding(f);
                              onClose();
                            }
                          }}
                          className="cursor-pointer rounded-lg border border-slate-200 p-3 transition-colors hover:border-blue-300 hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <span
                              className={`font-semibold ${
                                f.severity === 'Critical'
                                  ? 'text-red-600'
                                  : f.severity === 'High'
                                  ? 'text-amber-700'
                                  : 'text-blue-700'
                              }`}
                            >
                              {f.severity}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="font-mono text-slate-500">{srcRef?.pageOrSheet || 'Ref'}</span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="text-slate-600">{f.status}</span>
                          </div>
                          <div className="mt-1 text-xs font-medium text-slate-900">{f.title}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-3 text-[11px] text-slate-500">
              Original uploaded file is preserved read-only on disk.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
