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

// ─── Natural language → goal resolver (Gemini API) ────────────────────────────

const VALID_GOALS    = Object.keys(GOALS);
const VALID_CONFIDENCE = ['high', 'medium', 'low'];
const GEMINI_MODEL   = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * System prompt for Gemini.
 *
 * Key design decisions:
 *   - Returns 4 fields so we handle fitness/non-fitness in ONE call (no second request).
 *   - is_fitness_related = false triggers a friendly redirect message to the caller.
 *   - redirect_message is written by Gemini in the member's own language/tone.
 *   - temperature = 0 keeps the goal classification deterministic.
 *   - responseMimeType = 'application/json' forces Gemini to skip markdown fences.
 */
const SYSTEM_PROMPT = `
You are a fitness goal classifier embedded in a gym management app called GymHub.

Your job is to read what a gym member types and do TWO things:
  1. Decide if it is related to fitness / exercise / health goals.
  2. If it is, classify it into exactly one goal key.

─── RESPONSE SCHEMA ────────────────────────────────────────────────────────────
Always respond with a single JSON object containing EXACTLY these four keys:

{
  "is_fitness_related": true | false,
  "goal":               string | null,
  "confidence":         "high" | "medium" | "low" | null,
  "redirect_message":   string | null
}

─── RULES ───────────────────────────────────────────────────────────────────────

IF the input IS fitness-related:
  • Set "is_fitness_related" to true
  • Set "goal" to one of:
      "muscle_gain"     → building muscle, bulking, bigger/stronger, hypertrophy,
                          bodybuilding, gaining mass, lifting heavy
      "weight_loss"     → losing fat, cutting, burning calories, slimming, lean,
                          losing belly fat, toning up, dropping weight
      "endurance"       → stamina, running longer, cardio fitness, marathon,
                          triathlon, cycling, not getting tired easily
      "flexibility"     → stretching, mobility, yoga-style, range of motion,
                          injury prevention, joint health, moving better
      "general_fitness" → staying healthy, balanced training, overall wellness,
                          not sure what goal, beginner with no specific goal
  • Set "confidence" to how sure you are: "high", "medium", or "low"
  • Set "redirect_message" to null

IF the input is NOT fitness-related (e.g. food recipes, weather, coding, random chat):
  • Set "is_fitness_related" to false
  • Set "goal" to null
  • Set "confidence" to null
  • Set "redirect_message" to a SHORT, friendly message (1-2 sentences) telling
    the user this app is for fitness goals, and asking them to describe their
    fitness goal instead. Keep the tone warm and helpful, NOT robotic.

─── EXAMPLES ────────────────────────────────────────────────────────────────────

Input: "I want to lose belly fat and feel lighter"
Output: {"is_fitness_related":true,"goal":"weight_loss","confidence":"high","redirect_message":null}

Input: "Build bigger arms and a wider back"
Output: {"is_fitness_related":true,"goal":"muscle_gain","confidence":"high","redirect_message":null}

Input: "I want to run a 10k without stopping"
Output: {"is_fitness_related":true,"goal":"endurance","confidence":"high","redirect_message":null}

Input: "I'm pretty stiff, I can't touch my toes"
Output: {"is_fitness_related":true,"goal":"flexibility","confidence":"high","redirect_message":null}

Input: "Just want to be healthier, I'm not sure where to start"
Output: {"is_fitness_related":true,"goal":"general_fitness","confidence":"medium","redirect_message":null}

Input: "How do I make pasta carbonara?"
Output: {"is_fitness_related":false,"goal":null,"confidence":null,"redirect_message":"That sounds delicious, but GymHub is here to help with your fitness journey! 😊 Could you tell me what you'd like to achieve at the gym — like losing weight, building muscle, or improving your stamina?"}

Input: "What is the weather today?"
Output: {"is_fitness_related":false,"goal":null,"confidence":null,"redirect_message":"I can only help with fitness goals here! Tell me what you'd like to work on — for example, 'I want to get stronger' or 'I want more energy'."}

Input: "xyzabc123!!!"
Output: {"is_fitness_related":false,"goal":null,"confidence":null,"redirect_message":"Hmm, I didn't quite catch that! I'm here to help you build your workout plan. What fitness goal are you working toward?"}
`.trim();

