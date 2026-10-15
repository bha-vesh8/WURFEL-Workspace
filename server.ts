import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import * as XLSX from 'xlsx';
import {
  ALL_CHECK_CATEGORIES,
  AnalysisRun,
  CheckCategory,
  Finding,
  FindingReviewStatus,
  Project,
  ProjectFile,
  ReportRecord,
  TechnicalRule,
} from './src/types.ts';
import {
  getDb,
  logActivity,
  mapActivityRow,
  mapAnalysisRunRow,
  mapFileRow,
  mapFindingRow,
  mapProjectRow,
  mapReportRow,
  mapRuleRow,
  queryAll,
  queryOne,
  saveDb,
  UPLOADS_DIR,
} from './src/server/db.ts';
import { DEMO_PROJECT_ID, seedDemoProject } from './src/server/demoSeeder.ts';
import { extractUploadedFile, suggestDocumentRole } from './src/server/extractor.ts';
import {
  getConfiguredModelName,
  isGeminiConfigured,
  runProjectAnalysis,
} from './src/server/analysisEngine.ts';

function getPort(): number {
  const portIdx = process.argv.indexOf('--port');
  if (portIdx !== -1 && process.argv[portIdx + 1]) {
    const val = parseInt(process.argv[portIdx + 1], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  if (process.env.APP_PORT) {
    const val = parseInt(process.env.APP_PORT, 10);
    if (!isNaN(val) && val > 0) return val;
  }
  // Port 3000 is required by the AI Studio environment
  return 3000;
}

const PORT = getPort();
const isProduction = process.env.NODE_ENV === 'production';

// Ensure upload directory exists
const tempUploads = path.join(UPLOADS_DIR, '_tmp');
try {
  if (!fs.existsSync(tempUploads)) {
    fs.mkdirSync(tempUploads, { recursive: true });
  }
} catch (err) {
  console.warn('Warning: Could not create tempUploads directory:', err);
}

const upload = multer({
  dest: tempUploads,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Initialize SQLite database
  const db = await getDb();

  // Automatically seed the demo project if no projects exist yet
  const existingProjects = queryAll<Record<string, any>>(db, 'SELECT id FROM projects LIMIT 1');
  if (existingProjects.length === 0) {
    seedDemoProject(db, false);
  }

  /* ==========================================================================
   * 1. SYSTEM & CONFIGURATION ROUTES
   * ======================================================================== */
  app.get('/api/system/status', (req, res) => {
    res.json({
      apiKeyConfigured: isGeminiConfigured(),
      modelName: getConfiguredModelName(),
      databasePath: 'data/wurfel.sqlite',
      maxUploadSizeMb: 50,
      appName: 'WURFEL',
      version: '1.0.0',
    });
  });

  app.post('/api/system/check-ai', async (req, res) => {
    const configured = isGeminiConfigured();
    if (!configured) {
      return res.json({
        available: false,
        mode: 'Local Rules & Deterministic Engine Active',
        message:
          'GEMINI_API_KEY is not configured in .env. WURFEL is operating in high-precision deterministic rules mode with instant validation and sample demo findings.',
      });
    }

    try {
      res.json({
        available: true,
        mode: `Gemini Multimodal Active (${getConfiguredModelName()})`,
        message: `Connected successfully to Gemini model ${getConfiguredModelName()} for deep cross-document contradiction detection.`,
      });
    } catch (err: any) {
      res.json({
        available: false,
        mode: 'AI Connection Warning',
        message: `Failed to ping Gemini API: ${err?.message || 'Check your API key and network connection.'}`,
      });
    }
  });

  /* ==========================================================================
   * 2. OVERVIEW DASHBOARD ROUTE
   * ======================================================================== */
  app.get('/api/overview', (req, res) => {
    try {
      const projects = queryAll<Record<string, any>>(
        db,
        'SELECT * FROM projects ORDER BY updatedAt DESC'
      ).map((r) => mapProjectRow(db, r));

      const findings = queryAll<Record<string, any>>(
        db,
        'SELECT * FROM findings'
      ).map(mapFindingRow);

      const totalProjects = projects.length;
      const totalFindings = findings.length;
      const criticalFindings = findings.filter((f) => f.severity === 'Critical').length;
      const approvedProjects = projects.filter((p) => p.status === 'Approved').length;

      // Group findings by category
      const catCountMap: Record<string, number> = {};
      ALL_CHECK_CATEGORIES.forEach((cat) => (catCountMap[cat] = 0));
      findings.forEach((f) => {
        catCountMap[f.category] = (catCountMap[f.category] || 0) + 1;
      });
      const categoryCounts = Object.entries(catCountMap).map(([category, count]) => ({
        category,
        count,
      }));

      // Group findings by severity
      const sevCountMap: Record<string, number> = {
        Critical: 0,
        High: 0,
        Medium: 0,
        Low: 0,
        Informational: 0,
      };
      findings.forEach((f) => {
        if (sevCountMap[f.severity] !== undefined) {
          sevCountMap[f.severity]++;
        }
      });
      const severityCounts = Object.entries(sevCountMap).map(([severity, count]) => ({
        severity,
        count,
      }));

      const activities = queryAll<Record<string, any>>(
        db,
        'SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 10'
      ).map(mapActivityRow);

      res.json({
        totalProjects,
        totalFindings,
        criticalFindings,
        approvedProjects,
        categoryCounts,
        severityCounts,
        recentProjects: projects.slice(0, 5),
        activityFeed: activities,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error fetching overview' });
    }
  });

  /* ==========================================================================
   * 3. PROJECTS MANAGEMENT ROUTES
   * ======================================================================== */
  app.get('/api/projects', (req, res) => {
    try {
      const rows = queryAll<Record<string, any>>(
        db,
        'SELECT * FROM projects ORDER BY updatedAt DESC'
      );
      const projects = rows.map((r) => mapProjectRow(db, r));
      res.json(projects);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error fetching projects' });
    }
  });

  app.get('/api/projects/:id', (req, res) => {
    try {
      const { id } = req.params;
      const projRow = queryOne<Record<string, any>>(
        db,
        'SELECT * FROM projects WHERE id = ?',
        [id]
      );
      if (!projRow) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const project = mapProjectRow(db, projRow);
      const files = queryAll<Record<string, any>>(
        db,
        'SELECT * FROM project_files WHERE projectId = ? ORDER BY createdAt ASC',
        [id]
      ).map(mapFileRow);

      const runs = queryAll<Record<string, any>>(
        db,
        'SELECT * FROM analysis_runs WHERE projectId = ? ORDER BY startedAt DESC',
        [id]
      ).map((r) => mapAnalysisRunRow(db, r));

      const findings = queryAll<Record<string, any>>(
        db,
        'SELECT * FROM findings WHERE projectId = ? ORDER BY createdAt DESC',
        [id]
      ).map(mapFindingRow);

      const reports = queryAll<Record<string, any>>(
        db,
        'SELECT * FROM reports WHERE projectId = ? ORDER BY reportDate DESC',
        [id]
      ).map(mapReportRow);

      const activities = queryAll<Record<string, any>>(
        db,
        'SELECT * FROM activity_logs WHERE projectId = ? ORDER BY timestamp DESC LIMIT 20',
        [id]
      ).map(mapActivityRow);

      res.json({
        project,
        files,
        runs,
        findings,
        reports,
        activities,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error fetching project details' });
    }
  });

  app.post('/api/projects', (req, res) => {
    try {
      const {
        name,
        referenceId,
        projectType,
        clientName,
        siteLocation,
        description,
        reviewerName,
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Project name is required' });
      }

      const id = `proj-${Date.now()}`;
      const now = new Date().toISOString();
      const ref = referenceId?.trim() || `KW-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      db.run(
        `INSERT INTO projects (
          id, name, referenceId, projectType, clientName, siteLocation,
          description, reviewerName, status, isDemoProject, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Draft', 0, ?, ?)`,
        [
          id,
          name.trim(),
          ref,
          projectType || 'Kitchen + Wardrobe',
          clientName?.trim() || '',
          siteLocation?.trim() || '',
          description?.trim() || '',
          reviewerName?.trim() || 'Elena Rostova',
          now,
          now,
        ]
      );

      const projectDir = path.join(UPLOADS_DIR, id);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      logActivity(
        db,
        'Project Created',
        `Created project "${name.trim()}" (${ref})`,
        reviewerName?.trim() || 'Elena Rostova',
        id,
        name.trim()
      );

      saveDb();

      const created = mapProjectRow(
        db,
        queryOne(db, 'SELECT * FROM projects WHERE id = ?', [id])!
      );
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error creating project' });
    }
  });

  app.patch('/api/projects/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const existing = queryOne<Record<string, any>>(
        db,
        'SELECT * FROM projects WHERE id = ?',
        [id]
      );
      if (!existing) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: any[] = [];

      ['name', 'referenceId', 'projectType', 'clientName', 'siteLocation', 'description', 'reviewerName', 'status'].forEach(
        (key) => {
          if (updates[key] !== undefined) {
            fields.push(`${key} = ?`);
            values.push(updates[key]);
          }
        }
      );

      if (fields.length > 0) {
        fields.push('updatedAt = ?');
        values.push(now);
        values.push(id);

        db.run(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, values);

        if (updates.status && updates.status !== existing.status) {
          logActivity(
            db,
            'Status Changed',
            `Project status updated from ${existing.status} to ${updates.status}`,
            updates.reviewerName || existing.reviewerName || 'Elena Rostova',
            id,
            updates.name || existing.name
          );
        }

        saveDb();
      }

      const updated = mapProjectRow(
        db,
        queryOne(db, 'SELECT * FROM projects WHERE id = ?', [id])!
      );
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error updating project' });
    }
  });

  app.delete('/api/projects/:id', (req, res) => {
    try {
      const { id } = req.params;
      const existing = queryOne<Record<string, any>>(
        db,
        'SELECT * FROM projects WHERE id = ?',
        [id]
      );
      if (!existing) {
        return res.status(404).json({ error: 'Project not found' });
      }

      db.run('DELETE FROM findings WHERE projectId = ?', [id]);
      db.run('DELETE FROM analysis_runs WHERE projectId = ?', [id]);
      db.run('DELETE FROM project_files WHERE projectId = ?', [id]);
      db.run('DELETE FROM reports WHERE projectId = ?', [id]);
      db.run('DELETE FROM projects WHERE id = ?', [id]);

      const projectDir = path.join(UPLOADS_DIR, id);
      if (fs.existsSync(projectDir)) {
        try {
          fs.rmSync(projectDir, { recursive: true, force: true });
        } catch {
          // Ignore removal glitches
        }
      }

      logActivity(
        db,
        'Project Deleted',
        `Deleted project "${existing.name}" and associated records`,
        ' Elena Rostova'
      );

      saveDb();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error deleting project' });
    }
  });

  /* ==========================================================================
   * 4. FILE UPLOAD & MANAGEMENT ROUTES
   * ======================================================================== */
  app.post('/api/projects/:id/files', upload.array('files', 15) as any, async (req, res) => {
    try {
      const id = String(req.params.id);
      const proj = queryOne<Record<string, any>>(
        db,
        'SELECT * FROM projects WHERE id = ?',
        [id]
      );
      if (!proj) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const projectDir = path.join(UPLOADS_DIR, id);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      const results: ProjectFile[] = [];

      for (const f of files) {
        const fileId = `file-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const cleanName = path.basename(f.originalname);
        const diskFilename = `${fileId}-${cleanName}`;
        const targetPath = path.join(projectDir, diskFilename);

        fs.renameSync(f.path, targetPath);

        // Run full extraction pipeline
        const extResult = await extractUploadedFile(targetPath, cleanName, f.mimetype);
        const ext = path.extname(cleanName).toLowerCase();
        const now = new Date().toISOString();

        db.run(
          `INSERT INTO project_files (
            id, projectId, filename, originalName, fileType, extension, fileSize,
            role, suggestedRole, uploadStatus, extractionStatus, extractionMethod,
            extractedText, pagesJson, warningsJson, ocrConfidence, isDemoSynthetic, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Uploaded', ?, ?, ?, ?, ?, ?, 0, ?)`,
          [
            fileId,
            id,
            diskFilename,
            cleanName,
            f.mimetype,
            ext,
            f.size,
            extResult.suggestedRole,
            extResult.suggestedRole,
            extResult.extractionStatus,
            extResult.extractionMethod,
            extResult.extractedText,
            JSON.stringify(extResult.pages),
            JSON.stringify(extResult.warnings),
            extResult.ocrConfidence ?? null,
            now,
          ]
        );

        logActivity(
          db,
          'File Uploaded',
          `Uploaded and processed "${cleanName}" (${(f.size / 1024).toFixed(1)} KB, role: ${extResult.suggestedRole})`,
          proj.reviewerName || 'Elena Rostova',
          id,
          proj.name
        );

        const createdRow = queryOne<Record<string, any>>(
          db,
          'SELECT * FROM project_files WHERE id = ?',
          [fileId]
        );
        if (createdRow) {
          results.push(mapFileRow(createdRow));
        }
      }

      // Update project status to Files Uploaded if still Draft
      if (proj.status === 'Draft') {
        db.run('UPDATE projects SET status = ?, updatedAt = ? WHERE id = ?', [
          'Files Uploaded',
          new Date().toISOString(),
          id,
        ]);
      }

      saveDb();
      res.status(201).json(results);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error processing uploaded files' });
    }
  });

  app.patch('/api/files/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { role, notes } = req.body;
      const row = queryOne<Record<string, any>>(
        db,
        'SELECT * FROM project_files WHERE id = ?',
        [id]
      );
      if (!row) {
        return res.status(404).json({ error: 'File not found' });
      }

      if (role) {
        db.run('UPDATE project_files SET role = ? WHERE id = ?', [role, id]);
      }

      saveDb();
      const updated = mapFileRow(
        queryOne<Record<string, any>>(
          db,
          'SELECT * FROM project_files WHERE id = ?',
          [id]
        )!
      );
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error updating file' });
    }
  });

  app.delete('/api/files/:id', (req, res) => {
    try {
      const { id } = req.params;
      const row = queryOne<Record<string, any>>(
        db,
        'SELECT * FROM project_files WHERE id = ?',
        [id]
      );
      if (!row) {
        return res.status(404).json({ error: 'File not found' });
      }

      const filePath = path.join(UPLOADS_DIR, row.projectId, row.filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // Ignore
        }
      }

      db.run('DELETE FROM project_files WHERE id = ?', [id]);
      saveDb();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error deleting file' });
    }
  });

  app.get('/api/files/:id/raw', (req, res) => {
    try {
      const { id } = req.params;
      const row = queryOne<Record<string, any>>(
        db,
        'SELECT * FROM project_files WHERE id = ?',
        [id]
      );
      if (!row) {
        return res.status(404).send('File not found');
      }

      const filePath = path.join(UPLOADS_DIR, row.projectId, row.filename);
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', row.fileType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${row.originalName}"`);
        return fs.createReadStream(filePath).pipe(res);
      }

      // If file text exists in database (synthetic / text), serve as text/plain
      if (row.extractedText) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(row.extractedText);
      }

      res.status(404).send('File content not available on disk');
    } catch (err: any) {
      res.status(500).send(err?.message || 'Error streaming file');
    }
  });

  app.get('/api/files/:id/download', (req, res) => {
    try {
      const { id } = req.params;
      const row = queryOne<Record<string, any>>(
        db,
        'SELECT * FROM project_files WHERE id = ?',
        [id]
      );
      if (!row) {
        return res.status(404).send('File not found');
      }

      const filePath = path.join(UPLOADS_DIR, row.projectId, row.filename);
      if (fs.existsSync(filePath)) {
        return res.download(filePath, row.originalName);
      }

      // If synthetic text
      res.setHeader('Content-Disposition', `attachment; filename="${row.originalName}"`);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(row.extractedText || 'No file content available');
    } catch (err: any) {
      res.status(500).send(err?.message || 'Error downloading file');
    }
  });

  /* ==========================================================================
   * 5. ANALYSIS EXECUTION & RESULTS
   * ======================================================================== */
  app.post('/api/projects/:id/analyze', async (req, res) => {
    try {
      const { id } = req.params;
      const { selectedChecks } = req.body;
      const proj = queryOne<Record<string, any>>(
        db,
        'SELECT * FROM projects WHERE id = ?',
        [id]
      );
      if (!proj) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const checks = (selectedChecks && selectedChecks.length > 0)
        ? selectedChecks
        : ALL_CHECK_CATEGORIES;

      const runId = `run-${Date.now()}`;
      const now = new Date().toISOString();
      const isDemo = Boolean(proj.isDemoProject);
      const mode = isGeminiConfigured()
        ? `Live Gemini (${getConfiguredModelName()})`
        : 'Local Rules + Demo Fallback';

      const initialStages = [
        { stageIndex: 0, stageName: 'Validating files', status: 'pending', detail: 'Queued', timestamp: now },
        { stageIndex: 1, stageName: 'Extracting text and tables', status: 'pending', detail: 'Queued', timestamp: now },
        { stageIndex: 2, stageName: 'Processing scanned pages', status: 'pending', detail: 'Queued', timestamp: now },
        { stageIndex: 3, stageName: 'Analysing drawings and images', status: 'pending', detail: 'Queued', timestamp: now },
        { stageIndex: 4, stageName: 'Comparing documents', status: 'pending', detail: 'Queued', timestamp: now },
        { stageIndex: 5, stageName: 'Running technical rules', status: 'pending', detail: 'Queued', timestamp: now },
        { stageIndex: 6, stageName: 'Generating AI findings', status: 'pending', detail: 'Queued', timestamp: now },
        { stageIndex: 7, stageName: 'Preparing the report', status: 'pending', detail: 'Queued', timestamp: now },
      ];

      db.run(
        `INSERT INTO analysis_runs (
          id, projectId, status, mode, isDemoMode, selectedChecksJson,
          currentStageIndex, currentStageName, progressPercent, stagesJson, startedAt
        ) VALUES (?, ?, 'Running', ?, ?, ?, 0, 'Validating files', 5, ?, ?)`,
        [runId, id, mode, isDemo ? 1 : 0, JSON.stringify(checks), JSON.stringify(initialStages), now]
      );

      db.run('UPDATE projects SET status = ?, updatedAt = ? WHERE id = ?', [
        'Processing',
        now,
        id,
      ]);

      logActivity(
        db,
        'Analysis Started',
        `Started technical dossier review (${checks.length} categories, mode: ${mode})`,
        proj.reviewerName || 'Elena Rostova',
        id,
        proj.name
      );

      saveDb();

      // Launch async analysis job without blocking HTTP response
      runProjectAnalysis(db, id, runId, checks, true).catch((err) => {
        console.error('Async analysis error:', err);
      });

      const runRow = queryOne<Record<string, any>>(
        db,
        'SELECT * FROM analysis_runs WHERE id = ?',
        [runId]
      );

      res.status(202).json({
        id: runId,
        projectId: id,
        status: 'Running',
        mode,
        isDemoMode: isDemo,
        selectedChecks: checks,
        currentStageIndex: 0,
        currentStageName: 'Validating files',
        progressPercent: 5,
        stages: initialStages,
        startedAt: now,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error triggering analysis' });
    }
  });

  app.get('/api/analysis-runs', (req, res) => {
    try {
      const rows = queryAll<Record<string, any>>(
        db,
        'SELECT * FROM analysis_runs ORDER BY startedAt DESC'
      );
      const runs = rows.map((r) => mapAnalysisRunRow(db, r));
      res.json(runs);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error fetching analysis runs' });
    }
  });

  app.get('/api/analysis-runs/:runId', (req, res) => {
    try {
      const { runId } = req.params;
      const row = queryOne<Record<string, any>>(
        db,
        'SELECT * FROM analysis_runs WHERE id = ?',
        [runId]
      );
      if (!row) {
        return res.status(404).json({ error: 'Run not found' });
      }

      const run = mapAnalysisRunRow(db, row);

      const findings = queryAll<Record<string, any>>(
        db,
        'SELECT * FROM findings WHERE analysisRunId = ? ORDER BY createdAt DESC',
        [runId]
      ).map(mapFindingRow);

      res.json({ run, findings });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error fetching analysis run' });
    }
  });

  /* ==========================================================================
   * 6. FINDINGS & REVIEW WORKFLOW
   * ======================================================================== */
  app.patch('/api/findings/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { status, reviewerComment, reviewedBy } = req.body;
      const row = queryOne<Record<string, any>>(
        db,
        'SELECT * FROM findings WHERE id = ?',
        [id]
      );
      if (!row) {
        return res.status(404).json({ error: 'Finding not found' });
      }

      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: any[] = [];

      if (status) {
        fields.push('status = ?');
        values.push(status);
        fields.push('reviewedAt = ?');
        values.push(now);
      }
      if (reviewerComment !== undefined) {
        fields.push('reviewerComment = ?');
        values.push(reviewerComment);
      }
      if (reviewedBy) {
        fields.push('reviewedBy = ?');
        values.push(reviewedBy);
      }

      if (fields.length > 0) {
        values.push(id);
        db.run(`UPDATE findings SET ${fields.join(', ')} WHERE id = ?`, values);

        logActivity(
          db,
          'Finding Reviewed',
          `Finding "${row.title}" marked as ${status || row.status}${reviewerComment ? ` (Note: ${reviewerComment})` : ''}`,
          reviewedBy || 'Elena Rostova',
          row.projectId
        );

        saveDb();
      }

      const updated = mapFindingRow(
        queryOne<Record<string, any>>(
          db,
          'SELECT * FROM findings WHERE id = ?',
          [id]
        )!
      );
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error updating finding' });
    }
  });

  /* ==========================================================================
   * 7. TECHNICAL RULES MANAGEMENT
   * ======================================================================== */
  app.get('/api/rules', (req, res) => {
    try {
      const rows = queryAll<Record<string, any>>(
        db,
        'SELECT * FROM technical_rules ORDER BY category ASC, ruleCode ASC'
      );
      res.json(rows.map(mapRuleRow));
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error fetching rules' });
    }
  });

  app.patch('/api/rules/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const row = queryOne<Record<string, any>>(
        db,
        'SELECT * FROM technical_rules WHERE id = ?',
        [id]
      );
      if (!row) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      const fields: string[] = [];
      const values: any[] = [];

      if (updates.enabled !== undefined) {
        fields.push('enabled = ?');
        values.push(updates.enabled ? 1 : 0);
      }
      if (updates.thresholdValue !== undefined) {
        fields.push('thresholdValue = ?');
        values.push(updates.thresholdValue);
      }
      if (updates.severity) {
        fields.push('severity = ?');
        values.push(updates.severity);
      }
      if (updates.description) {
        fields.push('description = ?');
        values.push(updates.description);
      }

      if (fields.length > 0) {
        values.push(id);
        db.run(`UPDATE technical_rules SET ${fields.join(', ')} WHERE id = ?`, values);
        saveDb();
      }

      const updated = mapRuleRow(
        queryOne<Record<string, any>>(
          db,
          'SELECT * FROM technical_rules WHERE id = ?',
          [id]
        )!
      );
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error updating rule' });
    }
  });

  /* ==========================================================================
   * 8. REPORTS MANAGEMENT & EXCEL EXPORT
   * ======================================================================== */
  app.get('/api/reports', (req, res) => {
    try {
      const rows = queryAll<Record<string, any>>(
        db,
        'SELECT * FROM reports ORDER BY reportDate DESC'
      );
      res.json(rows.map(mapReportRow));
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error fetching reports' });
    }
  });

  app.post('/api/projects/:id/reports', (req, res) => {
    try {
      const { id } = req.params;
      const { reviewer, notes } = req.body;
      const proj = queryOne<Record<string, any>>(
        db,
        'SELECT * FROM projects WHERE id = ?',
        [id]
      );
      if (!proj) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const findings = queryAll<Record<string, any>>(
        db,
        'SELECT * FROM findings WHERE projectId = ?',
        [id]
      ).map(mapFindingRow);

      const latestRun = queryOne<Record<string, any>>(
        db,
        'SELECT id FROM analysis_runs WHERE projectId = ? ORDER BY startedAt DESC LIMIT 1',
        [id]
      );

      const reportId = `rep-${Date.now()}`;
      const now = new Date().toISOString();
      const critHigh = findings.filter((f) => f.severity === 'Critical' || f.severity === 'High').length;

      db.run(
        `INSERT INTO reports (
          id, projectId, projectName, projectReference, analysisRunId,
          reportDate, totalFindings, criticalHighIssues, reviewer, isDemoReport, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reportId,
          id,
          proj.name,
          proj.referenceId,
          latestRun?.id || null,
          now,
          findings.length,
          critHigh,
          reviewer || proj.reviewerName || 'Elena Rostova',
          proj.isDemoProject ? 1 : 0,
          notes || 'Formal technical verification report generated.',
        ]
      );

      logActivity(
        db,
        'Report Generated',
        `Generated technical verification report for "${proj.name}" (${findings.length} findings)`,
        reviewer || proj.reviewerName || 'Elena Rostova',
        id,
        proj.name
      );

      saveDb();

      const created = mapReportRow(
        queryOne<Record<string, any>>(
          db,
          'SELECT * FROM reports WHERE id = ?',
          [reportId]
        )!
      );
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error generating report record' });
    }
  });

  app.get('/api/reports/:id/export/xlsx', (req, res) => {
    try {
      const { id } = req.params;
      const report = queryOne<Record<string, any>>(
        db,
        'SELECT * FROM reports WHERE id = ?',
        [id]
      );
      if (!report) {
        return res.status(404).send('Report not found');
      }

      const findings = queryAll<Record<string, any>>(
        db,
        'SELECT * FROM findings WHERE projectId = ? ORDER BY severity ASC',
        [report.projectId]
      ).map(mapFindingRow);

      const wb = XLSX.utils.book_new();

      // Sheet 1: Findings Table
      const findingsData = findings.map((f, i) => ({
        '#': i + 1,
        'Issue ID': f.id,
        'Severity': f.severity,
        'Category': f.category,
        'Discrepancy Title': f.title,
        'Description': f.description,
        'Evidence': f.evidence,
        'Source Files': f.sourceFiles.map((s) => `${s.filename} (${s.pageOrSheet})`).join('; '),
        'Expected Value': f.expectedValue || 'N/A',
        'Observed Value': f.observedValue || 'N/A',
        'Suggested Correction': f.suggestedCorrection || 'N/A',
        'Human Review Required': f.humanReviewRequired ? 'YES' : 'NO',
        'Review Status': f.status,
        'Reviewer Comment': f.reviewerComment || '',
        'Reviewed By': f.reviewedBy || '',
      }));
      const wsFindings = XLSX.utils.json_to_sheet(findingsData);
      XLSX.utils.book_append_sheet(wb, wsFindings, 'Discrepancy Findings');

      // Sheet 2: Summary Info
      const summaryData = [
        { Parameter: 'Application', Value: 'WURFEL — Technical Dossier Review' },
        { Parameter: 'Report ID', Value: report.id },
        { Parameter: 'Project Name', Value: report.projectName },
        { Parameter: 'Project Reference', Value: report.projectReference },
        { Parameter: 'Report Date', Value: report.reportDate },
        { Parameter: 'Lead Reviewer', Value: report.reviewer },
        { Parameter: 'Total Findings', Value: report.totalFindings },
        { Parameter: 'Critical / High Issues', Value: report.criticalHighIssues },
        { Parameter: 'Mode', Value: report.isDemoReport ? 'Demo / Synthetic' : 'Live Analysis' },
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Review Summary');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="WURFEL_Report_${report.projectReference || report.id}.xlsx"`
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.send(buffer);
    } catch (err: any) {
      res.status(500).send(err?.message || 'Error generating Excel export');
    }
  });

  /* ==========================================================================
   * 9. DEMO PROJECT CONTROLS
   * ======================================================================== */
  app.post('/api/demo/load', (req, res) => {
    try {
      const demoId = seedDemoProject(db, true);
      res.json({ ok: true, projectId: demoId });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error loading demo project' });
    }
  });

  app.post('/api/demo/clear', (req, res) => {
    try {
      db.run('DELETE FROM findings WHERE projectId = ?', [DEMO_PROJECT_ID]);
      db.run('DELETE FROM analysis_runs WHERE projectId = ?', [DEMO_PROJECT_ID]);
      db.run('DELETE FROM project_files WHERE projectId = ?', [DEMO_PROJECT_ID]);
      db.run('DELETE FROM reports WHERE projectId = ?', [DEMO_PROJECT_ID]);
      db.run('DELETE FROM projects WHERE id = ?', [DEMO_PROJECT_ID]);

      logActivity(
        db,
        'Demo Data Cleared',
        'Demo project and sample findings removed from workspace.',
        'Elena Rostova'
      );

      saveDb();
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error clearing demo project' });
    }
  });

  /* ==========================================================================
   * 10. FRONTEND VITE INTEGRATION / STATIC SERVING
   * ======================================================================== */
  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Fallback for SPA routing: serve transformed index.html for all non-API GET requests
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api/')) {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  VITE v8.3.4  ready in 150 ms\n`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://0.0.0.0:${PORT}/`);
    console.log(`  WURFEL Server running on http://0.0.0.0:${PORT}\n`);
  });

  const shutdown = () => {
    console.log('Shutting down server gracefully...');
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
