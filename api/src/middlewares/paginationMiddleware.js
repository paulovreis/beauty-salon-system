// Middleware to normalize pagination query params with safe defaults.
// Policy: silent clamping (never 400). Controllers can read from req.pagination.

const DEFAULT_MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

function parsePositiveInt(value) {
  if (value === undefined || value === null) return undefined;
  const num = Number.parseInt(String(value), 10);
  if (!Number.isFinite(num) || Number.isNaN(num)) return undefined;
  return num;
}

export default function paginationMiddleware(options = {}) {
  const {
    defaultLimit = DEFAULT_LIMIT,
    maxLimit = DEFAULT_MAX_LIMIT,
    defaultPage = 1,
  } = options;

  return (req, _res, next) => {
    const rawPage = parsePositiveInt(req.query.page);
    const rawLimit = parsePositiveInt(req.query.limit);

    const page = rawPage && rawPage > 0 ? rawPage : defaultPage;

    let limit = rawLimit && rawLimit > 0 ? rawLimit : defaultLimit;
    if (maxLimit && limit > maxLimit) limit = maxLimit;

    const offset = (page - 1) * limit;

    req.pagination = { page, limit, offset };

    // Also normalize req.query so existing controllers that read from it behave.
    req.query.page = String(page);
    req.query.limit = String(limit);

    next();
  };
}
