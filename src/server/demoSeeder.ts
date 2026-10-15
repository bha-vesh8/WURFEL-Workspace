import fs from 'fs';
import path from 'path';
import { Database } from 'sql.js';
import {
  ALL_CHECK_CATEGORIES,
  AnalysisStageEvent,
  CategoryOutcome,
  ExtractedPageOrSheet,
  Finding,
} from '../types.ts';
import { logActivity, queryOne, saveDb, UPLOADS_DIR } from './db.ts';

export const DEMO_PROJECT_ID = 'proj-demo-modern-kw';
export const DEMO_RUN_ID = 'run-demo-modern-kw-01';
export const DEMO_REPORT_ID = 'rep-demo-modern-kw-01';

const ELEVATION_NORTH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 420" width="100%" height="100%">
  <rect width="880" height="420" fill="#F8FAFC"/>
  <g stroke="#CBD5E1" stroke-width="0.5">
    <line x1="0" y1="60" x2="880" y2="60"/><line x1="0" y1="120" x2="880" y2="120"/>
    <line x1="0" y1="180" x2="880" y2="180"/><line x1="0" y1="240" x2="880" y2="240"/>
    <line x1="0" y1="300" x2="880" y2="300"/><line x1="0" y1="360" x2="880" y2="360"/>
  </g>
  <text x="40" y="34" font-family="monospace" font-size="12" font-weight="bold" fill="#0F172A">SYNTHETIC SAMPLE DRAWING — NORTH WALL ELEVATION (KITCHEN RUN A)</text>
  <text x="640" y="34" font-family="monospace" font-size="11" fill="#475569">SCALE 1:25 | UNITS: MM | REV B</text>
  <!-- Top overall dimension -->
  <line x1="60" y1="75" x2="780" y2="75" stroke="#DC2626" stroke-width="1.5"/>
  <line x1="60" y1="68" x2="60" y2="82" stroke="#DC2626" stroke-width="1.5"/>
  <line x1="780" y1="68" x2="780" y2="82" stroke="#DC2626" stroke-width="1.5"/>
  <rect x="310" y="62" width="220" height="22" rx="3" fill="#FEF2F2" stroke="#FCA5A5"/>
  <text x="420" y="77" text-anchor="middle" font-family="monospace" font-size="11" font-weight="bold" fill="#B91C1C">DOSSIER TOTAL: 3650 mm (FR SITE: 3610 mm)</text>
  <!-- Tall Columns C1 & C2 -->
  <rect x="60" y="95" width="120" height="255" fill="#FFFFFF" stroke="#1E293B" stroke-width="1.5"/>
  <text x="120" y="130" text-anchor="middle" font-family="monospace" font-size="10" fill="#0F172A">C1-FRIDGE</text>
  <text x="120" y="145" text-anchor="middle" font-family="monospace" font-size="10" fill="#64748B">600 x 2180</text>
  <text x="120" y="162" text-anchor="middle" font-family="monospace" font-size="9" fill="#0284C7">RAL 7039 MATT</text>

  <rect x="180" y="95" width="120" height="255" fill="#FFFFFF" stroke="#1E293B" stroke-width="1.5"/>
  <line x1="240" y1="95" x2="240" y2="350" stroke="#64748B" stroke-dasharray="4 3"/>
  <text x="240" y="130" text-anchor="middle" font-family="monospace" font-size="10" fill="#0F172A">C2-POCKET OVEN</text>
  <text x="240" y="145" text-anchor="middle" font-family="monospace" font-size="10" fill="#D97706">600 (HAWA PKT)</text>
  <text x="240" y="162" text-anchor="middle" font-family="monospace" font-size="9" fill="#B45309">NO RECESS DETAIL</text>

  <!-- Base Cabinets B1, B2, B3 + Wall units W1, W2, W3 -->
  <rect x="300" y="95" width="160" height="90" fill="#F1F5F9" stroke="#1E293B" stroke-width="1.5"/>
  <text x="380" y="135" text-anchor="middle" font-family="monospace" font-size="10" fill="#0F172A">W1-800 LIFT</text>
  <rect x="460" y="95" width="180" height="90" fill="#F1F5F9" stroke="#1E293B" stroke-width="1.5"/>
  <text x="550" y="135" text-anchor="middle" font-family="monospace" font-size="10" fill="#0F172A">W2-900 HOOD</text>
  <rect x="640" y="95" width="120" height="90" fill="#F1F5F9" stroke="#1E293B" stroke-width="1.5"/>
  <text x="700" y="135" text-anchor="middle" font-family="monospace" font-size="10" fill="#0F172A">W3-600</text>

  <!-- LED Strip indicator -->
  <line x1="305" y1="188" x2="755" y2="188" stroke="#F59E0B" stroke-width="3"/>
  <text x="530" y="203" text-anchor="middle" font-family="monospace" font-size="9" fill="#B45309">4x LED-3000K-BAR (DOSSIER) vs 2x IN COSTING</text>

  <!-- Base units -->
  <rect x="300" y="245" width="160" height="105" fill="#FFFFFF" stroke="#1E293B" stroke-width="1.5"/>
  <text x="380" y="295" text-anchor="middle" font-family="monospace" font-size="10" fill="#0F172A">B1-800 SINK</text>

  <rect x="460" y="245" width="180" height="105" fill="#FFFFFF" stroke="#1E293B" stroke-width="1.5"/>
  <text x="550" y="295" text-anchor="middle" font-family="monospace" font-size="10" fill="#0F172A">B2-900 HOB</text>
  <text x="550" y="312" text-anchor="middle" font-family="monospace" font-size="9" fill="#DC2626">ACC-CUT-800 (MISMATCH)</text>

  <rect x="640" y="245" width="120" height="105" fill="#FFFFFF" stroke="#1E293B" stroke-width="1.5"/>
  <text x="700" y="295" text-anchor="middle" font-family="monospace" font-size="10" fill="#0F172A">B3-600 DW</text>

  <!-- Right Filler & Structural Column Conflict -->
  <rect x="760" y="95" width="20" height="255" fill="#FEE2E2" stroke="#DC2626" stroke-width="1.5"/>
  <text x="770" y="370" text-anchor="middle" font-family="monospace" font-size="9" fill="#DC2626">FILLER 50mm</text>
  <rect x="745" y="95" width="75" height="255" fill="none" stroke="#DC2626" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="815" y="220" font-family="monospace" font-size="10" font-weight="bold" fill="#DC2626">FR SITE PILLAR</text>
  <text x="815" y="234" font-family="monospace" font-size="9" fill="#DC2626">180x220mm</text>