/**
 * resolveGoalFromText
 * Calls the Gemini API to:
 *   1. Detect whether the member's input is fitness-related.
 *   2. If yes → classify it into one of the five goal keys.
 *   3. If no  → return a friendly redirect message to show the member.
 *
 * The caller (workouts.service.js) should check `is_fitness_related` before
 * proceeding to `buildWeeklyPlan`. If false, surface `redirect_message` to
 * the user and do not generate a plan.
 *
 * @param {string} userText
 *   Raw natural language from the member, e.g. "I want to lose belly fat"
 *
 * @returns {Promise<{
 *   is_fitness_related: boolean,
 *   goal:               string|null,   — valid goal key, or null if not fitness-related
 *   confidence:         string|null,   — 'high'|'medium'|'low', or null
 *   redirect_message:   string|null,   — friendly message to show user, or null
 *   raw_text:           string,        — original trimmed input
 *   fallback:           boolean,       — true if Gemini was unavailable
 * }>}
 *
 * @throws {Error} only for empty input — Gemini errors are caught and return fallback
 */
const resolveGoalFromText = async (userText) => {
  if (!userText || !userText.trim()) {
    throw new Error('Fitness goal description must not be empty');
  }

  const cleanText = userText.trim().slice(0, 500); // guard against huge inputs

  // ── Gemini API call ──────────────────────────────────────────────────────────
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role:  'user',
            parts: [{ text: cleanText }],
          },
        ],
        generationConfig: {
          temperature:      0,     // deterministic — same input → same goal every time
          maxOutputTokens:  200,   // JSON + short redirect_message fits comfortably
          responseMimeType: 'application/json', // Gemini skips markdown fences
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();

    // Extract raw text content from Gemini's nested response structure
    const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Defensive strip of any accidental markdown fences
    const jsonText = rawContent
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(jsonText);

    // ── Validate and sanitise every field from Gemini ─────────────────────────

    const isFitnessRelated = Boolean(parsed.is_fitness_related);

    // Ensure goal is a recognised key, or null if not fitness-related
    const goal = isFitnessRelated
      ? (VALID_GOALS.includes(parsed.goal) ? parsed.goal : 'general_fitness')
      : null;

    // Ensure confidence is valid, or null if not fitness-related
    const confidence = isFitnessRelated
      ? (VALID_CONFIDENCE.includes(parsed.confidence) ? parsed.confidence : 'low')
      : null;

    // Sanitise redirect_message: only present when not fitness-related
    const redirectMessage = !isFitnessRelated && typeof parsed.redirect_message === 'string'
      ? parsed.redirect_message.trim()
      : null;

    return {
      is_fitness_related: isFitnessRelated,
      goal,
      confidence,
      redirect_message: redirectMessage,
      raw_text:         cleanText,
      fallback:         false,
    };

  } catch (err) {
    // ── Graceful fallback when Gemini is unavailable ───────────────────────────
    // Never throw to the caller — return a safe default instead.
    const logger = require('../../utils/Logger');
    logger.warn('resolveGoalFromText: Gemini call failed, using fallback', {
      error: err.message,
      input: cleanText,
    });

    return {
      is_fitness_related: true,            // assume fitness-related so user isn't blocked
      goal:               'general_fitness',
      confidence:         'low',
      redirect_message:   null,
      raw_text:           cleanText,
      fallback:           true,            // caller can show "our AI is unavailable" note
    };
  }
};

module.exports = {
  buildWeeklyPlan,
  resolveGoalFromText,
  // Export internals for unit testing
  buildCatalogIndex,
  scoreExercise,
  pickBestExercises,
  GOAL_PROFILES,
  SPLITS,
  VALID_GOALS,
};