import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/database";
import type { AnalyticsPeriod, AnalyticsRank, AnalyticsSummary } from "../models/analytics";
import type { AnalyticsQuery } from "../validators/analyticsValidator";

const unknown = (column: Prisma.Sql) =>
  Prisma.sql`COALESCE(NULLIF(BTRIM(${column}), ''), 'Unknown')`;
export const purchaseMixSql = Prisma.sql`CASE WHEN has_frame AND has_lens THEN 'Frame + Lens' WHEN has_frame THEN 'Frame Only'
  WHEN has_lens THEN 'Lens Only' ELSE 'Unclassified' END`;
export function periodWhere(period: AnalyticsPeriod, column = Prisma.sql`purchase_date`) {
  return period.from && period.to
    ? Prisma.sql`${column} BETWEEN ${period.from}::date AND ${period.to}::date`
    : Prisma.sql`TRUE`;
}

// nik - Catalog joins are one-to-one, verified against the customer's shop, and never change saved descriptions.
export function analyticsCte(shopId: string, period: AnalyticsPeriod, query: AnalyticsQuery) {
  const filters: Prisma.Sql[] = [periodWhere(period)];
  for (const [value, column] of [
    [query.brand, Prisma.sql`frame_brand`],
    [query.style, Prisma.sql`frame_style`],
    [query.company, Prisma.sql`lens_company`],
    [query.vision, Prisma.sql`vision_type`],
    [query.model, Prisma.sql`frame_model`],
    [query.lensName, Prisma.sql`lens_name`],
    [query.coating, Prisma.sql`coating`],
    [query.frame, Prisma.sql`frame_description`],
    [query.lens, Prisma.sql`lens_description`],
    [query.mix, Prisma.sql`mix`],
  ] as const)
    if (value) filters.push(Prisma.sql`${column} = ${value}`);
  if (query.search) {
    const pattern = `%${query.search.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(Prisma.sql`(customer_name ILIKE ${pattern} OR mobile ILIKE ${pattern})`);
  }
  return Prisma.sql`
    WITH purchases AS (
      SELECT r.id, r."customerId" AS customer_id, c.name AS customer_name, c."mobNumber" AS mobile,
        c.gender, c."ageAtRecording" AS recorded_age, r."purchaseDate" AS purchase_date,
        r."pricingMode"::text AS pricing_mode, r."frameRate" AS frame_rate, r."lensRate" AS lens_rate, r.mrp,
        NULLIF(BTRIM(r."specsType"), '') AS frame, NULLIF(BTRIM(r."lensType"), '') AS lens,
        ${unknown(Prisma.sql`f.brand`)} AS frame_brand, ${unknown(Prisma.sql`f.model`)} AS frame_model,
        ${unknown(Prisma.sql`f."frameStyle"`)} AS frame_style,
        ${unknown(Prisma.sql`l.company`)} AS lens_company, ${unknown(Prisma.sql`l."lensName"`)} AS lens_name,
        ${unknown(Prisma.sql`l.coating`)} AS coating,
        CASE LOWER(BTRIM(l."visionType"))
          WHEN 'single vision' THEN 'Single Vision' WHEN 'single-vision' THEN 'Single Vision' WHEN 'sv' THEN 'Single Vision'
          WHEN 'progressive' THEN 'Progressive' WHEN 'progressives' THEN 'Progressive' WHEN 'pal' THEN 'Progressive'
          WHEN 'bifocal' THEN 'Bifocal' WHEN 'bifocals' THEN 'Bifocal'
          ELSE ${unknown(Prisma.sql`l."visionType"`)} END AS vision_type,
        COALESCE(NULLIF(BTRIM(r."specsType"), ''), NULLIF(CONCAT_WS(' - ', f.brand, f.model), ''), 'Unknown') AS frame_description,
        COALESCE(NULLIF(BTRIM(r."lensType"), ''), NULLIF(l."lensName", ''), 'Unknown') AS lens_description,
        (NULLIF(BTRIM(r."specsType"), '') IS NOT NULL OR f.id IS NOT NULL) AS has_frame,
        (NULLIF(BTRIM(r."lensType"), '') IS NOT NULL OR l.id IS NOT NULL) AS has_lens
      FROM "CustomerRecord" r JOIN "Customer" c ON c.id = r."customerId"
      LEFT JOIN "FrameCatalog" f ON f.id = r."frameCatalogId" AND f."shopId" = c."shopId"
      LEFT JOIN "LensCatalog" l ON l.id = r."lensCatalogId" AND l."shopId" = c."shopId"
      WHERE c."shopId" = ${shopId} AND c."isActive" = TRUE AND c."deletedAt" IS NULL AND r."deletionGroupId" IS NULL AND r."deletedAt" IS NULL
    ), classified AS (
      SELECT *, ${purchaseMixSql} AS mix FROM purchases
    ), filtered AS (SELECT * FROM classified WHERE ${Prisma.join(filters, " AND ")})
  `;
}

export async function queryRows<T>(cte: Prisma.Sql, statement: Prisma.Sql): Promise<T[]> {
  return prisma.$queryRaw<T[]>(Prisma.sql`${cte} ${statement}`);
}
export async function queryObject<T>(cte: Prisma.Sql, statement: Prisma.Sql): Promise<T> {
  const rows = await queryRows<{ data: T }>(
    cte,
    Prisma.sql`SELECT TO_JSONB(report) AS data FROM (${statement}) report`,
  );
  return rows[0].data;
}

// nik - Aggregate full matching sets in PostgreSQL numeric arithmetic before applying pagination.
export function summaryFor(cte: Prisma.Sql): Promise<AnalyticsSummary> {
  return queryObject(
    cte,
    Prisma.sql`
    SELECT COUNT(*)::int AS purchases, COALESCE(SUM(mrp), 0)::text AS value,
      COUNT(DISTINCT customer_id)::int AS customers, COALESCE(ROUND(AVG(mrp), 2), 0)::text AS average,
      COALESCE(MAX(mrp), 0)::text AS highest,
      COUNT(*) FILTER (WHERE has_frame)::int AS frames, COUNT(*) FILTER (WHERE has_lens)::int AS lenses,
      COUNT(*) FILTER (WHERE mix = 'Frame Only')::int AS "frameOnly",
      COUNT(*) FILTER (WHERE mix = 'Lens Only')::int AS "lensOnly",
      COUNT(*) FILTER (WHERE mix = 'Frame + Lens')::int AS both,
      COUNT(*) FILTER (WHERE mix = 'Unclassified')::int AS unclassified,
      COUNT(*) FILTER (WHERE purchase_date IS NULL)::int AS undated FROM filtered
  `,
  );
}

export const rankColumns = {
  brand: Prisma.sql`frame_brand`,
  model: Prisma.sql`frame_model`,
  style: Prisma.sql`frame_style`,
  frame: Prisma.sql`frame_description`,
  company: Prisma.sql`lens_company`,
  name: Prisma.sql`lens_name`,
  vision: Prisma.sql`vision_type`,
  coating: Prisma.sql`coating`,
  lens: Prisma.sql`lens_description`,
  mix: Prisma.sql`mix`,
  combination: Prisma.sql`frame_description || ' + ' || lens_description`,
};
export async function ranking(
  cte: Prisma.Sql,
  dimension: keyof typeof rankColumns,
  top: number,
  kind?: "frames" | "lenses",
): Promise<AnalyticsRank[]> {
  if (dimension === "combination") {
    const result = await queryObject<{ rows: AnalyticsRank[] }>(
      cte,
      Prisma.sql`
      SELECT COALESCE(JSONB_AGG(TO_JSONB(ranks)), '[]') AS rows FROM (
        SELECT frame_description AS frame, lens_description AS lens, ${rankColumns.combination} AS name,
          COUNT(*)::int AS purchases, ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 2)::float8 AS share
        FROM filtered WHERE has_frame AND has_lens GROUP BY 1, 2, 3 ORDER BY COUNT(*) DESC, 3 LIMIT ${top}
      ) ranks
    `,
    );
    return result.rows;
  }
  const where =
    kind === "frames"
      ? Prisma.sql`has_frame`
      : kind === "lenses"
        ? Prisma.sql`has_lens`
        : Prisma.sql`TRUE`;
  const rows = await queryObject<{ rows: AnalyticsRank[] }>(
    cte,
    Prisma.sql`
    SELECT COALESCE(JSONB_AGG(TO_JSONB(ranks)), '[]') AS rows FROM (
      SELECT ${rankColumns[dimension]} AS name, COUNT(*)::int AS purchases,
        ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 2)::float8 AS share
      FROM filtered WHERE ${where} GROUP BY 1 ORDER BY COUNT(*) DESC, 1 LIMIT ${top}
    ) ranks
  `,
  );
  return rows.rows;
}

export function changeBetween(current: AnalyticsSummary, previous: AnalyticsSummary) {
  const value = new Prisma.Decimal(current.value).minus(previous.value);
  return {
    value: value.toFixed(2),
    percent: new Prisma.Decimal(previous.value).isZero()
      ? null
      : value.div(previous.value).times(100).toDecimalPlaces(2).toNumber(),
    purchases: current.purchases - previous.purchases,
    average: new Prisma.Decimal(current.average).minus(previous.average).toFixed(2),
  };
}
