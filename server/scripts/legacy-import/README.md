# Legacy CSV Import

This script package helps you migrate customer data from the old MongoDB‑based CSV export into the new Optical CRM PostgreSQL schema.

## Directory layout
```
legacy-import/
  ├─ README.md                # (this file)
  ├─ cleanLegacyCsv.ts        # Parse CSV, generate data‑quality report
  ├─ validateLegacyData.ts    # Validate cleaned rows against Prisma requirements
  ├─ transformLegacyData.ts   # Convert cleaned rows into JSON ready for Prisma `createMany`
  ├─ reports/                 # Generated quality reports (git‑ignored)
  └─ output/                  # Cleaned & transformed files (git‑ignored)
```

## How to run
```bash
# Install dependencies (if not already present)
npm install csv-parse dayjs uuid

# Step 1 – clean & report
node scripts/legacy-import/cleanLegacyCsv.ts --input "C:\Users\x03xN\Downloads\HOCustomer data.csv" --report reports/quality-report.json

# Step 2 – validation (optional but recommended)
node scripts/legacy-import/validateLegacyData.ts --clean reports/cleaned-data.json --out reports/validation-report.json

# Step 3 – transformation
node scripts/legacy-import/transformLegacyData.ts --clean reports/cleaned-data.json --out output/

# Review the generated JSON files in `output/`.  When you are satisfied you can load them with Prisma, e.g.:
# npx prisma db seed --preview-feature --seed ./scripts/legacy-import/output/seed.ts
```

## Important notes
- The script **does NOT write to the live database** unless you explicitly run a Prisma seed/loader.
- All generated files are placed under `reports/` and `output/` and are added to `.gitignore` automatically.
- Duplicate detection uses the legacy `_id` (`legacyMongoId`) and optional mobile‑number heuristics.
- Old `reference` values are migrated to `CustomerNoteVersion` entries.
- Dates are parsed with `dayjs` preserving timezone info.
- Pricing mode defaults to `MRP_ONLY`; if you need `SPLIT` you must supply `frameRate` / `lensRate` in the CSV.

## Adding to `package.json`
You may want to add convenient npm scripts:
```json
"scripts": {
  "legacy:clean": "node scripts/legacy-import/cleanLegacyCsv.ts",
  "legacy:validate": "node scripts/legacy-import/validateLegacyData.ts",
  "legacy:transform": "node scripts/legacy-import/transformLegacyData.ts"
}
```

Feel free to adjust paths or options as needed.
