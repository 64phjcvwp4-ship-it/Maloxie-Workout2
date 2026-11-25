import type {
  AiProgramSession,
  AiProgramSessionExercise,
  AiProgramWeek,
  AiTrainingProgram,
  MuscleGroup,
  SplitType,
  WeightUnit,
} from '../types/training';

export interface EngineWorkoutSet {
  reps: number;
  weightKg: number;
  rpe: number;
  notes?: string;
}

export interface EngineWorkoutExercise {
  name: string;
  muscleGroup: MuscleGroup;
  sets: EngineWorkoutSet[];
}

export interface EngineWorkout {
  date: string;
  title: string;
  isDeload: boolean;
  energyLevel: number;
  sleepHours: number;
  sleepQuality: number;
  injuryNotes?: string;
  totalVolumeKg: number;
  exercises: EngineWorkoutExercise[];
}

export interface EnginePR {
  exercise: string;
  bestWeightKg: number;
  reps: number;
  estimated1RMKg: number;
  date: string;
}

export interface EngineMeasurement {
  date: string;
  bodyweightKg: number;
  bodyFatPct?: number;
}

export interface EngineGoal {
  title: string;
  exerciseName: string;
  metricType: 'weight' | 'e1rm' | 'volume' | 'bodyweight';
  targetValueKg: number;
  targetDate: string;
  status: 'active' | 'achieved';
}

export interface TrainingContextPayload {
  preferredUnit?: WeightUnit;
  activeDeloadWeek?: boolean;
  recentWorkouts?: EngineWorkout[];
  personalRecords?: EnginePR[];
  recentBodyMeasurements?: EngineMeasurement[];
  goals?: EngineGoal[];
}

export interface CoachRequestPayload {
  question: string;
  history?: Array<{ role?: string; content?: string }>;
  trainingContext?: TrainingContextPayload;
}

export interface ProgramRequestPayload {
  goalPrompt?: string;
  durationWeeks?: number;
  daysPerWeek?: number;
  includeDeload?: boolean;
  splitPreference?: string;
  trainingContext?: TrainingContextPayload;
}

const KG_TO_LBS = 2.2046226218;

function formatWeightUnit(kg: number, unit: WeightUnit): string {
  const val = unit === 'lbs' ? kg * KG_TO_LBS : kg;
  const rounded = unit === 'lbs' ? Math.round(val * 2) / 2 : Math.round(val * 10) / 10;
  return `${rounded} ${unit}`;
}

function formatVolUnit(kg: number, unit: WeightUnit): string {
  const val = unit === 'lbs' ? kg * KG_TO_LBS : kg;
  return `${Math.round(val).toLocaleString()} ${unit}`;
}

function roundToPlate(kg: number, unit: WeightUnit): number {
  if (unit === 'lbs') {
    const lbs = kg * KG_TO_LBS;
    const roundedLbs = Math.max(5, Math.round(lbs / 5) * 5);
    return roundedLbs;
  }
  return Math.max(2.5, Math.round(kg / 2.5) * 2.5);
}

