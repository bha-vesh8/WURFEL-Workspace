import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';
import {
  ActivityLog,
  AnalysisRun,
  Finding,
  Project,
  ProjectFile,
  ReportRecord,
  TechnicalRule,
} from '../types.ts';

function resolveDataDir(): string {
  if (process.env.DATA_DIR) {
    return path.resolve(process.cwd(), process.env.DATA_DIR);
  }
  if (process.env.VERCEL) {
    return path.join('/tmp', 'wurfel_data');
  }
  try {
    const local = path.resolve(process.cwd(), './data');
    if (!fs.existsSync(local)) {
      fs.mkdirSync(local, { recursive: true });
    }
    return local;
  } catch {
    return path.join('/tmp', 'wurfel_data');
  }
}

const DATA_DIR = resolveDataDir();
const DB_FILE = path.join(DATA_DIR, 'wurfel.sqlite');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Warning: Could not create persistent data directories, using memory only:', e);
}

let dbInstance: Database | null = null;

export function saveDb(): void {
  if (!dbInstance) return;
  const data = dbInstance.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    // If older db file existed, migrate or initialize fresh
    const oldDbFile = path.join(DATA_DIR, 'dossierai.sqlite');
    if (fs.existsSync(oldDbFile)) {
      const fileBuffer = fs.readFileSync(oldDbFile);
      dbInstance = new SQL.Database(fileBuffer);
    } else {
      dbInstance = new SQL.Database();
    }
  }

  initSchema(dbInstance);
  seedDefaultRulesIfNeeded(dbInstance);
  saveDb();
  return dbInstance;
}

function initSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      referenceId TEXT NOT NULL,
      projectType TEXT NOT NULL,
      clientName TEXT DEFAULT '',
      siteLocation TEXT DEFAULT '',
      description TEXT DEFAULT '',
      reviewerName TEXT DEFAULT '',
      status TEXT NOT NULL,
      isDemoProject INTEGER DEFAULT 0,
      lastAnalysisAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_files (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      filename TEXT NOT NULL,
      originalName TEXT NOT NULL,
      fileType TEXT NOT NULL,
      extension TEXT NOT NULL,
      fileSize INTEGER NOT NULL,
      role TEXT NOT NULL,
      suggestedRole TEXT NOT NULL,
      uploadStatus TEXT NOT NULL,
      extractionStatus TEXT NOT NULL,
      extractionMethod TEXT NOT NULL,
      extractedText TEXT DEFAULT '',
      pagesJson TEXT DEFAULT '[]',
      warningsJson TEXT DEFAULT '[]',
      ocrConfidence REAL,
      isDemoSynthetic INTEGER DEFAULT 0,
      unsupportedReason TEXT,
      recommendedFormat TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analysis_runs (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      isDemoMode INTEGER DEFAULT 0,
      selectedChecksJson TEXT NOT NULL,
      currentStageIndex INTEGER DEFAULT 0,
      currentStageName TEXT DEFAULT '',
      currentFileBeingProcessed TEXT,
      progressPercent INTEGER DEFAULT 0,
      stagesJson TEXT DEFAULT '[]',
      overallVerdict TEXT DEFAULT 'Review Required',
      summaryText TEXT DEFAULT '',
      categoryOutcomesJson TEXT DEFAULT '[]',
      errorMessage TEXT,
      startedAt TEXT NOT NULL,
      completedAt TEXT,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY,
      analysisRunId TEXT NOT NULL,
      projectId TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      confidence TEXT NOT NULL,
      findingType TEXT NOT NULL,
      description TEXT NOT NULL,
      evidence TEXT NOT NULL,
      sourceFilesJson TEXT NOT NULL,
      expectedValue TEXT,
      observedValue TEXT,
      suggestedCorrection TEXT NOT NULL,
      reasonForSuggestion TEXT NOT NULL,
      humanReviewRequired INTEGER DEFAULT 1,
      status TEXT NOT NULL,
      reviewerComment TEXT,
      reviewedBy TEXT,
      reviewedAt TEXT,
      isDemoFinding INTEGER DEFAULT 0,
      analysisSource TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS technical_rules (
      id TEXT PRIMARY KEY,
      ruleCode TEXT NOT NULL,
      name TEXT NOT NULL,
      groupName TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      sourceType TEXT NOT NULL,
      authorityReference TEXT NOT NULL,
      thresholdValue TEXT,
      comparisonOperator TEXT,
      unit TEXT,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      projectName TEXT NOT NULL,
      projectReference TEXT NOT NULL,
      analysisRunId TEXT NOT NULL,
      reportDate TEXT NOT NULL,
      totalFindings INTEGER NOT NULL,
      criticalHighIssues INTEGER NOT NULL,
      reviewer TEXT NOT NULL,
      isDemoReport INTEGER DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      projectId TEXT,
      projectName TEXT,
      action TEXT NOT NULL,
      detail TEXT NOT NULL,
      actor TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);
}

const DEFAULT_RULES: Omit<TechnicalRule, 'updatedAt'>[] = [
  {
    id: 'rule-meas-01',
    ruleCode: 'FR-TOL-01',
    name: 'Site-to-Dossier Wall Length Tolerance',
    groupName: 'Measurements',
    category: 'FR measurements and site constraints',
    description:
      'Flags when total cabinet run plus filler panels in the Technical Dossier differs from the FR site laser measurement by more than the configured tolerance.',
    severity: 'Critical',
    enabled: true,
    sourceType: 'Client-Configured Rule',
    authorityReference: 'Illustrative Example — Workshop Survey Tolerance Standard',
    thresholdValue: '15',
    comparisonOperator: '<=',
    unit: 'mm',
  },
  {
    id: 'rule-meas-02',
    ruleCode: 'FR-OBS-02',
    name: 'Structural Column & Service Pipe Clearance Verification',
    groupName: 'Measurements',
    category: 'FR measurements and site constraints',
    description:
      'Requires explicit notch or depth reduction callout when an FR site survey records a structural pillar, soil stack, or gas riser along a cabinet wall.',
    severity: 'High',
    enabled: true,
    sourceType: 'Built-in Prototype Rule',
    authorityReference: 'Built-in Prototype Check — Site Constraint Cross-Check',
    thresholdValue: '50',
    comparisonOperator: '>=',
    unit: 'mm',
  },
  {
    id: 'rule-dim-01',
    ruleCode: 'DIM-FILL-01',
    name: 'Minimum Wall Filler Width for 90° Door Opening',
    groupName: 'Dimensions and clearances',
    category: 'Dimensions and clearances',
    description:
      'Checks that hinged tall units or base cabinets adjacent to a return wall include a minimum filler strip width so handles clear wall plaster.',
    severity: 'High',
    enabled: true,
    sourceType: 'Client-Configured Rule',
    authorityReference: 'Illustrative Example — Client Installation Clearance Policy',
    thresholdValue: '45',
    comparisonOperator: '>=',
    unit: 'mm',
  },
  {
    id: 'rule-dim-02',
    ruleCode: 'DIM-WARD-02',
    name: 'Internal Hanging Rail Depth Verification',
    groupName: 'Dimensions and clearances',
    category: 'Dimensions and clearances',
    description:
      'Flags wardrobe carcasses with standard coat hangers when internal clear depth is below threshold.',
    severity: 'Medium',
    enabled: true,
    sourceType: 'Client-Configured Rule',
    authorityReference: 'Illustrative Example — Wardrobe Ergonomic Guideline',
    thresholdValue: '550',
    comparisonOperator: '>=',
    unit: 'mm',
  },
  {
    id: 'rule-fin-01',
    ruleCode: 'FIN-MATCH-01',
    name: 'Front & Visible End-Panel Finish Code Parity',
    groupName: 'Finishes',
    category: 'Colours and finishes',
    description:
      'Compares lacquer/melamine finish codes between TeoWin export BOM, technical dossier schedule, and costing sheet.',
    severity: 'High',
    enabled: true,
    sourceType: 'Built-in Prototype Rule',
    authorityReference: 'Built-in Prototype Check — Cross-Document Finish Code Parity',
    thresholdValue: 'Exact Code Match',
    comparisonOperator: '==',
    unit: 'code',
  },
  {
    id: 'rule-hw-01',
    ruleCode: 'HW-HINGE-01',
    name: 'Tall Door Height to Hinge Count Requirement',
    groupName: 'Hardware',
    category: 'Hinges and hardware',
    description:
      'Verifies that doors exceeding 1600mm height or heavy 22mm MDF fronts specify at least 4 hinges per door leaf in the hardware schedule.',
    severity: 'High',
    enabled: true,
    sourceType: 'Supplied Reference Standard',
    authorityReference: 'Illustrative Example — Hardware Supplier Technical Sheet Reference',
    thresholdValue: '4',
    comparisonOperator: '>=',
    unit: 'hinges/leaf',
  },
  {
    id: 'rule-acc-01',
    ruleCode: 'ACC-REF-01',
    name: 'Internal Drawer & Pull-Out Carcass Width Match',
    groupName: 'Accessories',
    category: 'Accessories and compatibility',
    description:
      'Cross-checks internal pull-out pantry, cutlery insert, and shoe rack nominal module widths against the host cabinet external width.',
    severity: 'High',
    enabled: true,
    sourceType: 'Built-in Prototype Rule',
    authorityReference: 'Built-in Prototype Check — Module Nominal Width Match',
    thresholdValue: '0',
    comparisonOperator: '==',
    unit: 'mm delta',
  },
  {
    id: 'rule-light-01',
    ruleCode: 'LGT-DRV-01',
    name: 'LED Strip Wattage & Driver Capacity Specification',
    groupName: 'Lighting',
    category: 'Lighting type, quantity, and positioning',
    description:
      'Checks that LED profiles and wardrobe sensor bars have matching quantities across drawings and costing, and include a 24V driver load margin.',
    severity: 'Medium',
    enabled: true,
    sourceType: 'Client-Configured Rule',
    authorityReference: 'Illustrative Example — Electrical Pre-Assembly Checklist',
    thresholdValue: '20',
    comparisonOperator: '>=',
    unit: '% driver headroom',
  },
  {
    id: 'rule-mech-01',
    ruleCode: 'MECH-PKT-01',
    name: 'Pocket Door & Lift Mechanism Technical Detail Requirement',
    groupName: 'Mechanisms',
    category: 'Mechanisms and moving components',
    description:
      'Requires dedicated workshop section drawing and spindle/recess clearance notes whenever pocket doors or bi-fold lift systems are specified.',
    severity: 'High',
    enabled: true,
    sourceType: 'Client-Configured Rule',
    authorityReference: 'Illustrative Example — Special Mechanism QA Gate',
    thresholdValue: 'Required',
    comparisonOperator: '==',
    unit: 'drawing sheet',
  },
  {
    id: 'rule-feas-01',
    ruleCode: 'FEAS-SPAN-01',
    name: 'Unsupported Shelf & Worktop Overhang Span Review',
    groupName: 'Technical feasibility',
    category: 'Technical feasibility',
    description:
      'Flags unsupported shelf spans > 900mm in 18mm board or breakfast bar overhangs > 300mm without steel support brackets for technical review.',
    severity: 'Medium',
    enabled: true,
    sourceType: 'Client-Configured Rule',
    authorityReference: 'Illustrative Example — Workshop Structural Span Guideline',
    thresholdValue: '900',
    comparisonOperator: '<=',
    unit: 'mm max span',
  },
  {
    id: 'rule-cost-01',
    ruleCode: 'COST-VAR-01',
    name: 'Costing Line-Item Arithmetic & BOM Quantity Reconciliation',
    groupName: 'Costing',
    category: 'Costing consistency',
    description:
      'Programmatically recalculates unit price × quantity totals and compares BOM quantities in TeoWin export against Costing Sheet lines.',
    severity: 'Critical',
    enabled: true,
    sourceType: 'Built-in Prototype Rule',
    authorityReference: 'Built-in Prototype Check — Deterministic Arithmetic Verifier',
    thresholdValue: '1.00',
    comparisonOperator: '<=',
    unit: 'EUR variance',
  },
  {
    id: 'rule-miss-01',
    ruleCode: 'MISS-SPEC-01',
    name: 'Mandatory Cutout & Handle Drilling Orientation Callout',
    groupName: 'Missing information',
    category: 'Missing information and unclear instructions',
    description:
      'Flags missing hob/sink cutout templates, unspecified handle drilling positions, or custom mitre/scribe assemblies lacking shop notes.',
    severity: 'High',
    enabled: true,
    sourceType: 'Built-in Prototype Rule',
    authorityReference: 'Built-in Prototype Check — Production Completeness Checklist',
    thresholdValue: 'Complete',
    comparisonOperator: '==',
    unit: 'specification',
  },
];

function seedDefaultRulesIfNeeded(db: Database): void {
  const res = db.exec('SELECT COUNT(*) as cnt FROM technical_rules');
  const count = res[0]?.values?.[0]?.[0] as number;
  if (count && count > 0) return;

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO technical_rules (
      id, ruleCode, name, groupName, category, description, severity,
      enabled, sourceType, authorityReference, thresholdValue, comparisonOperator, unit, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const r of DEFAULT_RULES) {
    stmt.run([
      r.id,
      r.ruleCode,
      r.name,
      r.groupName,
      r.category,
      r.description,
      r.severity,
      r.enabled ? 1 : 0,
      r.sourceType,
      r.authorityReference,
      r.thresholdValue || null,
      r.comparisonOperator || null,
      r.unit || null,
      now,
    ]);
  }
  stmt.free();
}

export function queryAll<T>(db: Database, sql: string, params: (string | number | null)[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T>(db: Database, sql: string, params: (string | number | null)[] = []): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function logActivity(
  db: Database,
  action: string,
  detail: string,
  actor = 'Elena Rostova (Lead Technical Reviewer)',
  projectId?: string,
  projectName?: string
): void {
  const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO activity_logs (id, projectId, projectName, action, detail, actor, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, projectId || null, projectName || null, action, detail, actor, now]
  );
  saveDb();
}

export function mapProjectRow(db: Database, row: Record<string, any>): Project {
  const filesRes = queryOne<{ cnt: number }>(
    db,
    'SELECT COUNT(*) as cnt FROM project_files WHERE projectId = ?',
    [row.id]
  );
  const findingsRes = queryOne<{ cnt: number }>(
    db,
    'SELECT COUNT(*) as cnt FROM findings WHERE projectId = ?',
    [row.id]
  );
  const critHighRes = queryOne<{ cnt: number }>(
    db,
    "SELECT COUNT(*) as cnt FROM findings WHERE projectId = ? AND severity IN ('Critical', 'High')",
    [row.id]
  );

  return {
    id: String(row.id),
    name: String(row.name),
    referenceId: String(row.referenceId),
    projectType: row.projectType as Project['projectType'],
    clientName: String(row.clientName || ''),
    siteLocation: String(row.siteLocation || ''),
    description: String(row.description || ''),
    reviewerName: String(row.reviewerName || ''),
    status: row.status as Project['status'],
    isDemoProject: Boolean(row.isDemoProject),
    fileCount: Number(filesRes?.cnt || 0),
    findingCount: Number(findingsRes?.cnt || 0),
    criticalHighCount: Number(critHighRes?.cnt || 0),
    lastAnalysisAt: row.lastAnalysisAt ? String(row.lastAnalysisAt) : undefined,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export function mapFileRow(row: Record<string, any>): ProjectFile {
  return {
    id: String(row.id),
    projectId: String(row.projectId),
    filename: String(row.filename),
    originalName: String(row.originalName),
    fileType: String(row.fileType),
    extension: String(row.extension),
    fileSize: Number(row.fileSize),
    role: row.role as ProjectFile['role'],
    suggestedRole: row.suggestedRole as ProjectFile['suggestedRole'],
    uploadStatus: row.uploadStatus as ProjectFile['uploadStatus'],
    extractionStatus: row.extractionStatus as ProjectFile['extractionStatus'],
    extractionMethod: String(row.extractionMethod),
    extractedText: String(row.extractedText || ''),
    pages: JSON.parse(String(row.pagesJson || '[]')),
    warnings: JSON.parse(String(row.warningsJson || '[]')),
    ocrConfidence: row.ocrConfidence !== null && row.ocrConfidence !== undefined ? Number(row.ocrConfidence) : undefined,
    isDemoSynthetic: Boolean(row.isDemoSynthetic),
    unsupportedReason: row.unsupportedReason ? String(row.unsupportedReason) : undefined,
    recommendedFormat: row.recommendedFormat ? String(row.recommendedFormat) : undefined,
    createdAt: String(row.createdAt),
  };
}

export function mapFindingRow(row: Record<string, any>): Finding {
  return {
    id: String(row.id),
    analysisRunId: String(row.analysisRunId),
    projectId: String(row.projectId),
    title: String(row.title),
    category: row.category as Finding['category'],
    severity: row.severity as Finding['severity'],
    confidence: row.confidence as Finding['confidence'],
    findingType: row.findingType as Finding['findingType'],
    description: String(row.description),
    evidence: String(row.evidence),
    sourceFiles: JSON.parse(String(row.sourceFilesJson || '[]')),
    expectedValue: row.expectedValue ? String(row.expectedValue) : undefined,
    observedValue: row.observedValue ? String(row.observedValue) : undefined,
    suggestedCorrection: String(row.suggestedCorrection),
    reasonForSuggestion: String(row.reasonForSuggestion),
    humanReviewRequired: Boolean(row.humanReviewRequired),
    status: row.status as Finding['status'],
    reviewerComment: row.reviewerComment ? String(row.reviewerComment) : undefined,
    reviewedBy: row.reviewedBy ? String(row.reviewedBy) : undefined,
    reviewedAt: row.reviewedAt ? String(row.reviewedAt) : undefined,
    isDemoFinding: Boolean(row.isDemoFinding),
    analysisSource: row.analysisSource as Finding['analysisSource'],
    createdAt: String(row.createdAt),
  };
}

export function mapAnalysisRunRow(db: Database, row: Record<string, any>): AnalysisRun {
  const counts = queryAll<{ severity: string; cnt: number }>(
    db,
    'SELECT severity, COUNT(*) as cnt FROM findings WHERE analysisRunId = ? GROUP BY severity',
    [row.id]
  );
  const reviewReq = queryOne<{ cnt: number }>(
    db,
    'SELECT COUNT(*) as cnt FROM findings WHERE analysisRunId = ? AND humanReviewRequired = 1',
    [row.id]
  );
  const proj = queryOne<{ name: string }>(db, 'SELECT name FROM projects WHERE id = ?', [row.projectId]);

  const countMap: Record<string, number> = {};
  let total = 0;
  for (const c of counts) {
    countMap[c.severity] = Number(c.cnt);
    total += Number(c.cnt);
  }

  return {
    id: String(row.id),
    projectId: String(row.projectId),
    projectName: proj?.name,
    status: row.status as AnalysisRun['status'],
    mode: row.mode as AnalysisRun['mode'],
    isDemoMode: Boolean(row.isDemoMode),
    selectedChecks: JSON.parse(String(row.selectedChecksJson || '[]')),
    currentStageIndex: Number(row.currentStageIndex || 0),
    currentStageName: String(row.currentStageName || ''),
    currentFileBeingProcessed: row.currentFileBeingProcessed ? String(row.currentFileBeingProcessed) : undefined,
    progressPercent: Number(row.progressPercent || 0),
    stages: JSON.parse(String(row.stagesJson || '[]')),
    overallVerdict: row.overallVerdict as AnalysisRun['overallVerdict'],
    summaryText: String(row.summaryText || ''),
    categoryOutcomes: JSON.parse(String(row.categoryOutcomesJson || '[]')),
    findingsCount: total,
    criticalCount: countMap['Critical'] || 0,
    highCount: countMap['High'] || 0,
    mediumCount: countMap['Medium'] || 0,
    lowCount: countMap['Low'] || 0,
    infoCount: countMap['Informational'] || 0,
    reviewRequiredCount: Number(reviewReq?.cnt || 0),
    errorMessage: row.errorMessage ? String(row.errorMessage) : undefined,
    startedAt: String(row.startedAt),
    completedAt: row.completedAt ? String(row.completedAt) : undefined,
  };
}

export function mapRuleRow(row: Record<string, any>): TechnicalRule {
  return {
    id: String(row.id),
    ruleCode: String(row.ruleCode),
    name: String(row.name),
    groupName: row.groupName as TechnicalRule['groupName'],
    category: row.category as TechnicalRule['category'],
    description: String(row.description),
    severity: row.severity as TechnicalRule['severity'],
    enabled: Boolean(row.enabled),
    sourceType: row.sourceType as TechnicalRule['sourceType'],
    authorityReference: String(row.authorityReference),
    thresholdValue: row.thresholdValue ? String(row.thresholdValue) : undefined,
    comparisonOperator: row.comparisonOperator ? String(row.comparisonOperator) : undefined,
    unit: row.unit ? String(row.unit) : undefined,
    updatedAt: String(row.updatedAt),
  };
}

export function mapReportRow(row: Record<string, any>): ReportRecord {
  return {
    id: String(row.id),
    projectId: String(row.projectId),
    projectName: String(row.projectName || ''),
    projectReference: String(row.projectReference || ''),
    analysisRunId: String(row.analysisRunId || ''),
    reportDate: String(row.reportDate),
    totalFindings: Number(row.totalFindings || 0),
    criticalHighIssues: Number(row.criticalHighIssues || 0),
    reviewer: String(row.reviewer || ''),
    isDemoReport: Boolean(row.isDemoReport),
    notes: row.notes ? String(row.notes) : undefined,
  };
}

export function mapActivityRow(row: Record<string, any>): ActivityLog {
  return {
    id: String(row.id),
    projectId: row.projectId ? String(row.projectId) : undefined,
    projectName: row.projectName ? String(row.projectName) : undefined,
    action: String(row.action),
    detail: String(row.detail),
    actor: String(row.actor),
    createdAt: String(row.createdAt),
  };
}

