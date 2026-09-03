/**
 * workouts.test.js
 * Integration + unit tests for the workouts module.
 *
 * Run: npx jest --testPathPattern=modules/workouts --runInBand --forceExit
 *
 * Test groups:
 *   1.  GET    /api/workouts/exercises               — list exercises
 *   2.  GET    /api/workouts/exercises/:id           — single exercise
 *   3.  POST   /api/workouts/admin/exercises         — create exercise
 *   4.  PATCH  /api/workouts/admin/exercises/:id     — update exercise
 *   5.  POST   /api/workouts/resolve-goal            — NLP goal resolver
 *   6.  POST   /api/workouts/generate                — generate plan (FR-07)
 *   7.  POST   /api/workouts                         — create custom plan
 *   8.  GET    /api/workouts/active                  — active schedule
 *   9.  GET    /api/workouts                         — list plans
 *   10. GET    /api/workouts/:planId                 — plan schedule
 *   11. PATCH  /api/workouts/:planId                 — update plan (FR-08)
 *   12. POST   /api/workouts/:planId/activate        — activate plan
 *   13. DELETE /api/workouts/:planId                 — delete plan
 *   14. PATCH  /api/workouts/:planId/days/:dayId     — update day (FR-08)
 *   15. PUT    /api/workouts/:planId/days/:dayId/exercises — set exercises
 *   16. Unit:  workouts.generator
 */

const request    = require('supertest');
const app        = require('../../../app');
const db         = require('../../../config/db');
const {
  buildWeeklyPlan,
  buildCatalogIndex,
  scoreExercise,
  pickBestExercises,
  classifyGoalLocally,
  GOAL_PROFILES,
} = require('../workouts.generator');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const registerAndLogin = async (overrides = {}) => {
  const userData = {
    full_name:        'Test Member',
    email:            'member@example.com',
    password:         'Password1',
    confirm_password: 'Password1',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(userData);
  return { user: res.body.data.user, accessToken: res.body.data.accessToken };
};

const registerAndLoginAdmin = async () => {
  const { user } = await registerAndLogin({
    email:     'admin@example.com',
    full_name: 'Admin User',
  });
  await db.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [user.id]);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.com', password: 'Password1' });
  return { user: res.body.data.user, accessToken: res.body.data.accessToken };
};

/** Give a user an active membership so workout routes are accessible */
const grantMembership = async (userId) => {
  const { rows: [plan] } = await db.query(
    `INSERT INTO membership_plans (name, price, duration_days)
     VALUES ('Test Plan', 100000, 30) RETURNING *`
  );
  const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  await db.query(
    `INSERT INTO memberships (user_id, plan_id, start_date, end_date, status)
     VALUES ($1, $2, CURRENT_DATE, $3, 'active')`,
    [userId, plan.id, end]
  );
};

/**
 * Seed exercises into the catalog.
 * Creates a minimal set covering all muscle groups at a given difficulty.
 */
const seedExercises = async (difficulty = 'beginner', count = 3) => {
  const groups = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body'];
  const exercises = [];
  for (const group of groups) {
    for (let i = 0; i < count; i++) {
      const { rows: [ex] } = await db.query(
        `INSERT INTO exercises (name, muscle_group, equipment, difficulty, goal_tags)
         VALUES ($1, $2, 'barbell', $3, $4)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING *`,
        [
          `${group} exercise ${i + 1} ${difficulty}`,
          group,
          difficulty,
          ['muscle_gain', 'weight_loss', 'general_fitness'],
        ]
      );
      exercises.push(ex);
    }
  }
  return exercises;
};

/**
 * Seed a complete workout plan with 7 days (no exercises).
 */
