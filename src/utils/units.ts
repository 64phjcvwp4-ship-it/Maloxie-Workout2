import type { WeightUnit } from '../types/training';

const KG_TO_LBS = 2.20462262185;
const CM_TO_IN = 0.3937007874;

export function fromKg(kg: number, unit: WeightUnit): number {
  if (!Number.isFinite(kg)) return 0;
  return unit === 'lbs' ? Number((kg * KG_TO_LBS).toFixed(1)) : Number(kg.toFixed(1));
}

export function toKg(displayWeight: number, unit: WeightUnit): number {
  if (!Number.isFinite(displayWeight)) return 0;
  return unit === 'lbs'
    ? Number((displayWeight / KG_TO_LBS).toFixed(2))
    : Number(displayWeight.toFixed(2));
}

export function formatWeight(kg: number, unit: WeightUnit, withUnit = true): string {
  const val = fromKg(kg, unit);
  return withUnit ? `${val} ${unit}` : `${val}`;
}

export function formatVolume(kgVolume: number, unit: WeightUnit): string {
  const val = unit === 'lbs' ? Math.round(kgVolume * KG_TO_LBS) : Math.round(kgVolume);
  return `${val.toLocaleString()} ${unit}`;
}

export function fromCm(cm: number, unit: WeightUnit): number {
  if (!Number.isFinite(cm)) return 0;
  return unit === 'lbs' ? Number((cm * CM_TO_IN).toFixed(1)) : Number(cm.toFixed(1));
}

export function toCm(displayLength: number, unit: WeightUnit): number {
  if (!Number.isFinite(displayLength)) return 0;
  return unit === 'lbs'
    ? Number((displayLength / CM_TO_IN).toFixed(2))
    : Number(displayLength.toFixed(2));
}

export function lengthUnitLabel(unit: WeightUnit): string {
  return unit === 'lbs' ? 'in' : 'cm';
}

export function calculateE1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Number(weightKg.toFixed(1));
  return Number((weightKg * (1 + reps / 30)).toFixed(1));
}

export function slugifyExercise(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 100) || 'exercise'
  );
}

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatRestDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${String(rem).padStart(2, '0')}`;
}
