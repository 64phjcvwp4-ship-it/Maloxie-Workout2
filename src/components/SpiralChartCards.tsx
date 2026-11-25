import React, { useMemo } from 'react';
import { calculateE1RM, formatVolume, formatWeight, fromKg } from '../utils/units';
import type {
  BodyMeasurement,
  PersonalRecord,
  TrainingGoal,
  WeightUnit,
  WorkoutLog,
} from '../types/training';
import type { InfiniteSpiralItem } from './InfiniteSpiral';

interface BuildSpiralChartsInput {
  workouts: WorkoutLog[];
  prs: PersonalRecord[];
  measurements: BodyMeasurement[];
  goals: TrainingGoal[];
  unit: WeightUnit;
  onOpenProgress: () => void;
}

interface CardFrameProps {
  kicker: string;
  headline: string;
  submetric: string;
  children: React.ReactNode;
}

const ChartCardFrame: React.FC<CardFrameProps> = ({
  kicker,
  headline,
  submetric,
  children,
}) => (
  <div className="w-full h-full px-3 py-2.5 flex flex-col justify-between select-none">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[9px] font-medium tracking-[0.06em] text-[#F4B86A] truncate">
          {kicker}
        </p>
        <p className="text-[13px] font-mono font-semibold tabular-nums text-white leading-tight truncate mt-0.5">
          {headline}
        </p>
      </div>
      <span className="text-[9px] font-mono tabular-nums text-zinc-400 shrink-0 pt-0.5">
        {submetric}
      </span>
    </div>
    <div className="w-full flex-1 flex items-end pt-1.5 min-h-0">{children}</div>
  </div>
);

export function useSpiralChartItems({
  workouts,
  prs,
  measurements,
  goals,
  unit,
  onOpenProgress,
}: BuildSpiralChartsInput): InfiniteSpiralItem[] {
  return useMemo(() => {
    const chronological = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
    const now = new Date();

    // 1. 7-Day Daily Tonnage Area Chart
    const daily7: { label: string; volKg: number }[] = [];
    let weekVolKg = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const dayVol = workouts
        .filter((w) => w.date === iso)
        .reduce((sum, w) => sum + w.totalVolumeKg, 0);
      weekVolKg += dayVol;
      daily7.push({ label: iso.slice(5), volKg: dayVol });
    }
    const dailyHasData = daily7.some((d) => d.volKg > 0);

    // 2. 6-Week Tonnage Bar Chart
    const weekly6: { label: string; volKg: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(now.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      const vol = workouts
        .filter((w) => {
          const d = new Date(`${w.date}T12:00:00`);
          return d >= start && d <= end;
        })
        .reduce((sum, w) => sum + w.totalVolumeKg, 0);
      weekly6.push({ label: `W-${i === 0 ? 'Now' : i}`, volKg: vol });
    }
    const weeklyMax = Math.max(1, ...weekly6.map((w) => w.volKg));
    const total6wVolKg = weekly6.reduce((sum, w) => sum + w.volKg, 0);

    // 3. Top Exercise Estimated 1RM Line Graph
    const topLiftName = prs[0]?.exerciseName || workouts[0]?.exercises[0]?.exerciseName || 'Est. 1RM';
    const liftPoints: { date: string; e1rmKg: number }[] = [];
    for (const w of chronological) {
      const ex = w.exercises.find(
        (item) => item.exerciseName.toLowerCase() === topLiftName.toLowerCase()
      );
      if (!ex || ex.sets.length === 0) continue;
      const best = ex.sets.reduce(
        (max, s) => Math.max(max, calculateE1RM(s.weightKg, s.reps)),
        0
      );
      if (best > 0) liftPoints.push({ date: w.date, e1rmKg: best });
    }
    const recentLiftPts = liftPoints.slice(-7);
    const liftPeakKg = recentLiftPts.reduce((m, p) => Math.max(m, p.e1rmKg), 0);

    // 4. 30-Day Muscle Group Set Distribution
    const thirtyAgo = new Date(now);
    thirtyAgo.setDate(now.getDate() - 30);
    const muscleOrder = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'] as const;
    const muscleCounts: Record<string, number> = {
      Chest: 0,
      Back: 0,
      Legs: 0,
      Shoulders: 0,
      Arms: 0,
    };
    let total30Sets = 0;
    for (const w of workouts) {
      const d = new Date(`${w.date}T12:00:00`);
      if (d < thirtyAgo) continue;
      for (const ex of w.exercises) {
        if (ex.muscleGroup in muscleCounts) {
          muscleCounts[ex.muscleGroup] += ex.sets.length;
        }
        total30Sets += ex.sets.length;
      }
    }
    const maxMuscleSets = Math.max(1, ...Object.values(muscleCounts));

    // 5. RPE & Sleep Readiness Dual Sparkline
    const recentSessions = chronological.slice(-7);
    const rpeSleepSeries = recentSessions.map((w) => {
      let sum = 0;
      let count = 0;
      for (const ex of w.exercises) {
        for (const s of ex.sets) {
          if (s.rpe > 0) {
            sum += s.rpe;
            count += 1;
          }
        }
      }
      const avgRpe = count > 0 ? sum / count : 0;
      return {
        avgRpe,
        sleepHours: w.sleepHours,
      };
    });
    const avgRpeAll =
      rpeSleepSeries.filter((p) => p.avgRpe > 0).length > 0
        ? (
            rpeSleepSeries.reduce((s, p) => s + p.avgRpe, 0) /
            rpeSleepSeries.filter((p) => p.avgRpe > 0).length
          ).toFixed(1)
        : '—';

    // 6. Bodyweight Trend OR Goal Progress Curve
    const sortedMeasurements = [...measurements]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);
    const activeGoal = goals.find((g) => g.status === 'active') ?? goals[0] ?? null;

    const svgW = 156;
    const svgH = 58;

    // Helper for SVG line path
    const buildCoords = (vals: number[], minFloor?: number) => {
      const minV = minFloor !== undefined ? Math.min(minFloor, ...vals) : Math.min(...vals);
      const maxV = Math.max(...vals);
      const span = maxV - minV || 1;
      return vals.map((v, idx) => {
        const x = vals.length === 1 ? svgW / 2 : 6 + (idx / (vals.length - 1)) * (svgW - 12);
        const y = 8 + (1 - (v - minV) / span) * (svgH - 16);
        return { x, y };
      });
    };

    const dailyCoords = buildCoords(
      daily7.map((d) => d.volKg),
      0
    );
    const dailyLine = dailyCoords
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    const dailyArea = `${dailyLine} L ${dailyCoords[dailyCoords.length - 1].x.toFixed(1)} ${svgH - 6} L ${dailyCoords[0].x.toFixed(1)} ${svgH - 6} Z`;

    const liftCoords =
      recentLiftPts.length > 0
        ? buildCoords(recentLiftPts.map((p) => fromKg(p.e1rmKg, unit)))
        : [];
    const liftLine = liftCoords
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    const bwCoords =
      sortedMeasurements.length > 0
        ? buildCoords(sortedMeasurements.map((m) => fromKg(m.bodyweightKg, unit)))
        : [];
    const bwLine = bwCoords
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    return [
      {
        id: 'chart-7d-volume',
        label: '7-Day Volume Trend Chart',
        onClick: onOpenProgress,
        content: (
          <ChartCardFrame
            kicker="7-Day Volume"
            headline={formatVolume(weekVolKg, unit)}
            submetric={dailyHasData ? '7d curve' : '0 logs'}
          >
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-[58px] overflow-visible">
              <defs>
                <linearGradient id="spiralVolGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E89B3C" stopOpacity="0.42" />
                  <stop offset="100%" stopColor="#E89B3C" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="6" y1={svgH - 6} x2={svgW - 6} y2={svgH - 6} stroke="rgba(255,255,255,0.09)" strokeDasharray="2 3" />
              <line x1="6" y1={svgH / 2} x2={svgW - 6} y2={svgH / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="2 3" />
              {dailyHasData ? (
                <>
                  <path d={dailyArea} fill="url(#spiralVolGrad)" />
                  <path
                    d={dailyLine}
                    fill="none"
                    stroke="#F4B86A"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {dailyCoords.map((p, idx) =>
                    daily7[idx].volKg > 0 ? (
                      <circle key={idx} cx={p.x} cy={p.y} r="2.6" fill="#09090B" stroke="#F4B86A" strokeWidth="1.6" />
                    ) : null
                  )}
                </>
              ) : (
                <path
                  d={`M 6 ${svgH - 6} L ${svgW - 6} ${svgH - 6}`}
                  stroke="rgba(232,155,60,0.45)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}
            </svg>
          </ChartCardFrame>
        ),
      },
      {
        id: 'chart-6w-tonnage',
        label: '6-Week Tonnage Bar Chart',
        onClick: onOpenProgress,
        content: (
          <ChartCardFrame
            kicker="6-Week Tonnage"
            headline={formatVolume(total6wVolKg, unit)}
            submetric="Weekly bars"
          >
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-[58px]">
              <line x1="6" y1={svgH - 6} x2={svgW - 6} y2={svgH - 6} stroke="rgba(255,255,255,0.09)" />
              {weekly6.map((bucket, idx) => {
                const barW = 16;
                const gap = (svgW - 12 - barW * 6) / 5;
                const x = 6 + idx * (barW + gap);
                const h = bucket.volKg > 0 ? Math.max(6, (bucket.volKg / weeklyMax) * (svgH - 14)) : 4;
                const y = svgH - 6 - h;
                const isLatest = idx === weekly6.length - 1;
                return (
                  <rect
                    key={bucket.label}
                    x={x}
                    y={y}
                    width={barW}
                    height={h}
                    rx="4"
                    fill={
                      bucket.volKg > 0
                        ? isLatest
                          ? '#F4B86A'
                          : 'rgba(232,155,60,0.48)'
                        : 'rgba(255,255,255,0.08)'
                    }
                  />
                );
              })}
            </svg>
          </ChartCardFrame>
        ),
      },
      {
        id: 'chart-e1rm-curve',
        label: 'Estimated 1RM Strength Curve',
        onClick: onOpenProgress,
        content: (
          <ChartCardFrame
            kicker={topLiftName}
            headline={liftPeakKg > 0 ? formatWeight(liftPeakKg, unit) : `0 ${unit}`}
            submetric="Est. 1RM"
          >
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-[58px] overflow-visible">
              <defs>
                <linearGradient id="spiralE1rmGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F4B86A" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#F4B86A" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="6" y1={svgH - 6} x2={svgW - 6} y2={svgH - 6} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 3" />
              <line x1="6" y1="14" x2={svgW - 6} y2="14" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 3" />
              {liftCoords.length > 0 ? (
                <>
                  {liftCoords.length > 1 && (
                    <path
                      d={`${liftLine} L ${liftCoords[liftCoords.length - 1].x.toFixed(1)} ${svgH - 6} L ${liftCoords[0].x.toFixed(1)} ${svgH - 6} Z`}
                      fill="url(#spiralE1rmGrad)"
                    />
                  )}
                  <path
                    d={liftLine}
                    fill="none"
                    stroke="#F4B86A"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {liftCoords.map((p, idx) => (
                    <circle key={idx} cx={p.x} cy={p.y} r="2.8" fill="#09090B" stroke="#F4B86A" strokeWidth="1.7" />
                  ))}
                </>
              ) : (
                <path
                  d={`M 6 ${svgH - 10} L ${svgW - 6} ${svgH - 10}`}
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}
            </svg>
          </ChartCardFrame>
        ),
      },
      {
        id: 'chart-muscle-split',
        label: '30-Day Muscle Group Distribution Chart',
        onClick: onOpenProgress,
        content: (
          <ChartCardFrame
            kicker="30-Day Split"
            headline={`${total30Sets} sets`}
            submetric="Muscles"
          >
            <div className="w-full space-y-1">
              {muscleOrder.map((mg) => {
                const count = muscleCounts[mg];
                const pct = count > 0 ? Math.max(8, Math.round((count / maxMuscleSets) * 100)) : 0;
                return (
                  <div key={mg} className="flex items-center gap-2">
                    <span className="text-[8.5px] font-mono text-zinc-400 w-11 truncate">{mg}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-[#E89B3C] to-[#F4B86A]"
                      />
                    </div>
                    <span className="text-[8.5px] font-mono tabular-nums text-zinc-300 w-4 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </ChartCardFrame>
        ),
      },
      {
        id: 'chart-rpe-readiness',
        label: 'RPE and Sleep Readiness Graph',
        onClick: onOpenProgress,
        content: (
          <ChartCardFrame
            kicker="RPE &amp; Sleep"
            headline={`RPE ${avgRpeAll}`}
            submetric={
              recentSessions.length > 0
                ? `${recentSessions[recentSessions.length - 1].sleepHours}h sleep`
                : 'Readiness'
            }
          >
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-[58px] overflow-visible">
              <line x1="6" y1={svgH - 6} x2={svgW - 6} y2={svgH - 6} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 3" />
              {rpeSleepSeries.length > 0 ? (
                <>
                  {(() => {
                    const rpePts = rpeSleepSeries.map((pt, idx) => {
                      const x =
                        rpeSleepSeries.length === 1
                          ? svgW / 2
                          : 6 + (idx / (rpeSleepSeries.length - 1)) * (svgW - 12);
                      const y = 8 + (1 - Math.min(10, pt.avgRpe) / 10) * (svgH - 16);
                      return { x, y };
                    });
                    const sleepPts = rpeSleepSeries.map((pt, idx) => {
                      const x =
                        rpeSleepSeries.length === 1
                          ? svgW / 2
                          : 6 + (idx / (rpeSleepSeries.length - 1)) * (svgW - 12);
                      const y = 8 + (1 - Math.min(10, pt.sleepHours) / 10) * (svgH - 16);
                      return { x, y };
                    });
                    const rpeD = rpePts
                      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                      .join(' ');
                    const sleepD = sleepPts
                      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                      .join(' ');
                    return (
                      <>
                        <path
                          d={sleepD}
                          fill="none"
                          stroke="#7DD3FC"
                          strokeWidth="1.5"
                          strokeDasharray="3 2"
                          strokeLinecap="round"
                        />
                        <path
                          d={rpeD}
                          fill="none"
                          stroke="#E89B3C"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {rpePts.map((p, idx) => (
                          <circle key={idx} cx={p.x} cy={p.y} r="2.5" fill="#09090B" stroke="#E89B3C" strokeWidth="1.6" />
                        ))}
                      </>
                    );
                  })()}
                </>
              ) : (
                <path
                  d={`M 6 ${svgH / 2} L ${svgW - 6} ${svgH / 2}`}
                  stroke="rgba(125,211,252,0.35)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}
            </svg>
          </ChartCardFrame>
        ),
      },
      {
        id: 'chart-bodyweight-prs',
        label: 'Bodyweight and PR Progress Graph',
        onClick: onOpenProgress,
        content: (
          <ChartCardFrame
            kicker={sortedMeasurements.length > 0 ? 'Bodyweight' : 'PR Milestones'}
            headline={
              sortedMeasurements.length > 0
                ? formatWeight(
                    sortedMeasurements[sortedMeasurements.length - 1].bodyweightKg,
                    unit
                  )
                : `${prs.length} tracked`
            }
            submetric={activeGoal ? 'Goal active' : `${workouts.length} logs`}
          >
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-[58px] overflow-visible">
              <line x1="6" y1={svgH - 6} x2={svgW - 6} y2={svgH - 6} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 3" />
              {bwCoords.length > 0 ? (
                <>
                  <path
                    d={bwLine}
                    fill="none"
                    stroke="#34D399"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {bwCoords.map((p, idx) => (
                    <circle key={idx} cx={p.x} cy={p.y} r="2.6" fill="#09090B" stroke="#34D399" strokeWidth="1.6" />
                  ))}
                </>
              ) : prs.length > 0 ? (
                prs.slice(0, 5).map((pr, idx) => {
                  const barW = 20;
                  const maxPr = Math.max(1, ...prs.slice(0, 5).map((p) => p.bestEstimated1RMKg));
                  const gap = (svgW - 12 - barW * 5) / 4;
                  const x = 6 + idx * (barW + gap);
                  const h = Math.max(8, (pr.bestEstimated1RMKg / maxPr) * (svgH - 14));
                  return (
                    <rect
                      key={pr.id}
                      x={x}
                      y={svgH - 6 - h}
                      width={barW}
                      height={h}
                      rx="4"
                      fill={idx === 0 ? '#34D399' : 'rgba(52,211,153,0.45)'}
                    />
                  );
                })
              ) : (
                <path
                  d={`M 6 ${svgH - 12} L ${svgW - 6} ${svgH - 12}`}
                  stroke="rgba(52,211,153,0.4)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}
            </svg>
          </ChartCardFrame>
        ),
      },
    ];
  }, [goals, measurements, onOpenProgress, prs, unit, workouts]);
}