const seedPlan = async (userId, overrides = {}) => {
  const { rows: [plan] } = await db.query(
    `INSERT INTO workout_plans (user_id, title, goal, fitness_level, is_active, is_customized)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      userId,
      overrides.title         || 'Test Plan',
      overrides.goal          || 'muscle_gain',
      overrides.fitness_level || 'beginner',
      overrides.is_active     ?? true,
      overrides.is_customized ?? false,
    ]
  );

  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const days = [];
  for (let dow = 1; dow <= 7; dow++) {
    const { rows: [day] } = await db.query(
      `INSERT INTO workout_days (workout_plan_id, day_of_week, day_label, is_rest_day)
       VALUES ($1, $2, $3, true) RETURNING *`,
      [plan.id, dow, DAY_NAMES[dow - 1]]
    );
    days.push(day);
  }

  return { plan, days };
};

beforeEach(async () => {
  await global.truncateAll();
});

// =============================================================================
// 1. GET /api/workouts/exercises
// =============================================================================
describe('GET /api/workouts/exercises', () => {

  it('should list all exercises', async () => {
    await seedExercises('beginner', 2);
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/workouts/exercises')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(16); // 8 groups × 2 exercises each
  });

  it('should filter by muscle_group', async () => {
    await seedExercises('beginner', 2);
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/workouts/exercises?muscle_group=chest')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach((ex) => expect(ex.muscle_group).toBe('chest'));
  });

  it('should filter by difficulty', async () => {
    await seedExercises('beginner');
    await seedExercises('advanced');
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/workouts/exercises?difficulty=advanced')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach((ex) => expect(ex.difficulty).toBe('advanced'));
  });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/workouts/exercises');
    expect(res.status).toBe(401);
  });
});


// =============================================================================
// 2. GET /api/workouts/exercises/:exerciseId
// =============================================================================
describe('GET /api/workouts/exercises/:exerciseId', () => {

  it('should return a single exercise by ID', async () => {
    const [exercise] = await seedExercises('beginner', 1);
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get(`/api/workouts/exercises/${exercise.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(exercise.id);
    expect(res.body.data.name).toBe(exercise.name);
  });

  it('should return 404 for a non-existent exercise', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/workouts/exercises/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it('should return 400 for an invalid UUID', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/workouts/exercises/not-a-uuid')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });
});


// =============================================================================
// 3. POST /api/workouts/admin/exercises
// =============================================================================
describe('POST /api/workouts/admin/exercises', () => {

  it('should create a new exercise in the catalog', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post('/api/workouts/admin/exercises')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name:         'Flat Bench Press',
        muscle_group: 'chest',
        equipment:    'barbell',
        difficulty:   'intermediate',
        description:  'Classic chest press',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name:         'Flat Bench Press',
      muscle_group: 'chest',
      difficulty:   'intermediate',
    });
  });

  it('should return 409 for a duplicate exercise name', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    await request(app)
      .post('/api/workouts/admin/exercises')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Squat', muscle_group: 'legs', difficulty: 'beginner' });

    const res = await request(app)
      .post('/api/workouts/admin/exercises')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Squat', muscle_group: 'legs', difficulty: 'beginner' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('should return 400 for an invalid muscle_group', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post('/api/workouts/admin/exercises')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Mystery Move', muscle_group: 'neck', difficulty: 'beginner' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'muscle_group' }),
      ])
    );
  });

  it('should return 400 when required fields are missing', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post('/api/workouts/admin/exercises')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'No Group' }); // missing muscle_group

    expect(res.status).toBe(400);
  });

  it('should return 403 for a regular member', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/workouts/admin/exercises')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Bench Press', muscle_group: 'chest', difficulty: 'beginner' });

    expect(res.status).toBe(403);
  });
});


