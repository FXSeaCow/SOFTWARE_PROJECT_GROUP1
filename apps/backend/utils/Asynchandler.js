/**
 * asyncHandler
 * Wraps an async Express route handler so any thrown error or rejected
 * promise is automatically forwarded to next() — eliminating the need
 * for try/catch in every controller.
 *
 * Usage:
 *   router.get('/me', asyncHandler(async (req, res) => {
 *     const user = await userService.getById(req.user.id);
 *     res.json(ApiResponse.success(user));
 *   }));
 *
 * Without this wrapper you would need:
 *   router.get('/me', async (req, res, next) => {
 *     try { ... } catch (err) { next(err); }
 *   });
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;