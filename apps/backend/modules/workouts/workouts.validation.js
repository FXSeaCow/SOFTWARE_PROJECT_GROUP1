/**
 * workouts.validation.js
 * Joi schemas for workout plan endpoints.
 *
 * FR-07  system generates workout plans based on user goals/fitness level
 * FR-08  members customize generated workout plans
 * FR-09  system stores workout plans for future use
 */

const Joi = require('joi');

const uuidParam = (name) =>
  Joi.object({
    [name]: Joi.string().uuid().required().messages({
      'string.uuid':  `${name} must be a valid UUID`,
      'any.required': `${name} is required`,
    }),
  });

// ─── Exercise catalog schemas (admin) ─────────────────────────────────────────

const MUSCLE_GROUPS = [
  'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body',
];
const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'];

/**
 * POST /api/workouts/admin/exercises
 * Admin adds an exercise to the catalog.
 */
const GOAL_TAGS = ['muscle_gain', 'weight_loss', 'endurance', 'flexibility', 'general_fitness'];

const createExerciseSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Exercise name is required',
  }),
  muscle_group: Joi.string().valid(...MUSCLE_GROUPS).required().messages({
    'any.only':     `muscle_group must be one of: ${MUSCLE_GROUPS.join(', ')}`,
    'any.required': 'muscle_group is required',
  }),
  equipment:   Joi.string().trim().max(50).allow('', null).optional(),
  difficulty:  Joi.string().valid(...DIFFICULTY_LEVELS).default('beginner'),
  description: Joi.string().trim().max(500).allow('', null).optional(),
  goal_tags:   Joi.array()
    .items(Joi.string().valid(...GOAL_TAGS))
    .default([])
    .messages({
      'any.only': `Each goal_tag must be one of: ${GOAL_TAGS.join(', ')}`,
    }),
});

/**
 * PATCH /api/workouts/admin/exercises/:exerciseId
 */
const updateExerciseSchema = Joi.object({
  name:         Joi.string().trim().min(2).max(100),
  muscle_group: Joi.string().valid(...MUSCLE_GROUPS),
  equipment:    Joi.string().trim().max(50).allow('', null),
  difficulty:   Joi.string().valid(...DIFFICULTY_LEVELS),
  description:  Joi.string().trim().max(500).allow('', null),
  goal_tags:    Joi.array().items(Joi.string().valid(...GOAL_TAGS)),
}).min(1).messages({
  'object.min': 'At least one field must be provided to update',
});

// ─── Workout plan schemas ─────────────────────────────────────────────────────

/**
 * POST /api/workouts/generate  (FR-07)
 * Member requests a generated workout plan.
 */
const generatePlanSchema = Joi.object({
  title:         Joi.string().trim().min(2).max(150).required().messages({
    'any.required': 'Plan title is required',
  }),
  goal: Joi.string()
    .valid('muscle_gain', 'weight_loss', 'endurance', 'flexibility', 'general_fitness')
    .required()
    .messages({
      'any.only':     'goal must be one of: muscle_gain, weight_loss, endurance, flexibility, general_fitness',
      'any.required': 'goal is required',
    }),
  fitness_level: Joi.string().valid(...DIFFICULTY_LEVELS).required().messages({
    'any.only':     `fitness_level must be one of: ${DIFFICULTY_LEVELS.join(', ')}`,
    'any.required': 'fitness_level is required',
  }),
  days_per_week: Joi.number().integer().min(2).max(6).required().messages({
    'number.min':   'days_per_week must be at least 2',
    'number.max':   'days_per_week cannot exceed 6',
    'any.required': 'days_per_week is required',
  }),
  preferred_slots: Joi.array()
    .items(
      Joi.object({
        day_of_week: Joi.number().integer().min(1).max(7).required(),
        period:      Joi.string().valid('morning', 'afternoon').allow(null).optional(),
      })
    )
    .optional()
    .messages({
      'array.base': 'preferred_slots must be an array of { day_of_week, period }',
    }),
});

/**
 * POST /api/workouts  (FR-09)
 * Member creates a fully custom plan from scratch.
 * Same fields as generate but does not auto-populate exercises.
 */
const createPlanSchema = Joi.object({
  title:         Joi.string().trim().min(2).max(150).required(),
  goal:          Joi.string().trim().max(200).allow('', null).optional(),
  fitness_level: Joi.string().valid(...DIFFICULTY_LEVELS).default('beginner'),
});

/**
 * PATCH /api/workouts/:planId  (FR-08)
 * Member updates plan title, goal, or fitness_level.
 */
const updatePlanSchema = Joi.object({
  title:         Joi.string().trim().min(2).max(150),
  goal:          Joi.string().trim().max(200).allow('', null),
  fitness_level: Joi.string().valid(...DIFFICULTY_LEVELS),
}).min(1).messages({
  'object.min': 'At least one field must be provided to update',
});

// ─── Workout day schemas ──────────────────────────────────────────────────────

/**
 * PATCH /api/workouts/:planId/days/:dayId  (FR-08)
 * Member updates the label or rest status of a specific day.
 */
const updateDaySchema = Joi.object({
  day_label:   Joi.string().trim().min(2).max(50),
  is_rest_day: Joi.boolean(),
}).min(1).messages({
  'object.min': 'At least one field must be provided to update',
});

// ─── Workout day exercise schemas ─────────────────────────────────────────────

/**
 * PUT /api/workouts/:planId/days/:dayId/exercises  (FR-08)
 * Member replaces all exercises for a specific day.
 * Accepts an ordered array — order_index is auto-assigned by position.
 */
const setDayExercisesSchema = Joi.object({
  exercises: Joi.array()
    .items(
      Joi.object({
        exercise_id:  Joi.string().uuid().required().messages({
          'string.uuid':  'exercise_id must be a valid UUID',
          'any.required': 'exercise_id is required',
        }),
        sets:         Joi.number().integer().min(1).max(20).required(),
        reps:         Joi.number().integer().min(1).max(200).required(),
        rest_seconds: Joi.number().integer().min(0).max(600).default(60),
        scheduled_period: Joi.string().valid('morning', 'afternoon').allow(null).optional(),
        scheduled_time:   Joi.string()
          .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
          .allow('', null)
          .optional()
          .messages({
            'string.pattern.base': 'scheduled_time must use HH:mm format',
          }),
        notes:        Joi.string().trim().max(200).allow('', null).optional(),
      })
    )
    .min(0) // allow empty array to clear all exercises on rest days
    .required()
    .messages({
      'any.required': 'exercises array is required',
    }),
});

/**
 * POST /api/workouts/resolve-goal
 * Member types a free-text fitness goal description.
 * Gemini classifies it into a goal key.
 */
const resolveGoalSchema = Joi.object({
  text: Joi.string().trim().min(2).max(500).required().messages({
    'string.min':   'Please describe your fitness goal in at least 2 characters',
    'string.max':   'Description must not exceed 500 characters',
    'any.required': 'A fitness goal description is required',
  }),
});

module.exports = {
  uuidParam,
  createExerciseSchema,
  updateExerciseSchema,
  resolveGoalSchema,
  generatePlanSchema,
  createPlanSchema,
  updatePlanSchema,
  updateDaySchema,
  setDayExercisesSchema,
};
