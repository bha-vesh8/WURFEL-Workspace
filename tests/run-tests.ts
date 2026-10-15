import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, mapFindingRow, mapProjectRow, mapRuleRow, queryAll, queryOne } from '../src/server/db.ts';
import { DEMO_PROJECT_ID, seedDemoProject } from '../src/server/demoSeeder.ts';
import { extractUploadedFile, suggestDocumentRole } from '../src/server/extractor.ts';
import { runProjectAnalysis } from '../src/server/analysisEngine.ts';
import { ALL_CHECK_CATEGORIES } from '../src/types.ts';

async function runTests() {
  console.log('Running WURFEL automated test suite...');

  // 1. Test document role suggestion
  assert.strictEqual(
    suggestDocumentRole('01_FR_Site_Measurement_Antwerp.pdf', 'Laser measurement 3610 mm'),
    'FR / Site Measurement'
  );
  assert.strictEqual(
    suggestDocumentRole('TeoWin_Export_BOM.xml', '<modules></modules>'),
    'TeoWin Export'
  );
  assert.strictEqual(
    suggestDocumentRole('Commercial_Costing.xlsx', 'UnitPrice Qty'),
    'Costing Sheet'
  );
  console.log('✓ Document role auto-suggestion tests passed');

  // 2. Test SQLite initialization & default rules seeding
  const db = await getDb();
  const rules = queryAll<Record<string, any>>(db, 'SELECT * FROM technical_rules').map(mapRuleRow);
  assert.ok(rules.length >= 10, 'Expected at least 10 default technical rules');
  console.log(`✓ SQLite database & ${rules.length} default technical rules verified`);

  // 3. Test Demo Project Seeding ("Modern Kitchen & Wardrobe — Project Demo")
  const demoId = seedDemoProject(db, true);
  assert.strictEqual(demoId, DEMO_PROJECT_ID);
  const demoRow = queryOne<Record<string, any>>(db, 'SELECT * FROM projects WHERE id = ?', [DEMO_PROJECT_ID]);
  assert.ok(demoRow, 'Demo project should exist');
  const demoProject = mapProjectRow(db, demoRow!);
  assert.strictEqual(demoProject.name, 'Modern Kitchen & Wardrobe — Project Demo');
  assert.strictEqual(demoProject.fileCount, 5);
  assert.ok(demoProject.findingCount >= 6, 'Demo project should have realistic sample findings');
  console.log('✓ Demo project seeding and synthetic findings verified');

  // 4. Test Unsupported File Format Handling (.dwg / .teo)
  const tempDir = path.resolve(process.cwd(), './data/test_tmp');
  fs.mkdirSync(tempDir, { recursive: true });
  const dwgPath = path.join(tempDir, 'layout.dwg');
  fs.writeFileSync(dwgPath, 'AC1027 binary content');
  const dwgExtract = await extractUploadedFile(dwgPath, 'layout.dwg', 'application/acad');
  assert.strictEqual(dwgExtract.extractionStatus, 'Unsupported');
  assert.ok(dwgExtract.recommendedFormat?.includes('.PDF'));
  console.log('✓ Unsupported format detection and guidance verified');

  // 5. Test CSV Spreadsheet Extraction & Deterministic Arithmetic Pipeline
  const csvPath = path.join(tempDir, 'test_costing.csv');
  fs.writeFileSync(
    csvPath,
    'Row,ItemCode,Description,Qty,UnitPrice_EUR,StatedTotal_EUR\n1,HAWA-25,Pocket Door,2,790,1380\n',
    'utf-8'
  );
  const csvExtract = await extractUploadedFile(csvPath, 'test_costing.csv', 'text/csv');
  assert.strictEqual(csvExtract.extractionStatus, 'Extracted');
  assert.strictEqual(csvExtract.pages.length, 1);

  // Run analysis on Demo Project and verify deterministic rules produce findings
  const runId = 'run-test-01';
  db.run(
    `INSERT INTO analysis_runs (id, projectId, status, mode, isDemoMode, selectedChecksJson, stagesJson, startedAt)
     VALUES (?, ?, 'Running', 'Local Rules + Demo Fallback', 1, ?, '[]', ?)`,
    [runId, DEMO_PROJECT_ID, JSON.stringify(ALL_CHECK_CATEGORIES), new Date().toISOString()]
  );
  await runProjectAnalysis(db, DEMO_PROJECT_ID, runId, ALL_CHECK_CATEGORIES, true);
  const runFindings = queryAll<Record<string, any>>(
    db,
    'SELECT * FROM findings WHERE analysisRunId = ?',
    [runId]
  ).map(mapFindingRow);
  assert.ok(runFindings.length >= 5, 'Analysis pipeline should generate deterministic findings');
  console.log(`✓ Analysis pipeline & deterministic rules verified (${runFindings.length} findings generated)`);

  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('All WURFEL tests passed!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
