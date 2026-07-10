/**
 * pagination.js
 * Parses and validates pagination query params, and generates
 * the LIMIT / OFFSET values for PostgreSQL queries.
 *
 * Usage in a repository:
 *   const { limit, offset } = pagination.parse(req.query);
 *   const { rows } = await db.query(
 *     'SELECT * FROM memberships ORDER BY created_at DESC LIMIT $1 OFFSET $2',
 *     [limit, offset]
 *   );
 *
 * Usage in a controller (with ApiResponse.paginated):
 *   const { limit, offset, page } = pagination.parse(req.query);
 *   const { rows, total } = await membershipRepo.findAll({ limit, offset });
 *   res.json(ApiResponse.paginated(rows, total, page, limit));
 */

const DEFAULT_PAGE  = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT     = 100;

/**
 * Parse page and limit from query params and return DB-ready values.
 *
 * @param {{ page?: string|number, limit?: string|number }} query - req.query
 * @returns {{ page: number, limit: number, offset: number }}
 */
const parse = (query = {}) => {
  let page  = parseInt(query.page,  10) || DEFAULT_PAGE;
  let limit = parseInt(query.limit, 10) || DEFAULT_LIMIT;

  // Guard against nonsense values
  if (page  < 1) page  = DEFAULT_PAGE;
  if (limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

module.exports = { parse };