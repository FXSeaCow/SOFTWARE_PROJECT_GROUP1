/**
 * Integration coverage for workout reminder recipient selection.
 *
 * These tests hit PostgreSQL because the important behavior lives in the SQL:
 * only the user's selected active workout plan should be considered.
 */

const db = require('../../../config/db');
const service = require('../notifications.service');
const { NOTIFICATION_TYPE } = require('../notifications.constants');

const getDbToday = async () => {
  const {
    rows: [today],
  } = await db.query(
    `SELECT CURRENT_DATE::TEXT AS date,
            EXTRACT(ISODOW FROM CURRENT_DATE)::INT AS day_of_week`
  );
  return today;
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

const grantActiveMembership = async (userId) => {
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
     VALUES ($1, $2, 'active', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days')`,
    [userId, membershipPlan.id]
  );
};

const createWorkoutPlanForToday = async (
  userId,
  { title, isActive, isRestDay, dayOfWeek }
) => {
  const {
    rows: [workoutPlan],
  } = await db.query(
    `INSERT INTO workout_plans (user_id, title, goal, fitness_level, is_active)
     VALUES ($1, $2, 'general_fitness', 'beginner', $3)
     RETURNING id`,
    [userId, title, isActive]
  );

  await db.query(
    `INSERT INTO workout_days (workout_plan_id, day_of_week, day_label, is_rest_day)
     VALUES ($1, $2, $3, $4)`,
    [workoutPlan.id, dayOfWeek, `${title} today`, isRestDay]
  );

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

const createTodayCheckin = async (userId) => {
  if (!(await workoutCheckinsHasBranchId())) {
    await db.query(
      `INSERT INTO workout_checkins (user_id, checkin_date)
       VALUES ($1, CURRENT_DATE)`,
      [userId]
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
     VALUES ($1, $2, CURRENT_DATE)`,
    [userId, branch.id]
  );
};

describe('workout reminder integration', () => {
  beforeEach(async () => {
    await global.truncateAll();
  });

  it('sends reminders only for the selected active plan and members without a check-in today', async () => {
    const today = await getDbToday();
    const shouldReceive = await createMember('reminder-target@example.com');
    const inactivePlanOnly = await createMember('inactive-plan@example.com');
    const alreadyCheckedIn = await createMember('checked-in@example.com');

    await grantActiveMembership(shouldReceive.id);
    await grantActiveMembership(inactivePlanOnly.id);
    await grantActiveMembership(alreadyCheckedIn.id);

    await createWorkoutPlanForToday(shouldReceive.id, {
      title: 'Selected Plan',
      isActive: true,
      isRestDay: false,
      dayOfWeek: today.day_of_week,
    });
    await createWorkoutPlanForToday(shouldReceive.id, {
      title: 'Old Plan',
      isActive: false,
      isRestDay: false,
      dayOfWeek: today.day_of_week,
    });

    await createWorkoutPlanForToday(inactivePlanOnly.id, {
      title: 'Selected Rest Plan',
      isActive: true,
      isRestDay: true,
      dayOfWeek: today.day_of_week,
    });
    await createWorkoutPlanForToday(inactivePlanOnly.id, {
      title: 'Inactive Workout Plan',
      isActive: false,
      isRestDay: false,
      dayOfWeek: today.day_of_week,
    });

    await createWorkoutPlanForToday(alreadyCheckedIn.id, {
      title: 'Checked In Plan',
      isActive: true,
      isRestDay: false,
      dayOfWeek: today.day_of_week,
    });
    await createTodayCheckin(alreadyCheckedIn.id);

    const result = await service.sendWorkoutReminderNotifications();

    expect(result).toMatchObject({
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

  it('completes silently when all active-plan members have checked in today', async () => {
    const today = await getDbToday();
    const member = await createMember('already-done@example.com');

    await grantActiveMembership(member.id);
    await createWorkoutPlanForToday(member.id, {
      title: 'Selected Plan',
      isActive: true,
      isRestDay: false,
      dayOfWeek: today.day_of_week,
    });
    await createTodayCheckin(member.id);

    const result = await service.sendWorkoutReminderNotifications();
    const { rows: notifications } = await db.query(`SELECT id FROM notifications`);

    expect(result).toMatchObject({
      scanned_count: 0,
      created_count: 0,
      skipped_count: 0,
    });
    expect(notifications).toHaveLength(0);
  });
});
