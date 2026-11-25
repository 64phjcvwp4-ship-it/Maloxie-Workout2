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
    return Math.max(5, Math.round(lbs / 5) * 5);
  }
  return Math.max(2.5, Math.round(kg / 2.5) * 2.5);
}

const LIFT_KNOWLEDGE: Array<{
  keywords: string[];
  name: string;
  muscleGroup: MuscleGroup;
  cues: string[];
  repScheme: string;
  swap: string;
}> = [
  {
    keywords: ['bench', 'chest press'],
    name: 'Barbell Bench Press',
    muscleGroup: 'Chest',
    cues: [
      'Retract and depress shoulder blades into the bench before unracking.',
      'Touch lower sternum with elbows tucked ~45 degrees, then drive feet into the floor as you press.',
    ],
    repScheme: '3–4 sets × 5–8 reps at RPE 7.5–8.5 (2.5–3 min rest)',
    swap: 'Incline Dumbbell Press or Machine Chest Press if shoulders feel cranky',
  },
  {
    keywords: ['incline'],
    name: 'Incline Dumbbell Press',
    muscleGroup: 'Chest',
    cues: [
      'Set bench to 25–30 degrees to bias upper pecs without overloading front delts.',
      'Lower for a controlled 2-second eccentric to a deep stretch before driving up.',
    ],
    repScheme: '3–4 sets × 8–10 reps at RPE 8 (2 min rest)',
    swap: 'Incline Smith Machine Press for maximum stability',
  },
  {
    keywords: ['squat'],
    name: 'Barbell Back Squat',
    muscleGroup: 'Legs',
    cues: [
      'Take a 360-degree breath into your brace before unlocking hips and knees together.',
      'Keep midfoot balance and drive knees out in line with your toes out of the hole.',
    ],
    repScheme: '3–4 sets × 4–6 reps (strength) or 6–8 reps (hypertrophy) at RPE 7.5–8.5',
    swap: '45-Degree Leg Press or Hack Squat if lower back or knees are fatigued',
  },
  {
    keywords: ['deadlift', 'rdl', 'romanian'],
    name: 'Deadlift / Romanian Deadlift',
    muscleGroup: 'Back',
    cues: [
      'Pull the slack out of the bar until your lats lock down before pushing the floor away.',
      'Keep the bar glued to shins/thighs and hinge through the hips rather than rounding the lumbar.',
    ],
    repScheme: '3 sets × 3–5 reps (Conventional) or 6–10 reps (RDL) at RPE 7.5–8.5',
    swap: 'Trap-Bar Deadlift or Seated Hamstring Curl + Back Extension for lower-back relief',
  },
  {
    keywords: ['overhead', 'ohp', 'shoulder press', 'military'],
    name: 'Standing Overhead Press',
    muscleGroup: 'Shoulders',
    cues: [
      'Squeeze glutes and brace abs so your ribcage stays stacked over your pelvis.',
      'Tuck chin slightly on initiation and push your head through once the bar clears your forehead.',
    ],
    repScheme: '3 sets × 5–8 reps at RPE 7.5–8.5 (2–2.5 min rest)',
    swap: 'Seated Dumbbell Shoulder Press or Landmine Press for shoulder comfort',
  },
  {
    keywords: ['pull-up', 'pullup', 'chin-up', 'chinup', 'lat pulldown', 'pulldown'],
    name: 'Weighted Pull-Up / Lat Pulldown',
    muscleGroup: 'Back',
    cues: [
      'Initiate every rep by depressing your shoulder blades down and driving elbows toward your hips.',
      'Control all the way to a full dead-hang stretch at the top.',
    ],
    repScheme: '3–4 sets × 6–10 reps at RPE 8 (2 min rest)',
    swap: 'Neutral-Grip Lat Pulldown for smooth progression',
  },
  {
    keywords: ['row', 't-bar'],
    name: 'Bent-Over / Chest-Supported Row',
    muscleGroup: 'Back',
    cues: [
      'Keep torso angle steady without heaving upward; pull toward your lower ribs/navel.',
      'Pause briefly at peak contraction and control the eccentric stretch.',
    ],
    repScheme: '3–4 sets × 8–12 reps at RPE 8 (90–120s rest)',
    swap: 'Chest-Supported T-Bar Row to remove lower-back fatigue',
  },
  {
    keywords: ['lateral raise', 'side delt'],
    name: 'Dumbbell Lateral Raise',
    muscleGroup: 'Shoulders',
    cues: [
      'Raise in the scapular plane (~30 degrees forward) leading with elbows rather than shrugging traps.',
      'Stop around shoulder height and resist gravity for 2 seconds on the way down.',
    ],
    repScheme: '3–4 sets × 12–15 reps at RPE 8.5–9 (60–75s rest)',
    swap: 'Cable Lateral Raise for constant tension at the bottom',
  },
  {
    keywords: ['curl', 'bicep'],
    name: 'EZ-Bar / Incline Dumbbell Curl',
    muscleGroup: 'Arms',
    cues: [
      'Pin upper arms slightly forward or at your sides—avoid swinging hips to start the rep.',
      'Lower all the way until elbows are straight for full long-head tension.',
    ],
    repScheme: '3 sets × 8–12 reps at RPE 8–9 (60–90s rest)',
    swap: 'Preacher Curl or Cable Curl',
  },
  {
    keywords: ['tricep', 'pushdown', 'skullcrusher', 'extension', 'dip'],
    name: 'Tricep Pushdown / Overhead Extension',
    muscleGroup: 'Arms',
    cues: [
      'Lock upper arms in place so only the elbow joint hinges.',
      'Include at least one overhead movement to stretch the long head of the triceps.',
    ],
    repScheme: '3 sets × 10–15 reps at RPE 8–9 (60–90s rest)',
    swap: 'Rope Pushdown or Cross-Body Cable Extension',
  },
];

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
  const exerciseHistory = new Map<
    string,
    Array<{ date: string; topWeightKg: number; topE1rm: number; volKg: number; topReps: number }>
  >();

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
      let topReps = 0;
      let topE1rm = 0;
      let exVol = 0;
      for (const s of ex.sets || []) {
        if (s.rpe > 0) {
          rpeSum += s.rpe;
          rpeCount += 1;
        }
        const weight = Number(s.weightKg) || 0;
        const reps = Number(s.reps) || 0;
        if (weight > topWeight || (weight === topWeight && reps > topReps)) {
          topWeight = weight;
          topReps = reps;
        }
        const e1rm = reps === 1 ? weight : weight * (1 + reps / 30);
        if (e1rm > topE1rm) topE1rm = e1rm;
        exVol += weight * reps;
      }

      const key = ex.name.trim();
      if (key) {
        const list = exerciseHistory.get(key) || [];
        list.push({ date: w.date, topWeightKg: topWeight, topE1rm, volKg: exVol, topReps });
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
    exerciseHistory,
    progressingLifts,
    stalledLifts,
    highFatigue,
    activeDeloadWeek: Boolean(ctx.activeDeloadWeek),
  };
}

