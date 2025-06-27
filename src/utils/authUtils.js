const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config(); // Carrega as variáveis de ambiente

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('Erro: JWT_SECRET não está definido nas variáveis de ambiente.');
  process.exit(1); // Encerra o processo se a chave JWT não for encontrada
}

// Gera um hash da senha
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12); // Nível de complexidade do salt
  return await bcrypt.hash(password, salt);
};

// Compara uma senha em texto puro com uma senha hash
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Gera um token JWT
const generateToken = (payload) => {
  // O token expira em 1 hora para fins de demonstração
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
};

// Verifica e decodifica um token JWT
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    // Pode ser TokenExpiredError, JsonWebTokenError, etc.
    throw new Error('Token inválido ou expirado.');
  }
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken
};