function analyzeContext(ctx: TrainingContextPayload) {
  const unit: WeightUnit = ctx.preferredUnit === 'lbs' ? 'lbs' : 'kg';
  const workouts = Array.isArray(ctx.recentWorkouts) ? ctx.recentWorkouts : [];
  const prs = Array.isArray(ctx.personalRecords) ? ctx.personalRecords : [];
  const measurements = Array.isArray(ctx.recentBodyMeasurements) ? ctx.recentBodyMeasurements : [];
  const goals = Array.isArray(ctx.goals) ? ctx.goals : [];

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 14);

  let weekVol = 0;
  let prevWeekVol = 0;
  let weekCount = 0;
  let prevWeekCount = 0;
  let rpeSum = 0;
  let rpeCount = 0;
  let sleepSum = 0;
  let sleepQualitySum = 0;
  let energySum = 0;

  const muscleSets: Record<MuscleGroup, number> = {
    Chest: 0,
    Back: 0,
    Legs: 0,
    Shoulders: 0,
    Arms: 0,
    Core: 0,
    'Full Body': 0,
  };

  const injuryNotes: Array<{ date: string; note: string }> = [];
  const exerciseHistory = new Map<string, Array<{ date: string; topWeightKg: number; topE1rm: number; volKg: number }>>();

  for (const w of workouts) {
    const d = new Date(`${w.date}T12:00:00`);
    const vol = Number(w.totalVolumeKg) || 0;
    if (d >= sevenDaysAgo) {
      weekVol += vol;
      weekCount += 1;
    } else if (d >= fourteenDaysAgo) {
      prevWeekVol += vol;
      prevWeekCount += 1;
    }

    sleepSum += Number(w.sleepHours) || 7;
    sleepQualitySum += Number(w.sleepQuality) || 7;
    energySum += Number(w.energyLevel) || 7;

    if (w.injuryNotes && w.injuryNotes.trim()) {
      injuryNotes.push({ date: w.date, note: w.injuryNotes.trim() });
    }

    for (const ex of w.exercises || []) {
      const mg = ex.muscleGroup || 'Full Body';
      if (mg in muscleSets) {
        muscleSets[mg] += (ex.sets || []).length;
      }

      let topWeight = 0;
      let topE1rm = 0;
      let exVol = 0;
      for (const s of ex.sets || []) {
        if (s.rpe > 0) {
          rpeSum += s.rpe;
          rpeCount += 1;
        }
        const weight = Number(s.weightKg) || 0;
        const reps = Number(s.reps) || 0;
        if (weight > topWeight) topWeight = weight;
        const e1rm = reps === 1 ? weight : weight * (1 + reps / 30);
        if (e1rm > topE1rm) topE1rm = e1rm;
        exVol += weight * reps;
      }

      const key = ex.name.trim();
      if (key) {
        const list = exerciseHistory.get(key) || [];
        list.push({ date: w.date, topWeightKg: topWeight, topE1rm, volKg: exVol });
        exerciseHistory.set(key, list);
      }
    }
  }

  const count = workouts.length;
  const avgRpe = rpeCount > 0 ? Number((rpeSum / rpeCount).toFixed(1)) : 0;
  const avgSleepHours = count > 0 ? Number((sleepSum / count).toFixed(1)) : 0;
  const avgSleepQuality = count > 0 ? Number((sleepQualitySum / count).toFixed(1)) : 0;
  const avgEnergy = count > 0 ? Number((energySum / count).toFixed(1)) : 0;
  const volumeDeltaPct =
    prevWeekVol > 0 ? Math.round(((weekVol - prevWeekVol) / prevWeekVol) * 100) : null;

  const progressingLifts: string[] = [];
  const stalledLifts: string[] = [];
  for (const [name, entries] of exerciseHistory.entries()) {
    if (entries.length < 2) continue;
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const latest = sorted[sorted.length - 1];
    if (latest.topE1rm > first.topE1rm + 0.5 || latest.volKg > first.volKg * 1.03) {
      const diffKg = latest.topE1rm - first.topE1rm;
      progressingLifts.push(`${name} (+${formatWeightUnit(Math.max(0.5, diffKg), unit)} est. 1RM)`);
    } else if (latest.topE1rm <= first.topE1rm && latest.volKg <= first.volKg) {
      stalledLifts.push(name);
    }
  }

  const highFatigue =
    avgRpe >= 8.5 ||
    (count > 0 && (avgSleepHours < 6.5 || avgSleepQuality <= 5.5 || avgEnergy <= 5.5)) ||
    injuryNotes.length > 0;

  return {
    unit,
    workouts,
    prs,
    measurements,
    goals,
    weekVol,
    prevWeekVol,
    weekCount,
    prevWeekCount,
    volumeDeltaPct,
    avgRpe,
    avgSleepHours,
    avgSleepQuality,
    avgEnergy,
    muscleSets,
    injuryNotes,
    progressingLifts,
    stalledLifts,
    highFatigue,
    activeDeloadWeek: Boolean(ctx.activeDeloadWeek),
  };
}

