export function getCurrentUserRole() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const [, payload] = token.split('.');
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return json?.role || null;
  } catch (_) {
    return null;
  }
}

export function getCurrentUserId() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const [, payload] = token.split('.');
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    // Common JWT fields: `sub` or custom `id`
    return json?.id ?? (json?.sub ? Number(json.sub) : null);
  } catch (_) {
    return null;
  }
}
