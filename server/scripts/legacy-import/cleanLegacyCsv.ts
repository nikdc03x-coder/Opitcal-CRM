import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * CLI arguments:
 *   --input <path to CSV>
 *   --report <path to output JSON report>
 */

function parseArgs() {
  const args = process.argv.slice(2);
  const getArg = (name: string) => {
    const idx = args.indexOf(name);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    return undefined;
  };
  const input = getArg('--input');
  const report = getArg('--report');
  if (!input || !report) {
    console.error('Usage: node cleanLegacyCsv.ts --input <csv> --report <json>');
    process.exit(1);
  }
  return { input, report };
}

interface RawRow {
  _id: string;
  name: string;
  mobNumber?: string;
  specsType?: string;
  lensType?: string;
  [key: string]: any; // other fields like prescriptions, mrp, dates, etc.
}

interface CleanedRow extends RawRow {
  // normalized fields
  mobNumber?: string | null;
  gender?: string | null;
  mrp?: number | null;
  createdAt?: string | null; // ISO string
  updatedAt?: string | null;
  // parsed prescription numbers as numbers or null
  reDistSph?: number | null;
  // ... (other prescription fields)
}

async function main() {
  const { input, report } = parseArgs();

  const records: RawRow[] = [];
  const parser = fs
    .createReadStream(input)
    .pipe(
      parse({
        columns: true,
        trim: true,
        skip_empty_lines: true,
      })
    );

  for await (const record of parser) {
    records.push(record as RawRow);
  }

  // Data‑quality analysis
  const total = records.length;
  const missingMob = records.filter(r => !r.mobNumber).length;
  const duplicateIds = records.reduce((acc, r) => {
    acc[r._id] = (acc[r._id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const duplicateCount = Object.values(duplicateIds).filter(c => c > 1).length;

  const reportObj = {
    totalRecords: total,
    missingMobNumber: missingMob,
    duplicateLegacyIds: duplicateCount,
    duplicateIdMap: duplicateIds,
    // more metrics can be added later
  };

  // Ensure directory exists
  const reportDir = path.dirname(report);
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(report, JSON.stringify(reportObj, null, 2), 'utf-8');

  console.log('Data‑quality report written to', report);
}

main().catch(err => {
  console.error('Error during cleaning:', err);
  process.exit(1);
});
