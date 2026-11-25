import React, { useEffect, useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  Award01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Dumbbell01Icon,
  Timer01Icon,
} from '@hugeicons/core-free-icons';
import { useMaloxie } from '../../context/MaloxieContext';
import { DEFAULT_WARMUP_ITEMS, MUSCLE_GROUPS } from '../../data/presets';
import { MaloxieButton } from '../ui/MaloxieButton';
import { GlassRadioSelector, TactilePillButton } from '../ui/UiverseControls';
import {
  calculateE1RM,
  formatRestDuration,
  formatVolume,
  formatWeight,
  fromKg,
  toKg,
  todayIsoDate,
} from '../../utils/units';
import type {
  MuscleGroup,
  WarmupItem,
  WorkoutExercise,
  WorkoutLog,
  WorkoutSet,
  WorkoutTemplate,
} from '../../types/training';

interface WorkoutLoggerViewProps {
  selectedTemplateToLoad?: WorkoutTemplate | null;
  onClearTemplateToLoad?: () => void;
}

function createEmptySet(defaultWeightKg = 20, restSeconds = 120): WorkoutSet {
  return {
    id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    reps: 8,
    weightKg: defaultWeightKg,
    rpe: 8,
    restSeconds,
    notes: '',
  };
}

export const WorkoutLoggerView: React.FC<WorkoutLoggerViewProps> = ({
  selectedTemplateToLoad,
  onClearTemplateToLoad,
}) => {
  const {
    profile,
    unit,
    workouts,
    templates,
    exercises: libraryExercises,
    measurements,
    saveWorkout,
    deleteWorkout,
  } = useMaloxie();

  const [editingWorkoutId, setEditingWorkoutId] = useState<string | undefined>(undefined);
  const [date, setDate] = useState(todayIsoDate());
  const [title, setTitle] = useState('Push — Strength Session');
  const [templateName, setTemplateName] = useState('');
  const [selectedSplitMode, setSelectedSplitMode] = useState('Push');
  const [isDeload, setIsDeload] = useState(Boolean(profile?.activeDeloadWeek));
  const [energyLevel, setEnergyLevel] = useState(8);
  const [sleepHours, setSleepHours] = useState(7.5);
  const [sleepQuality, setSleepQuality] = useState(8);
  const [injuryNotes, setInjuryNotes] = useState('');
  const [warmupItems, setWarmupItems] = useState<WarmupItem[]>(() =>
    DEFAULT_WARMUP_ITEMS.map((item) => ({ ...item }))
  );
  const [newWarmupText, setNewWarmupText] = useState('');
  const [sessionExercises, setSessionExercises] = useState<WorkoutExercise[]>([
    {
      id: `we_${Date.now()}`,
      exerciseName: 'Barbell Bench Press',
      muscleGroup: 'Chest',
      sets: [createEmptySet(60, 180), createEmptySet(60, 180), createEmptySet(60, 180)],
    },
  ]);

  // Quick-fill state per exercise (Sets x Reps x Weight)
  const [quickFillDrafts, setQuickFillDrafts] = useState<
    Record<string, { sets: number; reps: number; weightKg: number; rpe: number; restSeconds: number }>
  >({});

  // Standalone Volume Calculator state (Sets x Reps x Weight)
  const [calcExercise, setCalcExercise] = useState('Barbell Bench Press');
  const [calcMuscle, setCalcMuscle] = useState<MuscleGroup>('Chest');
  const [calcSets, setCalcSets] = useState(4);
  const [calcReps, setCalcReps] = useState(8);
  const [calcWeightKg, setCalcWeightKg] = useState(80);
  const [calcRpe, setCalcRpe] = useState(8);
  const [calcRest, setCalcRest] = useState(120);

  // Exercise picker state
  const [pickerMuscle, setPickerMuscle] = useState<'All' | MuscleGroup>('All');
  const [pickerSearch, setPickerSearch] = useState('');
  const [customExName, setCustomExName] = useState('');
  const [customExMuscle, setCustomExMuscle] = useState<MuscleGroup>('Chest');

  // Rest countdown timer state
  const [restRemaining, setRestRemaining] = useState(0);
  const [restRunning, setRestRunning] = useState(false);

  // History filter state
  const [historySearch, setHistorySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!restRunning) return;
    const timer = window.setInterval(() => {
      setRestRemaining((prev) => {
        if (prev <= 1) {
          setRestRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [restRunning]);

  const startRestTimer = (seconds: number) => {
    setRestRemaining(Math.max(5, seconds));
    setRestRunning(true);
  };

  const applyTemplate = (tpl: WorkoutTemplate) => {
    setEditingWorkoutId(undefined);
    setTitle(tpl.name);
    setTemplateName(tpl.name);
    setSelectedSplitMode(tpl.splitType);
    setSessionExercises(
      tpl.exercises.map((te, idx) => {
        // Seed initial weight from user's previous workout if logged
        const prevSession = workouts.find((w) =>
          w.exercises.some((e) => e.exerciseName.toLowerCase() === te.name.toLowerCase())
        );
        const prevEx = prevSession?.exercises.find(
          (e) => e.exerciseName.toLowerCase() === te.name.toLowerCase()
        );
        const seedWeightKg = prevEx?.sets[0]?.weightKg ?? 40;
        const count = Math.max(1, Math.min(8, te.targetSets));
        return {
          id: `we_${Date.now()}_${idx}`,
          exerciseName: te.name,
          muscleGroup: te.muscleGroup,
          sets: Array.from({ length: count }, () =>
            createEmptySet(seedWeightKg, te.restSeconds || 120)
          ),
        };
      })
    );
    setSaveBanner(`Loaded template "${tpl.name}".`);
  };

  useEffect(() => {
    if (selectedTemplateToLoad) {
      applyTemplate(selectedTemplateToLoad);
      onClearTemplateToLoad?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateToLoad]);

  const handleQuickSplitSelect = (splitVal: string) => {
    setSelectedSplitMode(splitVal);
    if (splitVal === 'Custom') {
      setTitle('Custom Strength Session');
      setTemplateName('');
      return;
    }
    const matching = templates.find(
      (t) => t.splitType.toLowerCase() === splitVal.toLowerCase()
    );
    if (matching) {
      applyTemplate(matching);
    } else {
      setTitle(`${splitVal} Session`);
    }
  };

  const filteredLibrary = useMemo(() => {
    return libraryExercises.filter((ex) => {
      const matchMuscle = pickerMuscle === 'All' || ex.muscleGroup === pickerMuscle;
      const matchText =
        !pickerSearch.trim() ||
        ex.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        ex.equipment.toLowerCase().includes(pickerSearch.toLowerCase());
      return matchMuscle && matchText;
    });
  }, [libraryExercises, pickerMuscle, pickerSearch]);

  const addExerciseToSession = (name: string, muscleGroup: MuscleGroup) => {
    const prevWorkout = workouts.find((w) =>
      w.exercises.some((e) => e.exerciseName.toLowerCase() === name.toLowerCase())
    );
    const prevEx = prevWorkout?.exercises.find(
      (e) => e.exerciseName.toLowerCase() === name.toLowerCase()
    );
    const seedWeightKg = prevEx?.sets[0]?.weightKg ?? 20;

    setSessionExercises((prev) => [
      ...prev,
      {
        id: `we_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        exerciseName: name,
        muscleGroup,
        sets: [createEmptySet(seedWeightKg, 120), createEmptySet(seedWeightKg, 120)],
      },
    ]);
  };

  const removeExerciseFromSession = (exId: string) => {
    setSessionExercises((prev) => prev.filter((e) => e.id !== exId));
  };

  const addSetToExercise = (exId: string) => {
    setSessionExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            createEmptySet(last?.weightKg ?? 20, last?.restSeconds ?? 120),
          ],
        };
      })
    );
  };

  const updateSetField = (
    exId: string,
    setId: string,
    field: keyof WorkoutSet,
    value: string | number
  ) => {
    setSessionExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
        };
      })
    );
  };

  const removeSet = (exId: string, setId: string) => {
    setSessionExercises((prev) =>
      prev.map((ex) =>
        ex.id === exId ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) } : ex
      )
    );
  };

  const updateExerciseMeta = (
    exId: string,
    patch: Partial<Pick<WorkoutExercise, 'exerciseName' | 'muscleGroup'>>
  ) => {
    setSessionExercises((prev) =>
      prev.map((ex) => (ex.id === exId ? { ...ex, ...patch } : ex))
    );
  };

  const applyQuickFillToExercise = (exId: string) => {
    const current = sessionExercises.find((e) => e.id === exId);
    if (!current) return;
    const draft = quickFillDrafts[exId] ?? {
      sets: current.sets.length || 3,
      reps: current.sets[0]?.reps || 8,
      weightKg: current.sets[0]?.weightKg ?? 40,
      rpe: current.sets[0]?.rpe || 8,
      restSeconds: current.sets[0]?.restSeconds || 120,
    };

    const count = Math.max(1, Math.min(12, Math.round(draft.sets)));
    const reps = Math.max(1, Math.min(200, Math.round(draft.reps)));
    const weightKg = Math.max(0, draft.weightKg);
    const rpe = Math.min(10, Math.max(1, Number(draft.rpe)));
    const restSeconds = Math.max(0, Math.round(draft.restSeconds));

    setSessionExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: Array.from({ length: count }, (_, idx) => ({
            id: `set_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
            reps,
            weightKg,
            rpe,
            restSeconds,
            notes: ex.sets[idx]?.notes || '',
          })),
        };
      })
    );
  };

  const calcTotalVolumeKg =
    Math.max(1, calcSets) * Math.max(1, calcReps) * Math.max(0, calcWeightKg);
  const calcEstimated1RMKg = calculateE1RM(Math.max(0, calcWeightKg), Math.max(1, calcReps));

  const addCalculatedExerciseToSession = () => {
    const count = Math.max(1, Math.min(12, Math.round(calcSets)));
    const reps = Math.max(1, Math.min(200, Math.round(calcReps)));
    const rpe = Math.min(10, Math.max(1, Number(calcRpe)));
    const restSeconds = Math.max(0, Math.round(calcRest));

    setSessionExercises((prev) => [
      ...prev,
      {
        id: `we_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        exerciseName: calcExercise.trim() || 'Calculated Lift',
        muscleGroup: calcMuscle,
        sets: Array.from({ length: count }, (_, idx) => ({
          id: `set_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
          reps,
          weightKg: calcWeightKg,
          rpe,
          restSeconds,
          notes: '',
        })),
      },
    ]);
    setSaveBanner(
      `Added ${calcExercise.trim() || 'Calculated Lift'} (${count}×${reps} @ ${formatWeight(calcWeightKg, unit)}).`
    );
  };

  const findLinkedBodyweightKg = (workoutDate: string): number | null => {
    if (measurements.length === 0) return null;
    const onOrBefore = measurements.find((m) => m.date <= workoutDate);
    return (onOrBefore ?? measurements[measurements.length - 1])?.bodyweightKg ?? null;
  };

  const totals = useMemo(() => {
    let totalVolumeKg = 0;
    let totalSets = 0;
    for (const ex of sessionExercises) {
      for (const s of ex.sets) {
        totalVolumeKg += Math.max(0, s.weightKg) * Math.max(0, s.reps);
        if (s.reps > 0) totalSets += 1;
      }
    }
    return { totalVolumeKg, totalSets };
  }, [sessionExercises]);

  const findPreviousExerciseComparison = (exerciseName: string) => {
    const prior = workouts.find(
      (w) =>
        w.id !== editingWorkoutId &&
        w.exercises.some((e) => e.exerciseName.toLowerCase() === exerciseName.toLowerCase())
    );
    if (!prior) return null;
    const match = prior.exercises.find(
      (e) => e.exerciseName.toLowerCase() === exerciseName.toLowerCase()
    );
    if (!match) return null;

    let prevVolKg = 0;
    let prevTopWeightKg = 0;
    for (const s of match.sets) {
      prevVolKg += s.weightKg * s.reps;
      if (s.weightKg > prevTopWeightKg) prevTopWeightKg = s.weightKg;
    }
    return {
      date: prior.date,
      prevVolKg,
      prevTopWeightKg,
      setCount: match.sets.length,
    };
  };

  const handleSaveWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setSaveBanner(null);

    if (sessionExercises.length === 0) {
      setErrorBanner('Add at least one exercise before saving the workout.');
      return;
    }

    setSaving(true);
    try {
      const { newPrExercises } = await saveWorkout(
        {
          date,
          title,
          templateName: templateName || undefined,
          isDeload,
          energyLevel,
          sleepHours,
          sleepQuality,
          injuryNotes: injuryNotes.trim() || undefined,
          warmupItems,
          exercises: sessionExercises,
          totalVolumeKg: totals.totalVolumeKg,
          totalSets: totals.totalSets,
        },
        editingWorkoutId
      );

      if (newPrExercises.length > 0) {
        setSaveBanner(
          `Workout saved to cloud! New Personal Record(s) unlocked: ${newPrExercises.join(', ')}`
        );
      } else {
        setSaveBanner('Workout logged and synced to Cloud Firestore.');
      }
      setEditingWorkoutId(undefined);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to save workout.');
    } finally {
      setSaving(false);
    }
  };

  const loadWorkoutIntoEditor = (w: WorkoutLog, duplicateAsNew: boolean) => {
    setEditingWorkoutId(duplicateAsNew ? undefined : w.id);
    setDate(duplicateAsNew ? todayIsoDate() : w.date);
    setTitle(duplicateAsNew ? `${w.title} (Repeat)` : w.title);
    setTemplateName(w.templateName || '');
    setIsDeload(w.isDeload);
    setEnergyLevel(w.energyLevel);
    setSleepHours(w.sleepHours);
    setSleepQuality(w.sleepQuality);
    setInjuryNotes(w.injuryNotes || '');
    setWarmupItems(
      w.warmupItems.length > 0
        ? w.warmupItems.map((wi) => ({ ...wi, completed: duplicateAsNew ? false : wi.completed }))
        : DEFAULT_WARMUP_ITEMS.map((item) => ({ ...item }))
    );
    setSessionExercises(
      w.exercises.map((ex) => ({
        ...ex,
        id: `we_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        sets: ex.sets.map((s) => ({
          ...s,
          id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        })),
      }))
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return workouts;
    const q = historySearch.toLowerCase();
    return workouts.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.date.includes(q) ||
        w.exercises.some((e) => e.exerciseName.toLowerCase().includes(q))
    );
  }, [historySearch, workouts]);

  return (
    <div className="space-y-8">
      {/* Top Session Header & Live Rest Timer */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.07] pb-6">
        <div>
          <p className="text-xs font-medium text-[#F4B86A]">
            {editingWorkoutId ? 'Editing Logged Session' : 'Active Workout Logger'}
          </p>
          <h1 className="text-3xl font-display font-bold tracking-[-0.03em] text-white mt-1">
            Log Sets, RPE &amp; Progressive Overload
          </h1>
        </div>

        {/* Live Rest Timer Control Bar */}
        <div className="flex flex-wrap items-center gap-3 maloxie-block px-5 py-3.5">
          <HugeiconsIcon icon={Timer01Icon} size={18} className="text-[#E89B3C]" />
          <div className="pr-2">
            <p className="text-[11px] font-medium text-zinc-400">Rest Timer</p>
            <p className="text-lg font-mono tabular-nums font-semibold text-white leading-none mt-0.5">
              {formatRestDuration(restRemaining)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[60, 90, 120, 180].map((sec) => (
              <MaloxieButton
                key={sec}
                variant="subtle"
                size="xs"
                onClick={() => startRestTimer(sec)}
                className="font-mono tabular-nums"
              >
                {sec}s
              </MaloxieButton>
            ))}
            {restRemaining > 0 && (
              <>
                <MaloxieButton
                  variant="primary"
                  size="xs"
                  onClick={() => setRestRunning((r) => !r)}
                >
                  {restRunning ? 'Pause' : 'Resume'}
                </MaloxieButton>
                <MaloxieButton
                  variant="subtle"
                  size="xs"
                  onClick={() => {
                    setRestRunning(false);
                    setRestRemaining(0);
                  }}
                >
                  Reset
                </MaloxieButton>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Split & Template Launcher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 space-y-6">
          <div className="maloxie-block p-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-[#F4B86A]">Quick Split Selector</p>
              <h2 className="text-base font-display font-semibold text-white">
                Load Workout Template
              </h2>
            </div>

            <GlassRadioSelector
              name="split-mode"
              value={selectedSplitMode}
              onChange={handleQuickSplitSelect}
              options={[
                { value: 'Push', label: 'Push', sublabel: 'Chest · Delts · Triceps' },
                { value: 'Pull', label: 'Pull', sublabel: 'Back · Rear Delts · Biceps' },
                { value: 'Legs', label: 'Legs', sublabel: 'Quads · Hamstrings · Calves' },
                { value: 'Full Body', label: 'Full Body', sublabel: 'Total Compound Split' },
              ]}
            />

            <div className="pt-3 border-t border-white/[0.06] space-y-2">
              <label className="block text-xs font-medium text-zinc-400">
                Or pick any saved / AI template
              </label>
              <select
                value=""
                onChange={(e) => {
                  const found = templates.find((t) => t.id === e.target.value);
                  if (found) applyTemplate(found);
                }}
                className="w-full maloxie-input px-3.5 py-2 text-xs"
              >
                <option value="">Choose from {templates.length} templates...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.source.toUpperCase()}] {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Interactive Volume Calculator (Sets x Reps x Weight) */}
          <div className="maloxie-block p-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-[#F4B86A]">Sets × Reps × Weight</p>
              <h2 className="text-base font-display font-semibold text-white">
                Volume Calculator
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Exercise
                </label>
                <input
                  type="text"
                  value={calcExercise}
                  onChange={(e) => setCalcExercise(e.target.value)}
                  className="w-full maloxie-input px-3 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Muscle Tag
                </label>
                <select
                  value={calcMuscle}
                  onChange={(e) => setCalcMuscle(e.target.value as MuscleGroup)}
                  className="w-full maloxie-input px-3 py-1.5 text-xs"
                >
                  {MUSCLE_GROUPS.map((mg) => (
                    <option key={mg} value={mg}>{mg}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Weight ({unit})
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  value={fromKg(calcWeightKg, unit)}
                  onChange={(e) => setCalcWeightKg(toKg(Number(e.target.value), unit))}
                  className="w-full maloxie-input px-3 py-1.5 text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Sets
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={calcSets}
                  onChange={(e) => setCalcSets(Number(e.target.value))}
                  className="w-full maloxie-input px-3 py-1.5 text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Reps
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={calcReps}
                  onChange={(e) => setCalcReps(Number(e.target.value))}
                  className="w-full maloxie-input px-3 py-1.5 text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  RPE (1–10)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={1}
                  max={10}
                  value={calcRpe}
                  onChange={(e) => setCalcRpe(Number(e.target.value))}
                  className="w-full maloxie-input px-3 py-1.5 text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Rest (sec)
                </label>
                <input
                  type="number"
                  step="15"
                  min={0}
                  value={calcRest}
                  onChange={(e) => setCalcRest(Number(e.target.value))}
                  className="w-full maloxie-input px-3 py-1.5 text-xs font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-mono text-zinc-400">
                  {calcSets} × {calcReps} × {fromKg(calcWeightKg, unit)} {unit}
                </p>
                <p className="text-xl font-mono tabular-nums font-bold text-[#F4B86A]">
                  {formatVolume(calcTotalVolumeKg, unit)}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-zinc-400">
                  Est. 1RM: {formatWeight(calcEstimated1RMKg, unit)}
                </p>
              </div>
              <MaloxieButton
                variant="secondary"
                size="sm"
                onClick={addCalculatedExerciseToSession}
              >
                Add to Session
              </MaloxieButton>
            </div>
          </div>
        </div>

        {/* Main Session Form */}
        <form onSubmit={handleSaveWorkout} className="lg:col-span-8 space-y-6">
          {/* Date, Title, Deload, Energy, Sleep & Pain */}
          <div className="maloxie-block p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-4">
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Workout Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full maloxie-input px-3.5 py-2 text-sm font-mono"
                />
              </div>
              <div className="sm:col-span-6">
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Workout Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Heavy Upper Push"
                  required
                  maxLength={120}
                  className="w-full maloxie-input px-3.5 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2 flex items-end">
                <label className="w-full flex items-center justify-center gap-2 maloxie-input px-3 py-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDeload}
                    onChange={(e) => setIsDeload(e.target.checked)}
                    className="accent-[#E89B3C]"
                  />
                  Deload
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-white/[0.06]">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Energy Level (<span className="font-mono text-zinc-200">{energyLevel}/10</span>)
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={energyLevel}
                  onChange={(e) => setEnergyLevel(Number(e.target.value))}
                  className="w-full accent-[#E89B3C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Sleep Previous Night (hrs / quality)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={24}
                    value={sleepHours}
                    onChange={(e) => setSleepHours(Number(e.target.value))}
                    className="w-20 maloxie-input px-2.5 py-1.5 text-xs font-mono tabular-nums"
                  />
                  <span className="text-xs text-zinc-400">hrs ·</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={sleepQuality}
                    onChange={(e) => setSleepQuality(Number(e.target.value))}
                    className="w-16 maloxie-input px-2.5 py-1.5 text-xs font-mono tabular-nums"
                  />
                  <span className="text-xs text-zinc-400 font-mono">/10</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Injury / Pain Notes
                </label>
                <input
                  type="text"
                  value={injuryNotes}
                  onChange={(e) => setInjuryNotes(e.target.value)}
                  placeholder="e.g., Left shoulder tight on lockout"
                  maxLength={600}
                  className="w-full maloxie-input px-3 py-1.5 text-xs placeholder:text-zinc-500"
                />
              </div>
            </div>

            {/* Warm-up Tracker */}
            <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-400">
                  Warm-up Tracker (<span className="font-mono text-zinc-200">{warmupItems.filter((w) => w.completed).length}/{warmupItems.length}</span>)
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newWarmupText}
                    onChange={(e) => setNewWarmupText(e.target.value)}
                    placeholder="Add warm-up item..."
                    className="maloxie-input px-3 py-1 text-xs w-44"
                  />
                  <MaloxieButton
                    variant="secondary"
                    size="xs"
                    onClick={() => {
                      if (!newWarmupText.trim()) return;
                      setWarmupItems((prev) => [
                        ...prev,
                        { id: `wu_${Date.now()}`, label: newWarmupText.trim(), completed: false },
                      ]);
                      setNewWarmupText('');
                    }}
                  >
                    Add
                  </MaloxieButton>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {warmupItems.map((wi) => (
                  <label
                    key={wi.id}
                    className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border text-xs cursor-pointer transition-colors ${
                      wi.completed
                        ? 'bg-[#E89B3C]/12 border-[#E89B3C]/35 text-white'
                        : 'bg-white/[0.04] border-white/[0.06] text-zinc-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={wi.completed}
                      onChange={() =>
                        setWarmupItems((prev) =>
                          prev.map((item) =>
                            item.id === wi.id ? { ...item, completed: !item.completed } : item
                          )
                        )
                      }
                      className="accent-[#E89B3C]"
                    />
                    <span className={wi.completed ? 'line-through opacity-80' : ''}>{wi.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Exercise Set Cards + Live Overload Comparison */}
          <div className="space-y-4">
            {sessionExercises.map((ex) => {
              const exVolumeKg = ex.sets.reduce(
                (acc, s) => acc + Math.max(0, s.weightKg) * Math.max(0, s.reps),
                0
              );
              const exTopWeightKg = ex.sets.reduce((m, s) => Math.max(m, s.weightKg), 0);
              const prevComp = findPreviousExerciseComparison(ex.exerciseName);
              const volDeltaKg = prevComp ? exVolumeKg - prevComp.prevVolKg : null;
              const weightDeltaKg = prevComp ? exTopWeightKg - prevComp.prevTopWeightKg : null;

              const draft = quickFillDrafts[ex.id] ?? {
                sets: ex.sets.length || 3,
                reps: ex.sets[0]?.reps || 8,
                weightKg: ex.sets[0]?.weightKg ?? 40,
                rpe: ex.sets[0]?.rpe || 8,
                restSeconds: ex.sets[0]?.restSeconds || 120,
              };

              return (
                <div
                  key={ex.id}
                  className="maloxie-block p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <input
                          type="text"
                          value={ex.exerciseName}
                          onChange={(e) =>
                            updateExerciseMeta(ex.id, { exerciseName: e.target.value })
                          }
                          aria-label="Exercise name"
                          className="bg-transparent border-b border-transparent focus:border-[#E89B3C] text-base font-display font-semibold text-white focus:outline-none min-w-[180px]"
                        />
                        <select
                          value={ex.muscleGroup}
                          onChange={(e) =>
                            updateExerciseMeta(ex.id, {
                              muscleGroup: e.target.value as MuscleGroup,
                            })
                          }
                          aria-label="Muscle group tag"
                          className="maloxie-input px-2.5 py-0.5 text-xs font-medium text-[#F4B86A]"
                        >
                          {MUSCLE_GROUPS.map((mg) => (
                            <option key={mg} value={mg}>
                              {mg}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Exercise Volume:{' '}
                        <span className="font-mono tabular-nums text-white">
                          {formatVolume(exVolumeKg, unit)}
                        </span>
                        {prevComp && (
                          <span className="font-mono tabular-nums">
                            {' · '}
                            Prev ({prevComp.date}): {formatWeight(prevComp.prevTopWeightKg, unit)} /{' '}
                            {formatVolume(prevComp.prevVolKg, unit)}
                            {volDeltaKg !== null && (
                              <span
                                className={`ml-2 ${
                                  volDeltaKg >= 0 ? 'text-emerald-400' : 'text-[#F4B86A]'
                                }`}
                              >
                                ({volDeltaKg >= 0 ? '+' : ''}
                                {formatVolume(volDeltaKg, unit)}
                                {weightDeltaKg !== null && weightDeltaKg !== 0
                                  ? `, ${weightDeltaKg > 0 ? '+' : ''}${fromKg(weightDeltaKg, unit)} ${unit}`
                                  : ''}
                                )
                              </span>
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExerciseFromSession(ex.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-white/[0.05] cursor-pointer"
                      title="Remove exercise"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={16} />
                    </button>
                  </div>

                  {/* Quick-Fill Sets x Reps x Weight Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 border-y border-white/[0.06] text-xs">
                    <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
                      <span className="text-[11px] font-sans font-medium text-zinc-400 mr-1">
                        Quick Sets × Reps × Weight:
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={draft.sets}
                        onChange={(e) =>
                          setQuickFillDrafts((prev) => ({
                            ...prev,
                            [ex.id]: { ...draft, sets: Number(e.target.value) },
                          }))
                        }
                        title="Sets"
                        className="w-12 maloxie-input px-2 py-1"
                      />
                      <span className="text-zinc-500">×</span>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={draft.reps}
                        onChange={(e) =>
                          setQuickFillDrafts((prev) => ({
                            ...prev,
                            [ex.id]: { ...draft, reps: Number(e.target.value) },
                          }))
                        }
                        title="Reps"
                        className="w-14 maloxie-input px-2 py-1"
                      />
                      <span className="text-zinc-500">@</span>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        value={fromKg(draft.weightKg, unit)}
                        onChange={(e) =>
                          setQuickFillDrafts((prev) => ({
                            ...prev,
                            [ex.id]: { ...draft, weightKg: toKg(Number(e.target.value), unit) },
                          }))
                        }
                        title={`Weight (${unit})`}
                        className="w-16 maloxie-input px-2 py-1"
                      />
                      <span className="text-zinc-400">{unit}</span>
                      <span className="text-zinc-500 ml-1">RPE</span>
                      <input
                        type="number"
                        step="0.5"
                        min={1}
                        max={10}
                        value={draft.rpe}
                        onChange={(e) =>
                          setQuickFillDrafts((prev) => ({
                            ...prev,
                            [ex.id]: { ...draft, rpe: Number(e.target.value) },
                          }))
                        }
                        title="RPE 1-10"
                        className="w-12 maloxie-input px-2 py-1"
                      />
                      <MaloxieButton
                        variant="secondary"
                        size="xs"
                        onClick={() => applyQuickFillToExercise(ex.id)}
                      >
                        Apply Sets
                      </MaloxieButton>
                    </div>
                    <span className="text-[11px] text-zinc-500">
                      RPE 1–10: 6 Light · 8 ~2 RIR · 10 Max
                    </span>
                  </div>

                  {/* Sets Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-[11px] font-medium text-zinc-400">
                          <th className="py-2 pr-2">Set</th>
                          <th className="py-2 px-2">Weight ({unit})</th>
                          <th className="py-2 px-2">Reps</th>
                          <th className="py-2 px-2">RPE (1-10)</th>
                          <th className="py-2 px-2">Rest (s)</th>
                          <th className="py-2 px-2">Set Volume</th>
                          <th className="py-2 px-2">Set Notes</th>
                          <th className="py-2 pl-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {ex.sets.map((s, idx) => {
                          const setVolKg = Math.max(0, s.weightKg) * Math.max(0, s.reps);
                          return (
                            <tr key={s.id} className="text-xs">
                              <td className="py-2 pr-2 font-mono tabular-nums text-zinc-400">
                                #{idx + 1}
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.5"
                                  min={0}
                                  value={fromKg(s.weightKg, unit)}
                                  onChange={(e) =>
                                    updateSetField(
                                      ex.id,
                                      s.id,
                                      'weightKg',
                                      toKg(Number(e.target.value), unit)
                                    )
                                  }
                                  className="w-20 maloxie-input px-2.5 py-1.5 font-mono tabular-nums"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={200}
                                  value={s.reps}
                                  onChange={(e) =>
                                    updateSetField(ex.id, s.id, 'reps', Number(e.target.value))
                                  }
                                  className="w-16 maloxie-input px-2.5 py-1.5 font-mono tabular-nums"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.5"
                                  min={1}
                                  max={10}
                                  value={s.rpe}
                                  onChange={(e) =>
                                    updateSetField(ex.id, s.id, 'rpe', Number(e.target.value))
                                  }
                                  className="w-16 maloxie-input px-2.5 py-1.5 font-mono tabular-nums"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="15"
                                    min={0}
                                    value={s.restSeconds}
                                    onChange={(e) =>
                                      updateSetField(
                                        ex.id,
                                        s.id,
                                        'restSeconds',
                                        Number(e.target.value)
                                      )
                                    }
                                    className="w-16 maloxie-input px-2 py-1.5 font-mono tabular-nums"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => startRestTimer(s.restSeconds)}
                                    title="Start rest timer"
                                    className="px-2 py-1.5 rounded-lg bg-white/[0.06] hover:bg-[#E89B3C] hover:text-[#09090B] text-[11px] font-medium transition-colors cursor-pointer"
                                  >
                                    Go
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 px-2 font-mono tabular-nums text-[#F4B86A] whitespace-nowrap">
                                {formatVolume(setVolKg, unit)}
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  value={s.notes}
                                  onChange={(e) =>
                                    updateSetField(ex.id, s.id, 'notes', e.target.value)
                                  }
                                  placeholder="Paused, bar speed..."
                                  className="w-36 maloxie-input px-2.5 py-1.5 placeholder:text-zinc-500"
                                />
                              </td>
                              <td className="py-2 pl-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeSet(ex.id, s.id)}
                                  className="text-zinc-500 hover:text-red-400 cursor-pointer"
                                  title="Delete set"
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <MaloxieButton
                    variant="subtle"
                    size="xs"
                    onClick={() => addSetToExercise(ex.id)}
                  >
                    <HugeiconsIcon icon={Add01Icon} size={14} />
                    Add Set
                  </MaloxieButton>
                </div>
              );
            })}
          </div>

          {/* Add Exercise Panel */}
          <div className="maloxie-block p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-display font-semibold text-white">
                Add Exercise from Library
              </p>
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search movements..."
                className="maloxie-input px-3.5 py-1.5 text-xs w-56"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(['All', ...MUSCLE_GROUPS] as const).map((mg) => (
                <button
                  key={mg}
                  type="button"
                  onClick={() => setPickerMuscle(mg)}
                  className={`px-3 py-1 rounded-xl text-xs transition-colors cursor-pointer whitespace-nowrap ${
                    pickerMuscle === mg
                      ? 'bg-[#E89B3C] text-[#09090B] font-semibold'
                      : 'bg-white/[0.04] text-zinc-400 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {mg}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
              {filteredLibrary.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => addExerciseToSession(ex.name, ex.muscleGroup)}
                  className="text-left rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] hover:border-[#E89B3C]/35 px-3 py-2 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-medium text-white truncate">{ex.name}</p>
                  <p className="text-[11px] text-zinc-400">
                    {ex.muscleGroup} · {ex.equipment}
                  </p>
                </button>
              ))}
            </div>

            <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={customExName}
                onChange={(e) => setCustomExName(e.target.value)}
                placeholder="Or type any custom exercise..."
                className="flex-1 min-w-[200px] maloxie-input px-3.5 py-1.5 text-xs"
              />
              <select
                value={customExMuscle}
                onChange={(e) => setCustomExMuscle(e.target.value as MuscleGroup)}
                className="maloxie-input px-3 py-1.5 text-xs"
              >
                {MUSCLE_GROUPS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <MaloxieButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (!customExName.trim()) return;
                  addExerciseToSession(customExName.trim(), customExMuscle);
                  setCustomExName('');
                }}
              >
                Add to Session
              </MaloxieButton>
            </div>
          </div>

          {/* Session Summary & Save Bar */}
          {errorBanner && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/25 p-3 text-xs text-red-200">
              {errorBanner}
            </div>
          )}
          {saveBanner && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 text-xs text-emerald-200 flex items-center gap-2">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
              {saveBanner}
            </div>
          )}

          <div className="maloxie-block p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-xs font-medium text-zinc-400">Total Session Volume</p>
                <p className="text-2xl font-mono tabular-nums font-bold text-[#F4B86A]">
                  {formatVolume(totals.totalVolumeKg, unit)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-400">Working Sets</p>
                <p className="text-2xl font-mono tabular-nums font-bold text-white">
                  {totals.totalSets}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {editingWorkoutId && (
                <MaloxieButton
                  variant="subtle"
                  size="sm"
                  onClick={() => setEditingWorkoutId(undefined)}
                >
                  Cancel Edit
                </MaloxieButton>
              )}
              <TactilePillButton type="submit" disabled={saving}>
                <HugeiconsIcon icon={Dumbbell01Icon} size={16} />
                {saving
                  ? 'Saving Session...'
                  : editingWorkoutId
                    ? 'Update Workout'
                    : 'Save & Update PRs'}
              </TactilePillButton>
            </div>
          </div>
        </form>
      </div>

      {/* Logged Workout History — Hairline Divided */}
      <div className="maloxie-block overflow-hidden">
        <div className="p-6 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-400">Session History</p>
            <h2 className="text-xl font-display font-semibold text-white">
              Logged Workouts (<span className="font-mono tabular-nums">{workouts.length}</span>)
            </h2>
          </div>
          <input
            type="text"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder="Filter by title, date, or exercise..."
            className="maloxie-input px-3.5 py-2 text-xs w-64"
          />
        </div>

        {filteredHistory.length === 0 ? (
          <p className="text-sm text-zinc-400 py-8 text-center">
            No matching workouts logged yet.
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredHistory.map((w) => {
              const linkedBwKg = findLinkedBodyweightKg(w.date);
              const completedWarmups = w.warmupItems?.filter((wi) => wi.completed).length ?? 0;
              return (
                <div key={w.id} className="p-6 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-display font-semibold text-white">
                        {w.title}
                        {w.isDeload ? ' · Deload Week' : ''}
                      </p>
                      <p className="text-xs font-mono tabular-nums text-zinc-400 mt-0.5">
                        {w.date} · {formatVolume(w.totalVolumeKg, unit)} · {w.totalSets} sets · Energy{' '}
                        {w.energyLevel}/10 · Sleep {w.sleepHours}h ({w.sleepQuality}/10)
                        {linkedBwKg !== null ? ` · BW ${formatWeight(linkedBwKg, unit)}` : ''}
                        {w.warmupItems?.length ? ` · Warm-up ${completedWarmups}/${w.warmupItems.length}` : ''}
                      </p>
                      {w.injuryNotes && (
                        <p className="text-xs text-[#F4B86A] mt-1">
                          Pain / Injury Note: {w.injuryNotes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <MaloxieButton
                        variant="secondary"
                        size="xs"
                        onClick={() => loadWorkoutIntoEditor(w, true)}
                      >
                        Repeat
                      </MaloxieButton>
                      <MaloxieButton
                        variant="secondary"
                        size="xs"
                        onClick={() => loadWorkoutIntoEditor(w, false)}
                      >
                        Edit
                      </MaloxieButton>
                      <button
                        type="button"
                        onClick={() => deleteWorkout(w.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 cursor-pointer"
                        title="Delete workout"
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-white/[0.05] pt-2 border-t border-white/[0.05]">
                    {w.exercises.map((ex) => {
                      const topSet = ex.sets.reduce(
                        (best, cur) => (cur.weightKg > best.weightKg ? cur : best),
                        ex.sets[0]
                      );
                      const exVolKg = ex.sets.reduce(
                        (sum, s) => sum + Math.max(0, s.weightKg) * Math.max(0, s.reps),
                        0
                      );
                      const avgRpe =
                        ex.sets.length > 0
                          ? (
                              ex.sets.reduce((acc, s) => acc + (s.rpe || 0), 0) / ex.sets.length
                            ).toFixed(1)
                          : '—';
                      const avgRest =
                        ex.sets.length > 0
                          ? Math.round(
                              ex.sets.reduce((acc, s) => acc + (s.restSeconds || 0), 0) /
                                ex.sets.length
                            )
                          : 0;
                      const setNotes = ex.sets
                        .map((s, i) => (s.notes?.trim() ? `#${i + 1}: ${s.notes.trim()}` : ''))
                        .filter(Boolean);

                      return (
                        <div key={ex.id} className="py-2 text-xs space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-zinc-200 font-medium">
                              {ex.exerciseName}{' '}
                              <span className="text-zinc-400 font-normal">· {ex.muscleGroup}</span>
                            </span>
                            <span className="font-mono tabular-nums text-[#F4B86A]">
                              {ex.sets.length} sets · Top{' '}
                              {topSet ? `${formatWeight(topSet.weightKg, unit)}×${topSet.reps}` : '—'}{' '}
                              · Vol {formatVolume(exVolKg, unit)} · RPE {avgRpe} · Rest {avgRest}s
                            </span>
                          </div>
                          {setNotes.length > 0 && (
                            <p className="text-[11px] text-zinc-400">
                              Notes: {setNotes.join(' · ')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkoutLoggerView;
