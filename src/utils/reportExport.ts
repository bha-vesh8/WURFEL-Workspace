import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnalysisRun, Finding, Project } from '../types.ts';

export function downloadProjectPdfReport(
  project: Project,
  run: AnalysisRun | undefined,
  findings: Finding[],
  reviewerNotes = ''
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const isDemo = Boolean(project.isDemoProject || run?.isDemoMode || findings.some((f) => f.isDemoFinding));

  // 1. Cover / Title Section
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(0, 42, pageWidth, 42);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('WURFEL — Technical Dossier Review Report', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('Pre-Production Technical Verification for Kitchen & Wardrobe Projects', 14, 25);

  if (isDemo) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text('MODE: DEMO / SYNTHETIC SAMPLE DATA ANALYSIS (NOT LIVE AI ON CLIENT FILES)', 14, 34);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(3, 105, 161);
    doc.text(`MODE: ${run?.mode || 'Technical Rules + AI Review'}`, 14, 34);
  }

  // 2. Project Details
  let y = 52;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Project Details', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    body: [
      ['Project Name', project.name, 'Reference ID', project.referenceId],
      ['Category', project.projectType, 'Client', project.clientName || 'N/A'],
      ['Site / Location', project.siteLocation || 'N/A', 'Reviewer', project.reviewerName || 'Elena Rostova'],
      [
        'Analysis Date',
        run?.completedAt ? new Date(run.completedAt).toLocaleString() : new Date().toLocaleString(),
        'Dossier Verdict',
        run?.overallVerdict || 'Review Required',
      ],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // 3. Summary of Analysis & 4. Counts by Severity
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('2. Executive Summary & Counts by Severity', 14, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const summaryLines = doc.splitTextToSize(
    run?.summaryText ||
      `Technical review of ${project.name} identified ${findings.length} total findings requiring review prior to production approval.`,
    pageWidth - 28
  );
  doc.text(summaryLines, 14, y);
  y += summaryLines.length * 4.5 + 3;

  const sevCounts = {
    Critical: findings.filter((f) => f.severity === 'Critical').length,
    High: findings.filter((f) => f.severity === 'High').length,
    Medium: findings.filter((f) => f.severity === 'Medium').length,
    Low: findings.filter((f) => f.severity === 'Low').length,
    Informational: findings.filter((f) => f.severity === 'Informational').length,
    HumanReview: findings.filter((f) => f.humanReviewRequired).length,
  };

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, halign: 'center', cellPadding: 2.5 },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    head: [['Total Findings', 'Critical', 'High', 'Medium', 'Low / Info', 'Human Review Req.']],
    body: [
      [
        findings.length,
        sevCounts.Critical,
        sevCounts.High,
        sevCounts.Medium,
        sevCounts.Low + sevCounts.Informational,
        sevCounts.HumanReview,
      ],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // 5. Findings Grouped by Category, 6. Evidence & Sources, 7. Suggested Corrections
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Technical Findings, Evidence & Suggested Corrections (Grouped by Category)', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak', textColor: [30, 41, 59] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['Category & Title', 'Sev / Status', 'Expected vs Observed', 'Evidence & Source Ref', 'Suggested Correction']],
    body: findings.map((f) => [
      `[${f.category}]\n${f.title}${f.isDemoFinding ? ' (Demo Sample)' : ''}`,
      `${f.severity}\nStatus: ${f.status}\nConf: ${f.confidence}`,
      `Exp: ${f.expectedValue || 'N/A'}\nObs: ${f.observedValue || 'N/A'}`,
      `${f.evidence}\nSources: ${f.sourceFiles.map((s) => `${s.filename} (${s.pageOrSheet})`).join(', ')}`,
      `${f.suggestedCorrection}\nReason: ${f.reasonForSuggestion}`,
    ]),
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  // 8. Items Requiring Human Review & 9. Reviewer Notes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('4. Items Requiring Specialist Human Review & Reviewer Notes', 14, y);
  y += 4;

  const humanItems = findings.filter((f) => f.humanReviewRequired || f.reviewerComment);
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    head: [['Finding', 'Review Status', 'Human Review Gate', 'Reviewer Comment']],
    body:
      humanItems.length > 0
        ? humanItems.map((f) => [
            f.title,
            f.status,
            f.humanReviewRequired ? 'Mandatory Sign-Off' : 'Standard',
            f.reviewerComment || reviewerNotes || 'Pending technical reviewer sign-off note.',
          ])
        : [['All Checked Items', 'Reviewed', 'Standard', reviewerNotes || 'No additional reviewer comments recorded.']],
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  // 10. Limitations & Disclaimer
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('5. Limitations & Engineering Disclaimer', 14, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const disclaimer = doc.splitTextToSize(
    'DISCLAIMER: WURFEL is an assistive technical review tool. It does not certify structural safety, building code compliance, or CNC production readiness. OCR on scanned drawings and visual AI inference may miss illegible symbols or unlabelled tolerances. All findings, dimensions, hardware counts, and costing figures must be verified and approved by a qualified human technical reviewer prior to manufacturing.',
    pageWidth - 28
  );
  doc.text(disclaimer, 14, y);

  const safeRef = project.referenceId.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`WURFEL_Review_Report_${safeRef}.pdf`);
}

export function downloadProjectCsvReport(project: Project, findings: Finding[]): void {
  const headers = [
    'Finding_ID',
    'Severity',
    'Category',
    'Finding_Type',
    'Confidence',
    'Review_Status',
    'Title',
    'Description',
    'Expected_Value',
    'Observed_Value',
    'Evidence',
    'Source_References',
    'Suggested_Correction',
    'Reason',
    'Human_Review_Required',
    'Reviewer_Comment',
    'Analysis_Source',
  ];

  const escapeCsv = (val: string | number | boolean | undefined) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = findings.map((f) =>
    [
      f.id,
      f.severity,
      f.category,
      f.findingType,
      f.confidence,
      f.status,
      f.title,
      f.description,
      f.expectedValue || '',
      f.observedValue || '',
      f.evidence,
      f.sourceFiles.map((s) => `${s.filename} (${s.pageOrSheet})`).join('; '),
      f.suggestedCorrection,
      f.reasonForSuggestion,
      f.humanReviewRequired ? 'Yes' : 'No',
      f.reviewerComment || '',
      f.isDemoFinding ? 'Demo Sample' : f.analysisSource,
    ]
      .map(escapeCsv)
      .join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeRef = project.referenceId.replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `WURFEL_Findings_${safeRef}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
