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
const buildWeeklyPlan = ({ goal, fitness_level, days_per_week, exerciseCatalog, preferredSlots }) => {
  const goalProfile = GOAL_PROFILES[goal] || GOAL_PROFILES['general_fitness'];
  const volume       = goalProfile.volumeOverrides[fitness_level]
                    || goalProfile.volumeOverrides['beginner'];
  const exPerGroup   = EXERCISES_PER_GROUP[fitness_level] || 2;

  // ── Pre-compute catalog index ONCE for the entire plan ────────────────────
  const { byGroup } = buildCatalogIndex(exerciseCatalog);

  // If the member specified exact days/periods (e.g. "chiều thứ 5 và sáng thứ 7"),
  // honor those days instead of the fixed SPLITS template. The split template is
  // still used for its muscle-group rotation — just remapped onto the requested days.
  const sortedSlots = Array.isArray(preferredSlots) && preferredSlots.length > 0
    ? [...preferredSlots].sort((a, b) => a.day_of_week - b.day_of_week).slice(0, 6)
    : [];

  const effectiveDaysPerWeek = sortedSlots.length > 0
    ? Math.max(2, sortedSlots.length)
    : days_per_week;

  const split = SPLITS[effectiveDaysPerWeek] || SPLITS[3];

  // Positional mapping: split[i]'s label/groups go onto sortedSlots[i]'s day/period
  // (or the template's own day when no preferred slots were given).
  const activeDayByDow = new Map();
  split.forEach((templateDay, index) => {
    const slot = sortedSlots[index];
    const dow  = slot ? slot.day_of_week : templateDay.day;
    activeDayByDow.set(dow, {
      label:  templateDay.label,
      groups: templateDay.groups,
      period: slot ? slot.period : null,
    });
  });

  const days = [];

  for (let dow = 1; dow <= 7; dow++) {
    const activeDay = activeDayByDow.get(dow);

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
          exercise_id:      ex.id,
          sets:             volume.sets,
          reps:             volume.reps,
          rest_seconds:     volume.rest_seconds,
          scheduled_period: activeDay.period || null,
          order_index:      orderIndex++,
          notes:            null,
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
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const LOCAL_GOAL_KEYWORDS = {
  muscle_gain: [
    'muscle',
    'build',
    'bigger',
    'gain mass',
    'bulk',
    'bulking',
    'strength',
    'stronger',
    'hypertrophy',
    'arms',
    'chest',
    'back',
    'lift heavy',
  ],
  weight_loss: [
    'lose weight',
    'weight loss',
    'fat',
    'belly',
    'slim',
    'cut',
    'cutting',
    'lighter',
    'calorie',
    'burn',
    'tone',
  ],
  endurance: [
    'endurance',
    'stamina',
    'run',
    'running',
    '10k',
    'marathon',
    'cardio',
    'cycling',
    'not tired',
  ],
  flexibility: [
    'flexibility',
    'flexible',
    'stretch',
    'stretching',
    'mobility',
    'yoga',
    'stiff',
    'touch my toes',
    'range of motion',
  ],
  general_fitness: [
    'healthy',
    'healthier',
    'fitness',
    'gym',
    'workout',
    'exercise',
    'wellness',
    'active',
    'energy',
  ],
};

const LOCAL_NON_FITNESS_KEYWORDS = [
  'pasta',
  'carbonara',
  'recipe',
  'cook',
  'cooking',
  'weather',
  'coding',
  'code',
  'javascript',
  'movie',
  'music',
  'travel',
];

const LOCAL_REDIRECT_MESSAGE =
  'GymHub is here to help with fitness goals. Tell me what you want to improve at the gym, such as building muscle, losing weight, or improving stamina.';

// ─── Preferred day/period keyword parser (Vietnamese, local fallback) ─────────
// day_of_week: 1=Monday ... 7=Sunday, matching workout_days.day_of_week.

const WEEKDAY_KEYWORDS = [
  { day: 1, terms: ['thứ 2', 'thứ hai', 't2'] },
  { day: 2, terms: ['thứ 3', 'thứ ba', 't3'] },
  { day: 3, terms: ['thứ 4', 'thứ tư', 't4'] },
  { day: 4, terms: ['thứ 5', 'thứ năm', 't5'] },
  { day: 5, terms: ['thứ 6', 'thứ sáu', 't6'] },
  { day: 6, terms: ['thứ 7', 'thứ bảy', 't7'] },
  { day: 7, terms: ['chủ nhật', 'chủ nhựt', 'cn'] },
];

// Only 'morning'/'afternoon' are supported by the schedule schema — 'tối' (evening)
// is mapped onto 'afternoon' as the closest existing slot.
const PERIOD_KEYWORDS = [
  { period: 'morning',   terms: ['sáng'] },
  { period: 'afternoon', terms: ['chiều', 'tối'] },
];

const WEEKEND_DAYS   = [6, 7];
const EARLY_WEEK_DAYS = [1, 2, 3];

/**
 * Lightweight local fallback that extracts preferred training days/periods
 * from free text when the LLM is unavailable. Not as flexible as the LLM
 * (only recognizes the keyword forms listed above), but covers the common
 * ways members phrase availability in Vietnamese.
 *
 * Clauses are split on commas/"và" so each day keeps the period mentioned
 * right next to it — e.g. "chiều thứ 5 và sáng thứ 7" → Thu=afternoon, Sat=morning.
 *
 * @param {string} text
 * @returns {Array<{ day_of_week: number, period: string|null }>}
 */
const parsePreferredSlotsLocally = (text) => {
  const normalized = text.toLowerCase();

  if (/hàng ngày|mỗi ngày|ngày nào cũng/.test(normalized)) {
    return [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day_of_week: day, period: null }));
  }

  const clauses = normalized
    .split(/,| và |;/)
    .map((c) => c.trim())
    .filter(Boolean);

  const slots = [];

  clauses.forEach((clause) => {
    const daysInClause = [];

    if (clause.includes('cuối tuần')) daysInClause.push(...WEEKEND_DAYS);
    if (clause.includes('đầu tuần'))  daysInClause.push(...EARLY_WEEK_DAYS);

    WEEKDAY_KEYWORDS.forEach(({ day, terms }) => {
      if (terms.some((term) => clause.includes(term))) daysInClause.push(day);
    });

    if (daysInClause.length === 0) return;

    let period = null;
    for (const { period: candidatePeriod, terms } of PERIOD_KEYWORDS) {
      if (terms.some((term) => clause.includes(term))) {
        period = candidatePeriod;
        break;
      }
    }

    daysInClause.forEach((day) => slots.push({ day_of_week: day, period }));
  });

  // De-dup by day_of_week (last mention wins), sorted Mon → Sun
  const byDay = new Map();
  slots.forEach((slot) => byDay.set(slot.day_of_week, slot));
  return Array.from(byDay.values()).sort((a, b) => a.day_of_week - b.day_of_week);
};