</svg>`;

const WARDROBE_SECTION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 420" width="100%" height="100%">
  <rect width="880" height="420" fill="#F8FAFC"/>
  <text x="40" y="34" font-family="monospace" font-size="12" font-weight="bold" fill="#0F172A">SYNTHETIC SAMPLE DRAWING — MASTER WARDROBE ELEVATION (WALL B)</text>
  <text x="630" y="34" font-family="monospace" font-size="11" fill="#475569">HEIGHT: 2680 MM | DEPTH: 620 MM</text>
  <rect x="80" y="70" width="160" height="290" fill="#FFFFFF" stroke="#1E293B" stroke-width="1.5"/>
  <rect x="240" y="70" width="160" height="290" fill="#FFFFFF" stroke="#1E293B" stroke-width="1.5"/>
  <rect x="400" y="70" width="160" height="290" fill="#FFFFFF" stroke="#1E293B" stroke-width="1.5"/>
  <rect x="560" y="70" width="160" height="290" fill="#FFFFFF" stroke="#1E293B" stroke-width="1.5"/>
  <text x="160" y="110" text-anchor="middle" font-family="monospace" font-size="10" fill="#0F172A">MOD W-01 (1000mm)</text>
  <text x="320" y="110" text-anchor="middle" font-family="monospace" font-size="10" fill="#0F172A">MOD W-02 (1000mm)</text>
  <text x="480" y="110" text-anchor="middle" font-family="monospace" font-size="10" fill="#0F172A">MOD W-03 (1000mm)</text>
  <text x="640" y="110" text-anchor="middle" font-family="monospace" font-size="10" fill="#0F172A">MOD W-04 (1000mm)</text>
  <!-- Hinge callout -->
  <circle cx="88" cy="100" r="4" fill="#DC2626"/>
  <circle cx="88" cy="215" r="4" fill="#DC2626"/>
  <circle cx="88" cy="330" r="4" fill="#DC2626"/>
  <text x="160" y="215" text-anchor="middle" font-family="monospace" font-size="10" fill="#DC2626">DOOR H=2540mm (22mm MDF)</text>
  <text x="160" y="232" text-anchor="middle" font-family="monospace" font-size="9" fill="#B91C1C">3 HINGES SPECIFIED (REQ: 5)</text>
  <!-- Pull-out rack callout -->
  <rect x="415" y="250" width="130" height="85" fill="#FEF3C7" stroke="#D97706"/>
  <text x="480" y="290" text-anchor="middle" font-family="monospace" font-size="9" fill="#92400E">SHOE RACK ACC-SR-900</text>
  <text x="480" y="305" text-anchor="middle" font-family="monospace" font-size="9" fill="#92400E">IN 1000mm MODULE</text>
</svg>`;

