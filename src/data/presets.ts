import type { MuscleGroup, SplitType, TemplateExercise } from '../types/training';

export interface PresetExercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: string;
  cues: string;
}

export interface PresetTemplate {
  id: string;
  name: string;
  splitType: SplitType;
  description: string;
  exercises: TemplateExercise[];
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
  'Full Body',
];

export const DEFAULT_WARMUP_ITEMS = [
  { id: 'wu_cardio', label: '5 min incline walk or rower', completed: false },
  { id: 'wu_mobility', label: 'Dynamic thoracic & hip openers', completed: false },
  { id: 'wu_ramp1', label: 'Ramp set 1: empty bar × 12 reps', completed: false },
  { id: 'wu_ramp2', label: 'Ramp set 2: 60% working load × 5 reps', completed: false },
];

export const PRESET_EXERCISES: PresetExercise[] = [
  { id: 'ex_bench_press', name: 'Barbell Bench Press', muscleGroup: 'Chest', equipment: 'Barbell', cues: 'Retract scapulae, leg drive, bar path to lower chest.' },
  { id: 'ex_incline_db', name: 'Incline Dumbbell Press', muscleGroup: 'Chest', equipment: 'Dumbbells', cues: '30-degree bench, controlled 2s eccentric, full stretch.' },
  { id: 'ex_cable_fly', name: 'Seated Cable Fly', muscleGroup: 'Chest', equipment: 'Cable', cues: 'Soft elbow bend, squeeze across sternum.' },
  { id: 'ex_weighted_dip', name: 'Weighted Chest Dip', muscleGroup: 'Chest', equipment: 'Dip Belt', cues: 'Slight forward torso lean, shoulders depressed.' },
  { id: 'ex_deadlift', name: 'Conventional Deadlift', muscleGroup: 'Back', equipment: 'Barbell', cues: 'Slack out of bar, brace lats, push floor away.' },
  { id: 'ex_pullup', name: 'Weighted Pull-Up', muscleGroup: 'Back', equipment: 'Bodyweight / Belt', cues: 'Chest to bar, initiate with scapular depression.' },
  { id: 'ex_barbell_row', name: 'Bent-Over Barbell Row', muscleGroup: 'Back', equipment: 'Barbell', cues: '45-degree hinge, pull toward lower ribs, pause.' },
  { id: 'ex_lat_pulldown', name: 'Neutral-Grip Lat Pulldown', muscleGroup: 'Back', equipment: 'Cable', cues: 'Drive elbows toward hips without leaning back excessively.' },
  { id: 'ex_chest_row', name: 'Chest-Supported T-Bar Row', muscleGroup: 'Back', equipment: 'Machine', cues: 'Full protraction at bottom, pause at peak contraction.' },
  { id: 'ex_back_squat', name: 'Barbell Back Squat', muscleGroup: 'Legs', equipment: 'Barbell', cues: 'Brace 360 degrees, knees track toes, break parallel.' },
  { id: 'ex_rdl', name: 'Romanian Deadlift', muscleGroup: 'Legs', equipment: 'Barbell', cues: 'Soft knee unlock, push hips straight back, feel hamstring tension.' },
  { id: 'ex_leg_press', name: '45-Degree Leg Press', muscleGroup: 'Legs', equipment: 'Machine', cues: 'Keep lower back pinned to pad, full knee flexion.' },
  { id: 'ex_bulgarian', name: 'Bulgarian Split Squat', muscleGroup: 'Legs', equipment: 'Dumbbells', cues: 'Vertical shin or slight lean, drive through midfoot.' },
  { id: 'ex_leg_curl', name: 'Seated Hamstring Curl', muscleGroup: 'Legs', equipment: 'Machine', cues: 'Lock hips down, 2-second negative.' },
  { id: 'ex_calf_raise', name: 'Standing Calf Raise', muscleGroup: 'Legs', equipment: 'Machine', cues: '2-second pause in deep dorsiflexion stretch.' },
  { id: 'ex_ohp', name: 'Standing Overhead Press', muscleGroup: 'Shoulders', equipment: 'Barbell', cues: 'Squeeze glutes, clear chin, press straight up over midfoot.' },
  { id: 'ex_db_lat_raise', name: 'Dumbbell Lateral Raise', muscleGroup: 'Shoulders', equipment: 'Dumbbells', cues: 'Lead with elbows slightly forward in scapular plane.' },
  { id: 'ex_face_pull', name: 'Rope Face Pull', muscleGroup: 'Shoulders', equipment: 'Cable', cues: 'Pull toward forehead with external rotation.' },
  { id: 'ex_rear_delt', name: 'Reverse Pec Deck Fly', muscleGroup: 'Shoulders', equipment: 'Machine', cues: 'Sweep arms wide rather than pinching traps.' },
  { id: 'ex_barbell_curl', name: 'EZ-Bar Bicep Curl', muscleGroup: 'Arms', equipment: 'EZ-Bar', cues: 'Elbows pinned at sides, zero torso swing.' },
  { id: 'ex_incline_curl', name: 'Incline Dumbbell Curl', muscleGroup: 'Arms', equipment: 'Dumbbells', cues: '45-degree incline, deep long-head stretch.' },
  { id: 'ex_tricep_pushdown', name: 'Rope Tricep Pushdown', muscleGroup: 'Arms', equipment: 'Cable', cues: 'Lock upper arms vertically, split rope at bottom.' },
  { id: 'ex_skullcrusher', name: 'Overhead EZ-Bar Extension', muscleGroup: 'Arms', equipment: 'EZ-Bar', cues: 'Stretch triceps behind head, drive smoothly.' },
  { id: 'ex_hanging_leg', name: 'Hanging Leg Raise', muscleGroup: 'Core', equipment: 'Pull-Up Bar', cues: 'Posteriorly tilt pelvis at top, control descent.' },
  { id: 'ex_cable_crunch', name: 'Kneeling Cable Crunch', muscleGroup: 'Core', equipment: 'Cable', cues: 'Flex thoracic spine toward pelvis without hip hinge.' },
  { id: 'ex_clean_press', name: 'Kettlebell Clean & Press', muscleGroup: 'Full Body', equipment: 'Kettlebell', cues: 'Crisp hip snap, rack softly, punch overhead.' },
];

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'tpl_push_strength',
    name: 'Push — Chest, Shoulders & Triceps',
    splitType: 'Push',
    description: 'Primary horizontal press progression paired with incline hypertrophy and lateral delts.',
    exercises: [
      { name: 'Barbell Bench Press', muscleGroup: 'Chest', targetSets: 4, targetReps: '5-6', restSeconds: 180 },
      { name: 'Incline Dumbbell Press', muscleGroup: 'Chest', targetSets: 3, targetReps: '8-10', restSeconds: 120 },
      { name: 'Standing Overhead Press', muscleGroup: 'Shoulders', targetSets: 3, targetReps: '6-8', restSeconds: 150 },
      { name: 'Dumbbell Lateral Raise', muscleGroup: 'Shoulders', targetSets: 4, targetReps: '12-15', restSeconds: 75 },
      { name: 'Rope Tricep Pushdown', muscleGroup: 'Arms', targetSets: 3, targetReps: '10-12', restSeconds: 90 },
    ],
  },
  {
    id: 'tpl_pull_density',
    name: 'Pull — Posterior Chain & Lats',
    splitType: 'Pull',
    description: 'Heavy vertical and horizontal pulling with rear-delt balance and bicep work.',
    exercises: [
      { name: 'Weighted Pull-Up', muscleGroup: 'Back', targetSets: 4, targetReps: '6-8', restSeconds: 150 },
      { name: 'Bent-Over Barbell Row', muscleGroup: 'Back', targetSets: 4, targetReps: '6-8', restSeconds: 150 },
      { name: 'Chest-Supported T-Bar Row', muscleGroup: 'Back', targetSets: 3, targetReps: '10-12', restSeconds: 120 },
      { name: 'Rope Face Pull', muscleGroup: 'Shoulders', targetSets: 3, targetReps: '15', restSeconds: 75 },
      { name: 'EZ-Bar Bicep Curl', muscleGroup: 'Arms', targetSets: 3, targetReps: '8-10', restSeconds: 90 },
    ],
  },
  {
    id: 'tpl_legs_power',
    name: 'Legs — Squat & Hinge Foundation',
    splitType: 'Legs',
    description: 'Balanced quad and hamstring overload with unilateral stability.',
    exercises: [
      { name: 'Barbell Back Squat', muscleGroup: 'Legs', targetSets: 4, targetReps: '5', restSeconds: 180 },
      { name: 'Romanian Deadlift', muscleGroup: 'Legs', targetSets: 3, targetReps: '8', restSeconds: 150 },
      { name: '45-Degree Leg Press', muscleGroup: 'Legs', targetSets: 3, targetReps: '10-12', restSeconds: 120 },
      { name: 'Seated Hamstring Curl', muscleGroup: 'Legs', targetSets: 3, targetReps: '12', restSeconds: 90 },
      { name: 'Standing Calf Raise', muscleGroup: 'Legs', targetSets: 4, targetReps: '12-15', restSeconds: 60 },
    ],
  },
  {
    id: 'tpl_full_body',
    name: 'Full Body — 3-Day Compound Split',
    splitType: 'Full Body',
    description: 'High-efficiency compound session hitting major movement patterns in 60 minutes.',
    exercises: [
      { name: 'Barbell Back Squat', muscleGroup: 'Legs', targetSets: 3, targetReps: '5-6', restSeconds: 180 },
      { name: 'Barbell Bench Press', muscleGroup: 'Chest', targetSets: 3, targetReps: '6-8', restSeconds: 150 },
      { name: 'Bent-Over Barbell Row', muscleGroup: 'Back', targetSets: 3, targetReps: '8', restSeconds: 120 },
      { name: 'Standing Overhead Press', muscleGroup: 'Shoulders', targetSets: 3, targetReps: '8-10', restSeconds: 120 },
      { name: 'Hanging Leg Raise', muscleGroup: 'Core', targetSets: 3, targetReps: '12', restSeconds: 75 },
    ],
  },
];
