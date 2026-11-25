export type WeightUnit = 'kg' | 'lbs';

export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Legs'
  | 'Shoulders'
  | 'Arms'
  | 'Core'
  | 'Full Body';

export type SplitType =
  | 'Push'
  | 'Pull'
  | 'Legs'
  | 'Full Body'
  | 'Upper'
  | 'Lower'
  | 'Custom';

export type WorkspaceTab =
  | 'dashboard'
  | 'logger'
  | 'progress'
  | 'library'
  | 'ai';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  preferredUnit: WeightUnit;
  activeDeloadWeek: boolean;
  deloadLabel?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WarmupItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface WorkoutSet {
  id: string;
  reps: number;
  weightKg: number;
  rpe: number;
  restSeconds: number;
  notes: string;
}

export interface WorkoutExercise {
  id: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  sets: WorkoutSet[];
}

export interface WorkoutLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title: string;
  templateName?: string;
  isDeload: boolean;
  energyLevel: number; // 1-10
  sleepHours: number;
  sleepQuality: number; // 1-10
  injuryNotes?: string;
  warmupItems: WarmupItem[];
  exercises: WorkoutExercise[];
  totalVolumeKg: number;
  totalSets: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TemplateExercise {
  name: string;
  muscleGroup: MuscleGroup;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
}

export interface WorkoutTemplate {
  id: string;
  userId: string;
  name: string;
  splitType: SplitType;
  description?: string;
  source: 'preset' | 'custom' | 'ai';
  exercises: TemplateExercise[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ExerciseItem {
  id: string;
  userId: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: string;
  cues?: string;
  isCustom: boolean;
  createdAt?: unknown;
}

export interface PersonalRecord {
  id: string;
  userId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  bestWeightKg: number;
  bestWeightReps: number;
  bestEstimated1RMKg: number;
  bestSetVolumeKg: number;
  achievedAt: string;
  workoutId: string;
  updatedAt?: unknown;
}

export interface BodyMeasurement {
  id: string;
  userId: string;
  date: string;
  bodyweightKg: number;
  bodyFatPct?: number;
  waistCm?: number;
  chestCm?: number;
  armsCm?: number;
  thighsCm?: number;
  notes?: string;
  createdAt?: unknown;
}

export interface TrainingGoal {
  id: string;
  userId: string;
  title: string;
  exerciseName: string;
  metricType: 'weight' | 'e1rm' | 'volume' | 'bodyweight';
  targetValue: number; // stored in canonical kg
  startValue: number; // stored in canonical kg
  targetDate: string;
  status: 'active' | 'achieved';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AiProgramSessionExercise {
  name: string;
  muscleGroup: MuscleGroup;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  targetRpe: number;
  loadGuidance: string;
}

export interface AiProgramSession {
  name: string;
  splitType: SplitType;
  description: string;
  exercises: AiProgramSessionExercise[];
}

export interface AiProgramWeek {
  weekNumber: number;
  isDeload: boolean;
  summary: string;
  sessions: AiProgramSession[];
}

export interface AiTrainingProgram {
  id: string;
  userId: string;
  title: string;
  focus: string;
  durationWeeks: number;
  deloadWeekNumber: number;
  weeks: AiProgramWeek[];
  createdAt?: unknown;
}
