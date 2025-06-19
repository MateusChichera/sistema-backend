const { verifyToken } = require('../utils/authUtils');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: 'Token não fornecido.' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded; // Adiciona o payload decodificado ao req.user

    // Para usuários que não são admin_geral, verifica se o empresa_id do token
    // corresponde ao empresa_id extraído do slug na URL (se existir).
    // Isso é uma camada extra de segurança para rotas multi-tenant.
    if (req.user.role !== 'admin_geral' && req.empresa_id) {
      if (req.user.empresa_id !== req.empresa_id) {
        return res.status(403).json({ message: 'Acesso negado. Token não pertence a esta empresa.' });
      }
    }

    next();
  } catch (error) {
    // Pode ser TokenExpiredError, JsonWebTokenError, etc.
    return res.status(403).json({ message: error.message });
  }
};

// Middleware para verificar a role específica
const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    // Garante que allowedRoles é sempre um array para fácil manipulação
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Acesso negado. Role do usuário não definida.' });
    }

    // Verifica se a role do usuário está entre as roles permitidas
    if (!rolesArray.includes(req.user.role)) {
      return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para realizar esta ação.' });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRole
};