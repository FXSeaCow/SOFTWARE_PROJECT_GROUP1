/**
 * fitness-records.test.js
 * Unit tests for the fitness-records module.
 *
 * Repository calls are mocked so the tests can verify calculators, services,
 * validation boundaries, and progress analysis without a database.
 */

jest.mock('../fitness-records.repository', () => ({
  createRecord: jest.fn(),
  findByIdAndUser: jest.fn(),
  findById: jest.fn(),
  findLatestByUser: jest.fn(),
  findAll: jest.fn(),
  findForProgress: jest.fn(),
  updateRecord: jest.fn(),
  deleteRecord: jest.fn(),
}));

jest.mock('../../../utils/Logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const repo = require('../fitness-records.repository');
const bmiCalculator = require('../bmiCalculator');
const bodyFatCalculator = require('../bodyFatCalculator');
const progressAnalyzer = require('../progressAnalyzer');
const service = require('../fitness-records.service');
const routes = require('../fitness-records.routes');
const request = require('supertest');
const app = require('../../../app');
const {
  createRecordSchema,
  updateRecordSchema,
} = require('../fitness-records.validation');

const baseRecord = {
  id: 'record-1',
  user_id: 'user-1',
  recorded_date: '2026-07-01',
  recorded_at: '2026-07-01',
  weight_kg: 70,
  height_cm: 175,
  bmi: 22.86,
  body_fat_pct: 18,
  body_fat_percent: 18,
  notes: null,
  created_at: '2026-07-01T00:00:00.000Z',
};

describe('fitness-records module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the Express router', () => {
    expect(routes).toBeDefined();
  });

  it('mounts fitness-record routes in the app', async () => {
    const res = await request(app).get('/api/fitness-records/me');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/access token missing/i);
  });

  it('calculates BMI, BMI category, and healthy weight range', () => {
    expect(bmiCalculator.calculateBMI(70, 175)).toBe(22.86);
    expect(bmiCalculator.classifyBMI(22.86)).toBe('normal');

    const summary = bmiCalculator.buildBMISummary(70, 175);

    expect(summary).toMatchObject({
      bmi: 22.86,
      bmi_category: 'normal',
    });
    expect(summary.healthy_weight_range.min_weight_kg).toBeGreaterThan(50);
  });

  it('estimates and classifies body fat percentage when enough measurements exist', () => {
    const bodyFat = bodyFatCalculator.calculateBodyFatPercentage({
      sex: 'male',
      height_cm: 180,
      waist_cm: 85,
      neck_cm: 40,
    });

    const summary = bodyFatCalculator.buildBodyFatSummary({
      sex: 'male',
      height_cm: 180,
      waist_cm: 85,
      neck_cm: 40,
    });

    expect(bodyFat).toBeGreaterThan(0);
    expect(bodyFat).toBeLessThan(40);
    expect(summary).toMatchObject({
      body_fat_percent: bodyFat,
      estimated: true,
    });
    expect(bodyFatCalculator.classifyBodyFat(16, 'male')).toBe('fitness');
  });

  it('compares metrics and builds trend analysis', () => {
    const records = [
      {
        id: 'record-1',
        recorded_date: '2026-07-01',
        weight_kg: 70,
        bmi: 22.86,
        body_fat_pct: 18,
      },
      {
        id: 'record-2',
        recorded_date: '2026-07-08',
        weight_kg: 68.5,
        bmi: 22.37,
        body_fat_pct: 17,
      },
    ];

    const analysis = progressAnalyzer.analyzeProgress(records, {
      goal: 'weight_loss',
    });

    expect(progressAnalyzer.compareMetric(68.5, 70)).toMatchObject({
      change: -1.5,
      direction: 'decreased',
    });
    expect(analysis.record_count).toBe(2);
    expect(analysis.latest_change.weight.change).toBe(-1.5);
    expect(analysis.latest_change.body_fat.change).toBe(-1);
    expect(analysis.trend).toHaveLength(2);
    expect(analysis.message).toBe('Weight is trending down');
  });

  it('validates required create fields and allows partial update fields', () => {
    const invalidCreate = createRecordSchema.validate({ weight_kg: 70 });
    const validUpdate = updateRecordSchema.validate({ body_fat_pct: 19 });

    expect(invalidCreate.error).toBeDefined();
    expect(
      invalidCreate.error.details.some((detail) =>
        detail.message.includes('height_cm is required')
      )
    ).toBe(true);
    expect(validUpdate.error).toBeUndefined();
  });

  it('builds DB-safe fields before creating a record', async () => {
    repo.createRecord.mockImplementation(async (payload) => ({
      ...baseRecord,
      ...payload,
      id: 'record-created',
      bmi: 22.86,
    }));

    const result = await service.createRecord('user-1', {
      recorded_date: '2026-07-01',
      weight_kg: 70,
      height_cm: 175,
      sex: 'male',
      waist_cm: 82,
      neck_cm: 38,
    });

    expect(repo.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        recorded_date: '2026-07-01',
        weight_kg: 70,
        height_cm: 175,
        body_fat_pct: expect.any(Number),
      })
    );
    expect(repo.createRecord.mock.calls[0][0]).not.toHaveProperty('bmi');
    expect(result).toMatchObject({
      id: 'record-created',
      bmi: 22.86,
      bmi_category: 'normal',
    });
  });

  it('lists member records with pagination metadata', async () => {
    repo.findAll.mockResolvedValue({
      rows: [baseRecord],
      total: 1,
    });

    const result = await service.listMyRecords('user-1', {
      page: '2',
      limit: '5',
    });

    expect(repo.findAll).toHaveBeenCalledWith({
      user_id: 'user-1',
      from_date: undefined,
      to_date: undefined,
      limit: 5,
      offset: 5,
    });
    expect(result).toMatchObject({ total: 1, page: 2, limit: 5 });
    expect(result.records[0]).toMatchObject({
      bmi_category: 'normal',
      body_fat_pct: 18,
      body_fat_percent: 18,
    });
  });

  it('gets latest, owned, and admin records by ID', async () => {
    repo.findLatestByUser.mockResolvedValue(baseRecord);
    repo.findByIdAndUser.mockResolvedValue(baseRecord);
    repo.findById.mockResolvedValue({ ...baseRecord, user_name: 'Member One' });

    await expect(service.getLatestRecord('user-1')).resolves.toMatchObject({
      id: 'record-1',
    });
    await expect(
      service.getMyRecordById('record-1', 'user-1')
    ).resolves.toMatchObject({ id: 'record-1' });
    await expect(service.getRecordById('record-1')).resolves.toMatchObject({
      user_name: 'Member One',
    });
  });

  it('updates DB columns without trying to write generated BMI', async () => {
    repo.findByIdAndUser.mockResolvedValue(baseRecord);
    repo.updateRecord.mockImplementation(async (_recordId, userId, fields) => ({
      ...baseRecord,
      ...fields,
      user_id: userId,
      bmi: 23.51,
    }));

    const result = await service.updateRecord('record-1', 'user-1', {
      weight_kg: 72,
    });

    expect(repo.updateRecord).toHaveBeenCalledWith(
      'record-1',
      'user-1',
      expect.objectContaining({
        weight_kg: 72,
      })
    );
    expect(repo.updateRecord.mock.calls[0][2]).not.toHaveProperty('bmi');
    expect(result.bmi).toBe(23.51);
  });

  it('deletes an owned record and returns 404 for missing records', async () => {
    repo.findByIdAndUser.mockResolvedValueOnce(baseRecord);
    repo.deleteRecord.mockResolvedValue(true);

    await expect(service.deleteRecord('record-1', 'user-1')).resolves.toBeUndefined();
    expect(repo.deleteRecord).toHaveBeenCalledWith('record-1', 'user-1');

    repo.findByIdAndUser.mockResolvedValueOnce(null);
    await expect(
      service.getMyRecordById('missing-record', 'user-1')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('analyzes progress from repository records', async () => {
    repo.findForProgress.mockResolvedValue([
      baseRecord,
      {
        ...baseRecord,
        id: 'record-2',
        recorded_date: '2026-07-08',
        recorded_at: '2026-07-08',
        weight_kg: 72,
        bmi: 23.51,
        body_fat_pct: 17.5,
        body_fat_percent: 17.5,
      },
    ]);

    const result = await service.getProgress('user-1', {
      limit: 10,
      goal: 'muscle_gain',
    });

    expect(repo.findForProgress).toHaveBeenCalledWith({
      user_id: 'user-1',
      from_date: undefined,
      to_date: undefined,
      limit: 10,
    });
    expect(result.record_count).toBe(2);
    expect(result.overall_change.weight.change).toBe(2);
    expect(result.trend).toHaveLength(2);
    expect(result.trend[1]).toMatchObject({
      recorded_date: '2026-07-08',
      body_fat_pct: 17.5,
    });
  });
});
