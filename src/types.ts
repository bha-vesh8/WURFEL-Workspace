export type ProjectCategory = 'Kitchen' | 'Kitchen + Wardrobe';

export type ProjectStatus =
  | 'Draft'
  | 'Files Uploaded'
  | 'Processing'
  | 'Analysis Complete'
  | 'Awaiting Review'
  | 'Approved';

export type DocumentRole =
  | 'FR / Site Measurement'
  | 'TeoWin Export'
  | 'Technical Dossier'
  | 'Costing Sheet'
  | 'Technical Drawing'
  | 'Reference Image'
  | 'Other';

export type ExtractionStatus = 'Pending' | 'Processing' | 'Extracted' | 'Partial' | 'Unsupported' | 'Error';

export type CheckCategory =
  | 'FR measurements and site constraints'
  | 'Cross-document consistency'
  | 'Dimensions and clearances'
  | 'Colours and finishes'
  | 'Hinges and hardware'
  | 'Accessories and compatibility'
  | 'Lighting type, quantity, and positioning'
  | 'Mechanisms and moving components'
  | 'Special constructions and customizations'
  | 'Technical feasibility'
  | 'Costing consistency'
  | 'Missing information and unclear instructions';

export const ALL_CHECK_CATEGORIES: CheckCategory[] = [
  'FR measurements and site constraints',
  'Cross-document consistency',
  'Dimensions and clearances',
  'Colours and finishes',
  'Hinges and hardware',
  'Accessories and compatibility',
  'Lighting type, quantity, and positioning',
  'Mechanisms and moving components',
  'Special constructions and customizations',
  'Technical feasibility',
  'Costing consistency',
  'Missing information and unclear instructions',
];

export type FindingSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';
export type FindingConfidence = 'High' | 'Medium' | 'Low';
export type FindingType =
  | 'Confirmed Discrepancy'
  | 'Potential Issue'
  | 'Missing Information'
  | 'Suggestion';

export type FindingReviewStatus = 'Open' | 'Accepted' | 'Rejected' | 'Resolved';

export type CheckRunOutcomeStatus =
  | 'Passed'
  | 'Issue Found'
  | 'Needs Review'
  | 'Not Checked'
  | 'Insufficient Evidence';

export interface ExtractedPageOrSheet {
  pageNumber: number;
  label: string;
  text: string;
  contentType: 'text' | 'drawing' | 'table' | 'scanned' | 'costing' | 'synthetic_drawing';
  tables?: Array<{
    name: string;
    headers: string[];
    rows: Array<Record<string, string | number>>;
  }>;
  detectedValues?: {
    dimensions?: string[];
    productCodes?: string[];
    finishCodes?: string[];
    quantities?: Array<{ code: string; description: string; qty: number; unitPrice?: number; lineTotal?: number }>;
  };
  warnings?: string[];
  ocrConfidence?: number;
  selectedForReview?: boolean;
  svgDrawingData?: string;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  filename: string;
  originalName: string;
  fileType: string;
  extension: string;
  fileSize: number;
  role: DocumentRole;
  suggestedRole: DocumentRole;
  uploadStatus: 'Uploaded' | 'Error';
  extractionStatus: ExtractionStatus;
  extractionMethod: string;
  extractedText: string;
  pages: ExtractedPageOrSheet[];
  warnings: string[];
  ocrConfidence?: number;
  isDemoSynthetic?: boolean;
  unsupportedReason?: string;
  recommendedFormat?: string;
  createdAt: string;
}

export interface Finding {
  id: string;
  analysisRunId: string;
  projectId: string;
  title: string;
  category: CheckCategory;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  findingType: FindingType;
  description: string;
  evidence: string;
  sourceFiles: Array<{
    fileId?: string;
    filename: string;
    pageOrSheet: string;
    isApproximate?: boolean;
  }>;
  expectedValue?: string;
  observedValue?: string;
  suggestedCorrection: string;
  reasonForSuggestion: string;
  humanReviewRequired: boolean;
  status: FindingReviewStatus;
  reviewerComment?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  isDemoFinding: boolean;
  analysisSource: 'Rule Engine' | 'Gemini AI' | 'Demo Sample';
  createdAt: string;
}

export interface CategoryOutcome {
  category: CheckCategory;
  status: CheckRunOutcomeStatus;
  summary: string;
}

export interface AnalysisStageEvent {
  stageIndex: number;
  stageName: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  detail?: string;
  timestamp?: string;
}

export interface AnalysisRun {
  id: string;
  projectId: string;
  projectName?: string;
  status: 'Running' | 'Completed' | 'Failed';
  mode: 'Live AI + Rules' | 'Local Rules + Demo Fallback' | 'Demo Sample Analysis';
  isDemoMode: boolean;
  selectedChecks: CheckCategory[];
  currentStageIndex: number;
  currentStageName: string;
  currentFileBeingProcessed?: string;
  progressPercent: number;
  stages: AnalysisStageEvent[];
  overallVerdict: 'Needs Attention' | 'Review Required' | 'No Issues Detected in Checked Items';
  summaryText: string;
  categoryOutcomes: CategoryOutcome[];
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  reviewRequiredCount: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export interface TechnicalRule {
  id: string;
  ruleCode: string;
  name: string;
  groupName:
    | 'Measurements'
    | 'Dimensions and clearances'
    | 'Finishes'
    | 'Hardware'
    | 'Accessories'
    | 'Lighting'
    | 'Mechanisms'
    | 'Technical feasibility'
    | 'Costing'
    | 'Missing information';
  category: CheckCategory;
  description: string;
  severity: FindingSeverity;
  enabled: boolean;
  sourceType: 'Built-in Prototype Rule' | 'Client-Configured Rule' | 'Supplied Reference Standard';
  authorityReference: string;
  thresholdValue?: string;
  comparisonOperator?: string;
  unit?: string;
  updatedAt: string;
}

export interface ReportRecord {
  id: string;
  projectId: string;
  projectName: string;
  projectReference: string;
  analysisRunId: string;
  reportDate: string;
  totalFindings: number;
  criticalHighIssues: number;
  reviewer: string;
  isDemoReport: boolean;
  notes?: string;
}

export interface ActivityLog {
  id: string;
  projectId?: string;
  projectName?: string;
  action: string;
  detail: string;
  actor: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  referenceId: string;
  projectType: ProjectCategory;
  clientName: string;
  siteLocation: string;
  description: string;
  reviewerName: string;
  status: ProjectStatus;
  isDemoProject: boolean;
  fileCount: number;
  findingCount: number;
  criticalHighCount: number;
  lastAnalysisAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SystemStatus {
  aiProvider: string;
  modelName: string;
  apiKeyConfigured: boolean;
  demoModeActive: boolean;
  maxUploadSizeMb: number;
  supportedFormats: Array<{
    extension: string;
    category: string;
    supportLevel: 'Full Local Extraction' | 'Preview + Metadata' | 'Unsupported (Export Recommended)';
    notes: string;
  }>;
  storageLocation: string;
  databasePath: string;
  uploadsDir: string;
  sqliteReady: boolean;
}
