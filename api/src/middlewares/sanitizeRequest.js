const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function sanitizeString(value) {
  // Strip NUL bytes and trim; keep other characters as-is to avoid breaking UX.
  return value.replace(/\u0000/g, '').trim();
}

function sanitizeAny(value) {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') return sanitizeString(value);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = sanitizeAny(value[i]);
    }
    return value;
  }

  if (typeof value === 'object') {
    // Preserve special objects.
    if (value instanceof Date) return value;

    for (const key of Object.keys(value)) {
      if (DANGEROUS_KEYS.has(key)) {
        delete value[key];
        continue;
      }
      value[key] = sanitizeAny(value[key]);
    }
    return value;
  }

  return value;
}

export default function sanitizeRequest() {
  return (req, _res, next) => {
    if (req.body && typeof req.body === 'object') sanitizeAny(req.body);
    if (req.query && typeof req.query === 'object') sanitizeAny(req.query);
    if (req.params && typeof req.params === 'object') sanitizeAny(req.params);
    next();
  };
}
