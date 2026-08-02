export type SeedExercise = {
  name: string;
  sets: string;
  isExplosive?: boolean;
  isMainLift?: boolean;
  isMonitor?: boolean;
  movementPattern?: string;
};

export type SeedSession = {
  title: string;
  exercises: SeedExercise[];
};

export type SeedBlock = {
  id: string;
  title: string;
  condition: string;
  body: string;
};

export type SeedPhase = {
  id: string;
  tag: string;
  name: string;
  weeks: string;
  dates: string;
  color: string;
  blurb: string;
  start: string;
  end: string;
  isDeload: boolean;
  deloadWeek?: number;
  isRaceBlock: boolean;
  note: string;
  waveScheme?: { sets: number; reps: number; pctMin: number; pctMax: number }[];
  sessions?: { tue?: SeedSession; thu?: SeedSession; sun?: SeedSession };
  blocks?: SeedBlock[];
};

export type SeedWeekDay = {
  short: string;
  full: string;
  summary: string;
  sub: string;
  color: string;
  swim: string | null;
  gym: string | null;
};

export type SeedVerdictCard = {
  tag: string;
  color: string;
  bg: string;
  title: string;
  body: string;
};

export type SeedPbRow = { name: string; time: string; color: string };
export type SeedInbodyRow = { name: string; value: string; note: string; noteColor: string };
export type SeedSplitBar = {
  label: string;
  yourPct: number;
  targetPct: number;
  color: string;
  yourSeconds: number | null;
  targetSeconds: number | null;
};
export type SeedDiagnosisCard = { problem: string; why: string; fix: string };
export type SeedMapRow = { title: string; body: string };
export type SeedMuscleCard = { title: string; color: string; body: string };
export type SeedTarget = {
  id: string;
  name: string;
  now: string;
  goal: string;
  goalValue?: number;
  unit?: string;
  why: string;
};
export type SeedMeal = { slot: number; time: string; desc: string; tag: string };
export type SeedWeighIn = { date: string; weight: number };

export type SeasonData = {
  meta: {
    athlete: string;
    events: string[];
    seasonStart: string;
    seasonEnd: string;
    timezone: string;
    targets: {
      ncaaDate: string;
      ncaaName: string;
      aseanDate: string;
      aseanName: string;
      aseanConfirmed: boolean | null;
      /** WS5 §0 Task 4G: primary long-term target, stored the same way as
       * NCAA (fixed date, no separate confirmed toggle -- it's the given). */
      seaGames2027Date: string;
      seaGames2027Name: string;
      /** Projected-only date (spec's "late May - mid June 2027" range,
       * anchored to its midpoint); `paiTryoutName` itself carries the
       * unconfirmed caveat since there's no settings-table toggle for it
       * the way aseanConfirmed has for ASEAN. */
      paiTryoutDate: string;
      paiTryoutName: string;
    };
    weeklyLoad: string;
    bulkWindowEnd: string;
  };
  PHASES: SeedPhase[];
  WEEK: SeedWeekDay[];
  VERDICT_CARDS: SeedVerdictCard[];
  PB_ROWS: SeedPbRow[];
  INBODY_ROWS: SeedInbodyRow[];
  SPLIT_BARS: SeedSplitBar[];
  DIAGNOSIS_CARDS: SeedDiagnosisCard[];
  KEEP_DOING: string[];
  MAP_ROWS: SeedMapRow[];
  MUSCLE_CARDS: SeedMuscleCard[];
  TARGETS: SeedTarget[];
  HOMEWORK: string[];
  MEALS: SeedMeal[];
  weighIns: SeedWeighIn[];
};