export function generateCoachResponse(payload: CoachRequestPayload): string {
  const q = (payload.question || '').trim().toLowerCase();
  const stats = analyzeContext(payload.trainingContext ?? {});
  const { unit } = stats;

  if (stats.workouts.length === 0) {
    const activeGoals = stats.goals.filter((g) => g.status === 'active');
    const latestBw = stats.measurements[0]?.bodyweightKg;
    const lines = [
      'BASELINE ASSESSMENT',
      'No workout sessions are logged yet, so here is how to establish clean progressive overload from Session 1:',
      '',
      `• Preferred Unit & Baseline: ${unit.toUpperCase()}${latestBw ? ` · Latest bodyweight ${formatWeightUnit(latestBw, unit)}` : ''}${activeGoals.length ? ` · ${activeGoals.length} active goal(s)` : ''}.`,
      '• First-Week Target: Log 3–4 sessions hitting RPE 7–8 (leaving 2–3 reps in reserve) so Maloxie can calibrate your Epley 1RMs and weekly tonnage.',
      '• Recovery Tracking: Fill in sleep hours, energy (1–10), and any joint/injury notes on each workout so deload triggers stay accurate.',
    ];
    if (activeGoals.length > 0) {
      const g = activeGoals[0];
      lines.push(
        `• Active Goal Focus: "${g.title}" (${g.exerciseName} → ${
          g.metricType === 'volume' ? formatVolUnit(g.targetValueKg, unit) : formatWeightUnit(g.targetValueKg, unit)
        } by ${g.targetDate}). Start at ~70–75% of target load for crisp 6–8 rep sets.`
      );
    }
    return lines.join('\n');
  }

  const isDeloadQuery = /deload|fatigue|tired|sleep|recover|sore|pain|injur|burn|overtrain/.test(q);
  const isSplitQuery = /split|volume|imbalance|weak|muscle|chest|back|leg|shoulder|arm|core|ratio/.test(q);
  const isGoalQuery = /goal|target|fast|program|block|plan|milestone|bodyweight|cut|bulk/.test(q);
  const isOverloadQuery = /overload|progress|stall|plateau|pr|1rm|bench|squat|deadlift|press|lift|strength|weight/.test(q);

  const sections: string[] = [];

  if (isDeloadQuery) {
    sections.push('READINESS & DELOAD VERDICT');
    if (stats.activeDeloadWeek) {
      sections.push(
        `• Protocol Status: Deload Week is already active. Keep working sets ~40% lower and cap intensity around RPE 6.0–6.5.`
      );
    } else if (stats.highFatigue) {
      sections.push(
        `• Recommendation: Schedule a 5–7 day Deload Week now. Your recent logs show fatigue markers (` +
          [
            stats.avgRpe >= 8.5 ? `avg RPE ${stats.avgRpe}/10` : '',
            stats.avgSleepHours < 6.5 ? `avg sleep ${stats.avgSleepHours}h` : '',
            stats.avgEnergy <= 5.5 ? `avg energy ${stats.avgEnergy}/10` : '',
            stats.injuryNotes.length ? `${stats.injuryNotes.length} injury note(s)` : '',
          ]
            .filter(Boolean)
            .join(', ') +
          ').'
      );
    } else {
      sections.push(
        `• Recommendation: No immediate deload required. Recovery metrics look solid (avg RPE ${stats.avgRpe || '—'}/10, sleep ${stats.avgSleepHours}h, energy ${stats.avgEnergy}/10). Continue accumulating for 1–2 more weeks before a planned deload.`
      );
    }

    if (stats.injuryNotes.length > 0) {
      sections.push('');
      sections.push('LOGGED PAIN / INJURY NOTES');
      for (const item of stats.injuryNotes.slice(0, 3)) {
        sections.push(`• ${item.date}: "${item.note}" — reduce axial/end-range loading on affected joints and use controlled 3s eccentrics at RPE 6–7.`);
      }
    }

    sections.push('');
    sections.push('NEXT SESSION ADJUSTMENTS');
    sections.push(
      `• Set Volume: ${stats.highFatigue ? 'Drop working sets by ~40% (e.g., 4 sets → 2–3 sets)' : 'Maintain current working sets'} and keep at least 2–3 reps in reserve.`
    );
    sections.push(`• Weekly Tonnage: Current 7d volume is ${formatVolUnit(stats.weekVol, unit)} across ${stats.weekCount} session(s).`);
    return sections.join('\n');
  }

  if (isSplitQuery) {
    const pushSets = stats.muscleSets.Chest + stats.muscleSets.Shoulders;
    const pullSets = stats.muscleSets.Back;
    const legSets = stats.muscleSets.Legs;
    const armCoreSets = stats.muscleSets.Arms + stats.muscleSets.Core;

    sections.push('MUSCLE GROUP VOLUME & SPLIT AUDIT');
    sections.push(
      `• Recent Set Distribution (${stats.workouts.length} sessions): Chest ${stats.muscleSets.Chest} · Back ${stats.muscleSets.Back} · Legs ${stats.muscleSets.Legs} · Shoulders ${stats.muscleSets.Shoulders} · Arms ${stats.muscleSets.Arms} · Core ${stats.muscleSets.Core}`
    );

    const imbalances: string[] = [];
    if (pushSets > pullSets * 1.35 && pullSets > 0) {
      imbalances.push(`Pulling volume (${pullSets} sets) trails pressing volume (${pushSets} sets) — add 3–4 weekly sets of chest-supported rows or face pulls.`);
    } else if (pullSets === 0 && pushSets > 0) {
      imbalances.push('No Back sets recorded in recent sessions — add vertical & horizontal pulling to protect shoulder balance.');
    }
    if (legSets < Math.max(4, Math.round((pushSets + pullSets) * 0.3))) {
      imbalances.push(`Lower-body volume (${legSets} sets) is lagging upper-body work — add squats, RDLs, or split squats.`);
    }
    if (stats.muscleSets.Core < 3) {
      imbalances.push('Direct Core work is minimal — add 2–3 sets of hanging leg raises or cable crunches twice weekly.');
    }

    sections.push('');
    sections.push('WEAK-LINK PRIORITIES');
    if (imbalances.length > 0) {
      for (const imp of imbalances) sections.push(`• ${imp}`);
    } else {
      sections.push(
        `• Balanced Push/Pull/Legs ratio (${pushSets} push / ${pullSets} pull / ${legSets} legs / ${armCoreSets} arms+core). Keep progressive overload steady on primary compounds.`
      );
    }
    return sections.join('\n');
  }

  if (isGoalQuery) {
    const activeGoals = stats.goals.filter((g) => g.status === 'active');
    sections.push('GOAL ACCELERATION ROADMAP');
    if (activeGoals.length === 0) {
      sections.push('• No active goals found yet. Create a strength or bodyweight target in Library & Goals so Maloxie can map weekly load steps.');
    } else {
      for (const g of activeGoals.slice(0, 4)) {
        const matchingPr = stats.prs.find(
          (p) => p.exercise.toLowerCase() === g.exerciseName.toLowerCase()
        );
        const currentKg =
          g.metricType === 'bodyweight'
            ? stats.measurements[0]?.bodyweightKg ?? 0
            : matchingPr
              ? g.metricType === 'e1rm'
                ? matchingPr.estimated1RMKg
                : matchingPr.bestWeightKg
              : 0;
        const gapKg = g.targetValueKg - currentKg;
        const stepLabel = unit === 'lbs' ? '2.5–5 lbs' : '1.25–2.5 kg';
        sections.push(
          `• ${g.title} (${g.exerciseName} by ${g.targetDate}): Target ${
            g.metricType === 'volume' ? formatVolUnit(g.targetValueKg, unit) : formatWeightUnit(g.targetValueKg, unit)
          }${currentKg > 0 ? ` · Current ${formatWeightUnit(currentKg, unit)} (${gapKg > 0 ? `${formatWeightUnit(gapKg, unit)} to go` : 'target reached!'})` : ''}. Add ${stepLabel} or +1 rep on top sets when RPE drops below 8.5.`
        );
      }
    }

    sections.push('');
    sections.push('RECOVERY GUARDRAILS');
    sections.push(
      `• Current 7d Volume: ${formatVolUnit(stats.weekVol, unit)} (${stats.weekCount} sessions) · Avg RPE ${stats.avgRpe || '—'}/10 · Sleep ${stats.avgSleepHours}h.`
    );
    if (stats.highFatigue) {
      sections.push('• Caution: Fatigue signals detected — take a 1-week deload before peaking toward heavy PR attempts.');
    } else {
      sections.push('• Use the Multi-Week & Deload Builder tab to lock in a structured 4-week accumulation + deload block.');
    }
    return sections.join('\n');
  }

  // Default & Overload / General Studio Coaching Audit
  sections.push(isOverloadQuery ? 'PROGRESSIVE OVERLOAD AUDIT' : 'MALOXIE TRAINING ANALYSIS');
  const volDeltaLabel =
    stats.volumeDeltaPct !== null
      ? ` (${stats.volumeDeltaPct >= 0 ? '+' : ''}${stats.volumeDeltaPct}% vs prior 7d)`
      : '';
  sections.push(
    `• 7-Day Tonnage: ${formatVolUnit(stats.weekVol, unit)} across ${stats.weekCount} session(s)${volDeltaLabel}.`
  );
  sections.push(
    `• Effort & Readiness: Avg RPE ${stats.avgRpe || '—'}/10 · Sleep ${stats.avgSleepHours}h (quality ${stats.avgSleepQuality}/10) · Energy ${stats.avgEnergy}/10.`
  );

  if (stats.prs.length > 0) {
    const topPrs = stats.prs
      .slice(0, 3)
      .map((p) => `${p.exercise}: ${formatWeightUnit(p.bestWeightKg, unit)} × ${p.reps} (e1RM ${formatWeightUnit(p.estimated1RMKg, unit)})`)
      .join(' · ');
    sections.push(`• Top Personal Records: ${topPrs}`);
  }

  sections.push('');
  sections.push('PROGRESSION & NEXT STEPS');
  if (stats.progressingLifts.length > 0) {
    sections.push(`• Trending Up: ${stats.progressingLifts.slice(0, 3).join(', ')}.`);
  }
  if (stats.stalledLifts.length > 0) {
    const step = unit === 'lbs' ? '+5 lbs' : '+2.5 kg';
    sections.push(
      `• Plateau Watch: ${stats.stalledLifts.slice(0, 3).join(', ')} held flat across recent sessions. Switch to double progression (add +1 rep per set before adding ${step}) or drop 10% load for a fresh 4-week wave.`
    );
  } else {
    const step = unit === 'lbs' ? '5 lbs' : '2.5 kg';
    sections.push(
      `• Next Session Rule: Whenever all working sets hit the top of your rep range at RPE <= 8, increase load by ${step} on your next session.`
    );
  }

  if (stats.highFatigue) {
    sections.push(
      `• Fatigue Alert: ${
        stats.injuryNotes.length
          ? `Noted "${stats.injuryNotes[0].note}" — `
          : ''
      }avg RPE/sleep signals suggest scheduling a deload week soon to lock in adaptations.`
    );
  }

  return sections.join('\n');
}

