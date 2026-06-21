/**
 * workouts.generator.js
 * Smart weekly workout plan generator.
 *
 * Design principles:
 *   1. Pre-compute the exercise catalog lookup once per call (not per day/group).
 *   2. Goal-driven exercise selection — exercises are tagged with goal_tags
 *      (e.g. ['weight_loss', 'muscle_gain']) and scored by relevance to the
 *      user's goal rather than picked randomly.
 *   3. Volume (sets/reps/rest) is adjusted per BOTH goal AND fitness_level.
 *   4. Split templates are adjusted per goal (cardio injection, rest days).
 */

// ─── Supported goals ──────────────────────────────────────────────────────────

const GOALS = {
  muscle_gain:     'muscle_gain',
  weight_loss:     'weight_loss',
  endurance:       'endurance',
  flexibility:     'flexibility',
  general_fitness: 'general_fitness',
};

// ─── Split templates ──────────────────────────────────────────────────────────
// day: 1=Mon … 7=Sun
// groups: primary muscle groups targeted that day
// The generator uses these as the base, then goal-adjustments are applied.

const SPLITS = {
  2: [
    { day: 1, label: 'Full Body A', groups: ['chest', 'back', 'legs'] },
    { day: 4, label: 'Full Body B', groups: ['shoulders', 'arms', 'core'] },
  ],
  3: [
    { day: 1, label: 'Push day',  groups: ['chest', 'shoulders', 'arms'] },
    { day: 3, label: 'Pull day',  groups: ['back',  'arms'] },
    { day: 5, label: 'Leg day',   groups: ['legs',  'core'] },
  ],
  4: [
    { day: 1, label: 'Chest & Triceps', groups: ['chest', 'arms'] },
    { day: 2, label: 'Back & Biceps',   groups: ['back',  'arms'] },
    { day: 4, label: 'Leg day',          groups: ['legs',  'core'] },
    { day: 5, label: 'Shoulders',        groups: ['shoulders', 'core'] },
  ],
  5: [
    { day: 1, label: 'Chest day',     groups: ['chest', 'arms'] },
    { day: 2, label: 'Back day',      groups: ['back'] },
    { day: 3, label: 'Leg day',       groups: ['legs'] },
    { day: 4, label: 'Shoulders',     groups: ['shoulders', 'arms'] },
    { day: 5, label: 'Core & Cardio', groups: ['core', 'cardio'] },
  ],
  6: [
    { day: 1, label: 'Chest day',   groups: ['chest'] },
    { day: 2, label: 'Back day',    groups: ['back'] },
    { day: 3, label: 'Leg day',     groups: ['legs'] },
    { day: 4, label: 'Shoulders',   groups: ['shoulders'] },
    { day: 5, label: 'Arms & Core', groups: ['arms', 'core'] },
    { day: 6, label: 'Cardio',      groups: ['cardio'] },
  ],
};

// ─── Goal profiles ────────────────────────────────────────────────────────────
// Defines how each goal adjusts the plan:
//   - extraGroups:     muscle groups injected into every active day
//   - priorityTags:    exercise goal_tags that get highest score (prefer these)
//   - secondaryTags:   goal_tags that get a bonus (good-fit)
//   - volumeOverrides: override default sets/reps/rest per fitness_level
//   - labelSuffix:     appended to day labels for transparency

