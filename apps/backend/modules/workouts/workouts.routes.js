/**
 * workouts.routes.js
 * Registers all workout plan endpoints.
 *
 * Base path (mounted in app.js): /api/workouts
 *
 * Exercise catalog (all authenticated):
 *   GET    /api/workouts/exercises                       — list exercises
 *   GET    /api/workouts/exercises/:exerciseId           — single exercise
 *
 * Exercise catalog (admin only):
 *   POST   /api/workouts/admin/exercises                 — add exercise
 *   PATCH  /api/workouts/admin/exercises/:exerciseId     — update exercise
 *
 * Workout plans (member):
 *   POST   /api/workouts/generate       FR-07            — generate plan
 *   POST   /api/workouts                FR-09            — create custom plan
 *   GET    /api/workouts/active         FR-07/09         — active schedule
 *   GET    /api/workouts                                 — list all plans
 *   GET    /api/workouts/:planId                         — plan schedule
 *   PATCH  /api/workouts/:planId        FR-08            — update plan
 *   POST   /api/workouts/:planId/activate                — activate plan
 *   DELETE /api/workouts/:planId                         — delete plan
 *   PATCH  /api/workouts/:planId/days/:dayId  FR-08      — update day
 *   PUT    /api/workouts/:planId/days/:dayId/exercises   — set day exercises
 */

const router = require('express').Router();
const ctrl   = require('./workouts.controller');

const { authenticate }            = require('../../middlewares/Auth.middleware');
const { requireRole }             = require('../../middlewares/Role.middleware');
const { requireActiveMembership } = require('../../middlewares/Membership.middleware');
const { validate }                = require('../../middlewares/Validate.middleware');
const {
  uuidParam,
  createExerciseSchema,
  updateExerciseSchema,
  resolveGoalSchema,
  generatePlanSchema,
  createPlanSchema,
  updatePlanSchema,
  updateDaySchema,
  setDayExercisesSchema,
} = require('./workouts.validation');

// All workout routes require authentication
router.use(authenticate);

// ── Exercise catalog ──────────────────────────────────────────────────────────
router.get('/exercises',              ctrl.listExercises);
router.get(
  '/exercises/:exerciseId',
  validate(null, uuidParam('exerciseId')),
  ctrl.getExerciseById
);

// ── Admin: exercise catalog management ───────────────────────────────────────
router.post(
  '/admin/exercises',
  requireRole('admin'),
  validate(createExerciseSchema),
  ctrl.createExercise
);
router.patch(
  '/admin/exercises/:exerciseId',
  requireRole('admin'),
  validate(updateExerciseSchema, uuidParam('exerciseId')),
  ctrl.updateExercise
);

// ── Goal resolver (Gemini NLP) — must come BEFORE requireActiveMembership ────
// Member can call this to figure out their goal before committing to a plan.
router.post(
  '/resolve-goal',
  validate(resolveGoalSchema),
  ctrl.resolveGoal
);

// ── Member: workout plans (require active membership) ─────────────────────────
router.use(requireActiveMembership);

router.post(
  '/generate',
  validate(generatePlanSchema),
  ctrl.generatePlan
);

router.post(
  '/',
  validate(createPlanSchema),
  ctrl.createCustomPlan
);

router.get('/active', ctrl.getActiveSchedule);

router.get('/', ctrl.listMyPlans);

router.get(
  '/:planId',
  validate(null, uuidParam('planId')),
  ctrl.getPlanSchedule
);

router.patch(
  '/:planId',
  validate(updatePlanSchema, uuidParam('planId')),
  ctrl.updatePlan
);

router.post(
  '/:planId/activate',
  validate(null, uuidParam('planId')),
  ctrl.activatePlan
);

router.delete(
  '/:planId',
  validate(null, uuidParam('planId')),
  ctrl.deletePlan
);

router.patch(
  '/:planId/days/:dayId',
  validate(updateDaySchema, uuidParam('planId')),
  ctrl.updateDay
);

router.put(
  '/:planId/days/:dayId/exercises',
  validate(setDayExercisesSchema, uuidParam('planId')),
  ctrl.setDayExercises
);

module.exports = router;