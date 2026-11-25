import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AiBrain01Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
} from '@hugeicons/core-free-icons';
import Strands from '../Strands';
import Crosshair from '../Crosshair';
import GradualBlur from '../GradualBlur';
import { MaloxieButton, MaloxieIconButton } from '../ui/MaloxieButton';
import { TactilePillButton } from '../ui/UiverseControls';
import { useMaloxie } from '../../context/MaloxieContext';
import type { AiProgramWeek, AiTrainingProgram } from '../../types/training';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface CrystalBallAiViewProps {
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
}

const STARTER_PROMPTS = [
  'Analyze my progressive overload across my recent workouts.',
  'Based on my RPE, sleep, and pain notes, should I take a deload week?',
  'How can I hit my active strength goal faster without burning out?',
  'Spot weak links or volume imbalances in my muscle group split.',
];

export const CrystalBallAiView: React.FC<CrystalBallAiViewProps> = ({
  initialPrompt,
  onClearInitialPrompt,
}) => {
  const {
    profile,
    unit,
    workouts,
    prs,
    measurements,
    goals,
    programs,
    saveAiProgram,
    applyProgramSessionsAsTemplates,
    toggleDeloadWeek,
    deleteProgram,
  } = useMaloxie();

  const stageRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<'coach' | 'program'>('coach');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'The Maloxie Crystal Ball is tuned to your live workout history, PRs, readiness scores, and goals. Ask any question about your training or switch to Program Builder to generate a multi-week block with a scheduled deload.',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Program builder inputs
  const [goalPrompt, setGoalPrompt] = useState('Build upper-body pressing strength while growing back and legs');
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [splitPreference, setSplitPreference] = useState('Upper / Lower');
  const [includeDeload, setIncludeDeload] = useState(true);
  const [programStatusMsg, setProgramStatusMsg] = useState<string | null>(null);

  const trainingContext = useMemo(() => {
    return {
      preferredUnit: unit,
      activeDeloadWeek: profile?.activeDeloadWeek ?? false,
      recentWorkouts: workouts.slice(0, 10).map((w) => ({
        date: w.date,
        title: w.title,
        isDeload: w.isDeload,
        energyLevel: w.energyLevel,
        sleepHours: w.sleepHours,
        sleepQuality: w.sleepQuality,
        injuryNotes: w.injuryNotes || '',
        totalVolumeKg: w.totalVolumeKg,
        exercises: w.exercises.map((e) => ({
          name: e.exerciseName,
          muscleGroup: e.muscleGroup,
          sets: e.sets.map((s) => ({
            reps: s.reps,
            weightKg: s.weightKg,
            rpe: s.rpe,
            notes: s.notes,
          })),
        })),
      })),
      personalRecords: prs.slice(0, 15).map((p) => ({
        exercise: p.exerciseName,
        bestWeightKg: p.bestWeightKg,
        reps: p.bestWeightReps,
        estimated1RMKg: p.bestEstimated1RMKg,
        date: p.achievedAt,
      })),
      recentBodyMeasurements: measurements.slice(0, 5),
      goals: goals.map((g) => ({
        title: g.title,
        exerciseName: g.exerciseName,
        metricType: g.metricType,
        targetValueKg: g.targetValue,
        targetDate: g.targetDate,
        status: g.status,
      })),
    };
  }, [goals, measurements, profile?.activeDeloadWeek, prs, unit, workouts]);

  const submitQuestion = async (textToAsk: string) => {
    const trimmed = textToAsk.trim();
    if (!trimmed || loading) return;

    setErrorMsg(null);
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setQuestion('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          history: nextHistory.slice(-6),
          trainingContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Maloxie AI could not respond.');
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: data.answer,
        },
      ]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to reach Maloxie AI.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      setMode('coach');
      void submitQuestion(initialPrompt);
      onClearInitialPrompt?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const handleGenerateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg(null);
    setProgramStatusMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalPrompt,
          durationWeeks,
          daysPerWeek,
          includeDeload,
          splitPreference,
          trainingContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Program generation failed.');
      }

      const generated = data.program as Omit<AiTrainingProgram, 'id' | 'userId' | 'createdAt'>;
      await saveAiProgram(generated);
      setProgramStatusMsg(`Saved "${generated.title}" to your training library.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate program.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyWeekAsTemplates = async (week: AiProgramWeek, programTitle: string) => {
    setProgramStatusMsg(null);
    const added = await applyProgramSessionsAsTemplates(week.sessions, `${programTitle} W${week.weekNumber}`);
    setProgramStatusMsg(`Added ${added} Week ${week.weekNumber} sessions into your Workout Templates.`);
    if (week.isDeload) {
      await toggleDeloadWeek(true, `${programTitle} · Week ${week.weekNumber} Deload`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Crystal Ball Interactive Stage */}
      <div
        ref={stageRef}
        className="relative maloxie-block overflow-hidden p-6 lg:p-8"
      >
        <Crosshair
          containerRef={stageRef}
          color="#e89b3c"
          thickness={1}
          opacity={0.38}
          smoothing={0.28}
          showCoordinates
          lineStyle="solid"
          clickPulse
        />

        <div className="relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Crystal Ball Orb */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full max-w-[360px] h-[320px] relative">
              <Strands
                glass
                glassSize={1.08}
                refraction={1.15}
                rim={1.1}
                dispersion={1.15}
                listening={loading || question.length > 0}
                energy={loading ? 1.45 : 0.72}
                colors={['#d95b56', '#ba5046', '#e89b3c', '#ffe8c2', '#93f1ff', '#3569fa', '#193d9b']}
                count={3}
                speed={loading ? 1.55 : 0.95}
                interactive
                clickPulse
              />
            </div>
            <p className="text-xs text-zinc-400 text-center">
              {loading
                ? 'Maloxie AI is reading your training history...'
                : 'Click the Crystal Ball to pulse'}
            </p>
          </div>

          {/* Right Controls & Mode Selector */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <p className="text-xs font-medium text-[#F4B86A]">Maloxie AI Oracle</p>
              <h1 className="text-3xl font-display font-bold tracking-[-0.03em] text-white mt-1 text-balance">
                Ask the Crystal Ball or build a multi-week block
              </h1>
              <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                Grounded in <span className="font-mono tabular-nums text-zinc-200">{workouts.length}</span> logged sessions,{' '}
                <span className="font-mono tabular-nums text-zinc-200">{prs.length}</span> Personal Records, and{' '}
                <span className="font-mono tabular-nums text-zinc-200">{goals.length}</span> active goals ({unit}).
              </p>
            </div>

            <div className="inline-flex flex-wrap items-center gap-2">
              <MaloxieButton
                variant={mode === 'coach' ? 'primary' : 'subtle'}
                size="sm"
                onClick={() => setMode('coach')}
              >
                Ask Training Coach
              </MaloxieButton>
              <MaloxieButton
                variant={mode === 'program' ? 'primary' : 'subtle'}
                size="sm"
                onClick={() => setMode('program')}
              >
                Multi-Week &amp; Deload Builder
              </MaloxieButton>
            </div>

            {mode === 'coach' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {STARTER_PROMPTS.map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => submitQuestion(sp)}
                      disabled={loading}
                      className="text-left text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-zinc-200 transition-colors cursor-pointer"
                    >
                      {sp}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitQuestion(question);
                  }}
                  className="flex flex-col sm:flex-row gap-3 pt-1"
                >
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask about progressive overload, stalling lifts, recovery, or deload timing..."
                    className="flex-1 maloxie-input px-4 py-3 text-sm placeholder:text-zinc-500"
                  />
                  <TactilePillButton type="submit" disabled={loading || !question.trim()}>
                    <HugeiconsIcon icon={AiBrain01Icon} size={16} />
                    {loading ? 'Consulting...' : 'Ask Crystal Ball'}
                  </TactilePillButton>
                </form>
              </div>
            ) : (
              <form onSubmit={handleGenerateProgram} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Program Focus &amp; Constraints
                  </label>
                  <input
                    type="text"
                    value={goalPrompt}
                    onChange={(e) => setGoalPrompt(e.target.value)}
                    className="w-full maloxie-input px-4 py-2.5 text-sm"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Weeks</label>
                    <select
                      value={durationWeeks}
                      onChange={(e) => setDurationWeeks(Number(e.target.value))}
                      className="w-full maloxie-input px-3 py-2 text-sm font-mono"
                    >
                      {[3, 4, 6, 8].map((w) => (
                        <option key={w} value={w}>{w} Weeks</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Days / Week</label>
                    <select
                      value={daysPerWeek}
                      onChange={(e) => setDaysPerWeek(Number(e.target.value))}
                      className="w-full maloxie-input px-3 py-2 text-sm font-mono"
                    >
                      {[3, 4, 5, 6].map((d) => (
                        <option key={d} value={d}>{d} Days</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Split</label>
                    <select
                      value={splitPreference}
                      onChange={(e) => setSplitPreference(e.target.value)}
                      className="w-full maloxie-input px-3 py-2 text-sm"
                    >
                      <option value="Push / Pull / Legs">Push / Pull / Legs</option>
                      <option value="Upper / Lower">Upper / Lower</option>
                      <option value="Full Body">Full Body</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-xs text-white cursor-pointer py-2">
                      <input
                        type="checkbox"
                        checked={includeDeload}
                        onChange={(e) => setIncludeDeload(e.target.checked)}
                        className="accent-[#E89B3C] w-4 h-4"
                      />
                      Final Week Deload
                    </label>
                  </div>
                </div>
                <MaloxieButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={loading}
                >
                  <HugeiconsIcon icon={Calendar03Icon} size={16} />
                  {loading ? 'Generating Program...' : 'Generate Multi-Week Program'}
                </MaloxieButton>
              </form>
            )}

            {errorMsg && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/25 p-3 text-xs text-red-200">
                {errorMsg}
              </div>
            )}
            {programStatusMsg && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 text-xs text-emerald-200 flex items-center gap-2">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
                {programStatusMsg}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conversation Transcript or Generated Programs */}
      {mode === 'coach' ? (
        <div className="relative maloxie-block overflow-hidden">
          <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-base font-display font-semibold text-white">
              Crystal Ball Coaching Log
            </h2>
            <span className="text-xs text-zinc-400">
              Context-aware · <span className="font-mono">{unit}</span>
            </span>
          </div>
          <div className="relative max-h-[420px] overflow-y-auto p-5 space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[#E89B3C]/12 border border-[#E89B3C]/30 text-white'
                      : 'bg-white/[0.04] border border-white/[0.06] text-zinc-200'
                  }`}
                >
                  <p className="text-[11px] font-medium text-zinc-400 mb-1">
                    {m.role === 'user' ? 'You' : 'Maloxie AI'}
                  </p>
                  {m.content}
                </div>
              </div>
            ))}
            <GradualBlur
              position="bottom"
              height="2.5rem"
              strength={1.2}
              layers={4}
              zIndex={20}
              tint="rgba(18, 18, 24, 0.72)"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {programs.length === 0 ? (
            <div className="maloxie-block p-8 text-center text-sm text-zinc-400">
              No multi-week programs generated yet. Configure your split above and let Maloxie AI construct your mesocycle and deload week.
            </div>
          ) : (
            programs.map((prog) => (
              <div
                key={prog.id}
                className="maloxie-block p-6 space-y-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.06] pb-4">
                  <div>
                    <p className="text-xs font-medium text-[#F4B86A]">
                      {prog.durationWeeks}-Week Block ·{' '}
                      {prog.deloadWeekNumber > 0
                        ? `Deload in Week ${prog.deloadWeekNumber}`
                        : 'No Deload'}
                    </p>
                    <h3 className="text-xl font-display font-bold text-white mt-1">
                      {prog.title}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">{prog.focus}</p>
                  </div>
                  <MaloxieIconButton
                    onClick={() => deleteProgram(prog.id)}
                    aria-label="Delete Program"
                    title="Delete Program"
                    className="hover:text-red-400"
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={16} />
                  </MaloxieIconButton>
                </div>

                <div className="divide-y divide-white/[0.06]">
                  {prog.weeks.map((wk) => (
                    <div key={wk.weekNumber} className="py-5 first:pt-0 last:pb-0 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            Week {wk.weekNumber}
                            {wk.isDeload ? ' — Scheduled Deload' : ' — Progressive Accumulation'}
                          </p>
                          <p className="text-xs text-zinc-400">{wk.summary}</p>
                        </div>
                        <MaloxieButton
                          variant="primary"
                          size="sm"
                          onClick={() => handleApplyWeekAsTemplates(wk, prog.title)}
                        >
                          {wk.isDeload ? 'Save Deload Templates & Activate' : 'Save Week as Templates'}
                        </MaloxieButton>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        {wk.sessions.map((sess, idx) => (
                          <div
                            key={`${wk.weekNumber}-${idx}`}
                            className="border-t border-white/[0.06] pt-3 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-white">{sess.name}</p>
                              <span className="text-[11px] font-medium text-[#F4B86A]">
                                {sess.splitType}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {sess.exercises.map((ex, eIdx) => (
                                <div
                                  key={eIdx}
                                  className="flex items-center justify-between text-[11px] text-zinc-400 font-mono tabular-nums"
                                >
                                  <span className="truncate pr-2 text-zinc-200 font-sans">
                                    {ex.name}
                                  </span>
                                  <span className="shrink-0">
                                    {ex.targetSets}×{ex.targetReps} · RPE {ex.targetRpe}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CrystalBallAiView;
