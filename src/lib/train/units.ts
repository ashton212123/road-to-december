export type WeightUnit = "kg" | "lb";

const KG_TO_LB = 2.20462;

function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

/** Storage stays kg everywhere (DB, actions, e1RM, tonnage) -- these only
 * convert at the display/input edge, per the athlete's Settings preference. */
export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === "lb" ? roundToHalf(kg * KG_TO_LB) : roundToHalf(kg);
}

export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === "lb" ? value / KG_TO_LB : value;
}

export function unitLabel(unit: WeightUnit): string {
  return unit;
}
