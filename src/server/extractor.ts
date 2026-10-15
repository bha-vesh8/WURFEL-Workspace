import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { createWorker } from 'tesseract.js';
import { DocumentRole, ExtractedPageOrSheet, ExtractionStatus } from '../types.ts';

export interface ExtractionResult {
  extractionStatus: ExtractionStatus;
  extractionMethod: string;
  extractedText: string;
  pages: ExtractedPageOrSheet[];
  warnings: string[];
  ocrConfidence?: number;
  suggestedRole: DocumentRole;
  unsupportedReason?: string;
  recommendedFormat?: string;
}

export function suggestDocumentRole(originalName: string, extractedText: string): DocumentRole {
  const lowerName = originalName.toLowerCase();
  const lowerText = extractedText.toLowerCase().slice(0, 3000);

  if (
    lowerName.includes('fr_') ||
    lowerName.includes('site') ||
    lowerName.includes('measure') ||
    lowerName.includes('survey') ||
    lowerName.includes('releve') ||
    lowerText.includes('site measurement') ||
    lowerText.includes('laser')
  ) {
    return 'FR / Site Measurement';
  }
  if (
    lowerName.includes('teowin') ||
    lowerName.includes('bom') ||
    lowerName.includes('erp') ||
    lowerText.includes('teowin') ||
    lowerText.includes('<modules')
  ) {
    return 'TeoWin Export';
  }
  if (
    lowerName.includes('cost') ||
    lowerName.includes('price') ||
    lowerName.includes('quote') ||
    lowerName.includes('commercial') ||
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.csv')
  ) {
    return 'Costing Sheet';
  }
  if (
    lowerName.includes('draw') ||
    lowerName.includes('elev') ||
    lowerName.includes('plan') ||
    lowerName.includes('section') ||
    lowerName.endsWith('.dxf')
  ) {
    return 'Technical Drawing';
  }
  if (
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.webp') ||
    lowerName.endsWith('.tif') ||
    lowerName.endsWith('.tiff')
  ) {
    return 'Reference Image';
  }
  if (
    lowerName.includes('dossier') ||
    lowerName.includes('spec') ||
    lowerName.includes('tech') ||
    lowerName.endsWith('.pdf') ||
    lowerName.endsWith('.docx')
  ) {
    return 'Technical Dossier';
  }
  return 'Other';
}

function detectValuesFromText(text: string): ExtractedPageOrSheet['detectedValues'] {
  const dimMatches = Array.from(
    new Set(text.match(/\b\d{2,4}\s*(?:x\s*\d{2,4}\s*(?:x\s*\d{2,4}\s*)?)?(?:mm|cm|m)\b/gi) || [])
  ).slice(0, 25);

  const codeMatches = Array.from(
    new Set(text.match(/\b(?:[A-Z]{2,6}-[A-Z0-9]{2,8}(?:-[A-Z0-9]{1,6})?)\b/g) || [])
  ).slice(0, 25);

  const finishMatches = Array.from(
    new Set(text.match(/\b(?:RAL\s*\d{4}|LAC-[A-Z0-9-]+|EGGER-[A-Z0-9-]+|FENIX-[A-Z0-9-]+)\b/gi) || [])
  ).slice(0, 15);

  return {
    dimensions: dimMatches,
    productCodes: codeMatches,
    finishCodes: finishMatches,
  };
}

