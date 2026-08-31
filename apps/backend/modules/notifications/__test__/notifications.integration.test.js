/**
 * Integration coverage for workout reminder recipient selection.
 *
 * These tests hit PostgreSQL because the important behavior lives in the SQL:
 * only the user's selected active workout plan should be considered.
 */

const db = require('../../../config/db');
const service = require('../notifications.service');
const { NOTIFICATION_TYPE } = require('../notifications.constants');

const dateOnly = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isoDayOfWeek = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  const localDay = new Date(year, month - 1, day).getDay();
  return localDay === 0 ? 7 : localDay;
};

const scheduleDate = (offsetDays = 0) => {
  const date = dateOnly(offsetDays);
  return {
    date,
    day_of_week: isoDayOfWeek(date),
  };
};

const createMember = async (email) => {
  const {
    rows: [user],
  } = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role, account_status)
     VALUES ($1, 'test-hash', $2, 'member', 'active')
     RETURNING id, email, full_name`,
    [email, email.split('@')[0]]
  );

  return user;
};

const grantActiveMembership = async (userId, activeDate) => {
  const {
    rows: [membershipPlan],
  } = await db.query(
    `INSERT INTO membership_plans (name, price, duration_days, is_active)
     VALUES ($1, 100000, 30, true)
     RETURNING id`,
    [`Plan ${userId}`]
  );

  await db.query(
    `INSERT INTO memberships (user_id, plan_id, status, start_date, end_date)
     VALUES ($1, $2, 'active', $3::date - 1, $3::date + 30)`,
    [userId, membershipPlan.id, activeDate]
  );
};

const createWorkoutPlanForDate = async (
  userId,
  { title, isActive, isRestDay, dayOfWeek, hasExercises }
) => {
  const shouldCreateExercises = hasExercises ?? !isRestDay;
  const {
    rows: [workoutPlan],
  } = await db.query(
    `INSERT INTO workout_plans (user_id, title, goal, fitness_level, is_active)
     VALUES ($1, $2, 'general_fitness', 'beginner', $3)
     RETURNING id`,
    [userId, title, isActive]
  );

  const {
    rows: [workoutDay],
  } = await db.query(
    `INSERT INTO workout_days (workout_plan_id, day_of_week, day_label, is_rest_day)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [workoutPlan.id, dayOfWeek, `${title} today`, isRestDay]
  );

  if (shouldCreateExercises) {
    const {
      rows: [exercise],
    } = await db.query(
      `INSERT INTO exercises (name, muscle_group, equipment, difficulty, goal_tags)
       VALUES ($1, 'full_body', 'bodyweight', 'beginner', $2)
       RETURNING id`,
      [`${title} exercise`, ['general_fitness']]
    );

    await db.query(
      `INSERT INTO workout_day_exercises
         (workout_day_id, exercise_id, sets, reps, rest_seconds, order_index)
       VALUES ($1, $2, 3, 10, 60, 0)`,
      [workoutDay.id, exercise.id]
    );
  }

  return workoutPlan;
};

