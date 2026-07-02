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
const {
  createRecordSchema,
  updateRecordSchema,
} = require('../fitness-records.validation');

const baseRecord = {
  id: 'record-1',
  user_id: 'user-1',
  recorded_at: '2026-07-01T00:00:00.000Z',
  weight_kg: 70,
  height_cm: 175,
  bmi: 22.86,
  body_fat_percent: 18,
  muscle_mass_kg: 35,
  waist_cm: 82,
  chest_cm: null,
  hip_cm: 95,
  neck_cm: 38,
  arm_cm: null,
  thigh_cm: null,
  notes: null,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: null,
};

describe('fitness-records module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the Express router', () => {
    expect(routes).toBeDefined();
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
        recorded_at: '2026-07-01',
        weight_kg: 70,
        bmi: 22.86,
        body_fat_percent: 18,
        muscle_mass_kg: 35,
        waist_cm: 82,
      },
      {
        id: 'record-2',
        recorded_at: '2026-07-08',
        weight_kg: 68.5,
        bmi: 22.37,
        body_fat_percent: 17,
        muscle_mass_kg: 35.2,
        waist_cm: 80,
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
    expect(analysis.trend).toHaveLength(2);
    expect(analysis.message).toBe('Weight is trending down');
  });

  it('validates required create fields and allows partial update fields', () => {
    const invalidCreate = createRecordSchema.validate({ weight_kg: 70 });
    const validUpdate = updateRecordSchema.validate({ waist_cm: 80 });

    expect(invalidCreate.error).toBeDefined();
    expect(
      invalidCreate.error.details.some((detail) =>
        detail.message.includes('height_cm is required')
      )
    ).toBe(true);
    expect(validUpdate.error).toBeUndefined();
  });

  it('builds derived fields before creating a record', async () => {
    repo.createRecord.mockImplementation(async (payload) => ({
      ...baseRecord,
      ...payload,
      id: 'record-created',
    }));

    const result = await service.createRecord('user-1', {
      weight_kg: 70,
      height_cm: 175,
      sex: 'male',
      waist_cm: 82,
      neck_cm: 38,
      muscle_mass_kg: 35,
    });

    expect(repo.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        weight_kg: 70,
        height_cm: 175,
        bmi: 22.86,
      })
    );
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
    expect(result.records[0].bmi_category).toBe('normal');
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

  it('recalculates BMI when updating a record', async () => {
    repo.findByIdAndUser.mockResolvedValue(baseRecord);
    repo.updateRecord.mockImplementation(async (_recordId, userId, fields) => ({
      ...baseRecord,
      ...fields,
      user_id: userId,
    }));

    const result = await service.updateRecord('record-1', 'user-1', {
      weight_kg: 72,
    });

    expect(repo.updateRecord).toHaveBeenCalledWith(
      'record-1',
      'user-1',
      expect.objectContaining({
        weight_kg: 72,
        bmi: 23.51,
      })
    );
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
        recorded_at: '2026-07-08T00:00:00.000Z',
        weight_kg: 72,
        bmi: 23.51,
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
  });
});