const countKeywordMatches = (text, keywords) =>
  keywords.reduce((count, keyword) => (
    text.includes(keyword) ? count + 1 : count
  ), 0);

/**
 * Lightweight local fallback used when Groq is unavailable.
 *
 * @param {string} cleanText
 * @returns {object}
 */
const classifyGoalLocally = (cleanText) => {
  const text = cleanText.toLowerCase();
  const scores = Object.entries(LOCAL_GOAL_KEYWORDS).map(([goal, keywords]) => ({
    goal,
    score: countKeywordMatches(text, keywords),
  }));
  scores.sort((a, b) => b.score - a.score);

  const best = scores[0];
  const nonFitnessScore = countKeywordMatches(text, LOCAL_NON_FITNESS_KEYWORDS);

  if (!best || best.score === 0) {
    if (nonFitnessScore > 0) {
      return {
        is_fitness_related: false,
        goal: null,
        confidence: null,
        redirect_message: LOCAL_REDIRECT_MESSAGE,
      };
    }

    return {
      is_fitness_related: true,
      goal: 'general_fitness',
      confidence: 'low',
      redirect_message: null,
    };
  }

  return {
    is_fitness_related: true,
    goal: best.goal,
    confidence: best.score >= 2 ? 'medium' : 'low',
    redirect_message: null,
  };
};

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

Your job is to read what a gym member types and do THREE things:
  1. Decide if it is related to fitness / exercise / health goals.
  2. If it is, classify it into exactly one goal key.
  3. Extract any specific days/times the member says they are free to train.

─── RESPONSE SCHEMA ────────────────────────────────────────────────────────────
Always respond with a single JSON object containing EXACTLY these five keys:

