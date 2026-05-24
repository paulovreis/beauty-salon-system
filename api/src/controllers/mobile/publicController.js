export function getMobilePublicMeta(req, res) {
  const slug = (process.env.SALON_SLUG || '').trim() || null;
  const name = (process.env.NOME_SALAO || '').trim() || null;
  const city = (process.env.SALON_CITY || '').trim() || null;
  const logoUrl = (process.env.SALON_LOGO_URL || '').trim() || null;

  // Prefer explicit public origin when configured.
  const apiPublicOrigin = (process.env.API_PUBLIC_ORIGIN || '').trim() || `${req.protocol}://${req.get('host')}`;

  res.json({
    slug,
    name,
    city,
    logoUrl,
    apiPublicOrigin,
    apiVersion: '1',
  });
}

export function getMobilePublicHealth(_req, res) {
  res.json({ ok: true });
}