// =============================================================================
// 4. PATCH /api/workouts/admin/exercises/:exerciseId
// =============================================================================
describe('PATCH /api/workouts/admin/exercises/:exerciseId', () => {

  it('should update an exercise', async () => {
    const [exercise] = await seedExercises('beginner', 1);
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .patch(`/api/workouts/admin/exercises/${exercise.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ difficulty: 'advanced', equipment: 'dumbbell' });

    expect(res.status).toBe(200);
    expect(res.body.data.difficulty).toBe('advanced');
    expect(res.body.data.equipment).toBe('dumbbell');
  });

  it('should return 404 for a non-existent exercise', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .patch('/api/workouts/admin/exercises/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ difficulty: 'advanced' });

    expect(res.status).toBe(404);
  });

  it('should return 400 when body is empty', async () => {
    const [exercise] = await seedExercises('beginner', 1);
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .patch(`/api/workouts/admin/exercises/${exercise.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});


// =============================================================================
// 5. POST /api/workouts/resolve-goal
// =============================================================================
describe('POST /api/workouts/resolve-goal', () => {

  it('should return a goal key for a fitness-related description', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/workouts/resolve-goal')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: 'I want to build bigger arms and gain muscle mass' });

    console.log('resolve-goal response:', res.body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_fitness_related).toBe(true);
    expect(res.body.data.goal).toBe('muscle_gain');
    expect(['high', 'medium', 'low']).toContain(res.body.data.confidence);
    expect(res.body.data.redirect_message).toBeNull();
  });

  it('should return 400 with a redirect_message for non-fitness input', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/workouts/resolve-goal')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: 'How do I make pasta carbonara?' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.data.is_fitness_related).toBe(false);
    expect(res.body.data.goal).toBeNull();
    expect(typeof res.body.message).toBe('string');
    expect(res.body.message.length).toBeGreaterThan(0);
  });
});


// =============================================================================
// 6. POST /api/workouts/generate  (FR-07)
// =============================================================================
describe('POST /api/workouts/generate', () => {

  it('should generate a 7-day plan with exercises', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    await seedExercises('beginner', 3);

    const res = await request(app)
      .post('/api/workouts/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title:         'My First Plan',
        goal:          'muscle_gain',
        fitness_level: 'beginner',
        days_per_week: 3,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.plan).toMatchObject({
      title:         'My First Plan',
      goal:          'muscle_gain',
      fitness_level: 'beginner',
      is_active:     true,
      is_customized: false,
    });

    // 7 days returned
    expect(res.body.data.schedule).toHaveLength(7);

    // Active days have exercises
    const activeDays = res.body.data.schedule.filter((d) => !d.is_rest_day);
    expect(activeDays.length).toBe(3);
    activeDays.forEach((d) => {
      expect(d.exercises.length).toBeGreaterThan(0);
    });
  });

  it('should deactivate the previous active plan on generate', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    await seedExercises('beginner', 3);

    // First plan
    await request(app)
      .post('/api/workouts/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Plan A', goal: 'muscle_gain', fitness_level: 'beginner', days_per_week: 3 });

    // Second plan — should deactivate Plan A
    await request(app)
      .post('/api/workouts/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Plan B', goal: 'weight_loss', fitness_level: 'beginner', days_per_week: 3 });

    const { rows } = await db.query(
      `SELECT title, is_active FROM workout_plans WHERE user_id = $1 ORDER BY created_at ASC`,
      [user.id]
    );

    expect(rows[0].title).toBe('Plan A');
    expect(rows[0].is_active).toBe(false);
    expect(rows[1].title).toBe('Plan B');
    expect(rows[1].is_active).toBe(true);
  });

  it('should return 400 when catalog has too few exercises', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    // seed only 1 exercise — not enough

    await db.query(
      `INSERT INTO exercises (name, muscle_group, difficulty) VALUES ('Squat', 'legs', 'beginner')`
    );

    const res = await request(app)
      .post('/api/workouts/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Plan', goal: 'muscle_gain', fitness_level: 'beginner', days_per_week: 3 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not enough exercises/i);
  });

  it('should return 400 when required fields are missing', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);

    const res = await request(app)
      .post('/api/workouts/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Plan' }); // missing goal, fitness_level, days_per_week

    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('should return 403 when member has no active membership', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/workouts/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Plan', goal: 'muscle_gain', fitness_level: 'beginner', days_per_week: 3 });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/active membership/i);
  });
});


// =============================================================================
// 7. POST /api/workouts  (create custom plan)
// =============================================================================
describe('POST /api/workouts', () => {

  it('should create a blank custom plan with 7 rest days', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);

    const res = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'My Custom Plan', fitness_level: 'intermediate' });

    expect(res.status).toBe(201);
    expect(res.body.data.plan.is_customized).toBe(true);
    expect(res.body.data.schedule).toHaveLength(7);
    res.body.data.schedule.forEach((d) => {
      expect(d.is_rest_day).toBe(true);
      expect(d.exercises).toHaveLength(0);
    });
  });

  it('should deactivate the previous active plan', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    await seedPlan(user.id, { is_active: true });

    await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'New Custom Plan', fitness_level: 'beginner' });

    const { rows } = await db.query(
      `SELECT COUNT(*) FROM workout_plans WHERE user_id = $1 AND is_active = true`,
      [user.id]
    );
    expect(parseInt(rows[0].count)).toBe(1);
  });

  it('should return 400 when title is missing', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);

    const res = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fitness_level: 'beginner' });

    expect(res.status).toBe(400);
  });
});


// =============================================================================
// 8. GET /api/workouts/active
// =============================================================================
describe('GET /api/workouts/active', () => {

  it('should return the active plan with a 7-day schedule', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    await seedPlan(user.id, { is_active: true });

    const res = await request(app)
      .get('/api/workouts/active')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.plan).toBeDefined();
    expect(res.body.data.schedule).toHaveLength(7);

    // Sorted Mon → Sun
    const days = res.body.data.schedule;
    for (let i = 1; i < days.length; i++) {
      expect(days[i].day_of_week).toBeGreaterThan(days[i - 1].day_of_week);
    }
  });

  it('should return 404 when no active plan exists', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);

    const res = await request(app)
      .get('/api/workouts/active')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/no active workout plan/i);
  });
});


