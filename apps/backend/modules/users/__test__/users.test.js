const request = require('supertest');
const app = require('../../../app');

const registerAndLogin = async () => {
  const userData = {
    full_name: 'Member User',
    email: 'member@example.com',
    password: 'Password1',
    confirm_password: 'Password1',
  };

  const registerResponse = await request(app)
    .post('/api/auth/register')
    .send(userData);

  return {
    accessToken: registerResponse.body.data.accessToken,
  };
};

beforeEach(async () => {
  await global.truncateAll();
});

describe('PATCH /api/users/me/password', () => {
  it('changes password when current password is correct', async () => {
    const { accessToken } = await registerAndLogin();

    const response = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password: 'Password1',
        new_password: 'UpdatedPass1',
        confirm_new_password: 'UpdatedPass1',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Password changed successfully');
  });

  it('returns 400 when current password is incorrect', async () => {
    const { accessToken } = await registerAndLogin();

    const response = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password: 'WrongPassword1',
        new_password: 'UpdatedPass1',
        confirm_new_password: 'UpdatedPass1',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Current password is incorrect');
  });
});
