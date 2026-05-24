import authenticateJWT from './authenticateJWT.js';

export default function requireClientRole() {
  return [
    authenticateJWT,
    (req, res, next) => {
      if (!req.user || req.user.role !== 'client') {
        return res.status(403).json({ message: 'Acesso negado' });
      }
      if (!req.user.client_id) {
        return res.status(403).json({ message: 'Conta de cliente não vinculada' });
      }
      next();
    },
  ];
}