{
  "is_fitness_related": true | false,
  "goal":               string | null,
  "confidence":         "high" | "medium" | "low" | null,
  "redirect_message":   string | null,
  "preferred_slots":    [{ "day_of_week": 1-7, "period": "morning" | "afternoon" | null }]
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
  • Set "preferred_slots" to []

─── PREFERRED_SLOTS RULES ────────────────────────────────────────────────────────
  • day_of_week uses 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday,
    6=Saturday, 7=Sunday (accepts Vietnamese day names like "thứ 5", "thứ Năm").
  • "period" is "morning" for sáng, "afternoon" for chiều OR tối (evening has no
    separate slot — map it to afternoon), or null if only a day is mentioned
    with no time of day.
  • "cuối tuần" (weekend) → Saturday + Sunday. "đầu tuần" (early week) → Mon-Wed.
  • "hàng ngày" / "mỗi ngày" (every day) → all 7 days, period null.
  • If NO specific day/time is mentioned anywhere in the input, return [].
  • One object per distinct day mentioned — never duplicate a day_of_week.

─── EXAMPLES ────────────────────────────────────────────────────────────────────

Input: "I want to lose belly fat and feel lighter"
Output: {"is_fitness_related":true,"goal":"weight_loss","confidence":"high","redirect_message":null,"preferred_slots":[]}

Input: "Build bigger arms and a wider back"
Output: {"is_fitness_related":true,"goal":"muscle_gain","confidence":"high","redirect_message":null,"preferred_slots":[]}

Input: "I want to run a 10k without stopping"
Output: {"is_fitness_related":true,"goal":"endurance","confidence":"high","redirect_message":null,"preferred_slots":[]}

Input: "I'm pretty stiff, I can't touch my toes"
Output: {"is_fitness_related":true,"goal":"flexibility","confidence":"high","redirect_message":null,"preferred_slots":[]}

Input: "Just want to be healthier, I'm not sure where to start"
Output: {"is_fitness_related":true,"goal":"general_fitness","confidence":"medium","redirect_message":null,"preferred_slots":[]}

Input: "Tôi muốn giảm cân và săn chắc cơ thể, tôi rảnh vào chiều thứ 5 và sáng thứ 7"
Output: {"is_fitness_related":true,"goal":"weight_loss","confidence":"high","redirect_message":null,"preferred_slots":[{"day_of_week":4,"period":"afternoon"},{"day_of_week":6,"period":"morning"}]}

Input: "Tôi chỉ rảnh cuối tuần để tập gym, muốn tăng cơ"
Output: {"is_fitness_related":true,"goal":"muscle_gain","confidence":"high","redirect_message":null,"preferred_slots":[{"day_of_week":6,"period":null},{"day_of_week":7,"period":null}]}

Input: "How do I make pasta carbonara?"
Output: {"is_fitness_related":false,"goal":null,"confidence":null,"redirect_message":"That sounds delicious, but GymHub is here to help with your fitness journey! 😊 Could you tell me what you'd like to achieve at the gym — like losing weight, building muscle, or improving your stamina?","preferred_slots":[]}

Input: "What is the weather today?"
Output: {"is_fitness_related":false,"goal":null,"confidence":null,"redirect_message":"I can only help with fitness goals here! Tell me what you'd like to work on — for example, 'I want to get stronger' or 'I want more energy'.","preferred_slots":[]}

Input: "xyzabc123!!!"
Output: {"is_fitness_related":false,"goal":null,"confidence":null,"redirect_message":"Hmm, I didn't quite catch that! I'm here to help you build your workout plan. What fitness goal are you working toward?","preferred_slots":[]}
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
 *   preferred_slots:    Array<{ day_of_week: number, period: string|null }>,
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
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not set in environment variables');
    }

    const response = await fetch(`${GROQ_API_URL}?key=${apiKey}`, {
      method:  'POST',
      headers: 
      { 'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
       },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: cleanText }
        ],
        temperature: 0,
        max_tokens: 200,
        // Forces Groq to output valid JSON matching your schema
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();

    // Extract raw text content from Gemini's nested response structure
    const rawContent = data?.choices?.[0]?.message?.content || '';

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

    // Sanitise preferred_slots: must be an array of { day_of_week: 1-7, period }
    const rawSlots = Array.isArray(parsed.preferred_slots) ? parsed.preferred_slots : [];
    const preferredSlots = rawSlots
      .filter((slot) => slot && Number.isInteger(slot.day_of_week)
        && slot.day_of_week >= 1 && slot.day_of_week <= 7)
      .map((slot) => ({
        day_of_week: slot.day_of_week,
        period: ['morning', 'afternoon'].includes(slot.period) ? slot.period : null,
      }));

    return {
      is_fitness_related: isFitnessRelated,
      goal,
      confidence,
      redirect_message: redirectMessage,
      raw_text:         cleanText,
      fallback:         false,
      preferred_slots:  preferredSlots,
    };

  } catch (err) {
    // ── Graceful fallback when Gemini is unavailable ───────────────────────────
    // Never throw to the caller — return a safe default instead.
    const logger = require('../../utils/Logger');
    logger.warn('resolveGoalFromText: Gemini call failed, using fallback', {
      error: err.message,
      input: cleanText,
    });

    const localResult = classifyGoalLocally(cleanText);

    return {
      ...localResult,
      raw_text:        cleanText,
      fallback:        true,            // caller can show "our AI is unavailable" note
      preferred_slots: parsePreferredSlotsLocally(cleanText),
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
  classifyGoalLocally,
  parsePreferredSlotsLocally,
  GOAL_PROFILES,
  SPLITS,
  VALID_GOALS,
};