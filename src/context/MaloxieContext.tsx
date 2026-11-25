import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { PRESET_EXERCISES, PRESET_TEMPLATES } from '../data/presets';
import { calculateE1RM, slugifyExercise } from '../utils/units';
import type {
  AiProgramSession,
  AiTrainingProgram,
  BodyMeasurement,
  ExerciseItem,
  MuscleGroup,
  PersonalRecord,
  SplitType,
  TemplateExercise,
  TrainingGoal,
  UserProfile,
  WeightUnit,
  WorkoutLog,
  WorkoutTemplate,
} from '../types/training';

interface MaloxieContextValue {
  user: User | null;
  authReady: boolean;
  dataLoading: boolean;
  profile: UserProfile | null;
  unit: WeightUnit;
  workouts: WorkoutLog[];
  templates: WorkoutTemplate[];
  exercises: ExerciseItem[];
  prs: PersonalRecord[];
  measurements: BodyMeasurement[];
  goals: TrainingGoal[];
  programs: AiTrainingProgram[];
  actionError: string | null;
  clearActionError: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  toggleUnit: (nextUnit: WeightUnit) => Promise<void>;
  toggleDeloadWeek: (active: boolean, label?: string) => Promise<void>;
  saveWorkout: (
    payload: Omit<WorkoutLog, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<{ workoutId: string; newPrExercises: string[] }>;
  deleteWorkout: (workoutId: string) => Promise<void>;
  saveTemplate: (payload: {
    name: string;
    splitType: SplitType;
    description?: string;
    source: 'preset' | 'custom' | 'ai';
    exercises: TemplateExercise[];
  }) => Promise<string>;
  deleteTemplate: (templateId: string) => Promise<void>;
  addCustomExercise: (payload: {
    name: string;
    muscleGroup: MuscleGroup;
    equipment: string;
    cues?: string;
  }) => Promise<void>;
  deleteExercise: (exerciseId: string) => Promise<void>;
  addMeasurement: (payload: Omit<BodyMeasurement, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  deleteMeasurement: (measurementId: string) => Promise<void>;
  saveGoal: (payload: {
    title: string;
    exerciseName: string;
    metricType: TrainingGoal['metricType'];
    targetValue: number;
    startValue: number;
    targetDate: string;
  }) => Promise<void>;
  updateGoalStatus: (goalId: string, status: 'active' | 'achieved') => Promise<void>;
  deleteGoal: (goalId: string) => Promise<void>;
  saveAiProgram: (program: Omit<AiTrainingProgram, 'id' | 'userId' | 'createdAt'>) => Promise<string>;
  applyProgramSessionsAsTemplates: (sessions: AiProgramSession[], programTitle: string) => Promise<number>;
  deleteProgram: (programId: string) => Promise<void>;
  exportTrainingJson: () => void;
}

const MaloxieContext = createContext<MaloxieContextValue | undefined>(undefined);

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const GUEST_STORAGE_KEY = 'maloxie_guest_workspace_v1';

interface GuestWorkspaceData {
  unit: WeightUnit;
  activeDeloadWeek: boolean;
  deloadLabel: string;
  workouts: WorkoutLog[];
  templates: WorkoutTemplate[];
  exercises: ExerciseItem[];
  prs: PersonalRecord[];
  measurements: BodyMeasurement[];
  goals: TrainingGoal[];
  programs: AiTrainingProgram[];
}

function defaultGuestWorkspace(): GuestWorkspaceData {
  return {
    unit: 'kg',
    activeDeloadWeek: false,
    deloadLabel: 'Standard Accumulation',
    workouts: [],
    templates: PRESET_TEMPLATES.map((t) => ({
      id: t.id,
      userId: 'guest',
      name: t.name,
      splitType: t.splitType,
      description: t.description,
      source: 'preset',
      exercises: t.exercises,
    })),
    exercises: PRESET_EXERCISES.map((e) => ({
      id: e.id,
      userId: 'guest',
      name: e.name,
      muscleGroup: e.muscleGroup,
      equipment: e.equipment,
      cues: e.cues,
      isCustom: false,
    })),
    prs: [],
    measurements: [],
    goals: [],
    programs: [],
  };
}

function loadGuestWorkspace(): GuestWorkspaceData {
  const defaults = defaultGuestWorkspace();
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<GuestWorkspaceData>;
    return {
      ...defaults,
      ...parsed,
      templates: parsed.templates?.length ? parsed.templates : defaults.templates,
      exercises: parsed.exercises?.length ? parsed.exercises : defaults.exercises,
    };
  } catch {
    return defaults;
  }
}

function persistGuestWorkspace(data: GuestWorkspaceData) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota issues
  }
}