interface ExerciseTemplateSpec {
  name: string;
  muscleGroup: MuscleGroup;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  baseRpe: number;
  pct1Rm: number;
}

function resolveLoadGuidance(
  ex: ExerciseTemplateSpec,
  prs: EnginePR[],
  unit: WeightUnit,
  weekNum: number,
  isDeload: boolean
): string {
  const match = prs.find(
    (p) =>
      p.exercise.toLowerCase() === ex.name.toLowerCase() ||
      ex.name.toLowerCase().includes(p.exercise.toLowerCase()) ||
      p.exercise.toLowerCase().includes(ex.name.toLowerCase())
  );

  if (match && match.estimated1RMKg > 0) {
    const weekFactor = isDeload ? 0.8 : 1 + (weekNum - 1) * 0.02;
    const rawKg = match.estimated1RMKg * ex.pct1Rm * weekFactor;
    const plateVal = roundToPlate(rawKg, unit);
    return isDeload
      ? `~${plateVal} ${unit} (deload -20% from working load)`
      : `~${plateVal} ${unit} (${Math.round(ex.pct1Rm * 100)}% est. 1RM)`;
  }

  if (isDeload) {
    return 'Reduce normal working weight by 15–20%, crisp bar speed';
  }
  const rpe = Math.min(9, Number((ex.baseRpe + (weekNum - 1) * 0.4).toFixed(1)));
  return weekNum === 1
    ? `Start conservative at RPE ${rpe} (2–3 reps in reserve)`
    : `Add ${unit === 'lbs' ? '+5 lbs' : '+2.5 kg'} or +1 rep vs Week ${weekNum - 1} (target RPE ${rpe})`;
}

