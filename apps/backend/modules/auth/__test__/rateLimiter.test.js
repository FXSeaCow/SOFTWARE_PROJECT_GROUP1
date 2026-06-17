const request = require('supertest');
// Enable rate limiter for this specific test so we can assert 429 behaviour.
process.env.ENABLE_RATE_LIMITER = 'true';
const app = require('../../../app');

describe('Rate Limiter', () => {

  it('should return 429 after too many login requests', async () => {

    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'abc@gmail.com',
          password: 'WrongPassword1'
        });
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'abc@gmail.com',
        password: 'WrongPassword1'
      });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/too many requests/i);
  });

});