const GOAL_PROFILES = {
  muscle_gain: {
    extraGroups:   [],
    priorityTags:  ['muscle_gain'],
    secondaryTags: ['general_fitness'],
    labelSuffix:   '',
    // Higher sets, lower reps, longer rest → hypertrophy
    volumeOverrides: {
      beginner:     { sets: 3, reps: 10, rest_seconds: 90  },
      intermediate: { sets: 4, reps: 8,  rest_seconds: 90  },
      advanced:     { sets: 5, reps: 6,  rest_seconds: 120 },
    },
  },

  weight_loss: {
    extraGroups:   ['cardio'],    // cardio injected into every active day
    priorityTags:  ['weight_loss'],
    secondaryTags: ['endurance', 'general_fitness'],
    labelSuffix:   '+ Cardio',
    // More reps, shorter rest → higher calorie burn
    volumeOverrides: {
      beginner:     { sets: 3, reps: 15, rest_seconds: 45 },
      intermediate: { sets: 4, reps: 12, rest_seconds: 40 },
      advanced:     { sets: 4, reps: 15, rest_seconds: 30 },
    },
  },

  endurance: {
    extraGroups:   ['cardio'],
    priorityTags:  ['endurance'],
    secondaryTags: ['weight_loss', 'general_fitness'],
    labelSuffix:   '+ Cardio',
    // High reps, very short rest → muscular endurance
    volumeOverrides: {
      beginner:     { sets: 2, reps: 20, rest_seconds: 30 },
      intermediate: { sets: 3, reps: 20, rest_seconds: 30 },
      advanced:     { sets: 4, reps: 20, rest_seconds: 20 },
    },
  },

  flexibility: {
    extraGroups:   ['core'],      // core work complements flexibility
    priorityTags:  ['flexibility'],
    secondaryTags: ['general_fitness'],
    labelSuffix:   '+ Core',
    // Low sets, higher reps, long rest → controlled movement
    volumeOverrides: {
      beginner:     { sets: 2, reps: 12, rest_seconds: 60 },
      intermediate: { sets: 3, reps: 12, rest_seconds: 60 },
      advanced:     { sets: 3, reps: 15, rest_seconds: 45 },
    },
  },

  general_fitness: {
    extraGroups:   [],
    priorityTags:  ['general_fitness'],
    secondaryTags: ['muscle_gain', 'weight_loss', 'endurance'],
    labelSuffix:   '',
    // Balanced defaults
    volumeOverrides: {
      beginner:     { sets: 3, reps: 12, rest_seconds: 60 },
      intermediate: { sets: 3, reps: 10, rest_seconds: 60 },
      advanced:     { sets: 4, reps: 10, rest_seconds: 60 },
    },
  },
};

// ─── Exercises per group per day (by fitness level) ───────────────────────────

const EXERCISES_PER_GROUP = {
  beginner:     2,
  intermediate: 3,
  advanced:     4,
};

// ─── Catalog index builder ────────────────────────────────────────────────────

/**
 * Build a lookup index from the flat exercise catalog array.
 * Pre-computed ONCE per buildWeeklyPlan() call — not per day or group.
 *
 * Returns:
 *   byGroup: { muscle_group → exercise[] }
 *   byTag:   { goal_tag    → exercise[] }
 *   all:     exercise[]
 *
 * @param {object[]} exerciseCatalog
 * @returns {{ byGroup: object, byTag: object, all: object[] }}
 */
const buildCatalogIndex = (exerciseCatalog) => {
  const byGroup = {};
  const byTag   = {};

  for (const ex of exerciseCatalog) {
    // Index by muscle_group
    if (!byGroup[ex.muscle_group]) byGroup[ex.muscle_group] = [];
    byGroup[ex.muscle_group].push(ex);

    // Index by each goal_tag (goal_tags is a string[] from the DB)
    const tags = ex.goal_tags || [];
    for (const tag of tags) {
      if (!byTag[tag]) byTag[tag] = [];
      byTag[tag].push(ex);
    }
  }

  return { byGroup, byTag, all: exerciseCatalog };
};

// ─── Exercise scoring ─────────────────────────────────────────────────────────

/**
 * Score an exercise based on how well it matches the current goal.
 *
 * Scoring:
 *   +3 if the exercise has a priority tag matching the goal
 *   +1 if the exercise has a secondary tag matching the goal
 *    0 otherwise (neutral — still usable)
 *
 * The score is used to sort the candidate pool: best-fit exercises come first.
 * Within the same score tier, a stable secondary sort by exercise name ensures
 * consistent output for the same catalog (no random flakiness in tests).
 *
 * @param {object} exercise
 * @param {string[]} priorityTags
 * @param {string[]} secondaryTags
 * @returns {number}
 */