export function generateTrainingProgram(payload: ProgramRequestPayload): Omit<AiTrainingProgram, 'id' | 'userId' | 'createdAt'> {
  const weeksCount = Math.min(Math.max(Math.round(Number(payload.durationWeeks) || 4), 2), 8);
  const daysCount = Math.min(Math.max(Math.round(Number(payload.daysPerWeek) || 4), 2), 6);
  const includeDeload = payload.includeDeload !== false;
  const splitPref = payload.splitPreference || 'Upper / Lower';
  const goalPrompt = (payload.goalPrompt || 'Balanced strength and hypertrophy progression').trim();
  const goalLower = goalPrompt.toLowerCase();

  const ctx = payload.trainingContext ?? {};
  const unit: WeightUnit = ctx.preferredUnit === 'lbs' ? 'lbs' : 'kg';
  const prs = Array.isArray(ctx.personalRecords) ? ctx.personalRecords : [];
  const allInjuries = (ctx.recentWorkouts || [])
    .map((w) => (w.injuryNotes || '').toLowerCase())
    .join(' ');

  const kneeSensitive = /knee|patella|quad tendon/.test(allInjuries);
  const backSensitive = /back|lumbar|spine|si joint/.test(allInjuries);
  const shoulderSensitive = /shoulder|rotator|impingement|ac joint/.test(allInjuries);

  const strengthBias = /strength|power|1rm|heavy|bench|squat|deadlift/.test(goalLower);
  const pressBias = /chest|bench|press|upper|shoulder|push/.test(goalLower);
  const pullBias = /back|pull|lat|row|deadlift/.test(goalLower);
  const legBias = /leg|squat|quad|hamstring|glute|lower/.test(goalLower);

  const pushSession: ExerciseTemplateSpec[] = [
    {
      name: shoulderSensitive ? 'Incline Dumbbell Press' : 'Barbell Bench Press',
      muscleGroup: 'Chest',
      targetSets: strengthBias || pressBias ? 4 : 3,
      targetReps: strengthBias ? '4-6' : '6-8',
      restSeconds: 180,
      baseRpe: 7.5,
      pct1Rm: strengthBias ? 0.82 : 0.76,
    },
    {
      name: shoulderSensitive ? 'Seated Cable Fly' : 'Incline Dumbbell Press',
      muscleGroup: 'Chest',
      targetSets: 3,
      targetReps: '8-10',
      restSeconds: 120,
      baseRpe: 7.5,
      pct1Rm: 0.7,
    },
    {
      name: shoulderSensitive ? 'Dumbbell Lateral Raise' : 'Standing Overhead Press',
      muscleGroup: 'Shoulders',
      targetSets: 3,
      targetReps: strengthBias ? '6-8' : '8-10',
      restSeconds: 150,
      baseRpe: 7.5,
      pct1Rm: 0.74,
    },
    {
      name: 'Dumbbell Lateral Raise',
      muscleGroup: 'Shoulders',
      targetSets: 4,
      targetReps: '12-15',
      restSeconds: 75,
      baseRpe: 8,
      pct1Rm: 0.62,
    },
    {
      name: 'Rope Tricep Pushdown',
      muscleGroup: 'Arms',
      targetSets: 3,
      targetReps: '10-12',
      restSeconds: 90,
      baseRpe: 8,
      pct1Rm: 0.65,
    },
  ];

  const pullSession: ExerciseTemplateSpec[] = [
    {
      name: 'Weighted Pull-Up',
      muscleGroup: 'Back',
      targetSets: pullBias ? 4 : 3,
      targetReps: '6-8',
      restSeconds: 150,
      baseRpe: 7.5,
      pct1Rm: 0.76,
    },
    {
      name: backSensitive ? 'Chest-Supported T-Bar Row' : 'Bent-Over Barbell Row',
      muscleGroup: 'Back',
      targetSets: 4,
      targetReps: strengthBias ? '5-7' : '8-10',
      restSeconds: 150,
      baseRpe: 7.5,
      pct1Rm: 0.75,
    },
    {
      name: 'Neutral-Grip Lat Pulldown',
      muscleGroup: 'Back',
      targetSets: 3,
      targetReps: '10-12',
      restSeconds: 120,
      baseRpe: 8,
      pct1Rm: 0.68,
    },
    {
      name: 'Rope Face Pull',
      muscleGroup: 'Shoulders',
      targetSets: 3,
      targetReps: '15',
      restSeconds: 75,
      baseRpe: 7.5,
      pct1Rm: 0.58,
    },
    {
      name: 'EZ-Bar Bicep Curl',
      muscleGroup: 'Arms',
      targetSets: 3,
      targetReps: '8-10',
      restSeconds: 90,
      baseRpe: 8,
      pct1Rm: 0.68,
    },
  ];

  const legsSession: ExerciseTemplateSpec[] = [
    {
      name: kneeSensitive ? '45-Degree Leg Press' : 'Barbell Back Squat',
      muscleGroup: 'Legs',
      targetSets: strengthBias || legBias ? 4 : 3,
      targetReps: strengthBias ? '4-6' : '6-8',
      restSeconds: 180,
      baseRpe: 7.5,
      pct1Rm: strengthBias ? 0.82 : 0.76,
    },
    {
      name: backSensitive ? 'Seated Hamstring Curl' : 'Romanian Deadlift',
      muscleGroup: 'Legs',
      targetSets: 3,
      targetReps: '8',
      restSeconds: 150,
      baseRpe: 7.5,
      pct1Rm: 0.72,
    },
    {
      name: kneeSensitive ? 'Seated Hamstring Curl' : 'Bulgarian Split Squat',
      muscleGroup: 'Legs',
      targetSets: 3,
      targetReps: '10',
      restSeconds: 120,
      baseRpe: 8,
      pct1Rm: 0.68,
    },
    {
      name: 'Standing Calf Raise',
      muscleGroup: 'Legs',
      targetSets: 4,
      targetReps: '12-15',
      restSeconds: 60,
      baseRpe: 8,
      pct1Rm: 0.64,
    },
    {
      name: 'Hanging Leg Raise',
      muscleGroup: 'Core',
      targetSets: 3,
      targetReps: '12',
      restSeconds: 75,
      baseRpe: 7.5,
      pct1Rm: 0.65,
    },
  ];

  const upperSession: ExerciseTemplateSpec[] = [
    pushSession[0],
    pullSession[1],
    pushSession[2],
    pullSession[2],
    pushSession[3],
    pullSession[4],
  ];

  const lowerSession: ExerciseTemplateSpec[] = [
    legsSession[0],
    legsSession[1],
    {
      name: '45-Degree Leg Press',
      muscleGroup: 'Legs',
      targetSets: 3,
      targetReps: '10-12',
      restSeconds: 120,
      baseRpe: 8,
      pct1Rm: 0.7,
    },
    {
      name: 'Seated Hamstring Curl',
      muscleGroup: 'Legs',
      targetSets: 3,
      targetReps: '12',
      restSeconds: 90,
      baseRpe: 8,
      pct1Rm: 0.65,
    },
    legsSession[3],
    {
      name: 'Kneeling Cable Crunch',
      muscleGroup: 'Core',
      targetSets: 3,
      targetReps: '12-15',
      restSeconds: 75,
      baseRpe: 8,
      pct1Rm: 0.64,
    },
  ];

  const fullBodyA: ExerciseTemplateSpec[] = [
    legsSession[0],
    pushSession[0],
    pullSession[1],
    pushSession[3],
    legsSession[4],
  ];

  const fullBodyB: ExerciseTemplateSpec[] = [
    {
      name: backSensitive ? 'Romanian Deadlift' : 'Conventional Deadlift',
      muscleGroup: 'Back',
      targetSets: 3,
      targetReps: '5',
      restSeconds: 180,
      baseRpe: 7.5,
      pct1Rm: 0.8,
    },
    pushSession[1],
    pullSession[0],
    pushSession[4],
    pullSession[3],
  ];

  interface SessionTemplateBlueprint {
    name: string;
    splitType: SplitType;
    description: string;
    specs: ExerciseTemplateSpec[];
  }

  let dayBlueprints: SessionTemplateBlueprint[] = [];
  if (splitPref === 'Full Body' || daysCount <= 3) {
    const cycle: SessionTemplateBlueprint[] = [
      { name: 'Full Body A — Squat & Press Focus', splitType: 'Full Body', description: 'Primary squat and horizontal push paired with rowing and core.', specs: fullBodyA },
      { name: 'Full Body B — Hinge & Pull Focus', splitType: 'Full Body', description: 'Posterior-chain hinge, incline press, and vertical pulling.', specs: fullBodyB },
      { name: 'Full Body C — Hypertrophy & Accessories', splitType: 'Full Body', description: 'Unilateral lower work, lateral delts, and arm/core balance.', specs: [legsSession[2], pushSession[2], pullSession[2], pushSession[4], pullSession[4]] },
    ];
    dayBlueprints = Array.from({ length: daysCount }, (_, i) => cycle[i % cycle.length]);
  } else if (splitPref === 'Push / Pull / Legs') {
    const ppl: SessionTemplateBlueprint[] = [
      { name: 'Push — Chest, Shoulders & Triceps', splitType: 'Push', description: 'Compound pressing strength paired with medial delt and tricep volume.', specs: pushSession },
      { name: 'Pull — Lats, Upper Back & Biceps', splitType: 'Pull', description: 'Vertical and horizontal pulling with rear-delt balance.', specs: pullSession },
      { name: 'Legs — Squat, Hinge & Core', splitType: 'Legs', description: 'Balanced quad/hamstring progression with calves and trunk stability.', specs: legsSession },
    ];
    dayBlueprints = Array.from({ length: daysCount }, (_, i) => ({
      ...ppl[i % 3],
      name: i >= 3 ? `${ppl[i % 3].name} (Day ${i + 1})` : ppl[i % 3].name,
    }));
  } else {
    const ul: SessionTemplateBlueprint[] = [
      { name: 'Upper A — Strength & Horizontal Focus', splitType: 'Upper', description: 'Primary bench and heavy row progression with shoulder/arm work.', specs: upperSession },
      { name: 'Lower A — Squat & Posterior Chain', splitType: 'Lower', description: 'Primary squat pattern, RDL hinge, and core stability.', specs: lowerSession },
      { name: 'Upper B — Vertical & Hypertrophy', splitType: 'Upper', description: 'Overhead pressing, weighted pull-ups, and upper-back density.', specs: [pushSession[2], pullSession[0], pushSession[1], pullSession[2], pullSession[3], pushSession[4]] },
      { name: 'Lower B — Hinge & Unilateral Volume', splitType: 'Lower', description: 'Deadlift/leg press hypertrophy with hamstring isolation and calves.', specs: [fullBodyB[0], legsSession[2], legsSession[3], lowerSession[3], legsSession[4]] },
    ];
    dayBlueprints = Array.from({ length: daysCount }, (_, i) => ul[i % ul.length]);
  }

  const deloadWeekNumber = includeDeload ? weeksCount : 0;
  const weeks: AiProgramWeek[] = [];

  for (let w = 1; w <= weeksCount; w++) {
    const isDeload = includeDeload && w === weeksCount;
    const sessions: AiProgramSession[] = dayBlueprints.map((bp) => {
      const exercises: AiProgramSessionExercise[] = bp.specs.map((spec) => {
        const sets = isDeload ? Math.max(2, Math.round(spec.targetSets * 0.6)) : spec.targetSets;
        const targetRpe = isDeload ? 6 : Math.min(9, Number((spec.baseRpe + (w - 1) * 0.4).toFixed(1)));
        return {
          name: spec.name,
          muscleGroup: spec.muscleGroup,
          targetSets: sets,
          targetReps: spec.targetReps,
          restSeconds: isDeload ? Math.max(60, spec.restSeconds - 30) : spec.restSeconds,
          targetRpe,
          loadGuidance: resolveLoadGuidance(spec, prs, unit, w, isDeload),
        };
      });

      return {
        name: isDeload ? `${bp.name} (Deload)` : bp.name,
        splitType: bp.splitType,
        description: isDeload ? 'Reduced volume and submaximal RPE to dissipate accumulated fatigue.' : bp.description,
        exercises,
      };
    });

    weeks.push({
      weekNumber: w,
      isDeload,
      summary: isDeload
        ? 'Deload Week: working sets cut by ~40% and capped at RPE 6.0 to supercompensate.'
        : w === 1
          ? `Accumulation Intro: establish crisp technique at RPE 7.5 (${unit}).`
          : `Accumulation Wave ${w}: step up load or +1 rep per set while keeping RPE <= ${Math.min(9, Number((7.5 + (w - 1) * 0.4).toFixed(1)))}.`,
      sessions,
    });
  }

  const shortGoal = goalPrompt.length > 52 ? `${goalPrompt.slice(0, 49).trim()}...` : goalPrompt;
  return {
    title: `${weeksCount}-Week ${splitPref} — ${shortGoal}`.slice(0, 120),
    focus: `${daysCount} days/week ${splitPref} block built around ${prs.length ? 'your recorded 1RMs' : 'RPE-guided progression'}${
      includeDeload ? ` with a Week ${weeksCount} deload.` : '.'
    }`.slice(0, 240),
    durationWeeks: weeksCount,
    deloadWeekNumber,
    weeks,
  };
}