export function seedDemoProject(db: Database, forceReset = false): string {
  const existing = queryOne<{ id: string }>(db, 'SELECT id FROM projects WHERE id = ?', [DEMO_PROJECT_ID]);
  if (existing && !forceReset) {
    return DEMO_PROJECT_ID;
  }

  if (existing && forceReset) {
    db.run('DELETE FROM findings WHERE projectId = ?', [DEMO_PROJECT_ID]);
    db.run('DELETE FROM analysis_runs WHERE projectId = ?', [DEMO_PROJECT_ID]);
    db.run('DELETE FROM project_files WHERE projectId = ?', [DEMO_PROJECT_ID]);
    db.run('DELETE FROM reports WHERE projectId = ?', [DEMO_PROJECT_ID]);
    db.run('DELETE FROM projects WHERE id = ?', [DEMO_PROJECT_ID]);
  }

  const now = new Date().toISOString();
  const demoProjectDir = path.join(UPLOADS_DIR, DEMO_PROJECT_ID);
  if (!fs.existsSync(demoProjectDir)) {
    fs.mkdirSync(demoProjectDir, { recursive: true });
  }

  db.run(
    `INSERT INTO projects (
      id, name, referenceId, projectType, clientName, siteLocation,
      description, reviewerName, status, isDemoProject, lastAnalysisAt, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      DEMO_PROJECT_ID,
      'Modern Kitchen & Wardrobe — Project Demo',
      'KW-2026-0842-DEMO',
      'Kitchen + Wardrobe',
      'Vandenberg Residence (Synthetic Demo)',
      'Antwerp — Penthouse Unit 4B',
      'Complete handleless lacquered island kitchen with pocket-door appliance tall bank and 4-bay floor-to-ceiling master bedroom wardrobe. Synthetic demonstration dataset with intentional cross-document discrepancies.',
      'Elena Rostova',
      'Awaiting Review',
      1,
      now,
      now,
      now,
    ]
  );

  // Create synthetic files on disk and in DB
  const demoFiles: Array<{
    id: string;
    filename: string;
    originalName: string;
    fileType: string;
    extension: string;
    role: string;
    extractionMethod: string;
    extractedText: string;
    pages: ExtractedPageOrSheet[];
    warnings: string[];
    ocrConfidence?: number;
  }> = [
    {
      id: 'file-demo-fr-01',
      filename: 'FR_Site_Survey_KW2026_0842.pdf',
      originalName: '01_FR_Site_Measurement_Sheet_Antwerp4B.pdf',
      fileType: 'application/pdf',
      extension: '.pdf',
      role: 'FR / Site Measurement',
      extractionMethod: 'PDF Embedded Text + OCR Verification (Synthetic Sample)',
      ocrConfidence: 96.4,
      warnings: ['Page 2 contains handwritten site annotation near NE corner pillar — verified via OCR.'],
      extractedText: `[SYNTHETIC SAMPLE DOCUMENT — FR SITE MEASUREMENT SURVEY]
Project Ref: KW-2026-0842-DEMO | Surveyor: M. Janssens | Laser Device: Leica Disto S910
Page 1: Kitchen North Wall (Run A)
- Clear wall-to-wall laser span at 900mm worktop height: 3,610 mm
- Clear wall-to-wall span at 2,150mm ceiling soffit height: 3,604 mm
- Structural concrete column on North-East corner: 180 mm (width along North wall) x 220 mm (projection depth).
- Ceiling height clear under plasterboard soffit: 2,520 mm.
- Plumbing waste outlet center from West wall: 1,540 mm.

Page 2: Master Bedroom Wardrobe Wall (Wall B)
- Clear recess width between finished plaster walls: 4,045 mm
- Clear floor-to-ceiling height: 2,695 mm (floor level variance 6 mm across 4m).
- Skirting board on Left return wall: 18 mm x 90 mm (to be removed by contractor).`,
      pages: [
        {
          pageNumber: 1,
          label: 'Page 1 — Kitchen North Wall Laser Survey',
          contentType: 'text',
          text: `[SYNTHETIC SAMPLE — PAGE 1: KITCHEN NORTH WALL SURVEY]
Survey Date: 11 Oct 2026 | Instrument: Leica Disto S910
• North Wall Total Available Span (Worktop level +900mm): 3,610 mm
• North Wall Span at Upper Soffit (+2,150mm): 3,604 mm
• North-East Structural Pillar: 180 mm wide along North Wall × 220 mm deep from back wall
• Finished Floor to Soffit Height: 2,520 mm
• Water / Drain Stub-out Center: 1,540 mm from West return wall`,
          detectedValues: {
            dimensions: ['3610 mm', '3604 mm', '180x220 mm', '2520 mm', '1540 mm'],
            productCodes: ['FR-SURV-0842'],
          },
          selectedForReview: true,
        },
        {
          pageNumber: 2,
          label: 'Page 2 — Master Wardrobe Recess & Handwritten Pillar Note',
          contentType: 'scanned',
          ocrConfidence: 94.2,
          text: `[SYNTHETIC SAMPLE — PAGE 2: MASTER WARDROBE & SITE NOTES]
• Wardrobe Wall B Clear Width: 4,045 mm
• Wardrobe Clear Ceiling Height: 2,695 mm
• SITE NOTE (Handwritten OCR): "NE Kitchen pillar 180x220mm cannot be chased or notched. Cabinet B3 or filler must step back or reduce run by 180mm."`,
          detectedValues: {
            dimensions: ['4045 mm', '2695 mm', '180x220 mm'],
          },
          warnings: ['Handwritten note detected on scanned site sketch (94.2% OCR confidence).'],
          selectedForReview: true,
        },
      ],
    },
    {
      id: 'file-demo-teowin-02',
      filename: 'TeoWin_Export_BOM_KW2026_0842.xml',
      originalName: '02_TeoWin_CAD_Export_BOM_v3.xml',
      fileType: 'application/xml',
      extension: '.xml',
      role: 'TeoWin Export',
      extractionMethod: 'Structured XML BOM Parser (Synthetic Sample)',
      warnings: [],
      extractedText: `[SYNTHETIC SAMPLE DOCUMENT — TEOWIN EXPORT XML SUMMARY]
Project: KW-2026-0842-DEMO | Exported Modules: 11
Finish Fronts Primary: RAL 7039 Quartz Grey Satin-Matt Lacquer (Code: LAC-RAL7039-SM)
Carcass Melamine: Egger U708 Light Grey 19mm
Kitchen North Run Modules:
- C1-600 Tall Fridge Housing (600x600x2180mm)
- C2-600 Tall Oven/Coffee Pocket Unit (600x650x2180mm) - Mechanism: HAWA-CONCEPTA-25
- B1-800 Sink Base 2-Drawer (800x600x780mm)
- B2-900 Induction Hob Base 3-Drawer (900x600x780mm) + Cutlery Insert ACC-CUT-800
- B3-600 Dishwasher Housing + Door (600x600x780mm)
- Left Filler FL-L: 100mm | Right Filler FL-R: 50mm
Total North Run Nominal Width: 600 + 600 + 800 + 900 + 600 + 100 + 50 = 3,650 mm
Wardrobe Wall B Modules:
- 4x W-1000 Tall Wardrobe Modules (4 x 1,000mm + 2x 22mm fillers = 4,044 mm, Height 2,680 mm)
- Doors: 8x Full-height 2,540mm leaves in 22mm Lacquered MDF, Hinges: Blum Clip Top 110° (BLUM-71B3550) x 24 pcs total (3 per leaf).`,
      pages: [
        {
          pageNumber: 1,
          label: 'XML Node: CabinetSchedule & Finishes',
          contentType: 'table',
          text: `TeoWin Exported Module & Finish Schedule (Synthetic Sample Data)
Primary Front Finish: LAC-RAL7039-SM (RAL 7039 Quartz Grey Satin-Matt)
Total Kitchen North Wall Width: 3,650 mm (600+600+800+900+600 + 150mm fillers)
Total Wardrobe Width: 4,044 mm`,
          tables: [
            {
              name: 'TeoWin_Modules',
              headers: ['ModuleCode', 'Description', 'Width_mm', 'Height_mm', 'Depth_mm', 'FinishCode', 'Qty'],
              rows: [
                { ModuleCode: 'C1-600', Description: 'Tall Integrated Fridge Unit', Width_mm: 600, Height_mm: 2180, Depth_mm: 600, FinishCode: 'LAC-RAL7039-SM', Qty: 1 },
                { ModuleCode: 'C2-600-PKT', Description: 'Tall Pocket-Door Appliance Unit', Width_mm: 600, Height_mm: 2180, Depth_mm: 650, FinishCode: 'LAC-RAL7039-SM', Qty: 1 },
                { ModuleCode: 'B1-800', Description: 'Sink Base 2-Drawer Pullout', Width_mm: 800, Height_mm: 780, Depth_mm: 600, FinishCode: 'LAC-RAL7039-SM', Qty: 1 },
                { ModuleCode: 'B2-900', Description: 'Hob Base 3-Drawer Unit', Width_mm: 900, Height_mm: 780, Depth_mm: 600, FinishCode: 'LAC-RAL7039-SM', Qty: 1 },
                { ModuleCode: 'B3-600', Description: 'Integrated Dishwasher Front', Width_mm: 600, Height_mm: 780, Depth_mm: 600, FinishCode: 'LAC-RAL7039-SM', Qty: 1 },
                { ModuleCode: 'W-1000-TALL', Description: 'Master Wardrobe Double Bay', Width_mm: 1000, Height_mm: 2680, Depth_mm: 620, FinishCode: 'LAC-RAL7039-SM', Qty: 4 },
              ],
            },
          ],
          detectedValues: {
            dimensions: ['3650 mm', '600x2180 mm', '900x780 mm', '1000x2680 mm'],
            productCodes: ['HAWA-CONCEPTA-25', 'ACC-CUT-800', 'BLUM-71B3550', 'ACC-SR-900'],
            finishCodes: ['LAC-RAL7039-SM', 'EGGER-U708'],
          },
          selectedForReview: true,
        },
      ],
    },
    {
      id: 'file-demo-dossier-03',
      filename: 'Technical_Dossier_KW2026_0842.pdf',
      originalName: '03_Technical_Production_Dossier_RevB.pdf',
      fileType: 'application/pdf',
      extension: '.pdf',
      role: 'Technical Dossier',
      extractionMethod: 'PDF Text + Vector Drawing Extractor (Synthetic Sample)',
      warnings: [],
      extractedText: `[SYNTHETIC SAMPLE DOCUMENT — TECHNICAL PRODUCTION DOSSIER REV B]
Page 1: General Specification & Finish Schedule
- Kitchen & Wardrobe Front Finish: LAC-RAL7035-GL (RAL 7035 Light Grey High-Gloss Lacquer) <-- Discrepancy vs TeoWin RAL 7039 Matt
- Worktop: 20mm Dekton Sirius Solid Surface, Island breakfast overhang = 420 mm unsupported cantilevers.
- Under-cabinet Lighting: 4x Recessed Linear LED Bars (Code: LGT-LED-3000K-900, 18W each, 72W total) connected to 1x 60W 24V Transformer (DRV-24V-60W).
- Hob Unit B2-900: Fitted with Solid Oak Cutlery Tray ACC-CUT-800 (800mm nominal width inside 900mm cabinet).

Page 2: Kitchen North Wall Technical Elevation (Drawing A-101)
- Total Run Dimension shown: 3,650 mm (C1 600 + C2 600 + B1 800 + B2 900 + B3 600 + Fillers 150).
- Note on C2 Pocket Unit: "Install Hawa Concepta 25 pocket door mechanism — contractor to verify spindle recess on site." (No section detail or recess clearance dimension provided).
- Induction Hob Cutout: "Cutout per Bora Pure flush-mount template — dimensions to be confirmed."

Page 3: Master Wardrobe Elevation & Hardware Schedule (Drawing W-201)
- 4x 1000mm Modules, Total Width 4,044 mm, Total Height 2,680 mm.
- 8x Full-height MDF 22mm doors (Height 2,540 mm, weight ~26.5 kg per leaf).
- Hinge schedule specifies 3x Blum Clip Top 110° hinges per door leaf (24 hinges total).
- Module W-03 (1000mm wide) specifies internal pull-out shoe rack ACC-SR-900 (for 900mm carcass without spacer kit).`,
      pages: [
        {
          pageNumber: 1,
          label: 'Page 1 — Material, Finish & Lighting Specification',
          contentType: 'text',
          text: `[SYNTHETIC SAMPLE — PAGE 1: TECHNICAL DOSSIER SPECIFICATIONS]
• Front Finish Code specified in Dossier Cover Sheet: LAC-RAL7035-GL (RAL 7035 Light Grey High-Gloss)
• Worktop Overhang: 20mm Dekton Sirius with 420 mm unsupported breakfast bar cantilever
• Lighting Schedule: 4× LGT-LED-3000K-900 (18W/bar = 72W total load) driven by 1× DRV-24V-60W (60W max rated driver)
• Drawer Accessories: B2-900 (900mm Hob Unit) assigned ACC-CUT-800 (800mm Oak Cutlery Insert)`,
          detectedValues: {
            dimensions: ['420 mm', '900 mm', '800 mm'],
            productCodes: ['LGT-LED-3000K-900', 'DRV-24V-60W', 'ACC-CUT-800'],
            finishCodes: ['LAC-RAL7035-GL'],
          },
          selectedForReview: true,
        },
        {
          pageNumber: 2,
          label: 'Page 2 — Drawing A-101: Kitchen North Wall Elevation',
          contentType: 'synthetic_drawing',
          svgDrawingData: ELEVATION_NORTH_SVG,
          text: `[SYNTHETIC SAMPLE — PAGE 2: DRAWING A-101 NORTH WALL ELEVATION]
• Overall Run Dimension: 3,650 mm (C1 600 + C2 600 + B1 800 + B2 900 + B3 600 + Fillers 150 mm)
• NE Corner Pillar (180×220mm from FR Survey) is NOT notched or deducted from the 3,650mm cabinet run
• C2-600 Pocket Door Note: "Fit Hawa Concepta 25 pocket doors — recess depth to be adjusted by installer"
• B2-900 Hob Cutout: "Flush induction hob cutout dimensions TBC before CNC"`,
          detectedValues: {
            dimensions: ['3650 mm', '600 mm', '800 mm', '900 mm', '150 mm'],
            productCodes: ['HAWA-CONCEPTA-25', 'B2-900', 'B3-600'],
          },
          selectedForReview: true,
        },
        {
          pageNumber: 3,
          label: 'Page 3 — Drawing W-201: Master Wardrobe Elevation & Hardware',
          contentType: 'synthetic_drawing',
          svgDrawingData: WARDROBE_SECTION_SVG,
          text: `[SYNTHETIC SAMPLE — PAGE 3: DRAWING W-201 MASTER WARDROBE]
• 4× 1,000 mm Modules (W-01 to W-04), Height 2,680 mm, Door Leaf Height 2,540 mm (22mm MDF)
• Hardware Callout: 3× Blum 110° hinges per 2,540mm door leaf (Total 24 pcs BLUM-71B3550)
• Module W-03 (1,000 mm external width) fitted with ACC-SR-900 (900 mm pull-out shoe rack; spacer adapter not listed)`,
          detectedValues: {
            dimensions: ['4044 mm', '2680 mm', '2540 mm', '1000 mm', '900 mm'],
            productCodes: ['BLUM-71B3550', 'ACC-SR-900'],
          },
          selectedForReview: true,
        },
      ],
    },
    {
      id: 'file-demo-costing-04',
      filename: 'Costing_Sheet_KW2026_0842.xlsx',
      originalName: '04_Commercial_Costing_Schedule_KW2026_0842.xlsx',
      fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: '.xlsx',
      role: 'Costing Sheet',
      extractionMethod: 'SheetJS Spreadsheet Parser & Arithmetic Engine (Synthetic Sample)',
      warnings: [],
      extractedText: `[SYNTHETIC SAMPLE DOCUMENT — COMMERCIAL COSTING SHEET]
Sheet 1: Cost_Breakdown
Line 1: Kitchen Tall & Base Cabinetry (LAC-RAL7039-SM) | Qty: 5 | Unit: 1,420.00 EUR | Stated Total: 7,100.00 EUR
Line 2: Master Wardrobe 4-Bay System (LAC-RAL7039-SM) | Qty: 4 | Unit: 1,650.00 EUR | Stated Total: 6,600.00 EUR
Line 3: Hawa Concepta 25 Pocket Door Hardware Set (HAWA-CONCEPTA-25) | Qty: 2 | Unit: 790.00 EUR | Stated Total: 1,380.00 EUR (Arithmetic Error: 2 x 790 = 1,580.00 EUR; Delta = -200.00 EUR)
Line 4: Blum Clip Top 110° Hinges (BLUM-71B3550) | Qty: 24 | Unit: 8.50 EUR | Stated Total: 204.00 EUR
Line 5: Linear LED Bar 3000K (LGT-LED-3000K-900) | Qty: 2 | Unit: 95.00 EUR | Stated Total: 190.00 EUR (Qty Mismatch: Dossier specifies 4 bars)
Line 6: Solid Oak Cutlery Insert 800mm (ACC-CUT-800) | Qty: 1 | Unit: 210.00 EUR | Stated Total: 210.00 EUR
Line 7: Pull-Out Shoe Rack 900mm (ACC-SR-900) | Qty: 0 (Missing from costing sheet despite appearing on Drawing W-201)
Stated Sheet Subtotal: 15,684.00 EUR | Recalculated Line Sum: 15,884.00 EUR (excl. unpriced missing shoe rack).`,
      pages: [
        {
          pageNumber: 1,
          label: 'Sheet 1 — Cost_Breakdown (8 Rows)',
          contentType: 'costing',
          text: `Extracted Costing Table from 04_Commercial_Costing_Schedule_KW2026_0842.xlsx`,
          tables: [
            {
              name: 'Cost_Breakdown',
              headers: ['Row', 'ItemCode', 'Description', 'Finish', 'Qty', 'UnitPrice_EUR', 'StatedTotal_EUR', 'CalculatedTotal_EUR'],
              rows: [
                { Row: 2, ItemCode: 'CAB-KIT-SET', Description: 'Kitchen Tall & Base Units (5 modules)', Finish: 'LAC-RAL7039-SM', Qty: 5, UnitPrice_EUR: 1420, StatedTotal_EUR: 7100, CalculatedTotal_EUR: 7100 },
                { Row: 3, ItemCode: 'CAB-WRD-SET', Description: 'Master Wardrobe 1000mm Bays', Finish: 'LAC-RAL7039-SM', Qty: 4, UnitPrice_EUR: 1650, StatedTotal_EUR: 6600, CalculatedTotal_EUR: 6600 },
                { Row: 4, ItemCode: 'HAWA-CONCEPTA-25', Description: 'Hawa Concepta 25 Pocket Door Set (C2)', Finish: 'Anodized', Qty: 2, UnitPrice_EUR: 790, StatedTotal_EUR: 1380, CalculatedTotal_EUR: 1580 },
                { Row: 5, ItemCode: 'BLUM-71B3550', Description: 'Blum Clip Top 110° Soft-Close Hinge', Finish: 'Nickel', Qty: 24, UnitPrice_EUR: 8.5, StatedTotal_EUR: 204, CalculatedTotal_EUR: 204 },
                { Row: 6, ItemCode: 'LGT-LED-3000K-900', Description: 'Recessed Under-Cabinet LED Profile 900mm', Finish: 'Black Alu', Qty: 2, UnitPrice_EUR: 95, StatedTotal_EUR: 190, CalculatedTotal_EUR: 190 },
                { Row: 7, ItemCode: 'DRV-24V-60W', Description: '24V Constant Voltage LED Driver 60W', Finish: 'N/A', Qty: 1, UnitPrice_EUR: 65, StatedTotal_EUR: 65, CalculatedTotal_EUR: 65 },
                { Row: 8, ItemCode: 'ACC-CUT-800', Description: 'Solid Oak Cutlery Tray Insert 800mm', Finish: 'Natural Oak', Qty: 1, UnitPrice_EUR: 210, StatedTotal_EUR: 210, CalculatedTotal_EUR: 210 },
              ],
            },
          ],
          detectedValues: {
            productCodes: ['HAWA-CONCEPTA-25', 'BLUM-71B3550', 'LGT-LED-3000K-900', 'DRV-24V-60W', 'ACC-CUT-800'],
            finishCodes: ['LAC-RAL7039-SM'],
            quantities: [
              { code: 'HAWA-CONCEPTA-25', description: 'Hawa Concepta 25 Pocket Door Set', qty: 2, unitPrice: 790, lineTotal: 1380 },
              { code: 'LGT-LED-3000K-900', description: 'Recessed LED Profile 900mm', qty: 2, unitPrice: 95, lineTotal: 190 },
            ],
          },
          selectedForReview: true,
        },
      ],
    },
    {
      id: 'file-demo-drawing-05',
      filename: 'Reference_Elevation_A101.png',
      originalName: '05_Reference_Drawing_North_Wall_Render.png',
      fileType: 'image/png',
      extension: '.png',
      role: 'Reference Image',
      extractionMethod: 'Image Vision Preview + Local OCR Pass (Synthetic Sample)',
      ocrConfidence: 91.8,
      warnings: ['Visual lighting positions in perspective render are approximate; verify against dimensioned Drawing A-101.'],
      extractedText: `[SYNTHETIC SAMPLE IMAGE OCR — NORTH WALL ELEVATION SHEET]
Detected Labels: C1-600 | C2-600 POCKET | B1-800 | B2-900 | B3-600 | TOTAL 3650MM | RAL 7039 MATT`,
      pages: [
        {
          pageNumber: 1,
          label: 'Image 1 — North Wall Technical Render & Callouts',
          contentType: 'synthetic_drawing',
          svgDrawingData: ELEVATION_NORTH_SVG,
          ocrConfidence: 91.8,
          text: `Detected OCR Text from Reference Drawing:
NORTH WALL ELEVATION — RUN A: 3650 mm
C1-FRIDGE (600) | C2-POCKET OVEN (600) | B1-SINK (800) | B2-HOB (900) | B3-DW (600) | FILLERS (150)`,
          detectedValues: {
            dimensions: ['3650 mm', '600 mm', '800 mm', '900 mm'],
          },
          selectedForReview: true,
        },
      ],
    },
  ];

  const fileStmt = db.prepare(`
    INSERT INTO project_files (
      id, projectId, filename, originalName, fileType, extension, fileSize,
      role, suggestedRole, uploadStatus, extractionStatus, extractionMethod,
      extractedText, pagesJson, warningsJson, ocrConfidence, isDemoSynthetic, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const f of demoFiles) {
    const diskPath = path.join(demoProjectDir, f.filename);
    fs.writeFileSync(diskPath, f.extractedText, 'utf-8');
    const size = Buffer.byteLength(f.extractedText, 'utf-8') + 24500;

    fileStmt.run([
      f.id,
      DEMO_PROJECT_ID,
      f.filename,
      f.originalName,
      f.fileType,
      f.extension,
      size,
      f.role,
      f.role,
      'Uploaded',
      'Extracted',
      f.extractionMethod,
      f.extractedText,
      JSON.stringify(f.pages),
      JSON.stringify(f.warnings),
      f.ocrConfidence ?? null,
      1,
      now,
    ]);
  }
  fileStmt.free();

  // Create Demo Findings covering all key checking categories
  const demoFindings: Omit<Finding, 'createdAt'>[] = [
    {
      id: 'find-demo-01',
      analysisRunId: DEMO_RUN_ID,
      projectId: DEMO_PROJECT_ID,
      title: 'North Wall Overall Cabinet Run Exceeds FR Site Laser Measurement by 40 mm',
      category: 'FR measurements and site constraints',
      severity: 'Critical',
      confidence: 'High',
      findingType: 'Confirmed Discrepancy',
      description:
        'The Technical Dossier (Drawing A-101) and TeoWin BOM specify a total North Wall cabinet and filler run of 3,650 mm (600+600+800+900+600 + 150 mm fillers). However, the FR Site Measurement sheet records a clear wall-to-wall span of 3,610 mm at worktop height (+900 mm) and 3,604 mm at upper soffit height (+2,150 mm), plus an unnotched 180×220 mm NE structural concrete pillar.',
      evidence:
        'FR Survey Page 1: "North Wall Total Available Span: 3,610 mm (soffit 3,604 mm); NE Structural Pillar 180×220 mm cannot be chased." vs Technical Dossier Page 2 & TeoWin XML: "Total North Run Nominal Width = 3,650 mm".',
      sourceFiles: [
        { fileId: 'file-demo-fr-01', filename: '01_FR_Site_Measurement_Sheet_Antwerp4B.pdf', pageOrSheet: 'Page 1 & Page 2' },
        { fileId: 'file-demo-dossier-03', filename: '03_Technical_Production_Dossier_RevB.pdf', pageOrSheet: 'Page 2 (Drawing A-101)' },
        { fileId: 'file-demo-teowin-02', filename: '02_TeoWin_CAD_Export_BOM_v3.xml', pageOrSheet: 'XML Node: CabinetSchedule' },
      ],
      expectedValue: '<= 3,604 mm clear width (or 3,430 mm clear of 180mm NE pillar)',
      observedValue: '3,650 mm nominal run (+46 mm overrun at soffit; +220 mm conflict at NE pillar)',
      suggestedCorrection:
        'Reduce base unit B1-800 to B1-600 (or B2-900 to B2-800) and detail a scribed infill/stepped depth unit around the 180×220 mm NE structural pillar before releasing to CNC.',
      reasonForSuggestion:
        'A 3,650 mm rigid cabinet bank physically cannot fit inside a 3,604–3,610 mm masonry opening, and the 180×220 mm concrete pillar blocks full-depth installation on the right-hand end.',
      humanReviewRequired: true,
      status: 'Open',
      isDemoFinding: true,
      analysisSource: 'Demo Sample',
    },
    {
      id: 'find-demo-02',
      analysisRunId: DEMO_RUN_ID,
      projectId: DEMO_PROJECT_ID,
      title: 'Conflicting Front Lacquer Finish Code Between Technical Dossier and TeoWin / Costing',
      category: 'Colours and finishes',
      severity: 'High',
      confidence: 'High',
      findingType: 'Confirmed Discrepancy',
      description:
        'The Technical Dossier specification sheet calls for LAC-RAL7035-GL (RAL 7035 Light Grey High-Gloss Lacquer), whereas both the TeoWin CAD Export XML and the Commercial Costing Sheet price and schedule LAC-RAL7039-SM (RAL 7039 Quartz Grey Satin-Matt Lacquer).',
      evidence:
        'Technical Dossier Page 1: "Front Finish Code: LAC-RAL7035-GL (RAL 7035 High-Gloss)" vs TeoWin XML & Costing Sheet Rows 2–3: "FinishCode: LAC-RAL7039-SM (RAL 7039 Quartz Grey Satin-Matt)".',
      sourceFiles: [
        { fileId: 'file-demo-dossier-03', filename: '03_Technical_Production_Dossier_RevB.pdf', pageOrSheet: 'Page 1' },
        { fileId: 'file-demo-teowin-02', filename: '02_TeoWin_CAD_Export_BOM_v3.xml', pageOrSheet: 'XML Node: CabinetSchedule' },
        { fileId: 'file-demo-costing-04', filename: '04_Commercial_Costing_Schedule_KW2026_0842.xlsx', pageOrSheet: 'Sheet 1, Rows 2–3' },
      ],
      expectedValue: 'LAC-RAL7039-SM (or signed client change order for LAC-RAL7035-GL)',
      observedValue: 'LAC-RAL7035-GL in Dossier vs LAC-RAL7039-SM in TeoWin & Costing',
      suggestedCorrection:
        'Confirm signed client colour sample sign-off and unify the finish code across the Dossier cover sheet, TeoWin BOM, and Costing Sheet (note high-gloss lacquer typically carries a 12–15% surcharge over satin-matt).',
      reasonForSuggestion:
        'Releasing conflicting RAL and gloss levels to the spray shop risks manufacturing all fronts in the wrong colour and sheen.',
      humanReviewRequired: true,
      status: 'Open',
      isDemoFinding: true,
      analysisSource: 'Demo Sample',
    },
    {
      id: 'find-demo-03',
      analysisRunId: DEMO_RUN_ID,
      projectId: DEMO_PROJECT_ID,
      title: 'Costing Sheet Arithmetic Discrepancy & Unpriced Pull-Out Shoe Rack (ACC-SR-900)',
      category: 'Costing consistency',
      severity: 'Critical',
      confidence: 'High',
      findingType: 'Confirmed Discrepancy',
      description:
        'Two costing discrepancies were identified: (1) Row 4 (Hawa Concepta 25 Pocket Door Set, Qty 2 × 790.00 EUR) states a line total of 1,380.00 EUR instead of the calculated 1,580.00 EUR (-200.00 EUR arithmetic understatement); (2) Internal Pull-Out Shoe Rack ACC-SR-900 specified in Wardrobe Module W-03 on Drawing W-201 and in TeoWin XML is completely omitted from the Costing Sheet.',
      evidence:
        'Costing Sheet Row 4: Qty=2, UnitPrice=790.00 EUR, StatedTotal=1,380.00 EUR (Calculated: 1,580.00 EUR). Drawing W-201 (Page 3) lists ACC-SR-900 in Module W-03, which has no matching row in Cost_Breakdown.',
      sourceFiles: [
        { fileId: 'file-demo-costing-04', filename: '04_Commercial_Costing_Schedule_KW2026_0842.xlsx', pageOrSheet: 'Sheet 1, Row 4 & Subtotal' },
        { fileId: 'file-demo-dossier-03', filename: '03_Technical_Production_Dossier_RevB.pdf', pageOrSheet: 'Page 3 (Drawing W-201)' },
      ],
      expectedValue: 'Row 4 Total = 1,580.00 EUR (+200.00 EUR) + Line item for ACC-SR-900',
      observedValue: 'Row 4 Stated Total = 1,380.00 EUR; ACC-SR-900 missing from costing',
      suggestedCorrection:
        'Correct Row 4 formula in 04_Commercial_Costing_Schedule_KW2026_0842.xlsx to 1,580.00 EUR and add the unit price and line total for 1× ACC-SR-900 (or 1,000mm equivalent ACC-SR-1000).',
      reasonForSuggestion:
        'Programmatic spreadsheet verification detected a 200.00 EUR line extension error plus an uncosted wardrobe accessory.',
      humanReviewRequired: true,
      status: 'Open',
      isDemoFinding: true,
      analysisSource: 'Demo Sample',
    },
    {
      id: 'find-demo-04',
      analysisRunId: DEMO_RUN_ID,
      projectId: DEMO_PROJECT_ID,
      title: 'Accessory Width Mismatches: 800mm Cutlery Tray in 900mm Hob Unit & 900mm Shoe Rack in 1000mm Wardrobe',
      category: 'Accessories and compatibility',
      severity: 'High',
      confidence: 'High',
      findingType: 'Confirmed Discrepancy',
      description:
        'Two internal accessories do not match their host cabinet nominal widths: (1) Base unit B2-900 (900 mm wide) is assigned cutlery insert ACC-CUT-800 (for 800 mm drawer); (2) Wardrobe bay W-03 (1,000 mm wide) is assigned pull-out shoe rack ACC-SR-900 (for 900 mm bay) without side build-out spacers.',
      evidence:
        'Dossier Page 1 & TeoWin XML: "B2-900 (Width 900mm) -> ACC-CUT-800" and Dossier Page 3: "MOD W-03 (1000mm) -> ACC-SR-900".',
      sourceFiles: [
        { fileId: 'file-demo-dossier-03', filename: '03_Technical_Production_Dossier_RevB.pdf', pageOrSheet: 'Page 1 & Page 3' },
        { fileId: 'file-demo-teowin-02', filename: '02_TeoWin_CAD_Export_BOM_v3.xml', pageOrSheet: 'XML Node: CabinetSchedule' },
      ],
      expectedValue: 'ACC-CUT-900 for B2-900; ACC-SR-1000 (or 50mm side spacer kit) for W-03',
      observedValue: 'ACC-CUT-800 in 900mm drawer; ACC-SR-900 in 1000mm wardrobe bay',
      suggestedCorrection:
        'Update BOM to ACC-CUT-900 for hob drawer B2-900, and either change the shoe rack to ACC-SR-1000 or specify 2× 50mm internal runner packing profiles in W-03.',
      reasonForSuggestion:
        'A 900 mm telescopic pull-out rack cannot span a 962 mm internal carcass opening without dedicated spacer profiles.',
      humanReviewRequired: false,
      status: 'Open',
      isDemoFinding: true,
      analysisSource: 'Demo Sample',
    },
    {
      id: 'find-demo-05',
      analysisRunId: DEMO_RUN_ID,
      projectId: DEMO_PROJECT_ID,
      title: 'LED Lighting Quantity Discrepancy (4 vs 2 Bars) and Undersized 60W 24V Driver for 72W Load',
      category: 'Lighting type, quantity, and positioning',
      severity: 'Medium',
      confidence: 'High',
      findingType: 'Confirmed Discrepancy',
      description:
        'The Technical Dossier specifies 4× LGT-LED-3000K-900 linear bars (4 × 18W = 72W total load), whereas the Costing Sheet only includes 2× LGT-LED-3000K-900. Furthermore, the single specified 60W driver (DRV-24V-60W) is overloaded at 72W (requires >= 86.4W capacity for 20% headroom under Rule LGT-DRV-01).',
      evidence:
        'Dossier Page 1 & Page 2: "4× LGT-LED-3000K-900 (18W each, 72W total) with 1× DRV-24V-60W" vs Costing Sheet Row 6: "LGT-LED-3000K-900 Qty: 2".',
      sourceFiles: [
        { fileId: 'file-demo-dossier-03', filename: '03_Technical_Production_Dossier_RevB.pdf', pageOrSheet: 'Page 1 & Page 2' },
        { fileId: 'file-demo-costing-04', filename: '04_Commercial_Costing_Schedule_KW2026_0842.xlsx', pageOrSheet: 'Sheet 1, Rows 6–7' },
      ],
      expectedValue: 'Qty 4 LED bars in Costing + 100W 24V Driver (or 2× 60W drivers) for 72W load',
      observedValue: 'Qty 2 LED bars in Costing; 1× 60W driver for 72W load (-12W deficit)',
      suggestedCorrection:
        'Update Costing Sheet Row 6 quantity to 4 units and upgrade DRV-24V-60W to DRV-24V-100W (or split across 2× DRV-24V-60W drivers).',
      reasonForSuggestion:
        'Connecting 72W of LED strips to a 60W transformer will trigger thermal overload protection or premature driver failure.',
      humanReviewRequired: true,
      status: 'Open',
      isDemoFinding: true,
      analysisSource: 'Demo Sample',
    },
    {
      id: 'find-demo-06',
      analysisRunId: DEMO_RUN_ID,
      projectId: DEMO_PROJECT_ID,
      title: 'Insufficient Hinge Count (3 per Leaf) on 2,540 mm Full-Height 22mm MDF Wardrobe Doors',
      category: 'Hinges and hardware',
      severity: 'High',
      confidence: 'High',
      findingType: 'Confirmed Discrepancy',
      description:
        'Master Wardrobe Drawing W-201 and TeoWin BOM allocate 3 hinges per door leaf (24 hinges total across 8 leaves) for 2,540 mm tall × 500 mm wide doors in 22 mm lacquered MDF (~26.5 kg/leaf). Configured Rule HW-HINGE-01 and hardware reference tables require at least 4–5 hinges per leaf for doors over 1,600 mm / 22 kg.',
      evidence:
        'Drawing W-201 (Page 3) & Costing Row 5: "8 leaves H=2540mm in 22mm MDF; 3 hinges per leaf (24 pcs BLUM-71B3550 total)".',
      sourceFiles: [
        { fileId: 'file-demo-dossier-03', filename: '03_Technical_Production_Dossier_RevB.pdf', pageOrSheet: 'Page 3 (Drawing W-201)' },
        { fileId: 'file-demo-costing-04', filename: '04_Commercial_Costing_Schedule_KW2026_0842.xlsx', pageOrSheet: 'Sheet 1, Row 5' },
      ],
      expectedValue: '5 hinges per leaf (40 hinges total for 8 wardrobe doors)',
      observedValue: '3 hinges per leaf (24 hinges total)',
      suggestedCorrection:
        'Increase wardrobe door hinge drilling from 3 to 5 hinges per leaf (40× BLUM-71B3550 total) on CNC boring program W-201 and update Costing Row 5.',
      reasonForSuggestion:
        '2,540 mm tall 22 mm MDF doors on 3 hinges will sag and lose vertical reveal alignment.',
      humanReviewRequired: false,
      status: 'Open',
      isDemoFinding: true,
      analysisSource: 'Demo Sample',
    },
    {
      id: 'find-demo-07',
      analysisRunId: DEMO_RUN_ID,
      projectId: DEMO_PROJECT_ID,
      title: 'Missing Pocket-Door Recess Section Detail & Unconfirmed Flush Hob Cutout Dimensions',
      category: 'Missing information and unclear instructions',
      severity: 'High',
      confidence: 'High',
      findingType: 'Missing Information',
      description:
        'Two fabrication-critical details are deferred to site or marked TBC in the Technical Dossier: (1) Tall unit C2-600 specifies a Hawa Concepta 25 pocket door system with the note "contractor to verify spindle recess on site" instead of a dimensioned workshop horizontal section; (2) Base unit B2-900 states "Flush induction hob cutout dimensions TBC before CNC".',
      evidence:
        'Dossier Page 2 (Drawing A-101): "Install Hawa Concepta 25 pocket door mechanism — contractor to verify spindle recess on site" and "Flush induction hob cutout dimensions TBC before CNC".',
      sourceFiles: [
        { fileId: 'file-demo-dossier-03', filename: '03_Technical_Production_Dossier_RevB.pdf', pageOrSheet: 'Page 2 (Drawing A-101)' },
      ],
      expectedValue: 'Dimensioned 1:5 pocket recess section + exact appliance cutout DXF/dimensions',
      observedValue: 'Deferred notes ("verify on site" / "TBC before CNC")',
      suggestedCorrection:
        'Attach the Hawa Concepta 25 carcass depth/partition setback detail (65 mm pocket cavity width + 55 mm rear ventilation) and lock the exact Bora Pure flush rebate dimensions before approving for production.',
      reasonForSuggestion:
        'Pocket door side panels and stone worktop CNC rebates cannot be machined on site.',
      humanReviewRequired: true,
      status: 'Open',
      isDemoFinding: true,
      analysisSource: 'Demo Sample',
    },
    {
      id: 'find-demo-08',
      analysisRunId: DEMO_RUN_ID,
      projectId: DEMO_PROJECT_ID,
      title: '420 mm Unsupported 20mm Dekton Island Overhang Exceeds 300 mm Cantilever Guideline',
      category: 'Technical feasibility',
      severity: 'Medium',
      confidence: 'Medium',
      findingType: 'Potential Issue',
      description:
        'Page 1 of the Technical Dossier specifies a 20 mm Dekton Sirius island breakfast bar overhang of 420 mm with no concealed steel support brackets or leg frame documented. Rule FEAS-SPAN-01 flags overhangs > 300 mm in 20 mm ultra-compact surfaces for structural review.',
      evidence:
        'Dossier Page 1: "Worktop: 20mm Dekton Sirius Solid Surface, Island breakfast overhang = 420 mm unsupported cantilevers."',
      sourceFiles: [
        { fileId: 'file-demo-dossier-03', filename: '03_Technical_Production_Dossier_RevB.pdf', pageOrSheet: 'Page 1' },
      ],
      expectedValue: '<= 300 mm unsupported cantilever OR concealed steel T-bar support brackets',
      observedValue: '420 mm unsupported overhang',
      suggestedCorrection:
        'Have the stone fabricator verify the 420 mm overhang or add 3× concealed steel support bars rebated into the island carcass top rail.',
      reasonForSuggestion:
        '20 mm sintered stone overhangs over 300 mm are susceptible to point-load fracture without structural sub-framing.',
      humanReviewRequired: true,
      status: 'Open',
      isDemoFinding: true,
      analysisSource: 'Demo Sample',
    },
  ];

  const stages: AnalysisStageEvent[] = [
    { stageIndex: 0, stageName: 'Validating files', status: 'completed', detail: 'Validated 5 synthetic demo files', timestamp: now },
    { stageIndex: 1, stageName: 'Extracting text and tables', status: 'completed', detail: 'Extracted 7 pages/sheets and 2 structured tables', timestamp: now },
    { stageIndex: 2, stageName: 'Processing scanned pages', status: 'completed', detail: 'Processed Page 2 handwritten site notes (94.2% OCR confidence)', timestamp: now },
    { stageIndex: 3, stageName: 'Analysing drawings and images', status: 'completed', detail: 'Inspected North Wall & Master Wardrobe elevations', timestamp: now },
    { stageIndex: 4, stageName: 'Comparing documents', status: 'completed', detail: 'Cross-checked FR Survey, TeoWin XML, Dossier PDF, and Costing XLSX', timestamp: now },
    { stageIndex: 5, stageName: 'Running technical rules', status: 'completed', detail: 'Evaluated 12 enabled technical rules', timestamp: now },
    { stageIndex: 6, stageName: 'Generating AI findings', status: 'completed', detail: 'Loaded 8 clearly labelled synthetic demo findings', timestamp: now },
    { stageIndex: 7, stageName: 'Preparing the report', status: 'completed', detail: 'Compiled technical review report', timestamp: now },
  ];

  const categoryOutcomes: CategoryOutcome[] = ALL_CHECK_CATEGORIES.map((cat) => {
    const matching = demoFindings.filter((f) => f.category === cat);
    if (matching.length > 0) {
      return {
        category: cat,
        status: 'Issue Found',
        summary: `${matching.length} synthetic sample issue(s) flagged in this category.`,
      };
    }
    return {
      category: cat,
      status: 'Needs Review',
      summary: 'Evaluated in synthetic demo mode; human technical review required before production release.',
    };
  });

  db.run(
    `INSERT INTO analysis_runs (
      id, projectId, status, mode, isDemoMode, selectedChecksJson,
      currentStageIndex, currentStageName, progressPercent, stagesJson,
      overallVerdict, summaryText, categoryOutcomesJson, startedAt, completedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      DEMO_RUN_ID,
      DEMO_PROJECT_ID,
      'Completed',
      'Demo Sample Analysis',
      1,
      JSON.stringify(ALL_CHECK_CATEGORIES),
      7,
      'Preparing the report',
      100,
      JSON.stringify(stages),
      'Needs Attention',
      'DEMO ANALYSIS RECORD (SYNTHETIC DATA): 8 technical discrepancies and missing details were identified across the synthetic sample dossier, including a critical 40 mm North Wall length overrun + 180×220 mm structural pillar conflict, a RAL 7035 vs RAL 7039 lacquer finish mismatch, and a 200 EUR costing arithmetic discrepancy.',
      JSON.stringify(categoryOutcomes),
      now,
      now,
    ]
  );

  const findingStmt = db.prepare(`
    INSERT INTO findings (
      id, analysisRunId, projectId, title, category, severity, confidence,
      findingType, description, evidence, sourceFilesJson, expectedValue,
      observedValue, suggestedCorrection, reasonForSuggestion, humanReviewRequired,
      status, isDemoFinding, analysisSource, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const f of demoFindings) {
    findingStmt.run([
      f.id,
      f.analysisRunId,
      f.projectId,
      f.title,
      f.category,
      f.severity,
      f.confidence,
      f.findingType,
      f.description,
      f.evidence,
      JSON.stringify(f.sourceFiles),
      f.expectedValue || null,
      f.observedValue || null,
      f.suggestedCorrection,
      f.reasonForSuggestion,
      f.humanReviewRequired ? 1 : 0,
      f.status,
      1,
      f.analysisSource,
      now,
    ]);
  }
  findingStmt.free();

  db.run(
    `INSERT INTO reports (
      id, projectId, projectName, projectReference, analysisRunId,
      reportDate, totalFindings, criticalHighIssues, reviewer, isDemoReport, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      DEMO_REPORT_ID,
      DEMO_PROJECT_ID,
      'Modern Kitchen & Wardrobe — Project Demo',
      'KW-2026-0842-DEMO',
      DEMO_RUN_ID,
      now,
      demoFindings.length,
      demoFindings.filter((f) => f.severity === 'Critical' || f.severity === 'High').length,
      'Elena Rostova',
      1,
      'Pre-generated Demo Technical Review Report based on synthetic sample documents.',
    ]
  );

  logActivity(
    db,
    'Demo Project Loaded',
    'Loaded "Modern Kitchen & Wardrobe — Project Demo" with 5 synthetic sample documents and 8 sample findings.',
    'System Demo Loader',
    DEMO_PROJECT_ID,
    'Modern Kitchen & Wardrobe — Project Demo'
  );

  saveDb();
  return DEMO_PROJECT_ID;
}