const workoutCheckinsHasBranchId = async () => {
  const {
    rows: [column],
  } = await db.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'workout_checkins'
         AND column_name = 'branch_id'
     ) AS exists`
  );

  return column.exists;
};

const createCheckinOnDate = async (userId, checkinDate) => {
  if (!(await workoutCheckinsHasBranchId())) {
    await db.query(
      `INSERT INTO workout_checkins (user_id, checkin_date)
       VALUES ($1, $2::date)`,
      [userId, checkinDate]
    );
    return;
  }

  const {
    rows: [branch],
  } = await db.query(
    `INSERT INTO gym_branches (name, capacity, is_active)
     VALUES ($1, 100, true)
     RETURNING id`,
    [`Branch ${userId}`]
  );

  await db.query(
    `INSERT INTO workout_checkins (user_id, branch_id, checkin_date)
     VALUES ($1, $2, $3::date)`,
    [userId, branch.id, checkinDate]
  );
};

describe('workout reminder integration', () => {
  beforeEach(async () => {
    await global.truncateAll();
  });

  it('sends reminders only for the selected active plan and members without a check-in on the target date', async () => {
    const today = scheduleDate(2);
    const shouldReceive = await createMember('reminder-target@example.com');
    const inactivePlanOnly = await createMember('inactive-plan@example.com');
    const alreadyCheckedIn = await createMember('checked-in@example.com');

    await grantActiveMembership(shouldReceive.id, today.date);
    await grantActiveMembership(inactivePlanOnly.id, today.date);
    await grantActiveMembership(alreadyCheckedIn.id, today.date);

    await createWorkoutPlanForDate(shouldReceive.id, {
      title: 'Selected Plan',
      isActive: true,
      isRestDay: false,
      dayOfWeek: today.day_of_week,
    });
    await createWorkoutPlanForDate(shouldReceive.id, {
      title: 'Old Plan',
      isActive: false,
      isRestDay: false,
      dayOfWeek: today.day_of_week,
    });

    await createWorkoutPlanForDate(inactivePlanOnly.id, {
      title: 'Selected Rest Plan',
      isActive: true,
      isRestDay: true,
      dayOfWeek: today.day_of_week,
    });
    await createWorkoutPlanForDate(inactivePlanOnly.id, {
      title: 'Inactive Workout Plan',
      isActive: false,
      isRestDay: false,
      dayOfWeek: today.day_of_week,
    });

    await createWorkoutPlanForDate(alreadyCheckedIn.id, {
      title: 'Checked In Plan',
      isActive: true,
      isRestDay: false,
      dayOfWeek: today.day_of_week,
    });
    await createCheckinOnDate(alreadyCheckedIn.id, today.date);

    const result = await service.sendWorkoutReminderNotifications(today.date);

    expect(result).toMatchObject({
      reminder_date: today.date,
      scanned_count: 1,
      created_count: 1,
      skipped_count: 0,
    });

    const { rows: notifications } = await db.query(
      `SELECT user_id, type, title, body
       FROM notifications
       ORDER BY sent_at ASC`
    );

    expect(notifications).toEqual([
      {
        user_id: shouldReceive.id,
        type: NOTIFICATION_TYPE.WORKOUT_REMINDER,
        title: 'Workout reminder',
        body: "Don't forget your workout today! Keep your streak going.",
      },
    ]);
  });

  it('completes silently when all active-plan members have checked in on the target date', async () => {
    const today = scheduleDate(1);
    const member = await createMember('already-done@example.com');

    await grantActiveMembership(member.id, today.date);
    await createWorkoutPlanForDate(member.id, {
      title: 'Selected Plan',
      isActive: true,
      isRestDay: false,
      dayOfWeek: today.day_of_week,
    });
    await createCheckinOnDate(member.id, today.date);

    const result = await service.sendWorkoutReminderNotifications(today.date);
    const { rows: notifications } = await db.query(`SELECT id FROM notifications`);

    expect(result).toMatchObject({
      reminder_date: today.date,
      scanned_count: 0,
      created_count: 0,
      skipped_count: 0,
    });
    expect(notifications).toHaveLength(0);
  });

  it('sends reminders for exercise days even when the rest-day flag is stale', async () => {
    const today = scheduleDate(3);
    const member = await createMember('stale-rest-flag@example.com');

    await grantActiveMembership(member.id, today.date);
    await createWorkoutPlanForDate(member.id, {
      title: 'Stale Rest Flag Plan',
      isActive: true,
      isRestDay: true,
      hasExercises: true,
      dayOfWeek: today.day_of_week,
    });

    const result = await service.sendWorkoutReminderNotifications(today.date);
    const { rows: notifications } = await db.query(
      `SELECT user_id, type
       FROM notifications`
    );

    expect(result).toMatchObject({
      reminder_date: today.date,
      scanned_count: 1,
      created_count: 1,
      skipped_count: 0,
    });
    expect(notifications).toEqual([
      {
        user_id: member.id,
        type: NOTIFICATION_TYPE.WORKOUT_REMINDER,
      },
    ]);
  });
});