export async function extractUploadedFile(
  filePath: string,
  originalName: string,
  mimeType: string
): Promise<ExtractionResult> {
  const ext = path.extname(originalName).toLowerCase();
  const warnings: string[] = [];

  try {
    // 1. Check explicitly unsupported binary/proprietary CAD formats first
    if (ext === '.dwg') {
      return {
        extractionStatus: 'Unsupported',
        extractionMethod: 'Format Validator',
        extractedText: '',
        pages: [],
        warnings: [
          `File "${originalName}" (${ext}) uses proprietary AutoCAD DWG binary encoding.`,
        ],
        suggestedRole: 'Technical Drawing',
        unsupportedReason: `Native binary AutoCAD (${ext}) files cannot be parsed locally without an external CAD converter.`,
        recommendedFormat: 'Please export the drawing from your CAD system as .PDF (vector/dimensioned) or ASCII .DXF and re-upload.',
      };
    }

    if (ext === '.teo' || ext === '.twd' || ext === '.twp') {
      return {
        extractionStatus: 'Unsupported',
        extractionMethod: 'Format Validator',
        extractedText: '',
        pages: [],
        warnings: [
          `File "${originalName}" (${ext}) is a proprietary native TeoWin project container.`,
        ],
        suggestedRole: 'TeoWin Export',
        unsupportedReason: `WURFEL operates independently of TeoWin and does not parse proprietary native (${ext}) binary containers without verified format specifications.`,
        recommendedFormat: 'Please export the TeoWin project bill of materials and drawings to .XML, .XLSX, .CSV, or .PDF.',
      };
    }

    // 2. Excel / CSV spreadsheets
    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      const buffer = fs.readFileSync(filePath);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const pages: ExtractedPageOrSheet[] = [];
      const allTextParts: string[] = [];

      workbook.SheetNames.forEach((sheetName, idx) => {
        const sheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        const headers = jsonRows.length > 0 ? Object.keys(jsonRows[0]) : [];
        const rowsPreview = jsonRows.slice(0, 100).map((r, rIdx) => {
          const cleanRow: Record<string, string | number> = { _Row: rIdx + 2 };
          for (const h of headers) {
            cleanRow[h] = typeof r[h] === 'number' ? r[h] : String(r[h] ?? '');
          }
          return cleanRow;
        });

        const textLines = jsonRows.map(
          (r, i) => `Row ${i + 2}: ` + headers.map((h) => `${h}=${r[h]}`).join(' | ')
        );
        const sheetText = `Sheet "${sheetName}" (${jsonRows.length} rows):\n` + textLines.join('\n');
        allTextParts.push(sheetText);

        const quantities: NonNullable<ExtractedPageOrSheet['detectedValues']>['quantities'] = [];
        for (const r of jsonRows) {
          const keys = Object.keys(r);
          const codeKey = keys.find((k) => /code|ref|sku|item|module/i.test(k));
          const descKey = keys.find((k) => /desc|name|title|component/i.test(k));
          const qtyKey = keys.find((k) => /qty|quant|count|pcs/i.test(k));
          const priceKey = keys.find((k) => /unit.*price|price|rate|cost/i.test(k));
          const totalKey = keys.find((k) => /total|amount|ext|subtotal/i.test(k));

          if (qtyKey && r[qtyKey] !== '') {
            const qtyVal = Number(String(r[qtyKey]).replace(/[^0-9.-]/g, ''));
            const unitVal = priceKey ? Number(String(r[priceKey]).replace(/[^0-9.-]/g, '')) : undefined;
            const totVal = totalKey ? Number(String(r[totalKey]).replace(/[^0-9.-]/g, '')) : undefined;
            if (!Number.isNaN(qtyVal)) {
              quantities.push({
                code: codeKey ? String(r[codeKey]) : 'ITEM',
                description: descKey ? String(r[descKey]) : 'Spreadsheet row item',
                qty: qtyVal,
                unitPrice: unitVal !== undefined && !Number.isNaN(unitVal) ? unitVal : undefined,
                lineTotal: totVal !== undefined && !Number.isNaN(totVal) ? totVal : undefined,
              });
            }
          }
        }

        const detected = detectValuesFromText(sheetText);
        pages.push({
          pageNumber: idx + 1,
          label: `Sheet ${idx + 1} — ${sheetName} (${jsonRows.length} rows)`,
          contentType: 'costing',
          text: sheetText,
          tables: [
            {
              name: sheetName,
              headers: ['_Row', ...headers],
              rows: rowsPreview,
            },
          ],
          detectedValues: {
            ...detected,
            quantities,
          },
          selectedForReview: true,
        });
      });

      const fullText = allTextParts.join('\n\n');
      return {
        extractionStatus: 'Extracted',
        extractionMethod: 'SheetJS Spreadsheet & Arithmetic Parser',
        extractedText: fullText,
        pages,
        warnings,
        suggestedRole: suggestDocumentRole(originalName, fullText),
      };
    }

    // 3. Word Documents (.docx / .doc)
    if (ext === '.docx' || ext === '.doc') {
      if (ext === '.doc') {
        warnings.push('Legacy binary .doc format detected; attempting raw text extraction. Convert to .docx for full table fidelity.');
      }
      const buffer = fs.readFileSync(filePath);
      try {
        const result = await mammoth.extractRawText({ buffer });
        const text = result.value.trim();
        if (result.messages?.length) {
          warnings.push(...result.messages.map((m) => m.message));
        }
        const paragraphs = text.split(/\n{2,}/).filter(Boolean);
        const chunks: string[] = [];
        for (let i = 0; i < Math.max(1, paragraphs.length); i += 12) {
          chunks.push(paragraphs.slice(i, i + 12).join('\n\n'));
        }
        const pages: ExtractedPageOrSheet[] = chunks.map((c, idx) => ({
          pageNumber: idx + 1,
          label: `Section ${idx + 1}`,
          contentType: 'text',
          text: c || '(Empty document section)',
          detectedValues: detectValuesFromText(c),
          selectedForReview: true,
        }));
        return {
          extractionStatus: text.length > 0 ? 'Extracted' : 'Partial',
          extractionMethod: 'Mammoth DOCX Text & Section Extractor',
          extractedText: text,
          pages,
          warnings: [
            ...warnings,
            'Embedded vector shapes inside DOCX are not rendered by Mammoth; text and headings were extracted.',
          ],
          suggestedRole: suggestDocumentRole(originalName, text),
        };
      } catch (docErr: any) {
        return {
          extractionStatus: 'Partial',
          extractionMethod: 'Fallback Text Reader',
          extractedText: '',
          pages: [],
          warnings: [`Could not parse Word document structure: ${docErr?.message || 'Unknown error'}. Recommend saving as .docx or .pdf.`],
          suggestedRole: 'Technical Dossier',
        };
      }
    }

    // 4. PowerPoint Presentations (.pptx / .ppt)
    if (ext === '.pptx' || ext === '.ppt') {
      if (ext === '.ppt') {
        return {
          extractionStatus: 'Unsupported',
          extractionMethod: 'Presentation Validator',
          extractedText: '',
          pages: [],
          warnings: [`Legacy binary PowerPoint (${ext}) is not supported directly.`],
          suggestedRole: 'Technical Dossier',
          unsupportedReason: 'Legacy binary PowerPoint (.ppt) files cannot be unpacked locally.',
          recommendedFormat: 'Please save the presentation as .PPTX or .PDF and re-upload.',
        };
      }
      const buffer = fs.readFileSync(filePath);
      const zip = await JSZip.loadAsync(buffer);
      const slideFiles = Object.keys(zip.files)
        .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
        .sort((a, b) => {
          const na = parseInt(a.match(/\d+/)?.[0] || '0', 10);
          const nb = parseInt(b.match(/\d+/)?.[0] || '0', 10);
          return na - nb;
        });

      const pages: ExtractedPageOrSheet[] = [];
      const allTexts: string[] = [];

      for (let i = 0; i < slideFiles.length; i++) {
        const xmlStr = await zip.files[slideFiles[i]].async('string');
        const textRuns = Array.from(xmlStr.matchAll(/<a:t>([^<]*)<\/a:t>/g)).map((m) => m[1]);
        const slideText = textRuns.join(' ').trim() || '(No extractable text on slide)';
        allTexts.push(`Slide ${i + 1}: ${slideText}`);
        pages.push({
          pageNumber: i + 1,
          label: `Slide ${i + 1}`,
          contentType: 'text',
          text: slideText,
          detectedValues: detectValuesFromText(slideText),
          selectedForReview: true,
        });
      }

      const combined = allTexts.join('\n\n');
      return {
        extractionStatus: pages.length > 0 ? 'Extracted' : 'Partial',
        extractionMethod: 'PPTX OpenXML Slide Extractor',
        extractedText: combined,
        pages,
        warnings: ['Extracted slide text nodes; embedded slide raster graphics require PDF or image export for OCR.'],
        suggestedRole: suggestDocumentRole(originalName, combined),
      };
    }

    // 5. Text, Markdown, JSON, XML, DXF
    if (['.txt', '.md', '.json', '.xml', '.dxf'].includes(ext)) {
      const rawText = fs.readFileSync(filePath, 'utf-8');
      let formattedText = rawText;

      if (ext === '.json') {
        try {
          const parsed = JSON.parse(rawText);
          formattedText = JSON.stringify(parsed, null, 2);
        } catch {
          warnings.push('JSON syntax warning: file could not be strictly parsed as valid JSON; raw text preserved.');
        }
      } else if (ext === '.dxf') {
        const dxfTexts = Array.from(rawText.matchAll(/\n\s*1\r?\n([^\r\n]+)/g)).map((m) => m[1].trim());
        formattedText =
          `DXF 2D Drawing Entities Extracted (${dxfTexts.length} text annotations):\n` +
          dxfTexts.slice(0, 200).join('\n');
        warnings.push('Extracted ASCII DXF text and dimension callouts; geometric polylines require CAD viewer.');
      }

      const lines = formattedText.split(/\r?\n/);
      const pages: ExtractedPageOrSheet[] = [];
      const linesPerPage = 60;
      for (let i = 0; i < Math.max(1, lines.length); i += linesPerPage) {
        const slice = lines.slice(i, i + linesPerPage).join('\n');
        const pNum = Math.floor(i / linesPerPage) + 1;
        pages.push({
          pageNumber: pNum,
          label: `${ext.toUpperCase().slice(1)} Segment ${pNum}`,
          contentType: ext === '.dxf' ? 'drawing' : 'text',
          text: slice,
          detectedValues: detectValuesFromText(slice),
          selectedForReview: true,
        });
      }

      return {
        extractionStatus: 'Extracted',
        extractionMethod: `Structured ${ext.toUpperCase().slice(1)} Parser`,
        extractedText: formattedText,
        pages,
        warnings,
        suggestedRole: suggestDocumentRole(originalName, formattedText),
      };
    }

    // 6. Images (.png, .jpg, .jpeg, .webp, .tif, .tiff) -> Local Tesseract OCR
    if (['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff'].includes(ext)) {
      let ocrText = '';
      let confidence: number | undefined;
      let method = 'Image Preview + Local Tesseract.js OCR';

      if (ext === '.tif' || ext === '.tiff') {
        warnings.push('TIFF image uploaded; browser preview and OCR support depend on uncompressed/standard encoding.');
      }

      try {
        const worker = await createWorker('eng');
        const ret = await worker.recognize(filePath);
        ocrText = (ret.data.text || '').trim();
        confidence = typeof ret.data.confidence === 'number' ? Number(ret.data.confidence.toFixed(1)) : undefined;
        await worker.terminate();
      } catch (ocrErr: any) {
        method = 'Image Preview (OCR Fallback)';
        warnings.push(
          `Local OCR pass could not complete (${ocrErr?.message || 'Tesseract worker offline'}); image preserved for visual inspection and Vision AI review.`
        );
      }

      if (!ocrText) {
        ocrText = `[Image Uploaded: ${originalName}] — Visual drawing/photo preserved. No dense machine-readable text block detected by OCR; flagged for visual technical review.`;
        warnings.push('OCR detected minimal or low-contrast text on this image. Symbols and dimension lines require human or Vision AI inspection.');
      } else if (confidence !== undefined && confidence < 75) {
        warnings.push(`Low OCR confidence (${confidence}%): dimension callouts or small drawing annotations may be ambiguous.`);
      }

      const pages: ExtractedPageOrSheet[] = [
        {
          pageNumber: 1,
          label: `Image 1 — ${originalName}`,
          contentType: 'drawing',
          text: ocrText,
          ocrConfidence: confidence,
          detectedValues: detectValuesFromText(ocrText),
          warnings,
          selectedForReview: true,
        },
      ];

      return {
        extractionStatus: 'Extracted',
        extractionMethod: method,
        extractedText: ocrText,
        pages,
        warnings,
        ocrConfidence: confidence,
        suggestedRole: suggestDocumentRole(originalName, ocrText),
      };
    }

    // 7. PDF Files (.pdf)
    if (ext === '.pdf') {
      const buffer = fs.readFileSync(filePath);
      const rawLatin = buffer.toString('latin1');
      const rawUtf8 = buffer.toString('utf-8');

      const pageCountMatch = rawLatin.match(/\/Count\s+(\d+)/);
      const estimatedPages = pageCountMatch ? Math.min(25, Math.max(1, parseInt(pageCountMatch[1], 10))) : 1;

      const literalStrings: string[] = [];
      const regex = /\(([^()\\]{3,200})\)/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(rawLatin)) !== null) {
        const cleaned = match[1].replace(/[^\x20-\x7E]/g, ' ').trim();
        if (cleaned.length >= 3 && /[a-zA-Z0-9]/.test(cleaned) && !cleaned.startsWith('PDF-')) {
          literalStrings.push(cleaned);
        }
      }

      let extractedText = '';
      if (!rawLatin.startsWith('%PDF-')) {
        extractedText = rawUtf8.trim();
      } else if (literalStrings.length > 0) {
        extractedText = literalStrings.join('\n');
      }

      if (!extractedText || extractedText.length < 30) {
        extractedText = `[PDF Document: ${originalName} (${estimatedPages} page(s), ${(buffer.length / 1024).toFixed(1)} KB)] — Page contains scanned raster graphics or vector curves with minimal embedded text stream. Flagged for Vision AI / human drawing review.`;
        warnings.push(
          'This PDF contains scanned pages or vector outlines without dense embedded text streams. Verify dimensions directly in the PDF preview.'
        );
      }

      const lines = extractedText.split(/\r?\n/).filter(Boolean);
      const numPages = Math.max(1, Math.min(estimatedPages, Math.ceil(lines.length / 25) || 1));
      const chunkSize = Math.max(1, Math.ceil(lines.length / numPages));

      const pages: ExtractedPageOrSheet[] = [];
      for (let p = 0; p < numPages; p++) {
        const pageLines = lines.slice(p * chunkSize, (p + 1) * chunkSize).join('\n');
        const lowerPage = pageLines.toLowerCase();
        let contentType: ExtractedPageOrSheet['contentType'] = 'text';
        if (lowerPage.includes('cost') || lowerPage.includes('eur') || lowerPage.includes('price')) {
          contentType = 'costing';
        } else if (lowerPage.includes('drawing') || lowerPage.includes('elevation') || lowerPage.includes('scale')) {
          contentType = 'drawing';
        } else if (pageLines.length < 60) {
          contentType = 'scanned';
        }

        pages.push({
          pageNumber: p + 1,
          label: `Page ${p + 1} (${contentType.toUpperCase()})`,
          contentType,
          text: pageLines || `(Page ${p + 1} — Visual/Vector Content)`,
          detectedValues: detectValuesFromText(pageLines),
          selectedForReview: true,
        });
      }

      return {
        extractionStatus: 'Extracted',
        extractionMethod: 'PDF Stream & Page Inspector',
        extractedText,
        pages,
        warnings,
        suggestedRole: suggestDocumentRole(originalName, extractedText),
      };
    }

    // 8. Unsupported
    return {
      extractionStatus: 'Unsupported',
      extractionMethod: 'Format Validator',
      extractedText: '',
      pages: [],
      warnings: [
        `Unsupported file format "${ext || 'unknown'}" for "${originalName}".`,
      ],
      suggestedRole: 'Other',
      unsupportedReason: `File "${originalName}" has extension "${ext || 'none'}", which is not supported by the local extraction pipeline.`,
      recommendedFormat: 'Supported formats: .PDF, .PNG, .JPG, .WEBP, .DOCX, .XLSX, .CSV, .PPTX, .TXT, .MD, .JSON, .XML, .DXF.',
    };
  } catch (err: any) {
    return {
      extractionStatus: 'Error',
      extractionMethod: 'Extraction Error Handler',
      extractedText: '',
      pages: [],
      warnings: [`Error extracting "${originalName}": ${err?.message || 'Malformed file content'}`],
      suggestedRole: 'Other',
    };
  }
}
