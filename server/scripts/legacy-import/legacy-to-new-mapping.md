# Legacy → New Schema Mapping

| Legacy CSV column                | New Prisma model | New field (type)                     | Notes / transformation |
|---------------------------------|------------------|--------------------------------------|------------------------|
| `_id`                           | CustomerRecord   | `legacyMongoId` (String)            | Stores original MongoDB document ID – used for idempotent imports.
| `name`                          | Customer         | `name` (String)                     | Trim whitespace, keep original spelling.
| `mobNumber`                     | Customer         | `mobNumber` (String?)               | Keep as‑is (string), preserve leading zeros. Empty → `null`.
| `gender`                        | Customer         | `gender` (String?)                  | Normalise to lower‑case values: `male`, `female`, `other`. Unrecognised → keep original for review.
| `reference`                     | CustomerNoteVersion | `content` (String)                | Insert as a staff note linked to the customer. Ignored if empty.
| `specsType`                     | CustomerRecord   | `specsType` (String?)               | Direct copy.
| `lensType`                      | CustomerRecord   | `lensType` (String?)                | Direct copy.
| `mrp`                           | CustomerRecord   | `mrp` (Decimal)                     | Parse to number; kept as‑is. If missing → `null`.
| `createdAt` / `updatedAt`       | CustomerRecord   | `purchaseDate` (DateTime?)          | Use `createdAt` as the historical purchase date when it represents a purchase; otherwise leave `null`. Preserve timezone.
| `re_dist.sph`                   | Prescription     | `reDistSph` (Decimal?)              | Parse float, keep sign.
| `re_dist.cyl`                   | Prescription     | `reDistCyl` (Decimal?)              | Same as above.
| `re_dist.axis`                  | Prescription     | `reDistAxis` (Int?)                 | Parse int.
| `re_near.sph` / `re_near.cyl` / `re_near.axis` | Prescription | `reNearSph`, `reNearCyl`, `reNearAxis` | Same conversion.
| `le_dist.sph` / `le_dist.cyl` / `le_dist.axis` | Prescription | `leDistSph`, `leDistCyl`, `leDistAxis` | Same conversion.
| `le_near.sph` / `le_near.cyl` / `le_near.axis` | Prescription | `leNearSph`, `leNearCyl`, `leNearAxis` | Same conversion.
| `__v` (Mongo version)           | –                | –                                    | Ignored.
| `ageAtRecording` (if present)   | Customer         | `ageAtRecording` (Int?)             | Optional – not in current CSV example.
| `legacyMongoId` (optional)      | Customer         | `legacyMongoId` (String?)           | Not present in CSV; we keep the `_id` mapping only for purchases.

**Relationship building**
- One **Customer** is created per distinct `mobNumber` + `name` combination **or** per unique `_id` if the CSV contains the same customer multiple times with different purchases.
- Each **CustomerRecord** references its **Customer** via `customerId` and optionally a **Prescription** via `prescriptionId`.
- When a prescription row contains *any* non‑null value, we create a **Prescription** record and set `createdForPurchaseId` to the generated UUID of the corresponding **CustomerRecord**.
- Staff notes (`reference`) become a **CustomerNoteVersion** linked to the same `customerId`.

**Important defaults**
- `pricingMode` → `MRP_ONLY` (the CSV only provides `mrp`).
- `shopId` must be supplied when running the import (e.g. `--shop-id <uuid>`). This value is copied to every created **Customer** and **CustomerRecord**.
- `isActive` defaults to `true` for all imported customers.

---

*This file lives at* `server/scripts/legacy-import/legacy-to-new-mapping.md`.
