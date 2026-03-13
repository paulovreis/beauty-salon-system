export default function buildErrorResponse(err) {
  const includeErrorDetails = process.env.NODE_ENV !== 'production';
  if (!includeErrorDetails) return undefined;
  if (!err) return undefined;
  return { error: err.message };
}
