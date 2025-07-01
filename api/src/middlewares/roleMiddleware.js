// Middleware para checar papel do usuário
// Exemplo de uso: roleMiddleware(['owner', 'manager'])
export default function roleMiddleware(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Acesso negado: permissão insuficiente' });
    }
    next();
  };
}