const scoreExercise = (exercise, priorityTags, secondaryTags) => {
  const tags = exercise.goal_tags || [];

  if (tags.some((t) => priorityTags.includes(t)))   return 3;
  if (tags.some((t) => secondaryTags.includes(t)))  return 1;
  return 0;
};

/**
 * Select the best N exercises for a muscle group given the goal profile.
 *
 * Steps:
 *   1. Get all exercises for the group from the pre-built index
 *   2. Score each by goal relevance
 *   3. Sort: highest score first, then alphabetically (deterministic tie-break)
 *   4. Take the top N
 *
 * @param {object[]} pool          — exercises for a specific muscle_group
 * @param {number}   count         — how many to pick
 * @param {object}   goalProfile   — from GOAL_PROFILES
 * @returns {object[]}
 */
const pickBestExercises = (pool, count, goalProfile) => {
  if (pool.length === 0) return [];

  const { priorityTags, secondaryTags } = goalProfile;

  const scored = pool.map((ex) => ({
    ex,
    score: scoreExercise(ex, priorityTags, secondaryTags),
  }));

  // Sort: highest score first, then by name for stable tie-breaking
  scored.sort((a, b) =>
    b.score !== a.score
      ? b.score - a.score
      : a.ex.name.localeCompare(b.ex.name)
  );

  return scored.slice(0, count).map(({ ex }) => ex);
};

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build the full 7-day plan structure.
 *
 * @param {{
 *   goal:            string,
 *   fitness_level:   string,
 *   days_per_week:   number,
 *   exerciseCatalog: object[]   — rows from exercises table (must include goal_tags[])
 * }} params
 *
 * @returns {Array<{
 *   day_of_week: number,
 *   day_label:   string,
 *   is_rest_day: boolean,
 *   exercises:   Array<{
 *     exercise_id:  string,
 *     sets:         number,
 *     reps:         number,
 *     rest_seconds: number,
 *     order_index:  number,
 *     notes:        null,
 *   }>
 * }>}
 */
const buildWeeklyPlan = ({ goal, fitness_level, days_per_week, exerciseCatalog }) => {
  const split       = SPLITS[days_per_week] || SPLITS[3];
  const goalProfile = GOAL_PROFILES[goal]   || GOAL_PROFILES['general_fitness'];
  const volume      = goalProfile.volumeOverrides[fitness_level]
                   || goalProfile.volumeOverrides['beginner'];
  const exPerGroup  = EXERCISES_PER_GROUP[fitness_level] || 2;

  // ── Pre-compute catalog index ONCE for the entire plan ────────────────────
  const { byGroup } = buildCatalogIndex(exerciseCatalog);

  // Active training days (Set of day-of-week numbers)
  const activeDayNums = new Set(split.map((s) => s.day));

  const days = [];

  for (let dow = 1; dow <= 7; dow++) {
    const activeDay = split.find((s) => s.day === dow);

    if (!activeDay) {
      days.push({ day_of_week: dow, day_label: 'Rest day', is_rest_day: true, exercises: [] });
      continue;
    }

    // Merge base groups with goal-injected extra groups (deduplicated)
    const groups = [...new Set([...activeDay.groups, ...goalProfile.extraGroups])];

    // Build label: "Push day + Cardio" etc.
    const label = goalProfile.labelSuffix
      ? `${activeDay.label} ${goalProfile.labelSuffix}`
      : activeDay.label;

    const exercises  = [];
    let   orderIndex = 0;

    for (const group of groups) {
      const pool   = byGroup[group] || [];
      const picked = pickBestExercises(pool, exPerGroup, goalProfile);

      for (const ex of picked) {
        exercises.push({
          exercise_id:  ex.id,
          sets:         volume.sets,
          reps:         volume.reps,
          rest_seconds: volume.rest_seconds,
          order_index:  orderIndex++,
          notes:        null,
        });
      }
    }

    days.push({ day_of_week: dow, day_label: label, is_rest_day: false, exercises });
  }

  return days;
};

module.exports = {
  buildWeeklyPlan,
  // Export internals for unit testing
  buildCatalogIndex,
  scoreExercise,
  pickBestExercises,
  GOAL_PROFILES,
  SPLITS,
};