// =============================================================================
// 9. GET /api/workouts  (list all plans)
// =============================================================================
describe('GET /api/workouts', () => {

  it('should return all plans for the user', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    await seedPlan(user.id, { title: 'Plan A', is_active: true });
    await seedPlan(user.id, { title: 'Plan B', is_active: false });

    const res = await request(app)
      .get('/api/workouts')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  it('should not return plans from other users', async () => {
    const { user: user1, accessToken } = await registerAndLogin();
    const { user: user2 } = await registerAndLogin({ email: 'user2@example.com' });
    await grantMembership(user1.id);
    await grantMembership(user2.id);
    await seedPlan(user1.id, { title: 'User1 Plan' });
    await seedPlan(user2.id, { title: 'User2 Plan' });

    const res = await request(app)
      .get('/api/workouts')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].title).toBe('User1 Plan');
  });
});


// =============================================================================
// 10. GET /api/workouts/:planId
// =============================================================================
describe('GET /api/workouts/:planId', () => {

  it('should return a specific plan schedule', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    const { plan } = await seedPlan(user.id);

    const res = await request(app)
      .get(`/api/workouts/${plan.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.plan.id).toBe(plan.id);
    expect(res.body.data.schedule).toHaveLength(7);
  });

  it('should return 404 for another user\'s plan', async () => {
    const { user: user1, accessToken } = await registerAndLogin();
    const { user: user2 } = await registerAndLogin({ email: 'user2@example.com' });
    await grantMembership(user1.id);
    await grantMembership(user2.id);
    const { plan } = await seedPlan(user2.id); // belongs to user2

    const res = await request(app)
      .get(`/api/workouts/${plan.id}`)
      .set('Authorization', `Bearer ${accessToken}`); // user1's token

    expect(res.status).toBe(404);
  });
});


// =============================================================================
// 11. PATCH /api/workouts/:planId  (FR-08)
// =============================================================================
describe('PATCH /api/workouts/:planId', () => {

  it('should update plan title and goal', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    const { plan } = await seedPlan(user.id);

    const res = await request(app)
      .patch(`/api/workouts/${plan.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Updated Title', goal: 'weight_loss' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title');
    expect(res.body.data.is_customized).toBe(true);
  });

  it('should return 404 for another user\'s plan', async () => {
    const { user: user1, accessToken } = await registerAndLogin();
    const { user: user2 } = await registerAndLogin({ email: 'user2@example.com' });
    await grantMembership(user1.id);
    await grantMembership(user2.id);
    const { plan } = await seedPlan(user2.id);

    const res = await request(app)
      .patch(`/api/workouts/${plan.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Hacked Title' });

    expect(res.status).toBe(404);
  });

  it('should return 400 when body is empty', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    const { plan } = await seedPlan(user.id);

    const res = await request(app)
      .patch(`/api/workouts/${plan.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});


// =============================================================================
// 12. POST /api/workouts/:planId/activate
// =============================================================================
describe('POST /api/workouts/:planId/activate', () => {

  it('should activate an inactive plan and deactivate the current one', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    const { plan: activePlan }   = await seedPlan(user.id, { is_active: true,  title: 'Active' });
    const { plan: inactivePlan } = await seedPlan(user.id, { is_active: false, title: 'Inactive' });

    const res = await request(app)
      .post(`/api/workouts/${inactivePlan.id}/activate`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);

    const { rows } = await db.query(
      `SELECT title, is_active FROM workout_plans WHERE user_id = $1 ORDER BY created_at ASC`,
      [user.id]
    );
    expect(rows.find((r) => r.title === 'Active').is_active).toBe(false);
    expect(rows.find((r) => r.title === 'Inactive').is_active).toBe(true);
  });

  it('should return 409 when trying to activate an already active plan', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    const { plan } = await seedPlan(user.id, { is_active: true });

    const res = await request(app)
      .post(`/api/workouts/${plan.id}/activate`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(409);
  });
});


// =============================================================================
// 13. DELETE /api/workouts/:planId
// =============================================================================
describe('DELETE /api/workouts/:planId', () => {

  it('should delete an inactive plan', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    const { plan } = await seedPlan(user.id, { is_active: false });

    const res = await request(app)
      .delete(`/api/workouts/${plan.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);

    const { rows } = await db.query(
      `SELECT id FROM workout_plans WHERE id = $1`, [plan.id]
    );
    expect(rows).toHaveLength(0);
  });

  it('should return 400 when trying to delete the active plan', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    const { plan } = await seedPlan(user.id, { is_active: true });

    const res = await request(app)
      .delete(`/api/workouts/${plan.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot delete the active plan/i);
  });

  it('should return 404 for a non-existent plan', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);

    const res = await request(app)
      .delete('/api/workouts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });
});


// =============================================================================
// 14. PATCH /api/workouts/:planId/days/:dayId  (FR-08)
// =============================================================================
describe('PATCH /api/workouts/:planId/days/:dayId', () => {

  it('should update day label', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    const { plan, days } = await seedPlan(user.id);
    const monday = days.find((d) => d.day_of_week === 1);

    const res = await request(app)
      .patch(`/api/workouts/${plan.id}/days/${monday.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ day_label: 'Chest day' });

    console.log("Error details:", res.body);
    expect(res.status).toBe(200);
    expect(res.body.data.day_label).toBe('Chest day');
  });

  it('should toggle is_rest_day', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    const { plan, days } = await seedPlan(user.id);
    const tuesday = days.find((d) => d.day_of_week === 2);

    const res = await request(app)
      .patch(`/api/workouts/${plan.id}/days/${tuesday.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ is_rest_day: false });

    expect(res.status).toBe(200);
    expect(res.body.data.is_rest_day).toBe(false);
  });

  it('should return 404 for a day not belonging to this plan', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    const { plan }          = await seedPlan(user.id);
    const { days: otherDays } = await seedPlan(user.id, { is_active: false });

    const res = await request(app)
      .patch(`/api/workouts/${plan.id}/days/${otherDays[0].id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ day_label: 'Hack' });

    expect(res.status).toBe(404);
  });
});


// =============================================================================
// 15. PUT /api/workouts/:planId/days/:dayId/exercises  (FR-08)
// =============================================================================
describe('PUT /api/workouts/:planId/days/:dayId/exercises', () => {

  it('should set exercises for a day', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    const exercises = await seedExercises('beginner', 1);
    const { plan, days } = await seedPlan(user.id);
    const monday = days.find((d) => d.day_of_week === 1);

    const res = await request(app)
      .put(`/api/workouts/${plan.id}/days/${monday.id}/exercises`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        exercises: [
          { exercise_id: exercises[0].id, sets: 4, reps: 10, rest_seconds: 60 },
          { exercise_id: exercises[1].id, sets: 3, reps: 12, rest_seconds: 45 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].order_index).toBe(0);
    expect(res.body.data[1].order_index).toBe(1);

    const { rows: [updatedDay] } = await db.query(
      `SELECT is_rest_day FROM workout_days WHERE id = $1`,
      [monday.id]
    );
    expect(updatedDay.is_rest_day).toBe(false);
  });

  it('should replace existing exercises (not append)', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    const exercises = await seedExercises('beginner', 1);
    const { plan, days } = await seedPlan(user.id);
    const monday = days.find((d) => d.day_of_week === 1);

    // Set 2 exercises
    await request(app)
      .put(`/api/workouts/${plan.id}/days/${monday.id}/exercises`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        exercises: [
          { exercise_id: exercises[0].id, sets: 3, reps: 10 },
          { exercise_id: exercises[1].id, sets: 3, reps: 10 },
        ],
      });

    // Replace with 1 exercise
    const res = await request(app)
      .put(`/api/workouts/${plan.id}/days/${monday.id}/exercises`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        exercises: [
          { exercise_id: exercises[0].id, sets: 5, reps: 5 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1); // not 3
  });

  it('should allow clearing all exercises by sending empty array', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    const exercises = await seedExercises('beginner', 1);
    const { plan, days } = await seedPlan(user.id);
    const monday = days.find((d) => d.day_of_week === 1);

    // Set exercises
    await request(app)
      .put(`/api/workouts/${plan.id}/days/${monday.id}/exercises`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ exercises: [{ exercise_id: exercises[0].id, sets: 3, reps: 10 }] });

    // Clear
    const res = await request(app)
      .put(`/api/workouts/${plan.id}/days/${monday.id}/exercises`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ exercises: [] });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);

    const { rows: [updatedDay] } = await db.query(
      `SELECT is_rest_day FROM workout_days WHERE id = $1`,
      [monday.id]
    );
    expect(updatedDay.is_rest_day).toBe(true);
  });

  it('should return 400 for a non-existent exercise_id', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    const { plan, days } = await seedPlan(user.id);

    const res = await request(app)
      .put(`/api/workouts/${plan.id}/days/${days[0].id}/exercises`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        exercises: [
          {
            exercise_id: '00000000-0000-0000-0000-000000000000',
            sets:        3,
            reps:        10,
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not found in catalog/i);
  });

  it('should mark the plan as customized after setting exercises', async () => {
    const { user, accessToken } = await registerAndLogin();
    await grantMembership(user.id);
    const exercises = await seedExercises('beginner', 1);
    const { plan, days } = await seedPlan(user.id, { is_customized: false });

    await request(app)
      .put(`/api/workouts/${plan.id}/days/${days[0].id}/exercises`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ exercises: [{ exercise_id: exercises[0].id, sets: 3, reps: 10 }] });

    const { rows } = await db.query(
      `SELECT is_customized FROM workout_plans WHERE id = $1`, [plan.id]
    );
    expect(rows[0].is_customized).toBe(true);
  });
});


// =============================================================================
// 16. Unit: workouts.generator
// =============================================================================
describe('workouts.generator (unit)', () => {

  // Minimal fake exercise catalog with goal_tags
  const makeCatalog = (difficulty = 'beginner') => {
    const groups = ['chest','back','legs','shoulders','arms','core','cardio','full_body'];
    const catalog = [];
    groups.forEach((g) => {
      for (let i = 0; i < 4; i++) {
        catalog.push({
          id:           `${g}-${i}`,
          name:         `${g} ex${i}`,
          muscle_group: g,
          difficulty,
          goal_tags:    i === 0
            ? ['muscle_gain']          // first exercise in group tagged for muscle_gain
            : i === 1
              ? ['weight_loss', 'endurance']
              : ['general_fitness'],   // rest are general
        });
      }
    });
    return catalog;
  };

  // ── buildCatalogIndex ───────────────────────────────────────────────────────
  describe('buildCatalogIndex', () => {
    it('should build byGroup index correctly', () => {
      const catalog = makeCatalog();
      const { byGroup } = buildCatalogIndex(catalog);

      expect(Object.keys(byGroup)).toContain('chest');
      expect(byGroup['chest'].length).toBe(4);
    });

    it('should build byTag index correctly', () => {
      const catalog = makeCatalog();
      const { byTag } = buildCatalogIndex(catalog);

      expect(byTag['muscle_gain']).toBeDefined();
      expect(byTag['weight_loss']).toBeDefined();
      // Every group has 1 muscle_gain exercise
      expect(byTag['muscle_gain'].length).toBe(8); // 8 groups × 1
    });

    it('should handle exercises with no goal_tags gracefully', () => {
      const catalog = [{ id: 'x', name: 'test', muscle_group: 'chest', goal_tags: undefined }];
      expect(() => buildCatalogIndex(catalog)).not.toThrow();
    });
  });

  // ── scoreExercise ───────────────────────────────────────────────────────────
  describe('scoreExercise', () => {
    it('should return 3 for priority tag match', () => {
      const ex = { goal_tags: ['muscle_gain', 'general_fitness'] };
      expect(scoreExercise(ex, ['muscle_gain'], ['weight_loss'])).toBe(3);
    });

    it('should return 1 for secondary tag match', () => {
      const ex = { goal_tags: ['weight_loss'] };
      expect(scoreExercise(ex, ['muscle_gain'], ['weight_loss'])).toBe(1);
    });

    it('should return 0 when no tags match', () => {
      const ex = { goal_tags: ['flexibility'] };
      expect(scoreExercise(ex, ['muscle_gain'], ['weight_loss'])).toBe(0);
    });

    it('should return 0 for exercises with no goal_tags', () => {
      const ex = { goal_tags: [] };
      expect(scoreExercise(ex, ['muscle_gain'], ['weight_loss'])).toBe(0);
    });
  });

  // ── pickBestExercises ───────────────────────────────────────────────────────
  describe('pickBestExercises', () => {
    const profile = GOAL_PROFILES['muscle_gain'];

    it('should return highest-scoring exercises first', () => {
      const pool = [
        { id: 'a', name: 'Bench',  goal_tags: ['general_fitness'] },
        { id: 'b', name: 'Squat',  goal_tags: ['muscle_gain'] },
        { id: 'c', name: 'Lunge',  goal_tags: ['weight_loss'] },
      ];
      const picked = pickBestExercises(pool, 2, profile);
      // 'Squat' scores 3, should be first
      expect(picked[0].id).toBe('b');
    });

    it('should use alphabetical name as tie-break for same score', () => {
      const pool = [
        { id: 'z', name: 'Z Exercise', goal_tags: ['muscle_gain'] },
        { id: 'a', name: 'A Exercise', goal_tags: ['muscle_gain'] },
      ];
      const picked = pickBestExercises(pool, 2, profile);
      expect(picked[0].name).toBe('A Exercise');
      expect(picked[1].name).toBe('Z Exercise');
    });

    it('should return at most count exercises', () => {
      const pool = makeCatalog().filter((e) => e.muscle_group === 'chest');
      const picked = pickBestExercises(pool, 2, profile);
      expect(picked.length).toBe(2);
    });

    it('should return empty array for empty pool', () => {
      expect(pickBestExercises([], 3, profile)).toEqual([]);
    });

    it('should return all exercises if count > pool size', () => {
      const pool = [{ id: 'a', name: 'Solo', goal_tags: ['muscle_gain'] }];
      expect(pickBestExercises(pool, 10, profile).length).toBe(1);
    });
  });

  // ── buildWeeklyPlan ─────────────────────────────────────────────────────────
  describe('buildWeeklyPlan', () => {
    it('should always return exactly 7 days', () => {
      const plan = buildWeeklyPlan({
        goal: 'muscle_gain', fitness_level: 'beginner',
        days_per_week: 3, exerciseCatalog: makeCatalog(),
      });
      expect(plan).toHaveLength(7);
    });

    it('should have correct number of active (non-rest) days', () => {
      [2, 3, 4, 5, 6].forEach((daysPerWeek) => {
        const plan = buildWeeklyPlan({
          goal: 'muscle_gain', fitness_level: 'beginner',
          days_per_week: daysPerWeek, exerciseCatalog: makeCatalog(),
        });
        const activeDays = plan.filter((d) => !d.is_rest_day);
        expect(activeDays.length).toBe(daysPerWeek);
      });
    });

    it('should inject cardio exercises for weight_loss goal', () => {
      const plan = buildWeeklyPlan({
        goal: 'weight_loss', fitness_level: 'beginner',
        days_per_week: 3, exerciseCatalog: makeCatalog(),
      });
      const allIds = plan.filter((d) => !d.is_rest_day)
        .flatMap((d) => d.exercises.map((e) => e.exercise_id));
      expect(allIds.some((id) => id.startsWith('cardio'))).toBe(true);
    });

    it('should inject cardio for endurance goal', () => {
      const plan = buildWeeklyPlan({
        goal: 'endurance', fitness_level: 'beginner',
        days_per_week: 3, exerciseCatalog: makeCatalog(),
      });
      const hasCardio = plan.filter((d) => !d.is_rest_day)
        .some((d) => d.exercises.some((e) => e.exercise_id.startsWith('cardio')));
      expect(hasCardio).toBe(true);
    });

    it('should NOT inject cardio for muscle_gain goal', () => {
      const plan = buildWeeklyPlan({
        goal: 'muscle_gain', fitness_level: 'beginner',
        days_per_week: 3, exerciseCatalog: makeCatalog(),
      });
      const allIds = plan.filter((d) => !d.is_rest_day)
        .flatMap((d) => d.exercises.map((e) => e.exercise_id));
      // Cardio only on dedicated cardio days — not injected into every day
      // For 3-day split (push/pull/legs) there's no dedicated cardio day
      const chestDayHasCardio = plan.find((d) => d.day_label === 'Push day')
        ?.exercises.some((e) => e.exercise_id.startsWith('cardio'));
      expect(chestDayHasCardio).toBe(false);
    });

    it('should use higher sets for muscle_gain vs weight_loss at same fitness level', () => {
      const muscleGainPlan = buildWeeklyPlan({
        goal: 'muscle_gain', fitness_level: 'intermediate',
        days_per_week: 3, exerciseCatalog: makeCatalog('intermediate'),
      });
      const weightLossPlan = buildWeeklyPlan({
        goal: 'weight_loss', fitness_level: 'intermediate',
        days_per_week: 3, exerciseCatalog: makeCatalog('intermediate'),
      });

      const mgSets = muscleGainPlan.find((d) => !d.is_rest_day)?.exercises[0]?.sets;
      const wlSets = weightLossPlan.find((d) => !d.is_rest_day)?.exercises[0]?.sets;

      expect(mgSets).toBeGreaterThanOrEqual(wlSets);
    });

    it('should use higher reps for weight_loss vs muscle_gain at same fitness level', () => {
      const muscleGainPlan = buildWeeklyPlan({
        goal: 'muscle_gain', fitness_level: 'intermediate',
        days_per_week: 3, exerciseCatalog: makeCatalog('intermediate'),
      });
      const weightLossPlan = buildWeeklyPlan({
        goal: 'weight_loss', fitness_level: 'intermediate',
        days_per_week: 3, exerciseCatalog: makeCatalog('intermediate'),
      });

      const mgReps = muscleGainPlan.find((d) => !d.is_rest_day)?.exercises[0]?.reps;
      const wlReps = weightLossPlan.find((d) => !d.is_rest_day)?.exercises[0]?.reps;

      expect(wlReps).toBeGreaterThan(mgReps);
    });

    it('should use shorter rest for weight_loss vs muscle_gain', () => {
      const mgPlan = buildWeeklyPlan({
        goal: 'muscle_gain', fitness_level: 'beginner',
        days_per_week: 3, exerciseCatalog: makeCatalog(),
      });
      const wlPlan = buildWeeklyPlan({
        goal: 'weight_loss', fitness_level: 'beginner',
        days_per_week: 3, exerciseCatalog: makeCatalog(),
      });

      const mgRest = mgPlan.find((d) => !d.is_rest_day)?.exercises[0]?.rest_seconds;
      const wlRest = wlPlan.find((d) => !d.is_rest_day)?.exercises[0]?.rest_seconds;

      expect(wlRest).toBeLessThan(mgRest);
    });

    it('should append goal suffix to day labels for weight_loss', () => {
      const plan = buildWeeklyPlan({
        goal: 'weight_loss', fitness_level: 'beginner',
        days_per_week: 3, exerciseCatalog: makeCatalog(),
      });
      const activeDay = plan.find((d) => !d.is_rest_day);
      expect(activeDay.day_label).toContain('Cardio');
    });

    it('should produce deterministic output for same inputs (no random)', () => {
      const params = {
        goal: 'muscle_gain', fitness_level: 'beginner',
        days_per_week: 3, exerciseCatalog: makeCatalog(),
      };
      const plan1 = buildWeeklyPlan(params);
      const plan2 = buildWeeklyPlan(params);

      const ids1 = plan1.flatMap((d) => d.exercises.map((e) => e.exercise_id)).join(',');
      const ids2 = plan2.flatMap((d) => d.exercises.map((e) => e.exercise_id)).join(',');
      expect(ids1).toBe(ids2);
    });

    it('should assign order_index starting from 0 within each day', () => {
      const plan = buildWeeklyPlan({
        goal: 'muscle_gain', fitness_level: 'beginner',
        days_per_week: 3, exerciseCatalog: makeCatalog(),
      });
      plan.filter((d) => !d.is_rest_day).forEach((day) => {
        day.exercises.forEach((ex, i) => {
          expect(ex.order_index).toBe(i);
        });
      });
    });

    it('should assign day_of_week 1–7 in order', () => {
      const plan = buildWeeklyPlan({
        goal: 'general_fitness', fitness_level: 'beginner',
        days_per_week: 3, exerciseCatalog: makeCatalog(),
      });
      const dows = plan.map((d) => d.day_of_week);
      expect(dows).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('should fall back to general_fitness profile for unknown goal', () => {
      expect(() => buildWeeklyPlan({
        goal: 'nonexistent_goal', fitness_level: 'beginner',
        days_per_week: 3, exerciseCatalog: makeCatalog(),
      })).not.toThrow();
    });

    it('should keep focused abs requests on core exercises only', () => {
      const plan = buildWeeklyPlan({
        goal: 'general_fitness',
        fitness_level: 'beginner',
        days_per_week: 3,
        exerciseCatalog: makeCatalog(),
        focus_muscle_groups: ['core'],
      });
      const activeDays = plan.filter((day) => !day.is_rest_day);
      const exerciseGroups = new Set(
        activeDays
          .flatMap((day) => day.exercises)
          .map((exercise) => exercise.exercise_id.split('-')[0])
      );

      expect(activeDays).toHaveLength(3);
      expect(Array.from(exerciseGroups)).toEqual(['core']);
      activeDays.forEach((day) => {
        expect(day.day_label).toBe('Focus: Core');
      });
    });
  });

  describe('classifyGoalLocally', () => {
    it('should reject non-fitness food requests instead of generating a plan', () => {
      const result = classifyGoalLocally('I want to eat chicken');

      expect(result).toMatchObject({
        is_fitness_related: false,
        goal: null,
      });
    });

    it('should detect Vietnamese abs requests as a core focus', () => {
      const result = classifyGoalLocally('Toi muon tap mui bung');

      expect(result).toMatchObject({
        is_fitness_related: true,
        focus_muscle_groups: ['core'],
      });
    });
  });
});