export function MaloxieProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  const [guestState, setGuestState] = useState<GuestWorkspaceData>(() => loadGuestWorkspace());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [goals, setGoals] = useState<TrainingGoal[]>([]);
  const [programs, setPrograms] = useState<AiTrainingProgram[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const clearActionError = useCallback(() => setActionError(null), []);

  const updateGuestState = useCallback(
    (updater: (prev: GuestWorkspaceData) => GuestWorkspaceData) => {
      setGuestState((prev) => {
        const next = updater(prev);
        persistGuestWorkspace(next);
        return next;
      });
    },
    []
  );

  const bootstrapUserWorkspace = useCallback(async (firebaseUser: User) => {
    const userPath = `users/${firebaseUser.uid}`;
    const userRef = doc(db, 'users', firebaseUser.uid);

    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const displayName = (firebaseUser.displayName || 'Maloxie Athlete').slice(0, 120);
        const email = (firebaseUser.email || 'athlete@maloxie.app').slice(0, 200);
        await setDoc(userRef, {
          uid: firebaseUser.uid,
          displayName,
          email,
          preferredUnit: 'kg',
          activeDeloadWeek: false,
          deloadLabel: 'Standard Accumulation',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Seed pre-loaded exercise library and starter Push/Pull/Legs/Full Body templates
        const batch = writeBatch(db);
        for (const ex of PRESET_EXERCISES) {
          const exRef = doc(db, 'users', firebaseUser.uid, 'exercises', ex.id);
          batch.set(exRef, {
            userId: firebaseUser.uid,
            name: ex.name,
            muscleGroup: ex.muscleGroup,
            equipment: ex.equipment,
            cues: ex.cues,
            isCustom: false,
            createdAt: serverTimestamp(),
          });
        }
        for (const tpl of PRESET_TEMPLATES) {
          const tplRef = doc(db, 'users', firebaseUser.uid, 'templates', tpl.id);
          batch.set(tplRef, {
            userId: firebaseUser.uid,
            name: tpl.name,
            splitType: tpl.splitType,
            description: tpl.description,
            source: 'preset',
            exercises: tpl.exercises,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        setDataLoading(true);
        try {
          await bootstrapUserWorkspace(nextUser);
        } catch (err) {
          setActionError(err instanceof Error ? err.message : 'Failed to initialize profile.');
        }
      } else {
        const guest = loadGuestWorkspace();
        setGuestState(guest);
        setProfile({
          uid: 'guest',
          displayName: 'Athlete',
          email: '',
          preferredUnit: guest.unit,
          activeDeloadWeek: guest.activeDeloadWeek,
          deloadLabel: guest.deloadLabel,
        });
        setWorkouts(guest.workouts);
        setTemplates(guest.templates);
        setExercises(guest.exercises);
        setPrs(guest.prs);
        setMeasurements(guest.measurements);
        setGoals(guest.goals);
        setPrograms(guest.programs);
        setDataLoading(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [bootstrapUserWorkspace]);

  // Keep reactive state synced to localStorage guest workspace when signed out
  useEffect(() => {
    if (!authReady || user) return;
    setProfile({
      uid: 'guest',
      displayName: 'Athlete',
      email: '',
      preferredUnit: guestState.unit,
      activeDeloadWeek: guestState.activeDeloadWeek,
      deloadLabel: guestState.deloadLabel,
    });
    setWorkouts(guestState.workouts);
    setTemplates(guestState.templates);
    setExercises(guestState.exercises);
    setPrs(guestState.prs);
    setMeasurements(guestState.measurements);
    setGoals(guestState.goals);
    setPrograms(guestState.programs);
  }, [authReady, guestState, user]);

  useEffect(() => {
    if (!authReady || !user) return;

    const uid = user.uid;
    setDataLoading(true);

    const unsubProfile = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
        setDataLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}`)
    );

    const unsubWorkouts = onSnapshot(
      query(collection(db, 'users', uid, 'workouts'), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WorkoutLog);
        list.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
        setWorkouts(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/workouts`)
    );

    const unsubTemplates = onSnapshot(
      query(collection(db, 'users', uid, 'templates'), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WorkoutTemplate);
        setTemplates(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/templates`)
    );

    const unsubExercises = onSnapshot(
      query(collection(db, 'users', uid, 'exercises'), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ExerciseItem);
        list.sort((a, b) => a.name.localeCompare(b.name));
        setExercises(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/exercises`)
    );

    const unsubPrs = onSnapshot(
      query(collection(db, 'users', uid, 'prs'), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PersonalRecord);
        list.sort((a, b) => b.bestEstimated1RMKg - a.bestEstimated1RMKg);
        setPrs(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/prs`)
    );

    const unsubMeasurements = onSnapshot(
      query(collection(db, 'users', uid, 'measurements'), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BodyMeasurement);
        list.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
        setMeasurements(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/measurements`)
    );

    const unsubGoals = onSnapshot(
      query(collection(db, 'users', uid, 'goals'), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingGoal);
        list.sort((a, b) => a.targetDate.localeCompare(b.targetDate));
        setGoals(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/goals`)
    );

    const unsubPrograms = onSnapshot(
      query(collection(db, 'users', uid, 'programs'), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AiTrainingProgram);
        setPrograms(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/programs`)
    );

    return () => {
      unsubProfile();
      unsubWorkouts();
      unsubTemplates();
      unsubExercises();
      unsubPrs();
      unsubMeasurements();
      unsubGoals();
      unsubPrograms();
    };
  }, [authReady, user]);

  const signInWithGoogle = useCallback(async () => {
    setActionError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setActionError(message);
    }
  }, []);

  const signOut = useCallback(async () => {
    setActionError(null);
    await firebaseSignOut(auth);
  }, []);

  const toggleUnit = useCallback(
    async (nextUnit: WeightUnit) => {
      if (!user) {
        updateGuestState((prev) => ({ ...prev, unit: nextUnit }));
        return;
      }
      const path = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          preferredUnit: nextUnit,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [updateGuestState, user]
  );

  const toggleDeloadWeek = useCallback(
    async (active: boolean, label?: string) => {
      const resolvedLabel = (
        label || (active ? 'Active Deload Week (-40% Volume)' : 'Standard Accumulation')
      ).slice(0, 80);
      if (!user) {
        updateGuestState((prev) => ({
          ...prev,
          activeDeloadWeek: active,
          deloadLabel: resolvedLabel,
        }));
        return;
      }
      const path = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          activeDeloadWeek: active,
          deloadLabel: resolvedLabel,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [updateGuestState, user]
  );

  const saveWorkout = useCallback(
    async (
      payload: Omit<WorkoutLog, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
      existingId?: string
    ): Promise<{ workoutId: string; newPrExercises: string[] }> => {
      const workoutId = existingId || makeId('wk');

      // Compute PR updates first (used by both guest and cloud paths)
      const groupedBySlug = new Map<
        string,
        {
          exerciseName: string;
          muscleGroup: MuscleGroup;
          bestWeightKg: number;
          bestWeightReps: number;
          bestE1RMKg: number;
          bestSetVolKg: number;
        }
      >();

      for (const ex of payload.exercises) {
        if (!ex.exerciseName.trim() || ex.sets.length === 0) continue;
        const prSlug = slugifyExercise(ex.exerciseName);
        if (!prSlug) continue;

        const existingGroup = groupedBySlug.get(prSlug) ?? {
          exerciseName: ex.exerciseName.trim().slice(0, 100),
          muscleGroup: ex.muscleGroup,
          bestWeightKg: 0,
          bestWeightReps: 1,
          bestE1RMKg: 0,
          bestSetVolKg: 0,
        };

        for (const s of ex.sets) {
          if (s.reps <= 0) continue;
          const e1rm = calculateE1RM(s.weightKg, s.reps);
          const setVol = s.weightKg * s.reps;
          if (
            s.weightKg > existingGroup.bestWeightKg ||
            (s.weightKg === existingGroup.bestWeightKg && s.reps > existingGroup.bestWeightReps)
          ) {
            existingGroup.bestWeightKg = s.weightKg;
            existingGroup.bestWeightReps = s.reps;
          }
          if (e1rm > existingGroup.bestE1RMKg) existingGroup.bestE1RMKg = e1rm;
          if (setVol > existingGroup.bestSetVolKg) existingGroup.bestSetVolKg = setVol;
        }

        groupedBySlug.set(prSlug, existingGroup);
      }

      if (!user) {
        const cleanWorkout: WorkoutLog = {
          id: workoutId,
          userId: 'guest',
          date: payload.date,
          title: payload.title.trim().slice(0, 120) || 'Strength Session',
          templateName: payload.templateName?.trim().slice(0, 100),
          isDeload: Boolean(payload.isDeload),
          energyLevel: Math.min(10, Math.max(1, Math.round(payload.energyLevel))),
          sleepHours: Math.min(24, Math.max(0, Number(payload.sleepHours))),
          sleepQuality: Math.min(10, Math.max(1, Math.round(payload.sleepQuality))),
          injuryNotes: payload.injuryNotes?.trim().slice(0, 600),
          warmupItems: payload.warmupItems.slice(0, 20),
          exercises: payload.exercises.slice(0, 30),
          totalVolumeKg: Number(payload.totalVolumeKg.toFixed(2)),
          totalSets: Math.round(payload.totalSets),
        };
        const newPrExercises: string[] = [];
        updateGuestState((prev) => {
          const nextWorkouts = existingId
            ? prev.workouts.map((w) => (w.id === existingId ? cleanWorkout : w))
            : [cleanWorkout, ...prev.workouts];
          nextWorkouts.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

          const nextPrs = [...prev.prs];
          for (const [prSlug, agg] of groupedBySlug.entries()) {
            if (agg.bestWeightKg <= 0 && agg.bestE1RMKg <= 0) continue;
            const idx = nextPrs.findIndex((p) => p.id === prSlug);
            if (idx === -1) {
              newPrExercises.push(agg.exerciseName);
              nextPrs.push({
                id: prSlug,
                userId: 'guest',
                exerciseName: agg.exerciseName,
                muscleGroup: agg.muscleGroup,
                bestWeightKg: Number(agg.bestWeightKg.toFixed(2)),
                bestWeightReps: Math.round(agg.bestWeightReps),
                bestEstimated1RMKg: Number(agg.bestE1RMKg.toFixed(2)),
                bestSetVolumeKg: Number(agg.bestSetVolKg.toFixed(2)),
                achievedAt: payload.date,
                workoutId,
              });
            } else {
              const exPr = nextPrs[idx];
              const beatWeight = agg.bestWeightKg > exPr.bestWeightKg;
              const beatE1RM = agg.bestE1RMKg > exPr.bestEstimated1RMKg;
              const beatSetVol = agg.bestSetVolKg > exPr.bestSetVolumeKg;
              if (beatWeight || beatE1RM || beatSetVol) {
                newPrExercises.push(agg.exerciseName);
                nextPrs[idx] = {
                  ...exPr,
                  bestWeightKg: Number(Math.max(exPr.bestWeightKg, agg.bestWeightKg).toFixed(2)),
                  bestWeightReps: beatWeight ? Math.round(agg.bestWeightReps) : exPr.bestWeightReps,
                  bestEstimated1RMKg: Number(Math.max(exPr.bestEstimated1RMKg, agg.bestE1RMKg).toFixed(2)),
                  bestSetVolumeKg: Number(Math.max(exPr.bestSetVolumeKg, agg.bestSetVolKg).toFixed(2)),
                  achievedAt: payload.date,
                  workoutId,
                };
              }
            }
          }
          nextPrs.sort((a, b) => b.bestEstimated1RMKg - a.bestEstimated1RMKg);
          return { ...prev, workouts: nextWorkouts, prs: nextPrs };
        });
        return { workoutId, newPrExercises };
      }

      const path = `users/${user.uid}/workouts/${workoutId}`;

      const cleanDoc: Record<string, unknown> = {
        userId: user.uid,
        date: payload.date,
        title: payload.title.trim().slice(0, 120) || 'Strength Session',
        isDeload: Boolean(payload.isDeload),
        energyLevel: Math.min(10, Math.max(1, Math.round(payload.energyLevel))),
        sleepHours: Math.min(24, Math.max(0, Number(payload.sleepHours))),
        sleepQuality: Math.min(10, Math.max(1, Math.round(payload.sleepQuality))),
        warmupItems: payload.warmupItems.slice(0, 20),
        exercises: payload.exercises.slice(0, 30),
        totalVolumeKg: Number(payload.totalVolumeKg.toFixed(2)),
        totalSets: Math.round(payload.totalSets),
        updatedAt: serverTimestamp(),
      };

      if (payload.templateName && payload.templateName.trim()) {
        cleanDoc.templateName = payload.templateName.trim().slice(0, 100);
      }
      if (payload.injuryNotes && payload.injuryNotes.trim()) {
        cleanDoc.injuryNotes = payload.injuryNotes.trim().slice(0, 600);
      }

      try {
        if (existingId) {
          await updateDoc(doc(db, 'users', user.uid, 'workouts', workoutId), cleanDoc);
        } else {
          await setDoc(doc(db, 'users', user.uid, 'workouts', workoutId), {
            ...cleanDoc,
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
      }

      // Auto-update Personal Records (PRs) using groupedBySlug computed above
      const newPrExercises: string[] = [];
      for (const [prSlug, agg] of groupedBySlug.entries()) {
        if (agg.bestWeightKg <= 0 && agg.bestE1RMKg <= 0) continue;

        const existingPr = prs.find((p) => p.id === prSlug);
        const prPath = `users/${user.uid}/prs/${prSlug}`;

        if (!existingPr) {
          newPrExercises.push(agg.exerciseName);
          try {
            await setDoc(doc(db, 'users', user.uid, 'prs', prSlug), {
              userId: user.uid,
              exerciseName: agg.exerciseName,
              muscleGroup: agg.muscleGroup,
              bestWeightKg: Number(agg.bestWeightKg.toFixed(2)),
              bestWeightReps: Math.round(agg.bestWeightReps),
              bestEstimated1RMKg: Number(agg.bestE1RMKg.toFixed(2)),
              bestSetVolumeKg: Number(agg.bestSetVolKg.toFixed(2)),
              achievedAt: payload.date,
              workoutId,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, prPath);
          }
        } else {
          const beatWeight = agg.bestWeightKg > existingPr.bestWeightKg;
          const beatE1RM = agg.bestE1RMKg > existingPr.bestEstimated1RMKg;
          const beatSetVol = agg.bestSetVolKg > existingPr.bestSetVolumeKg;

          if (beatWeight || beatE1RM || beatSetVol) {
            newPrExercises.push(agg.exerciseName);
            try {
              await updateDoc(doc(db, 'users', user.uid, 'prs', prSlug), {
                bestWeightKg: Number(Math.max(existingPr.bestWeightKg, agg.bestWeightKg).toFixed(2)),
                bestWeightReps: beatWeight ? Math.round(agg.bestWeightReps) : existingPr.bestWeightReps,
                bestEstimated1RMKg: Number(Math.max(existingPr.bestEstimated1RMKg, agg.bestE1RMKg).toFixed(2)),
                bestSetVolumeKg: Number(Math.max(existingPr.bestSetVolumeKg, agg.bestSetVolKg).toFixed(2)),
                achievedAt: payload.date,
                workoutId,
                updatedAt: serverTimestamp(),
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, prPath);
            }
          }
        }
      }

      return { workoutId, newPrExercises };
    },
    [prs, updateGuestState, user]
  );

  const deleteWorkout = useCallback(
    async (workoutId: string) => {
      if (!user) {
        updateGuestState((prev) => ({
          ...prev,
          workouts: prev.workouts.filter((w) => w.id !== workoutId),
        }));
        return;
      }
      const path = `users/${user.uid}/workouts/${workoutId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'workouts', workoutId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [updateGuestState, user]
  );

  const saveTemplate = useCallback(
    async (payload: {
      name: string;
      splitType: SplitType;
      description?: string;
      source: 'preset' | 'custom' | 'ai';
      exercises: TemplateExercise[];
    }) => {
      const id = makeId('tpl');
      if (!user) {
        updateGuestState((prev) => ({
          ...prev,
          templates: [
            {
              id,
              userId: 'guest',
              name: payload.name.trim().slice(0, 100),
              splitType: payload.splitType,
              description: payload.description?.trim().slice(0, 300),
              source: payload.source,
              exercises: payload.exercises.slice(0, 25),
            },
            ...prev.templates,
          ],
        }));
        return id;
      }
      const path = `users/${user.uid}/templates/${id}`;
      const docData: Record<string, unknown> = {
        userId: user.uid,
        name: payload.name.trim().slice(0, 100),
        splitType: payload.splitType,
        source: payload.source,
        exercises: payload.exercises.slice(0, 25),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (payload.description && payload.description.trim()) {
        docData.description = payload.description.trim().slice(0, 300);
      }
      try {
        await setDoc(doc(db, 'users', user.uid, 'templates', id), docData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
      return id;
    },
    [updateGuestState, user]
  );

  const deleteTemplate = useCallback(
    async (templateId: string) => {
      if (!user) {
        updateGuestState((prev) => ({
          ...prev,
          templates: prev.templates.filter((t) => t.id !== templateId),
        }));
        return;
      }
      const path = `users/${user.uid}/templates/${templateId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'templates', templateId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [updateGuestState, user]
  );

  const addCustomExercise = useCallback(
    async (payload: {
      name: string;
      muscleGroup: MuscleGroup;
      equipment: string;
      cues?: string;
    }) => {
      const id = makeId('ex');
      if (!user) {
        updateGuestState((prev) => ({
          ...prev,
          exercises: [
            ...prev.exercises,
            {
              id,
              userId: 'guest',
              name: payload.name.trim().slice(0, 100),
              muscleGroup: payload.muscleGroup,
              equipment: payload.equipment.trim().slice(0, 60) || 'Barbell',
              cues: payload.cues?.trim().slice(0, 400),
              isCustom: true,
            },
          ].sort((a, b) => a.name.localeCompare(b.name)),
        }));
        return;
      }
      const path = `users/${user.uid}/exercises/${id}`;
      const docData: Record<string, unknown> = {
        userId: user.uid,
        name: payload.name.trim().slice(0, 100),
        muscleGroup: payload.muscleGroup,
        equipment: payload.equipment.trim().slice(0, 60) || 'Barbell',
        isCustom: true,
        createdAt: serverTimestamp(),
      };
      if (payload.cues && payload.cues.trim()) {
        docData.cues = payload.cues.trim().slice(0, 400);
      }
      try {
        await setDoc(doc(db, 'users', user.uid, 'exercises', id), docData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [updateGuestState, user]
  );

  const deleteExercise = useCallback(
    async (exerciseId: string) => {
      if (!user) {
        updateGuestState((prev) => ({
          ...prev,
          exercises: prev.exercises.filter((e) => e.id !== exerciseId),
        }));
        return;
      }
      const path = `users/${user.uid}/exercises/${exerciseId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'exercises', exerciseId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [updateGuestState, user]
  );

  const addMeasurement = useCallback(
    async (payload: Omit<BodyMeasurement, 'id' | 'userId' | 'createdAt'>) => {
      const id = makeId('meas');
      if (!user) {
        updateGuestState((prev) => ({
          ...prev,
          measurements: [
            {
              id,
              userId: 'guest',
              date: payload.date,
              bodyweightKg: Number(payload.bodyweightKg.toFixed(2)),
              bodyFatPct: payload.bodyFatPct && payload.bodyFatPct >= 2 ? Number(payload.bodyFatPct.toFixed(1)) : undefined,
              waistCm: payload.waistCm && payload.waistCm > 0 ? Number(payload.waistCm.toFixed(1)) : undefined,
              chestCm: payload.chestCm && payload.chestCm > 0 ? Number(payload.chestCm.toFixed(1)) : undefined,
              armsCm: payload.armsCm && payload.armsCm > 0 ? Number(payload.armsCm.toFixed(1)) : undefined,
              thighsCm: payload.thighsCm && payload.thighsCm > 0 ? Number(payload.thighsCm.toFixed(1)) : undefined,
              notes: payload.notes?.trim().slice(0, 400),
            },
            ...prev.measurements,
          ].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0)),
        }));
        return;
      }
      const path = `users/${user.uid}/measurements/${id}`;
      const docData: Record<string, unknown> = {
        userId: user.uid,
        date: payload.date,
        bodyweightKg: Number(payload.bodyweightKg.toFixed(2)),
        createdAt: serverTimestamp(),
      };
      if (payload.bodyFatPct && payload.bodyFatPct >= 2) docData.bodyFatPct = Number(payload.bodyFatPct.toFixed(1));
      if (payload.waistCm && payload.waistCm > 0) docData.waistCm = Number(payload.waistCm.toFixed(1));
      if (payload.chestCm && payload.chestCm > 0) docData.chestCm = Number(payload.chestCm.toFixed(1));
      if (payload.armsCm && payload.armsCm > 0) docData.armsCm = Number(payload.armsCm.toFixed(1));
      if (payload.thighsCm && payload.thighsCm > 0) docData.thighsCm = Number(payload.thighsCm.toFixed(1));
      if (payload.notes && payload.notes.trim()) docData.notes = payload.notes.trim().slice(0, 400);

      try {
        await setDoc(doc(db, 'users', user.uid, 'measurements', id), docData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [updateGuestState, user]
  );

  const deleteMeasurement = useCallback(
    async (measurementId: string) => {
      if (!user) {
        updateGuestState((prev) => ({
          ...prev,
          measurements: prev.measurements.filter((m) => m.id !== measurementId),
        }));
        return;
      }
      const path = `users/${user.uid}/measurements/${measurementId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'measurements', measurementId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [updateGuestState, user]
  );

  const saveGoal = useCallback(
    async (payload: {
      title: string;
      exerciseName: string;
      metricType: TrainingGoal['metricType'];
      targetValue: number;
      startValue: number;
      targetDate: string;
    }) => {
      const id = makeId('goal');
      if (!user) {
        updateGuestState((prev) => ({
          ...prev,
          goals: [
            ...prev.goals,
            {
              id,
              userId: 'guest',
              title: payload.title.trim().slice(0, 120),
              exerciseName: payload.exerciseName.trim().slice(0, 100),
              metricType: payload.metricType,
              targetValue: Number(payload.targetValue.toFixed(2)),
              startValue: Number(payload.startValue.toFixed(2)),
              targetDate: payload.targetDate,
              status: 'active' as const,
            },
          ].sort((a, b) => a.targetDate.localeCompare(b.targetDate)),
        }));
        return;
      }
      const path = `users/${user.uid}/goals/${id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'goals', id), {
          userId: user.uid,
          title: payload.title.trim().slice(0, 120),
          exerciseName: payload.exerciseName.trim().slice(0, 100),
          metricType: payload.metricType,
          targetValue: Number(payload.targetValue.toFixed(2)),
          startValue: Number(payload.startValue.toFixed(2)),
          targetDate: payload.targetDate,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [updateGuestState, user]
  );

  const updateGoalStatus = useCallback(
    async (goalId: string, status: 'active' | 'achieved') => {
      if (!user) {
        updateGuestState((prev) => ({
          ...prev,
          goals: prev.goals.map((g) => (g.id === goalId ? { ...g, status } : g)),
        }));
        return;
      }
      const path = `users/${user.uid}/goals/${goalId}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'goals', goalId), {
          status,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [updateGuestState, user]
  );

  const deleteGoal = useCallback(
    async (goalId: string) => {
      if (!user) {
        updateGuestState((prev) => ({
          ...prev,
          goals: prev.goals.filter((g) => g.id !== goalId),
        }));
        return;
      }
      const path = `users/${user.uid}/goals/${goalId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'goals', goalId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [updateGuestState, user]
  );

  const saveAiProgram = useCallback(
    async (program: Omit<AiTrainingProgram, 'id' | 'userId' | 'createdAt'>) => {
      const id = makeId('prog');
      if (!user) {
        updateGuestState((prev) => ({
          ...prev,
          programs: [
            {
              id,
              userId: 'guest',
              title: program.title.slice(0, 120),
              focus: program.focus.slice(0, 240),
              durationWeeks: Math.min(12, Math.max(1, Math.round(program.durationWeeks))),
              deloadWeekNumber: Math.min(12, Math.max(0, Math.round(program.deloadWeekNumber))),
              weeks: program.weeks.slice(0, 12),
            },
            ...prev.programs,
          ],
        }));
        return id;
      }
      const path = `users/${user.uid}/programs/${id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'programs', id), {
          userId: user.uid,
          title: program.title.slice(0, 120),
          focus: program.focus.slice(0, 240),
          durationWeeks: Math.min(12, Math.max(1, Math.round(program.durationWeeks))),
          deloadWeekNumber: Math.min(12, Math.max(0, Math.round(program.deloadWeekNumber))),
          weeks: program.weeks.slice(0, 12),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
      return id;
    },
    [updateGuestState, user]
  );

  const applyProgramSessionsAsTemplates = useCallback(
    async (sessions: AiProgramSession[], programTitle: string) => {
      if (!user) {
        const added: WorkoutTemplate[] = sessions.slice(0, 7).map((s) => ({
          id: makeId('tpl_ai'),
          userId: 'guest',
          name: `${s.name}`.slice(0, 100),
          splitType: s.splitType || 'Custom',
          description: `AI Program (${programTitle}): ${s.description}`.slice(0, 300),
          source: 'ai',
          exercises: s.exercises.slice(0, 25).map((e) => ({
            name: e.name,
            muscleGroup: e.muscleGroup,
            targetSets: e.targetSets,
            targetReps: e.targetReps,
            restSeconds: e.restSeconds,
          })),
        }));
        updateGuestState((prev) => ({
          ...prev,
          templates: [...added, ...prev.templates],
        }));
        return added.length;
      }
      const batch = writeBatch(db);
      let count = 0;
      for (const s of sessions.slice(0, 7)) {
        const id = makeId('tpl_ai');
        batch.set(doc(db, 'users', user.uid, 'templates', id), {
          userId: user.uid,
          name: `${s.name}`.slice(0, 100),
          splitType: s.splitType || 'Custom',
          description: `AI Program (${programTitle}): ${s.description}`.slice(0, 300),
          source: 'ai',
          exercises: s.exercises.slice(0, 25).map((e) => ({
            name: e.name,
            muscleGroup: e.muscleGroup,
            targetSets: e.targetSets,
            targetReps: e.targetReps,
            restSeconds: e.restSeconds,
          })),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        count += 1;
      }
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/templates`);
      }
      return count;
    },
    [updateGuestState, user]
  );

  const deleteProgram = useCallback(
    async (programId: string) => {
      if (!user) {
        updateGuestState((prev) => ({
          ...prev,
          programs: prev.programs.filter((p) => p.id !== programId),
        }));
        return;
      }
      const path = `users/${user.uid}/programs/${programId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'programs', programId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [updateGuestState, user]
  );

  const exportTrainingJson = useCallback(() => {
    const bundle = {
      exportedAt: new Date().toISOString(),
      app: 'Maloxie',
      profile,
      workouts,
      prs,
      templates,
      exercises,
      measurements,
      goals,
      programs,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maloxie-training-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exercises, goals, measurements, profile, programs, prs, templates, workouts]);

  const unit: WeightUnit = profile?.preferredUnit ?? 'kg';

  const value = useMemo<MaloxieContextValue>(
    () => ({
      user,
      authReady,
      dataLoading,
      profile,
      unit,
      workouts,
      templates,
      exercises,
      prs,
      measurements,
      goals,
      programs,
      actionError,
      clearActionError,
      signInWithGoogle,
      signOut,
      toggleUnit,
      toggleDeloadWeek,
      saveWorkout,
      deleteWorkout,
      saveTemplate,
      deleteTemplate,
      addCustomExercise,
      deleteExercise,
      addMeasurement,
      deleteMeasurement,
      saveGoal,
      updateGoalStatus,
      deleteGoal,
      saveAiProgram,
      applyProgramSessionsAsTemplates,
      deleteProgram,
      exportTrainingJson,
    }),
    [
      actionError,
      addCustomExercise,
      addMeasurement,
      applyProgramSessionsAsTemplates,
      authReady,
      clearActionError,
      dataLoading,
      deleteExercise,
      deleteGoal,
      deleteMeasurement,
      deleteProgram,
      deleteTemplate,
      deleteWorkout,
      exercises,
      exportTrainingJson,
      goals,
      measurements,
      profile,
      programs,
      prs,
      saveAiProgram,
      saveGoal,
      saveTemplate,
      saveWorkout,
      signInWithGoogle,
      signOut,
      templates,
      toggleDeloadWeek,
      toggleUnit,
      unit,
      user,
      workouts,
    ]
  );

  return <MaloxieContext.Provider value={value}>{children}</MaloxieContext.Provider>;
}

export function useMaloxie() {
  const ctx = useContext(MaloxieContext);
  if (!ctx) throw new Error('useMaloxie must be used within MaloxieProvider');
  return ctx;
}
