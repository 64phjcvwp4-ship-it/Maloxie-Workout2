import React, { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Activity01Icon,
  Award01Icon,
  BodyWeightIcon,
  Calendar03Icon,
  ChartLineData01Icon,
  Delete02Icon,
} from '@hugeicons/core-free-icons';
import { useMaloxie } from '../../context/MaloxieContext';
import { MaloxieButton } from '../ui/MaloxieButton';
import { MUSCLE_GROUPS } from '../../data/presets';
import {
  calculateE1RM,
  formatVolume,
  formatWeight,
  fromCm,
  fromKg,
  lengthUnitLabel,
  toCm,
  toKg,
  todayIsoDate,
} from '../../utils/units';

export const ProgressAnalyticsView: React.FC = () => {
  const {
    profile,
    unit,
    workouts,
    prs,
    measurements,
    toggleDeloadWeek,
    addMeasurement,
    deleteMeasurement,
  } = useMaloxie();

  // Strength chart state
  const loggedExerciseNames = useMemo(() => {
    const set = new Set<string>();
    for (const w of workouts) {
      for (const e of w.exercises) {
        if (e.exerciseName.trim()) set.add(e.exerciseName.trim());
      }
    }
    return Array.from(set).sort();
  }, [workouts]);

  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const activeExercise = selectedExercise || loggedExerciseNames[0] || 'Barbell Bench Press';
  const [chartMetric, setChartMetric] = useState<'e1rm' | 'weight' | 'volume'>('e1rm');

  // Workout comparison state (defaults to latest vs previous)
  const [compareAId, setCompareAId] = useState<string>('');
  const [compareBId, setCompareBId] = useState<string>('');

  // Body measurement form state
  const [mDate, setMDate] = useState(todayIsoDate());
  const [mWeight, setMWeight] = useState('');
  const [mBodyFat, setMBodyFat] = useState('');
  const [mWaist, setMWaist] = useState('');
  const [mChest, setMChest] = useState('');
  const [mArms, setMArms] = useState('');
  const [mThighs, setMThighs] = useState('');
  const [mNotes, setMNotes] = useState('');
  const [measSaving, setMeasSaving] = useState(false);

  // Build chronological series for selected exercise
  const exerciseSeries = useMemo(() => {
    const points: {
      date: string;
      title: string;
      e1rmKg: number;
      topWeightKg: number;
      volumeKg: number;
      avgRpe: number;
    }[] = [];

    const chronological = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
    for (const w of chronological) {
      const match = w.exercises.find(
        (e) => e.exerciseName.toLowerCase() === activeExercise.toLowerCase()
      );
      if (!match || match.sets.length === 0) continue;

      let bestE1RM = 0;
      let topW = 0;
      let vol = 0;
      let rpeSum = 0;
      let rpeCount = 0;
      for (const s of match.sets) {
        const e1 = calculateE1RM(s.weightKg, s.reps);
        if (e1 > bestE1RM) bestE1RM = e1;
        if (s.weightKg > topW) topW = s.weightKg;
        vol += s.weightKg * s.reps;
        if (s.rpe > 0) {
          rpeSum += s.rpe;
          rpeCount += 1;
        }
      }
      points.push({
        date: w.date,
        title: w.title,
        e1rmKg: bestE1RM,
        topWeightKg: topW,
        volumeKg: vol,
        avgRpe: rpeCount > 0 ? Number((rpeSum / rpeCount).toFixed(1)) : 0,
      });
    }
    return points;
  }, [activeExercise, workouts]);

  // Weekly tonnage last 6 weeks + Muscle group distribution (last 30 days)
  const volumeSummaries = useMemo(() => {
    const now = new Date();
    const weeklyBuckets: { label: string; volumeKg: number; sessions: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(now.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);

      let vol = 0;
      let sess = 0;
      for (const w of workouts) {
        const d = new Date(`${w.date}T12:00:00`);
        if (d >= start && d <= end) {
          vol += w.totalVolumeKg;
          sess += 1;
        }
      }
      weeklyBuckets.push({
        label: `${start.getMonth() + 1}/${start.getDate()}`,
        volumeKg: vol,
        sessions: sess,
      });
    }

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const muscleMap: Record<string, { volumeKg: number; sets: number }> = {};
    for (const mg of MUSCLE_GROUPS) muscleMap[mg] = { volumeKg: 0, sets: 0 };

    let total30Vol = 0;
    for (const w of workouts) {
      const d = new Date(`${w.date}T12:00:00`);
      if (d < thirtyDaysAgo) continue;
      for (const ex of w.exercises) {
        const exVol = ex.sets.reduce((acc, s) => acc + s.weightKg * s.reps, 0);
        if (!muscleMap[ex.muscleGroup]) muscleMap[ex.muscleGroup] = { volumeKg: 0, sets: 0 };
        muscleMap[ex.muscleGroup].volumeKg += exVol;
        muscleMap[ex.muscleGroup].sets += ex.sets.length;
        total30Vol += exVol;
      }
    }

    // 14-day fatigue/deload computation
    const fourteenAgo = new Date(now);
    fourteenAgo.setDate(now.getDate() - 14);
    let rpeSum = 0;
    let rpeCount = 0;
    let highRpeSets = 0;
    let lowSleepCount = 0;
    for (const w of workouts) {
      const d = new Date(`${w.date}T12:00:00`);
      if (d < fourteenAgo) continue;
      if (w.sleepQuality <= 5 || w.sleepHours < 6) lowSleepCount += 1;
      for (const ex of w.exercises) {
        for (const s of ex.sets) {
          if (s.rpe > 0) {
            rpeSum += s.rpe;
            rpeCount += 1;
            if (s.rpe >= 9) highRpeSets += 1;
          }
        }
      }
    }
    const avg14Rpe = rpeCount > 0 ? Number((rpeSum / rpeCount).toFixed(1)) : 0;
    const deloadSuggested = avg14Rpe >= 8.7 || highRpeSets >= 10 || lowSleepCount >= 3;

    return {
      weeklyBuckets,
      muscleMap,
      total30Vol,
      avg14Rpe,
      highRpeSets,
      deloadSuggested,
    };
  }, [workouts]);

  // Progressive Overload Tracker across all logged exercises
  const overloadTrackerRows = useMemo(() => {
    const latestBwKg = measurements[0]?.bodyweightKg ?? null;
    const chronological = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
    const map = new Map<
      string,
      {
        exerciseName: string;
        muscleGroup: string;
        sessions: number;
        firstDate: string;
        latestDate: string;
        firstTopWeightKg: number;
        latestTopWeightKg: number;
        firstVolKg: number;
        latestVolKg: number;
        latestE1RMKg: number;
      }
    >();

    for (const w of chronological) {
      for (const ex of w.exercises) {
        if (!ex.exerciseName.trim() || ex.sets.length === 0) continue;
        const key = ex.exerciseName.trim().toLowerCase();
        let topW = 0;
        let vol = 0;
        let bestE1 = 0;
        for (const s of ex.sets) {
          if (s.weightKg > topW) topW = s.weightKg;
          vol += Math.max(0, s.weightKg) * Math.max(0, s.reps);
          const e1 = calculateE1RM(s.weightKg, s.reps);
          if (e1 > bestE1) bestE1 = e1;
        }

        const existing = map.get(key);
        if (!existing) {
          map.set(key, {
            exerciseName: ex.exerciseName.trim(),
            muscleGroup: ex.muscleGroup,
            sessions: 1,
            firstDate: w.date,
            latestDate: w.date,
            firstTopWeightKg: topW,
            latestTopWeightKg: topW,
            firstVolKg: vol,
            latestVolKg: vol,
            latestE1RMKg: bestE1,
          });
        } else {
          existing.sessions += 1;
          existing.latestDate = w.date;
          existing.latestTopWeightKg = topW;
          existing.latestVolKg = vol;
          existing.latestE1RMKg = bestE1;
        }
      }
    }

    return Array.from(map.values())
      .map((row) => {
        const weightDeltaKg = row.latestTopWeightKg - row.firstTopWeightKg;
        const weightDeltaPct =
          row.firstTopWeightKg > 0
            ? Math.round((weightDeltaKg / row.firstTopWeightKg) * 100)
            : 0;
        const volDeltaKg = row.latestVolKg - row.firstVolKg;
        const relativeStrength =
          latestBwKg && latestBwKg > 0
            ? Number((row.latestE1RMKg / latestBwKg).toFixed(2))
            : null;
        return {
          ...row,
          weightDeltaKg,
          weightDeltaPct,
          volDeltaKg,
          relativeStrength,
        };
      })
      .sort((a, b) => b.sessions - a.sessions || b.latestE1RMKg - a.latestE1RMKg);
  }, [measurements, workouts]);

  // Current vs Previous Workout Comparison
  const workoutA = useMemo(
    () => workouts.find((w) => w.id === compareAId) ?? workouts[0] ?? null,
    [compareAId, workouts]
  );
  const workoutB = useMemo(() => {
    if (compareBId) return workouts.find((w) => w.id === compareBId) ?? null;
    if (!workoutA) return null;
    return workouts.find((w) => w.id !== workoutA.id) ?? null;
  }, [compareBId, workoutA, workouts]);

  const workoutComparison = useMemo(() => {
    if (!workoutA || !workoutB) return null;

    const avgRpe = (w: typeof workoutA) => {
      let sum = 0;
      let cnt = 0;
      for (const ex of w.exercises) {
        for (const s of ex.sets) {
          if (s.rpe > 0) {
            sum += s.rpe;
            cnt += 1;
          }
        }
      }
      return cnt > 0 ? Number((sum / cnt).toFixed(1)) : 0;
    };

    const exNames = new Set<string>();
    workoutA.exercises.forEach((e) => exNames.add(e.exerciseName));
    workoutB.exercises.forEach((e) => exNames.add(e.exerciseName));

    const exerciseRows = Array.from(exNames).map((name) => {
      const exA = workoutA.exercises.find(
        (e) => e.exerciseName.toLowerCase() === name.toLowerCase()
      );
      const exB = workoutB.exercises.find(
        (e) => e.exerciseName.toLowerCase() === name.toLowerCase()
      );
      const topA = exA ? exA.sets.reduce((m, s) => Math.max(m, s.weightKg), 0) : 0;
      const topB = exB ? exB.sets.reduce((m, s) => Math.max(m, s.weightKg), 0) : 0;
      const volA = exA ? exA.sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0) : 0;
      const volB = exB ? exB.sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0) : 0;
      return {
        name,
        hasA: Boolean(exA),
        hasB: Boolean(exB),
        topA,
        topB,
        topDeltaKg: exA && exB ? topA - topB : null,
        volA,
        volB,
        volDeltaKg: exA && exB ? volA - volB : null,
      };
    });

    const volDeltaKg = workoutA.totalVolumeKg - workoutB.totalVolumeKg;
    const volDeltaPct =
      workoutB.totalVolumeKg > 0
        ? Math.round((volDeltaKg / workoutB.totalVolumeKg) * 100)
        : null;

    return {
      rpeA: avgRpe(workoutA),
      rpeB: avgRpe(workoutB),
      volDeltaKg,
      volDeltaPct,
      setsDelta: workoutA.totalSets - workoutB.totalSets,
      exerciseRows,
    };
  }, [workoutA, workoutB]);

  // Injury & Pain Notes History
  const injuryHistory = useMemo(() => {
    return workouts
      .filter((w) => Boolean(w.injuryNotes?.trim()))
      .map((w) => {
        let sum = 0;
        let cnt = 0;
        w.exercises.forEach((ex) =>
          ex.sets.forEach((s) => {
            if (s.rpe > 0) {
              sum += s.rpe;
              cnt += 1;
            }
          })
        );
        return {
          id: w.id,
          date: w.date,
          title: w.title,
          isDeload: w.isDeload,
          injuryNotes: w.injuryNotes || '',
          avgRpe: cnt > 0 ? Number((sum / cnt).toFixed(1)) : 0,
          sleepHours: w.sleepHours,
        };
      });
  }, [workouts]);

  // Current month calendar grid + monthly KPIs
  const monthCalendar = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const prevDate = new Date(year, month - 1, 1);
    const prevMonthPrefix = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();

    const byDate: Record<string, { volumeKg: number; isDeload: boolean; count: number }> = {};
    let monthSessions = 0;
    let monthVolumeKg = 0;
    let monthDeloadSessions = 0;
    let prevMonthVolumeKg = 0;

    for (const w of workouts) {
      if (w.date.startsWith(prevMonthPrefix)) {
        prevMonthVolumeKg += w.totalVolumeKg;
      }
      if (!w.date.startsWith(monthPrefix)) continue;
      monthSessions += 1;
      monthVolumeKg += w.totalVolumeKg;
      if (w.isDeload) monthDeloadSessions += 1;
      if (!byDate[w.date]) byDate[w.date] = { volumeKg: 0, isDeload: false, count: 0 };
      byDate[w.date].volumeKg += w.totalVolumeKg;
      byDate[w.date].count += 1;
      if (w.isDeload) byDate[w.date].isDeload = true;
    }

    const monthPrsCount = prs.filter((p) => p.achievedAt.startsWith(monthPrefix)).length;
    const momDeltaPct =
      prevMonthVolumeKg > 0
        ? Math.round(((monthVolumeKg - prevMonthVolumeKg) / prevMonthVolumeKg) * 100)
        : null;

    const cells: { day: number | null; iso?: string; data?: (typeof byDate)[string] }[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${monthPrefix}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, iso, data: byDate[iso] });
    }
    return {
      monthLabel: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      cells,
      monthSessions,
      monthVolumeKg,
      monthDeloadSessions,
      monthPrsCount,
      momDeltaPct,
    };
  }, [prs, workouts]);

  const handleAddMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    const bw = Number(mWeight);
    if (!Number.isFinite(bw) || bw <= 0) return;

    setMeasSaving(true);
    try {
      await addMeasurement({
        date: mDate,
        bodyweightKg: toKg(bw, unit),
        bodyFatPct: mBodyFat ? Number(mBodyFat) : undefined,
        waistCm: mWaist ? toCm(Number(mWaist), unit) : undefined,
        chestCm: mChest ? toCm(Number(mChest), unit) : undefined,
        armsCm: mArms ? toCm(Number(mArms), unit) : undefined,
        thighsCm: mThighs ? toCm(Number(mThighs), unit) : undefined,
        notes: mNotes.trim() || undefined,
      });
      setMWeight('');
      setMBodyFat('');
      setMWaist('');
      setMChest('');
      setMArms('');
      setMThighs('');
      setMNotes('');
    } finally {
      setMeasSaving(false);
    }
  };

  // Render clean responsive SVG line chart for strength progress
  const renderStrengthSvg = () => {
    if (exerciseSeries.length === 0) {
      return (
        <div className="h-56 flex items-center justify-center text-xs text-[#A1A1AA]">
          Log at least 1 session with {activeExercise} to chart strength progression.
        </div>
      );
    }

    const values = exerciseSeries.map((pt) =>
      chartMetric === 'e1rm'
        ? fromKg(pt.e1rmKg, unit)
        : chartMetric === 'weight'
          ? fromKg(pt.topWeightKg, unit)
          : Math.round(fromKg(pt.volumeKg, unit))
    );
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const pad = Math.max(2, (maxVal - minVal) * 0.2);
    const yMin = Math.max(0, minVal - pad);
    const yMax = maxVal + pad;

    const width = 640;
    const height = 220;
    const leftPad = 48;
    const rightPad = 20;
    const topPad = 20;
    const bottomPad = 32;
    const plotW = width - leftPad - rightPad;
    const plotH = height - topPad - bottomPad;

    const coords = exerciseSeries.map((pt, idx) => {
      const x =
        exerciseSeries.length === 1
          ? leftPad + plotW / 2
          : leftPad + (idx / (exerciseSeries.length - 1)) * plotW;
      const ratio = yMax === yMin ? 0.5 : (values[idx] - yMin) / (yMax - yMin);
      const y = topPad + plotH - ratio * plotH;
      return { x, y, val: values[idx], date: pt.date, rpe: pt.avgRpe };
    });

    const linePath = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');
    const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(
      topPad + plotH
    ).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(topPad + plotH).toFixed(1)} Z`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56 overflow-visible">
        <defs>
          <linearGradient id="maloxieChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e89b3c" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#e89b3c" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((tick) => {
          const y = topPad + plotH - tick * plotH;
          const labelVal = Math.round(yMin + tick * (yMax - yMin));
          return (
            <g key={tick}>
              <line
                x1={leftPad}
                y1={y}
                x2={width - rightPad}
                y2={y}
                stroke="rgba(255,255,255,0.07)"
                strokeDasharray="3 3"
              />
              <text
                x={leftPad - 8}
                y={y + 4}
                textAnchor="end"
                fill="#A1A1AA"
                fontSize="10"
                fontFamily="IBM Plex Mono, monospace"
              >
                {labelVal}
              </text>
            </g>
          );
        })}

        {coords.length > 1 && <path d={areaPath} fill="url(#maloxieChartFill)" />}
        <path
          d={linePath}
          fill="none"
          stroke="#e89b3c"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {coords.map((c, idx) => (
          <g key={idx}>
            <circle cx={c.x} cy={c.y} r={4.2} fill="#08080A" stroke="#f4b86a" strokeWidth="2.1" />
            <text
              x={c.x}
              y={c.y - 10}
              textAnchor="middle"
              fill="#F5F5F7"
              fontSize="10"
              fontFamily="IBM Plex Mono, monospace"
            >
              {c.val}
            </text>
            <text
              x={c.x}
              y={height - 8}
              textAnchor="middle"
              fill="#71717A"
              fontSize="9.5"
              fontFamily="IBM Plex Mono, monospace"
            >
              {c.date.slice(5)}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  // Bodyweight trend SVG chart
  const renderBodyweightSvg = () => {
    const chrono = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
    if (chrono.length === 0) return null;

    const vals = chrono.map((m) => fromKg(m.bodyweightKg, unit));
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const pad = Math.max(1, (maxV - minV) * 0.25);
    const yMin = Math.max(0, minV - pad);
    const yMax = maxV + pad;

    const width = 640;
    const height = 148;
    const leftPad = 44;
    const rightPad = 20;
    const topPad = 18;
    const bottomPad = 26;
    const plotW = width - leftPad - rightPad;
    const plotH = height - topPad - bottomPad;

    const pts = chrono.map((m, idx) => {
      const x =
        chrono.length === 1
          ? leftPad + plotW / 2
          : leftPad + (idx / (chrono.length - 1)) * plotW;
      const ratio = yMax === yMin ? 0.5 : (vals[idx] - yMin) / (yMax - yMin);
      const y = topPad + plotH - ratio * plotH;
      return { x, y, val: vals[idx], date: m.date };
    });

    const pathD = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 overflow-visible">
        {[0, 0.5, 1].map((tick) => {
          const y = topPad + plotH - tick * plotH;
          const labelVal = (yMin + tick * (yMax - yMin)).toFixed(1);
          return (
            <g key={tick}>
              <line
                x1={leftPad}
                y1={y}
                x2={width - rightPad}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="3 3"
              />
              <text
                x={leftPad - 8}
                y={y + 4}
                textAnchor="end"
                fill="#A1A1AA"
                fontSize="10"
                fontFamily="IBM Plex Mono, monospace"
              >
                {labelVal}
              </text>
            </g>
          );
        })}
        <path
          d={pathD}
          fill="none"
          stroke="#f4c77b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r={4} fill="#08080A" stroke="#f4c77b" strokeWidth="2" />
            <text
              x={p.x}
              y={p.y - 8}
              textAnchor="middle"
              fill="#F5F5F7"
              fontSize="9.5"
              fontFamily="IBM Plex Mono, monospace"
            >
              {p.val}
            </text>
            <text
              x={p.x}
              y={height - 6}
              textAnchor="middle"
              fill="#71717A"
              fontSize="9"
              fontFamily="IBM Plex Mono, monospace"
            >
              {p.date.slice(5)}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  const maxWeeklyVol = Math.max(
    1,
    ...volumeSummaries.weeklyBuckets.map((b) => b.volumeKg)
  );

  const firstPoint = exerciseSeries[0];
  const latestPoint = exerciseSeries[exerciseSeries.length - 1];
  const overloadDeltaKg =
    firstPoint && latestPoint ? latestPoint.e1rmKg - firstPoint.e1rmKg : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.07] pb-6">
        <div>
          <p className="text-xs font-medium text-[#F4B86A]">Strength &amp; Volume Analytics</p>
          <h1 className="text-3xl font-display font-bold tracking-[-0.03em] text-white mt-1">
            Progressive Overload, PRs &amp; Body Metrics
          </h1>
        </div>

        {/* Deload Week Tracker Control */}
        <div className="flex items-center gap-3 maloxie-block px-5 py-3.5">
          <div>
            <p className="text-xs font-medium text-white">
              Deload Week Tracker · 14d Avg RPE{' '}
              <span className="font-mono tabular-nums">{volumeSummaries.avg14Rpe || '—'}</span>
            </p>
            <p className="text-[11px] text-zinc-400">
              {profile?.activeDeloadWeek
                ? 'Active: Target -40% volume & RPE 6–6.5'
                : volumeSummaries.deloadSuggested
                  ? 'Elevated fatigue detected — deload recommended'
                  : 'Fatigue nominal'}
            </p>
          </div>
          <MaloxieButton
            variant={profile?.activeDeloadWeek ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => toggleDeloadWeek(!profile?.activeDeloadWeek)}
          >
            {profile?.activeDeloadWeek ? 'End Deload' : 'Start Deload'}
          </MaloxieButton>
        </div>
      </div>

      {/* Strength Progress Chart + Overload Delta */}
      <div className="maloxie-block p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <HugeiconsIcon icon={ChartLineData01Icon} size={19} className="text-[#E89B3C]" />
            <h2 className="text-lg font-display font-semibold text-white">
              Strength Progress Over Time
            </h2>
            <select
              value={activeExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="maloxie-input px-3.5 py-1.5 text-xs"
            >
              {loggedExerciseNames.length === 0 ? (
                <option value="Barbell Bench Press">Barbell Bench Press</option>
              ) : (
                loggedExerciseNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))
              )}
            </select>
          </div>

          <div className="inline-flex flex-wrap items-center gap-1.5">
            {(
              [
                ['e1rm', `Est. 1RM (${unit})`],
                ['weight', `Top Weight (${unit})`],
                ['volume', `Volume (${unit})`],
              ] as const
            ).map(([key, label]) => (
              <MaloxieButton
                key={key}
                variant={chartMetric === key ? 'primary' : 'subtle'}
                size="xs"
                onClick={() => setChartMetric(key)}
              >
                {label}
              </MaloxieButton>
            ))}
          </div>
        </div>

        {renderStrengthSvg()}

        {overloadDeltaKg !== null && exerciseSeries.length > 1 && (
          <div className="flex flex-wrap items-center gap-6 pt-3 border-t border-white/[0.06] text-xs font-mono tabular-nums text-zinc-400">
            <span>
              First e1RM ({firstPoint.date}):{' '}
              <strong className="text-white">{formatWeight(firstPoint.e1rmKg, unit)}</strong>
            </span>
            <span>
              Latest e1RM ({latestPoint.date}):{' '}
              <strong className="text-white">{formatWeight(latestPoint.e1rmKg, unit)}</strong>
            </span>
            <span className={overloadDeltaKg >= 0 ? 'text-emerald-400' : 'text-[#F4B86A]'}>
              Progressive Overload: {overloadDeltaKg >= 0 ? '+' : ''}
              {fromKg(overloadDeltaKg, unit)} {unit}
            </span>
          </div>
        )}
      </div>

      {/* All-Exercises Progressive Overload Tracker */}
      <div className="maloxie-block p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[#F4B86A]">Multi-Session Progression</p>
            <h2 className="text-lg font-display font-semibold text-white">
              Progressive Overload Tracker
            </h2>
          </div>
          <p className="text-xs text-zinc-400">
            Click any lift row to chart its curve above
          </p>
        </div>

        {overloadTrackerRows.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Log workouts to track top-weight gains, volume progression, and relative strength ratios.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] font-medium text-zinc-400">
                  <th className="py-2.5 pr-4">Exercise</th>
                  <th className="py-2.5 px-3">Muscle</th>
                  <th className="py-2.5 px-3 text-right">Sessions</th>
                  <th className="py-2.5 px-3 text-right">Start Weight</th>
                  <th className="py-2.5 px-3 text-right">Latest Weight</th>
                  <th className="py-2.5 px-3 text-right">Overload</th>
                  <th className="py-2.5 px-3 text-right">Latest Vol</th>
                  <th className="py-2.5 pl-3 text-right">Rel. Strength</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {overloadTrackerRows.map((row) => (
                  <tr
                    key={row.exerciseName}
                    onClick={() => setSelectedExercise(row.exerciseName)}
                    className={`cursor-pointer transition-colors ${
                      activeExercise.toLowerCase() === row.exerciseName.toLowerCase()
                        ? 'bg-[#E89B3C]/10'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <td className="py-2.5 pr-4 font-medium text-white">{row.exerciseName}</td>
                    <td className="py-2.5 px-3 text-zinc-400">{row.muscleGroup}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-400">
                      {row.sessions}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-400">
                      {formatWeight(row.firstTopWeightKg, unit)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-white">
                      {formatWeight(row.latestTopWeightKg, unit)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                        row.weightDeltaKg > 0
                          ? 'text-emerald-400'
                          : row.weightDeltaKg < 0
                            ? 'text-[#F4B86A]'
                            : 'text-zinc-400'
                      }`}
                    >
                      {row.sessions < 2
                        ? 'Baseline'
                        : `${row.weightDeltaKg >= 0 ? '+' : ''}${fromKg(row.weightDeltaKg, unit)} ${unit} (${row.weightDeltaPct >= 0 ? '+' : ''}${row.weightDeltaPct}%)`}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#F4B86A]">
                      {formatVolume(row.latestVolKg, unit)}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-zinc-400">
                      {row.relativeStrength !== null ? `${row.relativeStrength}× BW` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Comparison Between Current and Previous Workout */}
      <div className="maloxie-block p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#F4B86A]">Session-to-Session Delta</p>
            <h2 className="text-lg font-display font-semibold text-white">
              Current vs Previous Workout Comparison
            </h2>
          </div>

          {workouts.length >= 2 && workoutA && workoutB && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={workoutA.id}
                onChange={(e) => setCompareAId(e.target.value)}
                aria-label="Current session"
                className="maloxie-input px-3 py-1.5"
              >
                {workouts.map((w) => (
                  <option key={w.id} value={w.id}>
                    Current: {w.date} · {w.title}
                  </option>
                ))}
              </select>
              <span className="text-zinc-500">vs</span>
              <select
                value={workoutB.id}
                onChange={(e) => setCompareBId(e.target.value)}
                aria-label="Previous session"
                className="maloxie-input px-3 py-1.5"
              >
                {workouts.map((w) => (
                  <option key={w.id} value={w.id}>
                    Previous: {w.date} · {w.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {!workoutComparison || !workoutA || !workoutB ? (
          <p className="text-sm text-zinc-400">
            Log at least 2 workouts to compare current vs previous session volume, RPE, energy, sleep, and exercise lifts.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 py-3 border-y border-white/[0.06] text-xs font-mono tabular-nums">
              <div>
                <p className="font-sans font-medium text-zinc-400">Total Volume</p>
                <p className="text-sm text-white mt-0.5">
                  {formatVolume(workoutA.totalVolumeKg, unit)}{' '}
                  <span className="text-zinc-500">vs {formatVolume(workoutB.totalVolumeKg, unit)}</span>
                </p>
                <p
                  className={
                    workoutComparison.volDeltaKg >= 0 ? 'text-emerald-400' : 'text-[#F4B86A]'
                  }
                >
                  {workoutComparison.volDeltaKg >= 0 ? '+' : ''}
                  {formatVolume(workoutComparison.volDeltaKg, unit)}
                  {workoutComparison.volDeltaPct !== null
                    ? ` (${workoutComparison.volDeltaPct >= 0 ? '+' : ''}${workoutComparison.volDeltaPct}%)`
                    : ''}
                </p>
              </div>
              <div>
                <p className="font-sans font-medium text-zinc-400">Working Sets</p>
                <p className="text-sm text-white mt-0.5">
                  {workoutA.totalSets} <span className="text-zinc-500">vs {workoutB.totalSets}</span>
                </p>
                <p className="text-[#F4B86A]">
                  {workoutComparison.setsDelta >= 0 ? '+' : ''}
                  {workoutComparison.setsDelta} sets
                </p>
              </div>
              <div>
                <p className="font-sans font-medium text-zinc-400">Avg Session RPE</p>
                <p className="text-sm text-white mt-0.5">
                  {workoutComparison.rpeA || '—'}{' '}
                  <span className="text-zinc-500">vs {workoutComparison.rpeB || '—'}</span>
                </p>
              </div>
              <div>
                <p className="font-sans font-medium text-zinc-400">Energy Level</p>
                <p className="text-sm text-white mt-0.5">
                  {workoutA.energyLevel}/10{' '}
                  <span className="text-zinc-500">vs {workoutB.energyLevel}/10</span>
                </p>
              </div>
              <div>
                <p className="font-sans font-medium text-zinc-400">Sleep Previous Night</p>
                <p className="text-sm text-white mt-0.5">
                  {workoutA.sleepHours}h ({workoutA.sleepQuality}/10){' '}
                  <span className="text-zinc-500">
                    vs {workoutB.sleepHours}h ({workoutB.sleepQuality}/10)
                  </span>
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] font-medium text-zinc-400">
                    <th className="py-2 pr-3">Exercise</th>
                    <th className="py-2 px-3 text-right">Current Top</th>
                    <th className="py-2 px-3 text-right">Previous Top</th>
                    <th className="py-2 px-3 text-right">Current Vol</th>
                    <th className="py-2 px-3 text-right">Previous Vol</th>
                    <th className="py-2 pl-3 text-right">Volume Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {workoutComparison.exerciseRows.map((row) => (
                    <tr key={row.name}>
                      <td className="py-2 pr-3 font-medium text-white">{row.name}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-white">
                        {row.hasA ? formatWeight(row.topA, unit) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-zinc-400">
                        {row.hasB ? formatWeight(row.topB, unit) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-[#F4B86A]">
                        {row.hasA ? formatVolume(row.volA, unit) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-zinc-400">
                        {row.hasB ? formatVolume(row.volB, unit) : '—'}
                      </td>
                      <td
                        className={`py-2 pl-3 text-right font-mono tabular-nums ${
                          row.volDeltaKg === null
                            ? 'text-zinc-500'
                            : row.volDeltaKg >= 0
                              ? 'text-emerald-400'
                              : 'text-[#F4B86A]'
                        }`}
                      >
                        {row.volDeltaKg === null
                          ? row.hasA
                            ? 'New in current'
                            : 'Only in previous'
                          : `${row.volDeltaKg >= 0 ? '+' : ''}${formatVolume(row.volDeltaKg, unit)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Weekly Tonnage + Monthly Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weekly Volume Summary & Muscle Breakdown */}
        <div className="lg:col-span-6 maloxie-block p-6 space-y-5">
          <div>
            <p className="text-xs font-medium text-zinc-400">6-Week Trend</p>
            <h2 className="text-lg font-display font-semibold text-white">
              Weekly Training Volume Summary
            </h2>
          </div>
          <div className="grid grid-cols-6 gap-2 items-end h-36 pt-4">
            {volumeSummaries.weeklyBuckets.map((wk) => {
              const pct = Math.max(6, Math.round((wk.volumeKg / maxWeeklyVol) * 100));
              return (
                <div key={wk.label} className="flex flex-col items-center justify-end h-full gap-1.5">
                  <span className="text-[10px] font-mono tabular-nums text-zinc-400">
                    {wk.volumeKg > 0 ? Math.round(fromKg(wk.volumeKg, unit)) : 0}
                  </span>
                  <div
                    style={{ height: `${pct}%` }}
                    className="w-full max-w-[36px] rounded-t-lg bg-gradient-to-t from-[#E89B3C]/50 to-[#F4C77B]"
                  />
                  <span className="text-[10px] font-mono text-zinc-500">{wk.label}</span>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-white/[0.06] space-y-2">
            <p className="text-xs font-medium text-zinc-400">30-Day Volume by Muscle Group</p>
            {MUSCLE_GROUPS.map((mg) => {
              const entry = volumeSummaries.muscleMap[mg];
              const share =
                volumeSummaries.total30Vol > 0
                  ? Math.round((entry.volumeKg / volumeSummaries.total30Vol) * 100)
                  : 0;
              return (
                <div key={mg} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono tabular-nums">
                    <span className="text-zinc-200 font-sans">{mg}</span>
                    <span className="text-zinc-400">
                      {entry.sets} sets · {formatVolume(entry.volumeKg, unit)} ({share}%)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      style={{ width: `${share}%` }}
                      className="h-full bg-[#E89B3C] rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly Progress Overview */}
        <div className="lg:col-span-6 maloxie-block p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400">Monthly Progress Overview</p>
              <h2 className="text-lg font-display font-semibold text-white">
                {monthCalendar.monthLabel}
              </h2>
            </div>
            <HugeiconsIcon icon={Calendar03Icon} size={19} className="text-[#E89B3C]" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-white/[0.06] font-mono tabular-nums">
            <div>
              <p className="text-[11px] font-sans font-medium text-zinc-400">Sessions</p>
              <p className="text-lg font-semibold text-white">{monthCalendar.monthSessions}</p>
            </div>
            <div>
              <p className="text-[11px] font-sans font-medium text-zinc-400">Monthly Volume</p>
              <p className="text-lg font-semibold text-[#F4B86A]">
                {formatVolume(monthCalendar.monthVolumeKg, unit)}
              </p>
              {monthCalendar.momDeltaPct !== null && (
                <p
                  className={`text-[10px] ${
                    monthCalendar.momDeltaPct >= 0 ? 'text-emerald-400' : 'text-[#F4B86A]'
                  }`}
                >
                  {monthCalendar.momDeltaPct >= 0 ? '+' : ''}
                  {monthCalendar.momDeltaPct}% vs last mo
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-sans font-medium text-zinc-400">PRs Hit</p>
              <p className="text-lg font-semibold text-white">{monthCalendar.monthPrsCount}</p>
            </div>
            <div>
              <p className="text-[11px] font-sans font-medium text-zinc-400">Deload Days</p>
              <p className="text-lg font-semibold text-sky-300">
                {monthCalendar.monthDeloadSessions}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-zinc-500">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {monthCalendar.cells.map((cell, idx) => {
              if (!cell.day) return <div key={idx} className="h-11" />;
              const trained = Boolean(cell.data);
              return (
                <div
                  key={cell.iso}
                  title={
                    cell.data
                      ? `${cell.iso}: ${formatVolume(cell.data.volumeKg, unit)} (${cell.data.count} session)`
                      : cell.iso
                  }
                  className={`h-11 rounded-xl border flex flex-col items-center justify-center text-xs font-mono tabular-nums ${
                    cell.data?.isDeload
                      ? 'bg-sky-500/12 border-sky-400/35 text-sky-200'
                      : trained
                        ? 'bg-[#E89B3C]/16 border-[#E89B3C]/45 text-white font-semibold'
                        : 'bg-white/[0.035] border-white/[0.05] text-zinc-500'
                  }`}
                >
                  <span>{cell.day}</span>
                  {trained && (
                    <span className="text-[9px] text-[#F4B86A] leading-none mt-0.5">
                      {cell.data?.isDeload ? 'DL' : 'OK'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-zinc-400">
            Amber tiles indicate completed training days; sky-blue tiles mark deload sessions.
          </p>
        </div>
      </div>

      {/* Personal Records Table */}
      <div className="maloxie-block p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#F4B86A]">Auto-Updated Benchmarks</p>
            <h2 className="text-lg font-display font-semibold text-white">
              Personal Records (PR) Tracker
            </h2>
          </div>
          <HugeiconsIcon icon={Award01Icon} size={19} className="text-[#E89B3C]" />
        </div>

        {prs.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Personal Records update automatically whenever you log a new heaviest lift, estimated 1RM, or set volume.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] font-medium text-zinc-400">
                  <th className="py-2.5 pr-4">Exercise</th>
                  <th className="py-2.5 px-3">Muscle</th>
                  <th className="py-2.5 px-3 text-right">Best Lift</th>
                  <th className="py-2.5 px-3 text-right">Est. 1RM</th>
                  <th className="py-2.5 px-3 text-right">Best Set Volume</th>
                  <th className="py-2.5 pl-3 text-right">Achieved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {prs.map((pr) => (
                  <tr key={pr.id} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-4 font-medium text-white">{pr.exerciseName}</td>
                    <td className="py-2.5 px-3 text-zinc-400">{pr.muscleGroup}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#F4B86A]">
                      {formatWeight(pr.bestWeightKg, unit)} × {pr.bestWeightReps}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-white">
                      {formatWeight(pr.bestEstimated1RMKg, unit)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-400">
                      {formatVolume(pr.bestSetVolumeKg, unit)}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-zinc-400">
                      {pr.achievedAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Weight & Body Measurements Log */}
      <div className="maloxie-block p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Linked Anthropometrics</p>
            <h2 className="text-lg font-display font-semibold text-white">
              Weight &amp; Body Measurements Log
            </h2>
          </div>
          <HugeiconsIcon icon={BodyWeightIcon} size={19} className="text-[#E89B3C]" />
        </div>

        <form onSubmit={handleAddMeasurement} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Date</label>
            <input
              type="date"
              value={mDate}
              onChange={(e) => setMDate(e.target.value)}
              required
              className="w-full maloxie-input px-2.5 py-1.5 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Weight ({unit})
            </label>
            <input
              type="number"
              step="0.1"
              value={mWeight}
              onChange={(e) => setMWeight(e.target.value)}
              placeholder="82.5"
              required
              className="w-full maloxie-input px-2.5 py-1.5 text-xs font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Body Fat %</label>
            <input
              type="number"
              step="0.1"
              value={mBodyFat}
              onChange={(e) => setMBodyFat(e.target.value)}
              placeholder="14.2"
              className="w-full maloxie-input px-2.5 py-1.5 text-xs font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Waist ({lengthUnitLabel(unit)})
            </label>
            <input
              type="number"
              step="0.1"
              value={mWaist}
              onChange={(e) => setMWaist(e.target.value)}
              className="w-full maloxie-input px-2.5 py-1.5 text-xs font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Chest ({lengthUnitLabel(unit)})
            </label>
            <input
              type="number"
              step="0.1"
              value={mChest}
              onChange={(e) => setMChest(e.target.value)}
              className="w-full maloxie-input px-2.5 py-1.5 text-xs font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Arms ({lengthUnitLabel(unit)})
            </label>
            <input
              type="number"
              step="0.1"
              value={mArms}
              onChange={(e) => setMArms(e.target.value)}
              className="w-full maloxie-input px-2.5 py-1.5 text-xs font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Thighs ({lengthUnitLabel(unit)})
            </label>
            <input
              type="number"
              step="0.1"
              value={mThighs}
              onChange={(e) => setMThighs(e.target.value)}
              className="w-full maloxie-input px-2.5 py-1.5 text-xs font-mono tabular-nums"
            />
          </div>
          <div className="col-span-2 sm:col-span-3 lg:col-span-6">
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Check-In Notes
            </label>
            <input
              type="text"
              value={mNotes}
              onChange={(e) => setMNotes(e.target.value)}
              placeholder="Morning fasted weigh-in, hydration, recovery notes..."
              maxLength={400}
              className="w-full maloxie-input px-3 py-1.5 text-xs placeholder:text-zinc-500"
            />
          </div>
          <div className="col-span-2 sm:col-span-1 lg:col-span-2">
            <MaloxieButton
              type="submit"
              variant="primary"
              size="md"
              disabled={measSaving}
              className="w-full"
            >
              {measSaving ? 'Saving...' : 'Log Check-In'}
            </MaloxieButton>
          </div>
        </form>

        {measurements.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-white/[0.06]">
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-2">
                Bodyweight Trend ({unit})
              </p>
              {renderBodyweightSvg()}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] font-medium text-zinc-400">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 px-3 text-right">Weight</th>
                    <th className="py-2 px-3 text-right">BF %</th>
                    <th className="py-2 px-3 text-right">Waist</th>
                    <th className="py-2 px-3 text-right">Chest</th>
                    <th className="py-2 px-3 text-right">Arms</th>
                    <th className="py-2 px-3 text-right">Thighs</th>
                    <th className="py-2 px-3">Notes</th>
                    <th className="py-2 pl-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {measurements.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 pr-3 font-mono text-white">{m.date}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-[#F4B86A]">
                        {formatWeight(m.bodyweightKg, unit)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-zinc-400">
                        {m.bodyFatPct ? `${m.bodyFatPct}%` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-zinc-400">
                        {m.waistCm ? `${fromCm(m.waistCm, unit)} ${lengthUnitLabel(unit)}` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-zinc-400">
                        {m.chestCm ? `${fromCm(m.chestCm, unit)} ${lengthUnitLabel(unit)}` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-zinc-400">
                        {m.armsCm ? `${fromCm(m.armsCm, unit)} ${lengthUnitLabel(unit)}` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-zinc-400">
                        {m.thighsCm ? `${fromCm(m.thighsCm, unit)} ${lengthUnitLabel(unit)}` : '—'}
                      </td>
                      <td className="py-2 px-3 text-zinc-400 max-w-[200px] truncate">
                        {m.notes || '—'}
                      </td>
                      <td className="py-2 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => deleteMeasurement(m.id)}
                          className="text-zinc-500 hover:text-red-400 cursor-pointer"
                        >
                          <HugeiconsIcon icon={Delete02Icon} size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Injury / Pain Notes Log */}
      <div className="maloxie-block p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Recovery &amp; Joint Monitoring</p>
            <h2 className="text-lg font-display font-semibold text-white">
              Injury &amp; Pain Notes History
            </h2>
          </div>
          <HugeiconsIcon icon={Activity01Icon} size={19} className="text-[#E89B3C]" />
        </div>

        {injuryHistory.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No pain or injury flags recorded. Any joint tightness or pain notes entered in the workout logger will appear here chronologically.
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {injuryHistory.map((item) => (
              <div
                key={item.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <p className="font-medium text-white">
                    {item.title}
                    {item.isDeload ? ' · Deload' : ''}
                  </p>
                  <p className="text-[#F4B86A]">{item.injuryNotes}</p>
                </div>
                <p className="font-mono tabular-nums text-zinc-400 shrink-0">
                  {item.date} · Avg RPE {item.avgRpe || '—'} · Sleep {item.sleepHours}h
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressAnalyticsView;
