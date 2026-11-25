import React, { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Dumbbell01Icon,
  Target01Icon,
} from '@hugeicons/core-free-icons';
import { useMaloxie } from '../../context/MaloxieContext';
import { MaloxieButton } from '../ui/MaloxieButton';
import { MUSCLE_GROUPS } from '../../data/presets';
import { fromKg, toKg } from '../../utils/units';
import type {
  MuscleGroup,
  SplitType,
  TemplateExercise,
  TrainingGoal,
  WorkoutTemplate,
} from '../../types/training';

interface LibraryAndGoalsViewProps {
  onStartTemplate: (tpl: WorkoutTemplate) => void;
}

export const LibraryAndGoalsView: React.FC<LibraryAndGoalsViewProps> = ({
  onStartTemplate,
}) => {
  const {
    unit,
    exercises,
    templates,
    goals,
    prs,
    measurements,
    addCustomExercise,
    deleteExercise,
    saveTemplate,
    deleteTemplate,
    saveGoal,
    updateGoalStatus,
    deleteGoal,
  } = useMaloxie();

  const [section, setSection] = useState<'goals' | 'library' | 'templates'>('goals');

  // Goal creation state
  const [goalTitle, setGoalTitle] = useState('Bench 100kg by March');
  const [goalExercise, setGoalExercise] = useState('Barbell Bench Press');
  const [goalMetric, setGoalMetric] = useState<TrainingGoal['metricType']>('weight');
  const [goalTarget, setGoalTarget] = useState('100');
  const [goalStart, setGoalStart] = useState('80');
  const [goalDate, setGoalDate] = useState('2027-03-31');

  // Exercise library state
  const [exFilterMuscle, setExFilterMuscle] = useState<'All' | MuscleGroup>('All');
  const [exSearch, setExSearch] = useState('');
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState<MuscleGroup>('Chest');
  const [newExEquip, setNewExEquip] = useState('Barbell');
  const [newExCues, setNewExCues] = useState('');

  // Custom template builder state
  const [tplName, setTplName] = useState('');
  const [tplSplit, setTplSplit] = useState<SplitType>('Custom');
  const [tplDesc, setTplDesc] = useState('');
  const [tplExercises, setTplExercises] = useState<TemplateExercise[]>([
    { name: 'Barbell Bench Press', muscleGroup: 'Chest', targetSets: 4, targetReps: '6-8', restSeconds: 150 },
  ]);

  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => {
      const mOk = exFilterMuscle === 'All' || ex.muscleGroup === exFilterMuscle;
      const qOk =
        !exSearch.trim() ||
        ex.name.toLowerCase().includes(exSearch.toLowerCase()) ||
        ex.equipment.toLowerCase().includes(exSearch.toLowerCase());
      return mOk && qOk;
    });
  }, [exFilterMuscle, exSearch, exercises]);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const tVal = Number(goalTarget);
    const sVal = Number(goalStart);
    if (!goalTitle.trim() || !Number.isFinite(tVal) || tVal <= 0) return;
    await saveGoal({
      title: goalTitle,
      exerciseName: goalExercise,
      metricType: goalMetric,
      targetValue: toKg(tVal, unit),
      startValue: toKg(Number.isFinite(sVal) ? sVal : 0, unit),
      targetDate: goalDate,
    });
    setGoalTitle('');
  };

  const handleCreateExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExName.trim()) return;
    await addCustomExercise({
      name: newExName,
      muscleGroup: newExMuscle,
      equipment: newExEquip,
      cues: newExCues,
    });
    setNewExName('');
    setNewExCues('');
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim() || tplExercises.length === 0) return;
    await saveTemplate({
      name: tplName,
      splitType: tplSplit,
      description: tplDesc,
      source: 'custom',
      exercises: tplExercises,
    });
    setTplName('');
    setTplDesc('');
  };

  const computeCurrentForGoal = (g: TrainingGoal) => {
    if (g.metricType === 'bodyweight') {
      return measurements[0]?.bodyweightKg ?? g.startValue;
    }
    const pr = prs.find((p) => p.exerciseName.toLowerCase() === g.exerciseName.toLowerCase());
    if (!pr) return g.startValue;
    if (g.metricType === 'e1rm') return pr.bestEstimated1RMKg;
    if (g.metricType === 'volume') return pr.bestSetVolumeKg;
    return pr.bestWeightKg;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.07] pb-6">
        <div>
          <p className="text-xs font-medium text-[#F4B86A]">Training System</p>
          <h1 className="text-3xl font-display font-bold tracking-[-0.03em] text-white mt-1">
            Goals, Exercise Library &amp; Templates
          </h1>
        </div>

        <div className="inline-flex flex-wrap items-center gap-2">
          {(
            [
              ['goals', `Goals (${goals.length})`],
              ['templates', `Templates (${templates.length})`],
              ['library', `Exercise Library (${exercises.length})`],
            ] as const
          ).map(([key, label]) => (
            <MaloxieButton
              key={key}
              variant={section === key ? 'primary' : 'subtle'}
              size="sm"
              onClick={() => setSection(key)}
            >
              {label}
            </MaloxieButton>
          ))}
        </div>
      </div>

      {/* SECTION 1: GOAL SETTING */}
      {section === 'goals' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleCreateGoal}
            className="lg:col-span-5 maloxie-block p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Target01Icon} size={18} className="text-[#E89B3C]" />
              <h2 className="text-lg font-display font-semibold text-white">Create Training Goal</h2>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Goal Title</label>
              <input
                type="text"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="e.g., Bench 100kg by March"
                required
                className="w-full maloxie-input px-3.5 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Metric</label>
                <select
                  value={goalMetric}
                  onChange={(e) => setGoalMetric(e.target.value as TrainingGoal['metricType'])}
                  className="w-full maloxie-input px-3 py-2 text-xs"
                >
                  <option value="weight">Top Weight ({unit})</option>
                  <option value="e1rm">Estimated 1RM ({unit})</option>
                  <option value="volume">Best Set Volume ({unit})</option>
                  <option value="bodyweight">Bodyweight ({unit})</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Exercise</label>
                <select
                  value={goalExercise}
                  onChange={(e) => setGoalExercise(e.target.value)}
                  disabled={goalMetric === 'bodyweight'}
                  className="w-full maloxie-input px-3 py-2 text-xs disabled:opacity-50"
                >
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.name}>{ex.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Start ({unit})
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={goalStart}
                  onChange={(e) => setGoalStart(e.target.value)}
                  className="w-full maloxie-input px-3 py-2 text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Target ({unit})
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  required
                  className="w-full maloxie-input px-3 py-2 text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Target Date</label>
                <input
                  type="date"
                  value={goalDate}
                  onChange={(e) => setGoalDate(e.target.value)}
                  required
                  className="w-full maloxie-input px-2.5 py-2 text-xs font-mono"
                />
              </div>
            </div>
            <MaloxieButton
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
            >
              Save Goal
            </MaloxieButton>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {goals.length === 0 ? (
              <div className="maloxie-block p-8 text-center text-sm text-zinc-400">
                No training goals yet. Add a target like &ldquo;Bench 100kg by March&rdquo; to track automated PR progress.
              </div>
            ) : (
              goals.map((g) => {
                const currentKg = computeCurrentForGoal(g);
                const span = g.targetValue - g.startValue;
                const pct =
                  g.status === 'achieved'
                    ? 100
                    : span !== 0
                      ? Math.min(100, Math.max(0, Math.round(((currentKg - g.startValue) / span) * 100)))
                      : currentKg >= g.targetValue
                        ? 100
                        : 0;

                return (
                  <div
                    key={g.id}
                    className="maloxie-block p-6 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-display font-semibold text-white">{g.title}</p>
                        <p className="text-xs text-zinc-400">
                          {g.metricType === 'bodyweight' ? 'Bodyweight' : g.exerciseName} · Target{' '}
                          <span className="font-mono">{g.targetDate}</span> · {g.status === 'achieved' ? 'Achieved' : 'Active'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {g.status !== 'achieved' && (
                          <MaloxieButton
                            variant="secondary"
                            size="xs"
                            onClick={() => updateGoalStatus(g.id, 'achieved')}
                          >
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
                            Mark Hit
                          </MaloxieButton>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteGoal(g.id)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 cursor-pointer"
                        >
                          <HugeiconsIcon icon={Delete02Icon} size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono tabular-nums text-zinc-400">
                        <span>
                          Current: <strong className="text-white">{fromKg(currentKg, unit)} {unit}</strong>
                        </span>
                        <span>
                          Goal: <strong className="text-[#F4B86A]">{fromKg(g.targetValue, unit)} {unit}</strong> ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full rounded-full transition-all ${
                            g.status === 'achieved'
                              ? 'bg-emerald-400'
                              : 'bg-gradient-to-r from-[#E89B3C] to-[#F4C77B]'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: WORKOUT TEMPLATES */}
      {section === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleCreateTemplate}
            className="lg:col-span-5 maloxie-block p-6 space-y-4"
          >
            <h2 className="text-lg font-display font-semibold text-white">Create Workout Template</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Template Name</label>
                <input
                  type="text"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="Upper Power A"
                  required
                  className="w-full maloxie-input px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Split Type</label>
                <select
                  value={tplSplit}
                  onChange={(e) => setTplSplit(e.target.value as SplitType)}
                  className="w-full maloxie-input px-3 py-2 text-xs"
                >
                  {(['Push', 'Pull', 'Legs', 'Full Body', 'Upper', 'Lower', 'Custom'] as const).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Description</label>
              <input
                type="text"
                value={tplDesc}
                onChange={(e) => setTplDesc(e.target.value)}
                placeholder="Focus on horizontal pressing and rowing"
                className="w-full maloxie-input px-3 py-2 text-xs"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-400">Exercises</p>
                <button
                  type="button"
                  onClick={() =>
                    setTplExercises((prev) => [
                      ...prev,
                      {
                        name: exercises[0]?.name || 'Barbell Back Squat',
                        muscleGroup: exercises[0]?.muscleGroup || 'Legs',
                        targetSets: 3,
                        targetReps: '8-10',
                        restSeconds: 120,
                      },
                    ])
                  }
                  className="text-xs text-[#F4B86A] hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <HugeiconsIcon icon={Add01Icon} size={13} />
                  Add Movement
                </button>
              </div>
              {tplExercises.map((te, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <select
                    value={te.name}
                    onChange={(e) => {
                      const found = exercises.find((x) => x.name === e.target.value);
                      setTplExercises((prev) =>
                        prev.map((item, i) =>
                          i === idx
                            ? {
                                ...item,
                                name: e.target.value,
                                muscleGroup: found?.muscleGroup || item.muscleGroup,
                              }
                            : item
                        )
                      );
                    }}
                    className="col-span-6 maloxie-input px-2 py-1.5 text-xs"
                  >
                    {exercises.map((ex) => (
                      <option key={ex.id} value={ex.name}>{ex.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={te.targetSets}
                    onChange={(e) =>
                      setTplExercises((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, targetSets: Number(e.target.value) } : item
                        )
                      )
                    }
                    className="col-span-2 maloxie-input px-2 py-1.5 text-xs font-mono"
                    title="Sets"
                  />
                  <input
                    type="text"
                    value={te.targetReps}
                    onChange={(e) =>
                      setTplExercises((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, targetReps: e.target.value } : item
                        )
                      )
                    }
                    className="col-span-3 maloxie-input px-2 py-1.5 text-xs font-mono"
                    title="Reps"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setTplExercises((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="col-span-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <MaloxieButton
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
            >
              Save Template
            </MaloxieButton>
          </form>

          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="maloxie-block p-6 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-medium text-[#F4B86A]">
                        {tpl.splitType} · {tpl.source === 'ai' ? 'AI Program' : tpl.source === 'preset' ? 'Preset' : 'Custom'}
                      </p>
                      <h3 className="text-base font-display font-semibold text-white">
                        {tpl.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteTemplate(tpl.id)}
                      className="text-zinc-500 hover:text-red-400 cursor-pointer"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={15} />
                    </button>
                  </div>
                  {tpl.description && (
                    <p className="text-xs text-zinc-400">{tpl.description}</p>
                  )}
                  <div className="space-y-1 pt-2 border-t border-white/[0.06]">
                    {tpl.exercises.map((e, i) => (
                      <div key={i} className="flex justify-between text-xs text-zinc-200">
                        <span className="truncate pr-2">{e.name}</span>
                        <span className="font-mono tabular-nums text-zinc-400 shrink-0">
                          {e.targetSets}×{e.targetReps}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <MaloxieButton
                  variant="secondary"
                  size="sm"
                  onClick={() => onStartTemplate(tpl)}
                  className="w-full"
                >
                  <HugeiconsIcon icon={Dumbbell01Icon} size={14} />
                  Start Workout
                </MaloxieButton>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: EXERCISE LIBRARY */}
      {section === 'library' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateExercise}
            className="maloxie-block p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
          >
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Exercise Name</label>
              <input
                type="text"
                value={newExName}
                onChange={(e) => setNewExName(e.target.value)}
                placeholder="Pendlay Row"
                required
                className="w-full maloxie-input px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Muscle Group</label>
              <select
                value={newExMuscle}
                onChange={(e) => setNewExMuscle(e.target.value as MuscleGroup)}
                className="w-full maloxie-input px-3 py-2 text-xs"
              >
                {MUSCLE_GROUPS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Equipment</label>
              <input
                type="text"
                value={newExEquip}
                onChange={(e) => setNewExEquip(e.target.value)}
                placeholder="Barbell"
                required
                className="w-full maloxie-input px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Form Cues</label>
              <input
                type="text"
                value={newExCues}
                onChange={(e) => setNewExCues(e.target.value)}
                placeholder="Explode from floor, reset each rep"
                className="w-full maloxie-input px-3 py-2 text-xs"
              />
            </div>
            <MaloxieButton
              type="submit"
              variant="primary"
              size="sm"
            >
              Add Custom Exercise
            </MaloxieButton>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(['All', ...MUSCLE_GROUPS] as const).map((mg) => (
                <button
                  key={mg}
                  type="button"
                  onClick={() => setExFilterMuscle(mg)}
                  className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                    exFilterMuscle === mg
                      ? 'bg-[#E89B3C] text-[#09090B] font-semibold'
                      : 'bg-white/[0.04] text-zinc-400 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {mg}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={exSearch}
              onChange={(e) => setExSearch(e.target.value)}
              placeholder="Search exercises..."
              className="maloxie-input px-3.5 py-1.5 text-xs w-60"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExercises.map((ex) => (
              <div
                key={ex.id}
                className="maloxie-block p-5 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{ex.name}</h3>
                    <p className="text-xs text-[#F4B86A]">
                      {ex.muscleGroup} · {ex.equipment}
                    </p>
                  </div>
                  {ex.isCustom && (
                    <button
                      type="button"
                      onClick={() => deleteExercise(ex.id)}
                      className="text-zinc-500 hover:text-red-400 cursor-pointer"
                      title="Delete custom exercise"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={14} />
                    </button>
                  )}
                </div>
                {ex.cues && <p className="text-xs text-zinc-400 leading-relaxed">{ex.cues}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryAndGoalsView;
