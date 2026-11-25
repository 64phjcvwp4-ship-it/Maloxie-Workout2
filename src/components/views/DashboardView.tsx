import React, { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Activity01Icon,
  AiBrain01Icon,
  Award01Icon,
  BodyWeightIcon,
  Calendar03Icon,
  ChartLineData01Icon,
  Dumbbell01Icon,
  Moon02Icon,
  Target01Icon,
} from '@hugeicons/core-free-icons';
import { useMaloxie } from '../../context/MaloxieContext';
import { MagicBento, MagicBentoCard } from '../ui/MagicBento';
import InfiniteSpiral from '../InfiniteSpiral';
import GradualBlur from '../GradualBlur';
import Strands from '../Strands';
import { GlassSlabLogo } from '../glass-slab-logo';
import AnimatedContent from '../AnimatedContent';
import { MaloxieButton } from '../ui/MaloxieButton';
import { TactilePillButton } from '../ui/UiverseControls';
import { SPIRAL_PROGRESS_MEDIA } from '../../data/presets';
import { formatVolume, formatWeight, fromKg } from '../../utils/units';
import type { WorkspaceTab } from '../../types/training';

interface DashboardViewProps {
  onNavigate: (tab: WorkspaceTab) => void;
  onAskCrystalBall: (prompt: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onAskCrystalBall,
}) => {
  const {
    user,
    signInWithGoogle,
    profile,
    unit,
    workouts,
    prs,
    measurements,
    goals,
    dataLoading,
  } = useMaloxie();

  const [quickPrompt, setQuickPrompt] = useState('');

  const metrics = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 14);
    const monthPrefix = now.toISOString().slice(0, 7);

    let weekVolumeKg = 0;
    let prevWeekVolumeKg = 0;
    let weekSessions = 0;
    let weekSets = 0;
    let monthSessions = 0;
    let monthVolumeKg = 0;

    let rpeSum = 0;
    let rpeCount = 0;

    for (const w of workouts) {
      const d = new Date(`${w.date}T12:00:00`);
      if (d >= sevenDaysAgo) {
        weekVolumeKg += w.totalVolumeKg;
        weekSessions += 1;
        weekSets += w.totalSets;
      } else if (d >= fourteenDaysAgo) {
        prevWeekVolumeKg += w.totalVolumeKg;
      }
      if (w.date.startsWith(monthPrefix)) {
        monthSessions += 1;
        monthVolumeKg += w.totalVolumeKg;
      }
      if (d >= fourteenDaysAgo) {
        for (const ex of w.exercises) {
          for (const s of ex.sets) {
            if (s.rpe > 0) {
              rpeSum += s.rpe;
              rpeCount += 1;
            }
          }
        }
      }
    }

    const avgRpe = rpeCount > 0 ? Number((rpeSum / rpeCount).toFixed(1)) : 0;
    const volumeDeltaPct =
      prevWeekVolumeKg > 0
        ? Math.round(((weekVolumeKg - prevWeekVolumeKg) / prevWeekVolumeKg) * 100)
        : null;

    const latestWorkout = workouts[0] ?? null;
    const latestWeight = measurements[0]?.bodyweightKg ?? null;

    return {
      weekVolumeKg,
      weekSessions,
      weekSets,
      monthSessions,
      monthVolumeKg,
      volumeDeltaPct,
      avgRpe,
      latestWorkout,
      latestWeight,
    };
  }, [measurements, workouts]);

  const spiralItems = useMemo(() => {
    return SPIRAL_PROGRESS_MEDIA.map((item, idx) => {
      const pr = prs[idx];
      return {
        src: item.src,
        alt: item.alt,
        label: pr ? pr.exerciseName : item.label,
        metric: pr ? `${formatWeight(pr.bestWeightKg, unit)} × ${pr.bestWeightReps}` : 'Ready to Log',
      };
    });
  }, [prs, unit]);

  const primaryGoal = goals.find((g) => g.status === 'active') ?? goals[0] ?? null;

  const computeGoalProgress = (goal: typeof primaryGoal) => {
    if (!goal) return { currentKg: 0, pct: 0 };
    let currentKg = goal.startValue;
    if (goal.metricType === 'bodyweight') {
      currentKg = measurements[0]?.bodyweightKg ?? goal.startValue;
    } else {
      const match = prs.find(
        (p) => p.exerciseName.toLowerCase() === goal.exerciseName.toLowerCase()
      );
      if (match) {
        currentKg =
          goal.metricType === 'e1rm'
            ? match.bestEstimated1RMKg
            : goal.metricType === 'volume'
              ? match.bestSetVolumeKg
              : match.bestWeightKg;
      }
    }
    const span = goal.targetValue - goal.startValue;
    const pct =
      span !== 0
        ? Math.min(100, Math.max(0, Math.round(((currentKg - goal.startValue) / span) * 100)))
        : currentKg >= goal.targetValue
          ? 100
          : 0;
    return { currentKg, pct };
  };

  const goalStats = computeGoalProgress(primaryGoal);

  const handleQuickAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPrompt.trim()) {
      onNavigate('ai');
      return;
    }
    onAskCrystalBall(quickPrompt.trim());
  };

  return (
    <div className="space-y-8">
      {/* Unified Studio Hero Showcase */}
      <AnimatedContent distance={22} stagger={0.05} trigger="mount">
        <div className="maloxie-block p-6 lg:p-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <p className="text-xs font-medium tracking-[0.14em] uppercase text-[#F4B86A]">
                Strength Intelligence &amp; Training Studio ·{' '}
                {profile?.activeDeloadWeek ? 'Deload Protocol Active' : 'Accumulation Phase'}
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-display font-bold tracking-[-0.035em] leading-[1.06] text-white text-balance">
                {user
                  ? `Welcome back, ${profile?.displayName?.split(' ')[0] || 'Athlete'}`
                  : 'Every set measured. Every overload earned.'}
              </h1>
              <p className="text-sm sm:text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
                {workouts.length === 0
                  ? 'Log sets, reps, RPE, rest timers, sleep, and body measurements in one workspace—then consult the Maloxie Crystal Ball to build multi-week blocks and deloads.'
                  : `${workouts.length} logged sessions · ${prs.length} tracked Personal Records · Avg 14d RPE ${metrics.avgRpe || '—'}`}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <TactilePillButton onClick={() => onNavigate('logger')}>
                  <HugeiconsIcon icon={Dumbbell01Icon} size={16} />
                  Log Workout
                </TactilePillButton>
                <MaloxieButton
                  variant="secondary"
                  size="md"
                  onClick={() => onNavigate('ai')}
                >
                  Ask Maloxie AI
                </MaloxieButton>
                {!user && (
                  <MaloxieButton
                    variant="subtle"
                    size="md"
                    onClick={signInWithGoogle}
                  >
                    Sign in with Google to Sync
                  </MaloxieButton>
                )}
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="w-full rounded-[22px] border border-white/[0.06] bg-[#08080A]/55 overflow-hidden">
                <GlassSlabLogo
                  logo="/assets/aistudio/1795213782478_6c4c1cc1.jpg"
                  slabs={17}
                  depth={0.75}
                  elevation={60}
                  colors={['#e89b3c', '#f4b86a', '#d9822b', '#27272a', '#141418']}
                  backgroundColor="#08080a"
                  lightColor="#fff2ed"
                  ambient={0.18}
                  exposure={1.16}
                  reflectivity={1.65}
                  style={{ height: 270 }}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {!user && (
            <div className="pt-5 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  index: '01',
                  title: 'Set-by-Set Telemetry',
                  desc: 'Track Sets × Reps × Weight, RPE 1–10, rest timers, warm-ups, and previous-session deltas.',
                },
                {
                  index: '02',
                  title: 'Auto PR & Overload',
                  desc: 'Instant Personal Record detection, Epley 1RM estimates, weekly tonnage, and monthly trends.',
                },
                {
                  index: '03',
                  title: 'Readiness & Metrics',
                  desc: 'Link sleep quality, energy, injury notes, deload weeks, and full body measurements.',
                },
                {
                  index: '04',
                  title: 'Maloxie AI Crystal Ball',
                  desc: 'Ask training questions grounded in your history or generate multi-week & deload blocks.',
                },
              ].map((item) => (
                <div key={item.title} className="space-y-1.5">
                  <p className="text-[11px] font-mono tabular-nums text-[#E89B3C]">{item.index}</p>
                  <h2 className="text-sm font-display font-semibold text-white tracking-tight">
                    {item.title}
                  </h2>
                  <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </AnimatedContent>

      {/* MagicBento Telemetry Grid */}
      <MagicBento gap={14}>
        {/* Card 1: Weekly Volume (2 cols) */}
        <MagicBentoCard className="lg:col-span-2 p-6 flex flex-col justify-between min-h-[200px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-400">7-Day Volume Summary</p>
              <p className="text-3xl sm:text-4xl font-mono font-semibold tabular-nums text-white mt-2">
                {dataLoading ? '—' : formatVolume(metrics.weekVolumeKg, unit)}
              </p>
            </div>
            <HugeiconsIcon icon={ChartLineData01Icon} size={20} className="text-[#E89B3C]" />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-400 pt-5 border-t border-white/[0.06] mt-4">
            <span className="font-mono tabular-nums">
              {metrics.weekSessions} sessions this week
            </span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span className="font-mono tabular-nums">{metrics.weekSets} working sets</span>
            {metrics.volumeDeltaPct !== null && (
              <>
                <span aria-hidden="true" className="text-zinc-600">·</span>
                <span
                  className={`font-mono tabular-nums ${
                    metrics.volumeDeltaPct >= 0 ? 'text-emerald-400' : 'text-[#F4B86A]'
                  }`}
                >
                  {metrics.volumeDeltaPct >= 0 ? '+' : ''}
                  {metrics.volumeDeltaPct}% vs last week
                </span>
              </>
            )}
          </div>
        </MagicBentoCard>

        {/* Card 2: Monthly Overview */}
        <MagicBentoCard
          onClick={() => onNavigate('progress')}
          className="p-6 flex flex-col justify-between min-h-[200px]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400">Monthly Progress</p>
              <p className="text-3xl font-mono font-semibold tabular-nums text-white mt-2">
                {metrics.monthSessions} <span className="text-sm font-sans text-zinc-400 font-normal">sessions</span>
              </p>
            </div>
            <HugeiconsIcon icon={Calendar03Icon} size={19} className="text-[#E89B3C]" />
          </div>
          <div className="space-y-1 pt-4 border-t border-white/[0.06]">
            <p className="text-xs text-zinc-400">Monthly Tonnage</p>
            <p className="text-sm font-mono tabular-nums text-white">
              {formatVolume(metrics.monthVolumeKg, unit)}
            </p>
          </div>
        </MagicBentoCard>

        {/* Card 3: Readiness & Deload */}
        <MagicBentoCard
          onClick={() => onNavigate('progress')}
          className="p-6 flex flex-col justify-between min-h-[200px]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400">Readiness &amp; Deload</p>
              <p className="text-2xl font-display font-semibold text-white mt-2">
                {profile?.activeDeloadWeek
                  ? 'Deload Active'
                  : metrics.avgRpe >= 8.8
                    ? 'High Fatigue'
                    : 'Ready to Push'}
              </p>
            </div>
            <HugeiconsIcon icon={Moon02Icon} size={19} className="text-[#F4B86A]" />
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-400 pt-4 border-t border-white/[0.06]">
            <span className="font-mono tabular-nums">
              Sleep {metrics.latestWorkout ? `${metrics.latestWorkout.sleepHours}h (${metrics.latestWorkout.sleepQuality}/10)` : '—'}
            </span>
            <span className="font-mono tabular-nums">
              Energy {metrics.latestWorkout ? `${metrics.latestWorkout.energyLevel}/10` : '—'}
            </span>
          </div>
        </MagicBentoCard>

        {/* Card 4: Personal Records Leaderboard (2 cols) */}
        <MagicBentoCard
          onClick={() => onNavigate('progress')}
          className="lg:col-span-2 p-6 flex flex-col justify-between min-h-[220px]"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-medium text-zinc-400">Personal Records</p>
              <h2 className="text-lg font-display font-semibold text-white">
                Top Tracked Lifts
              </h2>
            </div>
            <HugeiconsIcon icon={Award01Icon} size={19} className="text-[#E89B3C]" />
          </div>
          {prs.length === 0 ? (
            <p className="text-sm text-zinc-400">
              Log exercises to automatically track best weight, reps, and estimated 1RM.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {prs.slice(0, 3).map((pr) => (
                <div key={pr.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{pr.exerciseName}</p>
                    <p className="text-xs text-zinc-400">
                      {pr.muscleGroup} · <span className="font-mono">{pr.achievedAt}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono tabular-nums text-[#F4B86A] font-semibold">
                      {formatWeight(pr.bestWeightKg, unit)} × {pr.bestWeightReps}
                    </p>
                    <p className="text-[11px] font-mono tabular-nums text-zinc-400">
                      e1RM {formatWeight(pr.bestEstimated1RMKg, unit)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </MagicBentoCard>

        {/* Card 5: Goal Progress & Bodyweight */}
        <MagicBentoCard
          onClick={() => onNavigate('library')}
          className="p-6 flex flex-col justify-between min-h-[220px]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400">Primary Goal</p>
              <h2 className="text-base font-display font-semibold text-white mt-1 line-clamp-2">
                {primaryGoal ? primaryGoal.title : 'Set a Strength Goal'}
              </h2>
            </div>
            <HugeiconsIcon icon={Target01Icon} size={19} className="text-[#E89B3C]" />
          </div>
          {primaryGoal ? (
            <div className="space-y-2 mt-4">
              <div className="flex justify-between text-xs font-mono tabular-nums text-zinc-400">
                <span>{fromKg(goalStats.currentKg, unit)} {unit}</span>
                <span className="text-white">{fromKg(primaryGoal.targetValue, unit)} {unit}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  style={{ width: `${goalStats.pct}%` }}
                  className="h-full bg-gradient-to-r from-[#E89B3C] to-[#F4C77B] rounded-full transition-all"
                />
              </div>
              <p className="text-[11px] font-mono text-zinc-400">
                {goalStats.pct}% complete · Target {primaryGoal.targetDate}
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-400 mt-4">
              Example: &ldquo;Bench 100kg by March&rdquo;
            </p>
          )}
          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <HugeiconsIcon icon={BodyWeightIcon} size={14} />
              Bodyweight
            </span>
            <span className="font-mono tabular-nums text-white">
              {metrics.latestWeight ? formatWeight(metrics.latestWeight, unit) : 'Not logged'}
            </span>
          </div>
        </MagicBentoCard>

        {/* Card 6: Maloxie AI Crystal Ball Portal */}
        <MagicBentoCard className="p-5 flex flex-col justify-between min-h-[220px]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#F4B86A]">Maloxie AI</p>
              <h2 className="text-base font-display font-semibold text-white">Crystal Ball</h2>
            </div>
            <HugeiconsIcon icon={AiBrain01Icon} size={19} className="text-[#E89B3C]" />
          </div>
          <div
            onClick={() => onNavigate('ai')}
            className="h-24 w-full my-1 cursor-pointer"
            title="Open Maloxie AI Crystal Ball"
          >
            <Strands
              glass
              glassSize={1.05}
              energy={0.7}
              colors={['#e89b3c', '#f4b86a', '#ffe8c2', '#93f1ff', '#3569fa']}
              count={3}
            />
          </div>
          <form onSubmit={handleQuickAsk} className="flex gap-2">
            <input
              type="text"
              value={quickPrompt}
              onChange={(e) => setQuickPrompt(e.target.value)}
              placeholder="Ask about your program..."
              className="flex-1 min-w-0 maloxie-input px-3.5 py-2 text-xs placeholder:text-zinc-500"
            />
            <MaloxieButton
              type="submit"
              variant="primary"
              size="sm"
            >
              Ask
            </MaloxieButton>
          </form>
        </MagicBentoCard>
      </MagicBento>

      {/* Progress Showcase: InfiniteSpiral + Recent Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 relative maloxie-block overflow-hidden min-h-[420px] flex flex-col">
          <div className="relative z-30 p-5 border-b border-white/[0.06] flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#F4B86A]">Milestone Spiral</p>
              <h2 className="text-lg font-display font-semibold text-white">
                Strength Progression Orbit
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('progress')}
              className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              View Charts →
            </button>
          </div>
          <div className="relative flex-1 min-h-[340px]">
            <InfiniteSpiral
              items={spiralItems}
              speed={0.5}
              radius={138}
              cardWidth={102}
              cardHeight={102}
              verticalSpacing={54}
              perspective={1000}
              cardRadius={12}
              centerScale={1.2}
              edgeBlur={4}
              cardsPerTurn={6}
              pauseOnHover
              direction="up"
              edgeFade={0.3}
              grayscale={0.35}
            />
            <GradualBlur
              position="bottom"
              height="4.5rem"
              strength={1.8}
              layers={6}
              exponential
              zIndex={20}
              tint="rgba(18, 18, 24, 0.72)"
            />
          </div>
        </div>

        {/* Recent Workouts Ledger — Single Elevation with Hairline Dividers */}
        <div className="lg:col-span-7 relative maloxie-block overflow-hidden flex flex-col min-h-[420px]">
          <div className="p-5 border-b border-white/[0.06] flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-400">Training Feed</p>
              <h2 className="text-lg font-display font-semibold text-white">
                Recent Sessions
              </h2>
            </div>
            <MaloxieButton
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('logger')}
            >
              Open Logger
            </MaloxieButton>
          </div>

          <div className="relative flex-1 overflow-y-auto max-h-[360px]">
            {workouts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 px-6 space-y-3">
                <HugeiconsIcon icon={Activity01Icon} size={26} className="text-[#E89B3C]" />
                <p className="text-sm font-medium text-white">No workouts logged yet</p>
                <p className="text-xs text-zinc-400 max-w-sm">
                  Start with a Push, Pull, Legs, or Full Body template to track your sets, RPE, and progressive overload.
                </p>
                <MaloxieButton
                  variant="primary"
                  size="md"
                  onClick={() => onNavigate('logger')}
                >
                  Log First Workout
                </MaloxieButton>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {workouts.slice(0, 6).map((w) => (
                  <div
                    key={w.id}
                    onClick={() => onNavigate('logger')}
                    className="px-5 py-4 hover:bg-white/[0.025] transition-colors cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {w.title}
                          {w.isDeload ? ' · Deload' : ''}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          <span className="font-mono tabular-nums">{w.date}</span> ·{' '}
                          <span className="font-mono tabular-nums">{w.exercises.length}</span> exercises ·{' '}
                          <span className="font-mono tabular-nums">{w.totalSets}</span> sets
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono tabular-nums text-[#F4B86A] font-semibold">
                          {formatVolume(w.totalVolumeKg, unit)}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-zinc-400 mt-0.5">
                          Energy {w.energyLevel}/10 · Sleep {w.sleepHours}h
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <GradualBlur
              position="bottom"
              height="3.25rem"
              strength={1.4}
              layers={5}
              exponential
              zIndex={20}
              tint="rgba(18, 18, 24, 0.72)"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
