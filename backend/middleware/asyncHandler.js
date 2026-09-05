// Wraps an async route handler so that a rejected promise (e.g. a DB call
// that throws) is forwarded to Express's error-handling middleware via
// next(err), instead of becoming an unhandled rejection that crashes the
// whole Node process.
//
// Usage:
//   router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
//       const [rows] = await pool.query(...);
//       res.json(rows);
//   }));
function asyncHandler(fn) {
    return function wrapped(req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = asyncHandler;