function buildEffectiveQuery(
  rawQuestion: string,
  history?: Array<{ role?: string; content?: string }>
): { q: string; raw: string; isFollowUp: boolean } {
  const raw = rawQuestion.trim();
  const q = raw.toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const isShortFollowUp =
    words.length <= 5 &&
    /^(why|how|what about|and |more|explain|example|elaborate|yes|yeah|ok|okay|sure|details|which)/.test(q);

  if (isShortFollowUp && Array.isArray(history) && history.length > 0) {
    const prevUserMsgs = history
      .filter((m) => m.role === 'user' && m.content && m.content.trim().toLowerCase() !== q)
      .slice(-2)
      .map((m) => m.content!.trim());
    if (prevUserMsgs.length > 0) {
      return {
        q: `${prevUserMsgs.join(' ')} ${q}`.toLowerCase(),
        raw,
        isFollowUp: true,
      };
    }
  }

  return { q, raw, isFollowUp: false };
}

export function generateCoachResponse(payload: CoachRequestPayload): string {
  const { q, raw } = buildEffectiveQuery(payload.question || '', payload.history);
  const stats = analyzeContext(payload.trainingContext ?? {});
  const { unit } = stats;
  const hasLogs = stats.workouts.length > 0;
  const step = unit === 'lbs' ? '5 lbs' : '2.5 kg';
  const microStep = unit === 'lbs' ? '2.5 lbs' : '1.25 kg';

  // 1. Greeting / Identity / Help
  if (/^(hi|hello|hey|yo|sup|good morning|good evening)\b/.test(q) || /what can you do|how do you work|\bhelp\b/.test(q)) {
    const summaryLine = hasLogs
      ? `I am tracking ${stats.workouts.length} workout(s), ${stats.prs.length} Personal Record(s), and ${stats.goals.length} goal(s) in ${unit.toUpperCase()}.`
      : `Your workspace is ready in ${unit.toUpperCase()} (${stats.goals.length} active goal(s), ${stats.measurements.length} body measurement(s)).`;
    return [
      'MALOXIE CRYSTAL BALL',
      summaryLine,
      '',
      'Ask me anything specific, such as:',
      '• Lift Coaching: "How do I increase my bench press?" or "Form cues for Romanian deadlift"',
      '• Programming & Volume: "How many sets per week for hypertrophy?" or "Best 4-day Upper/Lower split"',
      '• Recovery & Nutrition: "Should I deload right now?" or "How much protein should I eat daily?"',
    ].join('\n');
  }

  // 2. Specific Exercise / Movement Match (checks logged exercises, PRs, and lift knowledge)
  const loggedMatchName = Array.from(stats.exerciseHistory.keys()).find((name) =>
    q.includes(name.toLowerCase())
  );
  const prMatch = stats.prs.find((p) => q.includes(p.exercise.toLowerCase()));
  const knowledgeMatch = LIFT_KNOWLEDGE.find((k) => k.keywords.some((kw) => q.includes(kw)));

  // Only route to Lift Breakdown if the user isn't asking purely about deload/nutrition/warmup
  const isPureTopic =
    /warm\s?up|mobility|protein|calorie|macro|diet|creatine|deload|sleep|rest\s*(time|period|between)/.test(q) &&
    !knowledgeMatch &&
    !loggedMatchName;

  if ((loggedMatchName || prMatch || knowledgeMatch) && !isPureTopic) {
    const liftTitle = loggedMatchName || prMatch?.exercise || knowledgeMatch!.name;
    const lines: string[] = [`LIFT COACHING — ${liftTitle.toUpperCase()}`];

    if (prMatch) {
      const nextTargetKg = prMatch.bestWeightKg + (unit === 'lbs' ? 2.268 : 2.5);
      lines.push(
        `• Recorded PR: ${formatWeightUnit(prMatch.bestWeightKg, unit)} × ${prMatch.reps} reps (est. 1RM ${formatWeightUnit(prMatch.estimated1RMKg, unit)}) on ${prMatch.date}.`
      );
      lines.push(
        `• Next Working Target: Push toward ${formatWeightUnit(nextTargetKg, unit)} once you hit the top of your rep range cleanly at RPE <= 8.`
      );
    } else if (loggedMatchName) {
      const entries = stats.exerciseHistory.get(loggedMatchName)!;
      const latest = entries[entries.length - 1];
      lines.push(
        `• Latest Session: ${formatWeightUnit(latest.topWeightKg, unit)} × ${latest.topReps} reps (est. 1RM ${formatWeightUnit(latest.topE1rm, unit)}).`
      );
    } else {
      lines.push(
        `• No logged sets for ${liftTitle} yet — start conservatively at RPE 7–7.5 (2–3 reps in reserve) and add ${step} whenever all sets hit the target reps cleanly.`
      );
    }

    if (knowledgeMatch) {
      lines.push('');
      lines.push('EXECUTION & PROGRESSION');
      for (const cue of knowledgeMatch.cues) {
        lines.push(`• Form Cue: ${cue}`);
      }
      lines.push(`• Target Structure: ${knowledgeMatch.repScheme}`);
      lines.push(`• Joint-Friendly Alternative: ${knowledgeMatch.swap}`);
    }

    if (stats.injuryNotes.length > 0) {
      lines.push('');
      lines.push(`• Injury Watch: You recently logged "${stats.injuryNotes[0].note}" — keep eccentrics controlled and stop 2+ reps shy of failure if discomfort rises.`);
    }

    return lines.join('\n');
  }

  // 3. Nutrition, Protein, Calories, Bulk / Cut, Supplements
  if (/protein|calorie|macro|diet|eat|food|nutrition|bulk|cut|fat|lean|creatine|supplement|bodyweight|weight loss|gain weight/.test(q)) {
    const latestBwKg = stats.measurements[0]?.bodyweightKg;
    const bwDisplay = latestBwKg ? formatWeightUnit(latestBwKg, unit) : null;
    const lines = ['NUTRITION & BODY COMPOSITION'];

    if (latestBwKg) {
      const proteinLow = Math.round(latestBwKg * 1.6);
      const proteinHigh = Math.round(latestBwKg * 2.2);
      const maintEst = Math.round(latestBwKg * 32);
      lines.push(`• Anchor Bodyweight: ${bwDisplay} (from your latest measurement).`);
      lines.push(`• Daily Protein Target: ${proteinLow}–${proteinHigh} g/day (1.6–2.2 g/kg) split across 3–4 meals to maximize muscle protein synthesis.`);
      if (/cut|fat|lean|loss/.test(q)) {
        lines.push(`• Fat-Loss Deficit: Aim around ${maintEst - 400}–${maintEst - 300} kcal/day (~300–450 kcal deficit) to lose 0.4–0.7% bodyweight/week while retaining strength.`);
      } else if (/bulk|gain|mass|grow/.test(q)) {
        lines.push(`• Lean Surplus: Aim around ${maintEst + 250}–${maintEst + 350} kcal/day (+250–350 kcal above maintenance) for steady lean tissue gain without excess fat.`);
      } else {
        lines.push(`• Estimated Maintenance Range: ~${maintEst - 150}–${maintEst + 150} kcal/day depending on daily step count and training volume.`);
      }
    } else {
      lines.push('• Log your current bodyweight in Progress → Body Metrics so Maloxie can calculate exact gram and calorie targets.');
      lines.push('• Rule of Thumb: Target 1.6–2.2 g protein per kg of bodyweight (0.75–1.0 g/lb), keep a modest +/-300 kcal surplus or deficit, and stay consistent for 2+ weeks before adjusting.');
    }

    lines.push('');
    lines.push('TRAINING & RECOVERY SYNERGY');
    lines.push('• Pre-Session Fuel: 30–60 g carbs 60–90 min before lifting supports high-output sets and RPE stability.');
    lines.push('• Creatine Monohydrate: 3–5 g daily (timing does not matter) reliably improves repeat-set work capacity.');
    return lines.join('\n');
  }

  // 4. Warm-Up & Mobility
  if (/warm\s?up|warmup|mobility|stretch|ramp|prepare|activation/.test(q)) {
    const topPr = stats.prs[0];
    const lines = [
      'WARM-UP & RAMP PROTOCOL',
      'Keep your warm-up crisp (8–12 minutes) so it primes the nervous system without draining working sets:',
      '',
      '• Step 1 — General Heat (3–5 min): Light incline walk, rower, or assault bike until lightly sweating.',
      '• Step 2 — Dynamic Mobility (3 min): 1–2 quick sets of band pull-aparts, thoracic rotations, or 90/90 hip openers for the joints you are training today.',
      '• Step 3 — Specific Ramp Sets (3–4 sets):',
    ];
    if (topPr) {
      const w50 = roundToPlate(topPr.bestWeightKg * 0.5, unit);
      const w75 = roundToPlate(topPr.bestWeightKg * 0.75, unit);
      const w90 = roundToPlate(topPr.bestWeightKg * 0.9, unit);
      lines.push(
        `  For example, based on your ${topPr.exercise} (${formatWeightUnit(topPr.bestWeightKg, unit)}): ${w50} ${unit} × 8 → ${w75} ${unit} × 4 → ${w90} ${unit} × 1–2 (rest 90s, then start working sets).`
      );
    } else {
      lines.push('  Empty bar × 10 → 50% working weight × 6 → 75% × 3 → 90% × 1–2 (never fatigue yourself on warm-up sets).');
    }
    return lines.join('\n');
  }

  // 5. Rest Times, Tempo, Reps, Sets, Hypertrophy vs Strength
  if (/rest\s*(time|period|between|long)|how long.*rest|tempo|eccentric|rpe|rir|rep range|how many (rep|set)|hypertrophy|strength vs/.test(q)) {
    const lines = ['PROGRAMMING PARAMETERS — SETS, REPS & REST'];
    if (/rest/.test(q)) {
      lines.push('• Primary Compounds (Squat, Bench, Deadlift, OHP): Rest 2.5–4 minutes between sets so ATP and central drive recover.');
      lines.push('• Secondary Compounds & Rows: Rest 90–120 seconds.');
      lines.push('• Isolations (Laterals, Curls, Pushdowns, Calves): Rest 60–75 seconds.');
    }
    if (/rpe|rir|failure|heavy|intensity/.test(q)) {
      lines.push(
        `• Optimal Effort Zone: Keep most compound sets at RPE 7.5–8.5 (1.5–2.5 reps in reserve).${
          hasLogs && stats.avgRpe ? ` Your recent 14d average is RPE ${stats.avgRpe}/10.` : ''
        }`
      );
      lines.push('• Isolation Work: Safely push final sets to RPE 9–10 with minimal systemic fatigue.');
    }
    if (/rep|set|hypertrophy|strength|tempo|eccentric/.test(q) || lines.length === 1) {
      lines.push('• Strength Emphasis: 3–5 sets × 3–6 reps at ~80–88% 1RM (RPE 7.5–8.5).');
      lines.push('• Hypertrophy Emphasis: 10–18 hard sets per muscle group per week across 6–15 reps with a controlled 2-second eccentric.');
      lines.push('• Double Progression Rule: Pick a rep range (e.g., 8–10). Once every set reaches 10 clean reps at RPE <= 8.5, add ' + step + ' next session.');
    }
    if (hasLogs) {
      lines.push('');
      lines.push(
        `• Your Current Set Snapshot (${stats.workouts.length} logged session(s)): Chest ${stats.muscleSets.Chest} · Back ${stats.muscleSets.Back} · Legs ${stats.muscleSets.Legs} · Shoulders ${stats.muscleSets.Shoulders} · Arms ${stats.muscleSets.Arms}.`
      );
    }
    return lines.join('\n');
  }

  // 6. Injury / Pain / Joint Safety
  if (/pain|injur|hurt|ache|sore|tendon|impingement|knee|shoulder|lower back|elbow|wrist|hip/.test(q)) {
    const lines = ['JOINT SAFETY & LOAD MANAGEMENT'];
    if (stats.injuryNotes.length > 0) {
      lines.push('• Logged Notes from Your Sessions:');
      for (const note of stats.injuryNotes.slice(0, 3)) {
        lines.push(`  - ${note.date}: "${note.note}"`);
      }
    }
    lines.push('• Immediate Triage: Drop load by 15–25% on movements that trigger sharp pain (>3/10), slow down the eccentric to 3 seconds, and avoid bouncing out of the bottom.');
    if (/shoulder/.test(q)) {
      lines.push('• Shoulder Swaps: Replace flat barbell bench / dips temporarily with neutral-grip dumbbell press, floor press, or cable flyes.');
    } else if (/knee/.test(q)) {
      lines.push('• Knee Swaps: Shift from deep high-bar squats to controlled leg press, box squats, or hip-dominant RDLs/hamstring curls.');
    } else if (/back/.test(q)) {
      lines.push('• Lower-Back Swaps: Swap barbell rows and heavy conventional pulls for chest-supported rows, belt squats, or leg curls.');
    } else {
      lines.push('• If discomfort persists beyond 1–2 weeks or worsens under light warm-up sets, consult a qualified sports physio before loading heavy.');
    }
    return lines.join('\n');
  }

  // 7. Deload / Fatigue / Recovery / Sleep
  if (/deload|fatigue|tired|sleep|recover|burn|overtrain|rest day/.test(q)) {
    const lines = ['READINESS & DELOAD VERDICT'];
    if (stats.activeDeloadWeek) {
      lines.push('• Deload Protocol is Active: Keep working sets ~40% lower and cap intensity at RPE 6.0–6.5.');
    } else if (hasLogs && stats.highFatigue) {
      lines.push(
        `• Recommendation: Schedule a 5–7 day Deload Week now. Fatigue markers detected (` +
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
    } else if (hasLogs) {
      lines.push(
        `• Recommendation: Recovery looks steady (avg RPE ${stats.avgRpe || '—'}/10, sleep ${stats.avgSleepHours}h, energy ${stats.avgEnergy}/10). Keep training normally and plan a deload every 4–6 weeks.`
      );
    } else {
      lines.push('• Deload Timing Guide: Run 3–5 progressive accumulation weeks (RPE 7.5 → 8.5), then take 1 deload week cutting working sets by ~40% at RPE 6.0–6.5.');
    }

    lines.push('');
    lines.push('RECOVERY LEVERS');
    lines.push('• Sleep Target: 7.5–9 hours/night — dropping below 6.5 hours increases perceived RPE and slows strength recovery.');
    lines.push('• Toggle Deload Mode anytime in Library & Goals or generate a block with Final Week Deload enabled.');
    return lines.join('\n');
  }

  // 8. Split / Volume / Muscle Imbalances / Frequency
  if (/split|volume|imbalance|weak|muscle|chest|back|leg|shoulder|arm|core|ratio|days a week|frequency|ppl|upper|full body/.test(q)) {
    const pushSets = stats.muscleSets.Chest + stats.muscleSets.Shoulders;
    const pullSets = stats.muscleSets.Back;
    const legSets = stats.muscleSets.Legs;
    const armCoreSets = stats.muscleSets.Arms + stats.muscleSets.Core;

    const lines = ['SPLIT & MUSCLE VOLUME ANALYSIS'];
    if (hasLogs) {
      lines.push(
        `• Logged Set Distribution (${stats.workouts.length} session(s)): Chest ${stats.muscleSets.Chest} · Back ${stats.muscleSets.Back} · Legs ${stats.muscleSets.Legs} · Shoulders ${stats.muscleSets.Shoulders} · Arms ${stats.muscleSets.Arms} · Core ${stats.muscleSets.Core}`
      );
      if (pushSets > pullSets * 1.35 && pullSets > 0) {
        lines.push(`• Imbalance Flag: Pulling (${pullSets} sets) trails pushing (${pushSets} sets) — add 3–4 weekly sets of rows or face pulls.`);
      } else if (pullSets === 0 && pushSets > 0) {
        lines.push('• Imbalance Flag: No Back sets logged recently — add pull-ups/pulldowns and rows to balance shoulder health.');
      }
      if (legSets < Math.max(4, Math.round((pushSets + pullSets) * 0.3))) {
        lines.push(`• Lower-Body Focus: Leg sets (${legSets}) trail upper-body sets — schedule squats, RDLs, or split squats twice weekly.`);
      }
      if (pushSets + pullSets + legSets + armCoreSets > 0 && legSets >= 4 && pullSets >= pushSets * 0.7) {
        lines.push('• Balance Verdict: Your Push/Pull/Legs distribution is well proportioned.');
      }
    } else {
      lines.push('• Best Split by Training Frequency:');
      lines.push('  - 3 Days/Week: Full Body (squat, hinge, push, pull every session).');
      lines.push('  - 4 Days/Week: Upper / Lower (hits every muscle twice weekly with generous recovery).');
      lines.push('  - 5–6 Days/Week: Push / Pull / Legs (high-volume specialization).');
    }
    return lines.join('\n');
  }

  // 9. Goals & Target Timelines
  if (/goal|target|fast|achieve|milestone|how long|deadline/.test(q)) {
    const activeGoals = stats.goals.filter((g) => g.status === 'active');
    const lines = ['GOAL ACCELERATION ROADMAP'];
    if (activeGoals.length === 0) {
      lines.push('• You do not have an active goal set yet. Add a target weight, e1RM, or bodyweight milestone in the Library tab so Maloxie can track your exact remaining gap.');
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
        lines.push(
          `• ${g.title} (${g.exerciseName} by ${g.targetDate}): Target ${
            g.metricType === 'volume' ? formatVolUnit(g.targetValueKg, unit) : formatWeightUnit(g.targetValueKg, unit)
          }${
            currentKg > 0
              ? ` · Current ${formatWeightUnit(currentKg, unit)} (${
                  gapKg > 0 ? `${formatWeightUnit(gapKg, unit)} remaining` : 'target achieved!'
                })`
              : ''
          }.`
        );
      }
    }
    lines.push('');
    lines.push(`• Pacing Strategy: Add ${microStep}–${step} or +1 rep on primary working sets whenever RPE stays <= 8, and keep protein and sleep steady.`);
    return lines.join('\n');
  }

  // 10. Progressive Overload / Plateaus / General Questions
  const isOverload = /overload|progress|stall|plateau|stuck|stronger|pr|1rm|increase/.test(q);
  const lines: string[] = [
    isOverload ? 'PROGRESSIVE OVERLOAD AUDIT' : `COACHING BRIEF — "${raw.slice(0, 72)}"`,
  ];

  if (hasLogs) {
    const volDeltaLabel =
      stats.volumeDeltaPct !== null
        ? ` (${stats.volumeDeltaPct >= 0 ? '+' : ''}${stats.volumeDeltaPct}% vs prior 7d)`
        : '';
    lines.push(
      `• 7-Day Tonnage: ${formatVolUnit(stats.weekVol, unit)} across ${stats.weekCount} session(s)${volDeltaLabel}.`
    );
    lines.push(
      `• Readiness & Effort: Avg RPE ${stats.avgRpe || '—'}/10 · Sleep ${stats.avgSleepHours}h (quality ${stats.avgSleepQuality}/10) · Energy ${stats.avgEnergy}/10.`
    );
    if (stats.prs.length > 0) {
      const topPrs = stats.prs
        .slice(0, 3)
        .map(
          (p) =>
            `${p.exercise}: ${formatWeightUnit(p.bestWeightKg, unit)} × ${p.reps} (e1RM ${formatWeightUnit(p.estimated1RMKg, unit)})`
        )
        .join(' · ');
      lines.push(`• Top PRs: ${topPrs}`);
    }
    lines.push('');
    lines.push('ACTIONABLE RECOMMENDATIONS');
    if (stats.progressingLifts.length > 0) {
      lines.push(`• Trending Up: ${stats.progressingLifts.slice(0, 3).join(', ')}.`);
    }
    if (stats.stalledLifts.length > 0) {
      lines.push(
        `• Plateau Watch: ${stats.stalledLifts.slice(0, 3).join(', ')} held flat recently — use double progression (+1 rep/set before adding ${step}) or reset 10% lighter for a fresh 4-week climb.`
      );
    } else {
      lines.push(
        `• Overload Rule: Once all working sets reach the top of your target rep range at RPE <= 8, increase load by ${step} next session.`
      );
    }
  } else {
    lines.push(
      `• Context Note: You haven't logged workouts yet, so I cannot read past sets for "${raw.slice(0, 60)}" — here is the evidence-based approach in ${unit.toUpperCase()}:`
    );
    lines.push(`• Core Progression: Pick 4–6 compound & isolation lifts per session, hit RPE 7.5–8.5, and add ${microStep}–${step} or +1 rep each week.`);
    lines.push('• Tip: Ask me about a specific lift (e.g. "bench press cues"), nutrition ("how much protein?"), split design, rest periods, or switch to Multi-Week & Deload Builder to create a full plan.');
  }

  return lines.join('\n');
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

export function generateTrainingProgram(
  payload: ProgramRequestPayload
): Omit<AiTrainingProgram, 'id' | 'userId' | 'createdAt'> {
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
      {
        name: 'Full Body A — Squat & Press Focus',
        splitType: 'Full Body',
        description: 'Primary squat and horizontal push paired with rowing and core.',
        specs: fullBodyA,
      },
      {
        name: 'Full Body B — Hinge & Pull Focus',
        splitType: 'Full Body',
        description: 'Posterior-chain hinge, incline press, and vertical pulling.',
        specs: fullBodyB,
      },
      {
        name: 'Full Body C — Hypertrophy & Accessories',
        splitType: 'Full Body',
        description: 'Unilateral lower work, lateral delts, and arm/core balance.',
        specs: [legsSession[2], pushSession[2], pullSession[2], pushSession[4], pullSession[4]],
      },
    ];
    dayBlueprints = Array.from({ length: daysCount }, (_, i) => cycle[i % cycle.length]);
  } else if (splitPref === 'Push / Pull / Legs') {
    const ppl: SessionTemplateBlueprint[] = [
      {
        name: 'Push — Chest, Shoulders & Triceps',
        splitType: 'Push',
        description: 'Compound pressing strength paired with medial delt and tricep volume.',
        specs: pushSession,
      },
      {
        name: 'Pull — Lats, Upper Back & Biceps',
        splitType: 'Pull',
        description: 'Vertical and horizontal pulling with rear-delt balance.',
        specs: pullSession,
      },
      {
        name: 'Legs — Squat, Hinge & Core',
        splitType: 'Legs',
        description: 'Balanced quad/hamstring progression with calves and trunk stability.',
        specs: legsSession,
      },
    ];
    dayBlueprints = Array.from({ length: daysCount }, (_, i) => ({
      ...ppl[i % 3],
      name: i >= 3 ? `${ppl[i % 3].name} (Day ${i + 1})` : ppl[i % 3].name,
    }));
  } else {
    const ul: SessionTemplateBlueprint[] = [
      {
        name: 'Upper A — Strength & Horizontal Focus',
        splitType: 'Upper',
        description: 'Primary bench and heavy row progression with shoulder/arm work.',
        specs: upperSession,
      },
      {
        name: 'Lower A — Squat & Posterior Chain',
        splitType: 'Lower',
        description: 'Primary squat pattern, RDL hinge, and core stability.',
        specs: lowerSession,
      },
      {
        name: 'Upper B — Vertical & Hypertrophy',
        splitType: 'Upper',
        description: 'Overhead pressing, weighted pull-ups, and upper-back density.',
        specs: [pushSession[2], pullSession[0], pushSession[1], pullSession[2], pullSession[3], pushSession[4]],
      },
      {
        name: 'Lower B — Hinge & Unilateral Volume',
        splitType: 'Lower',
        description: 'Deadlift/leg press hypertrophy with hamstring isolation and calves.',
        specs: [fullBodyB[0], legsSession[2], legsSession[3], lowerSession[3], legsSession[4]],
      },
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
          : `Accumulation Wave ${w}: step up load or +1 rep per set while keeping RPE <= ${Math.min(
              9,
              Number((7.5 + (w - 1) * 0.4).toFixed(1))
            )}.`,
      sessions,
    });
  }

  const shortGoal = goalPrompt.length > 52 ? `${goalPrompt.slice(0, 49).trim()}...` : goalPrompt;
  return {
    title: `${weeksCount}-Week ${splitPref} — ${shortGoal}`.slice(0, 120),
    focus: `${daysCount} days/week ${splitPref} block built around ${
      prs.length ? 'your recorded 1RMs' : 'RPE-guided progression'
    }${includeDeload ? ` with a Week ${weeksCount} deload.` : '.'}`.slice(0, 240),
    durationWeeks: weeksCount,
    deloadWeekNumber,
    weeks,
  };
}
