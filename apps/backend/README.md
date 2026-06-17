# Backend Auth API

Node.js backend for register and login. It uses only Node built-in modules, stores users in `data/users.json`, hashes passwords with PBKDF2, and signs access tokens with HMAC SHA-256.

## Run

```bash
npm run dev:backend
```

Default URL: `http://localhost:4000`

## Endpoints

### `POST /api/auth/register`

Body:

```json
{
  "name": "Demo Member",
  "email": "member@gym.com",
  "password": "123456"
}
```

### `POST /api/auth/login`

Body:

```json
{
  "email": "member@gym.com",
  "password": "123456"
}
```

### `GET /api/auth/me`

Header:

```text
Authorization: Bearer <accessToken>
```
