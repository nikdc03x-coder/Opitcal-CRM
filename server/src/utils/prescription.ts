
import type { PrescriptionInput } from "../validators/customerWriteValidator";

// Convert the original optical prescription structure
// into the column names used by PostgreSQL.
export function mapPrescription(data: PrescriptionInput) {
  return {
    reDistSph: data.re_dist?.sph,
    reDistCyl: data.re_dist?.cyl,
    reDistAxis: data.re_dist?.axis,

    reNearSph: data.re_near?.sph,
    reNearCyl: data.re_near?.cyl,
    reNearAxis: data.re_near?.axis,

    leDistSph: data.le_dist?.sph,
    leDistCyl: data.le_dist?.cyl,
    leDistAxis: data.le_dist?.axis,

    leNearSph: data.le_near?.sph,
    leNearCyl: data.le_near?.cyl,
    leNearAxis: data.le_near?.axis,
  };
}
