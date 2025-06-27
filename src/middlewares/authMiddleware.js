// Crie um novo arquivo ou adicione no seu 'authMiddleware.js'
const jwt = require('jsonwebtoken'); // Certifique-se de que jwt está importado, se verifyToken usar internamente

// Supondo que verifyToken está em '../utils/authUtils'
const { verifyToken } = require('../utils/authUtils'); 

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: 'Token não fornecido.' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;

    if (req.user.role !== 'admin_geral' && req.empresa_id) {
      if (req.user.empresa_id !== req.empresa_id) {
        return res.status(403).json({ message: 'Acesso negado. Token não pertence a esta empresa.' });
      }
    }
    next();
  } catch (error) {
    return res.status(403).json({ message: error.message });
  }
};

// --- NOVO MIDDLEWARE PARA AUTENTICAÇÃO OPCIONAL ---
const authenticateOptional = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    // Se não há token, simplesmente define req.user como null
    // e permite que a requisição prossiga.
    req.user = null; 
    return next(); 
  }

  // Se há um token, tenta verificar e decodificar como de costume
  try {
    const decoded = verifyToken(token);
    req.user = decoded;

    if (req.user.role !== 'admin_geral' && req.empresa_id) {
      if (req.user.empresa_id !== req.empresa_id) {
        // Se o token existe, mas não é válido para a empresa, ainda é um erro 403
        return res.status(403).json({ message: 'Acesso negado. Token não pertence a esta empresa.' });
      }
    }
    next();
  } catch (error) {
    // Se o token existe, mas é inválido (expirado, malformado, etc.), 
    // ele deve ser tratado como um erro 403.
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
  authorizeRole,
  authenticateOptional // Exporte o novo middleware
};