// backend/src/controllers/authController.js
const { pool } = require('../config/db');
const { comparePassword, generateToken, hashPassword } = require('../utils/authUtils');

// Função auxiliar para obter o status da empresa
const getCompanyStatus = async (empresaId) => {
  const [rows] = await pool.query('SELECT status FROM empresas WHERE id = ?', [empresaId]);
  return rows.length > 0 ? rows[0].status : null;
};

// Função de login para o Administrador Geral (não precisa de status da empresa)
const adminLogin = async (req, res, next) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM admin_geral WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const admin = rows[0];
    const isMatch = await comparePassword(senha, admin.senha_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const payload = {
      id: admin.id,
      email: admin.email,
      role: 'admin_geral'
    };
    const token = generateToken(payload);

    res.status(200).json({
      message: 'Login de administrador realizado com sucesso!',
      token,
      user: {
        id: admin.id,
        nome: admin.nome,
        email: admin.email,
        role: 'admin_geral'
      }
    });

  } catch (error) {
    next(error);
  }
};

// Função de login para Funcionários
const funcionarioLogin = async (req, res, next) => {
  const { email, senha } = req.body;
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId

  if (!email || !senha) {
    return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }
  if (!empresaId) { // Deve ser setado pelo empresaMiddleware
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  try {
    // 1. Verificar status da empresa antes de permitir o login
    const companyStatus = await getCompanyStatus(empresaId);
    if (!companyStatus || companyStatus !== 'Ativa') {
      return res.status(403).json({ message: 'Esta empresa não está ativa ou não foi encontrada.' });
    }

    // 2. Busca o funcionário pelo email E empresa_id
    const [rows] = await pool.query('SELECT * FROM funcionarios WHERE email = ? AND empresa_id = ?', [email, empresaId]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciais inválidas ou funcionário não encontrado para esta empresa.' });
    }

    const funcionario = rows[0];
    const isMatch = await comparePassword(senha, funcionario.senha_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    
    if (!funcionario.ativo) {
      return res.status(403).json({ message: 'Sua conta de funcionário está inativa.' });
    }

    const payload = {
      id: funcionario.id,
      email: funcionario.email,
      role: funcionario.role,
      empresa_id: funcionario.empresa_id
    };
    const token = generateToken(payload);

    res.status(200).json({
      message: 'Login de funcionário realizado com sucesso!',
      token,
      user: {
        id: funcionario.id,
        nome: funcionario.nome,
        email: funcionario.email,
        role: funcionario.role,
        empresa_id: funcionario.empresa_id
      }
    });

  } catch (error) {
    next(error);
  }
};

// Função de login para Clientes
const clienteLogin = async (req, res, next) => {
  const { email, senha } = req.body;
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId

  if (!email || !senha) {
    return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  try {
    // 1. Verificar status da empresa antes de permitir o login
    const companyStatus = await getCompanyStatus(empresaId);
    if (!companyStatus || companyStatus !== 'Ativa') {
      return res.status(403).json({ message: 'Esta empresa não está ativa ou não foi encontrada.' });
    }

    const [rows] = await pool.query('SELECT * FROM clientes WHERE email = ? AND empresa_id = ?', [email, empresaId]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciais inválidas ou cliente não encontrado para esta empresa.' });
    }

    const cliente = rows[0];
    
    if (!cliente.senha_hash) {
      return res.status(401).json({ message: 'Esta conta de cliente não possui uma senha definida para login.' });
    }
    
    const isMatch = await comparePassword(senha, cliente.senha_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const payload = {
      id: cliente.id,
      email: cliente.email,
      role: 'cliente',
      empresa_id: cliente.empresa_id
    };
    const token = generateToken(payload);

    res.status(200).json({
      message: 'Login de cliente realizado com sucesso!',
      token,
      user: {
        id: cliente.id,
        nome: cliente.nome,
        email: cliente.email,
        empresa_id: cliente.empresa_id,
        role: 'cliente'
      }
    });

  } catch (error) {
    next(error);
  }
};

// Cadastro de Cliente (mantido como está)
const registerClient = async (req, res, next) => {
  const { nome, email, telefone, endereco, senha } = req.body;
  const empresaId = req.empresa_id;

  if (!nome || !telefone || !empresaId) {
    return res.status(400).json({ message: 'Nome, telefone e ID da empresa são obrigatórios.' });
  }

  if (email) {
    const [existingClient] = await pool.query('SELECT id FROM clientes WHERE email = ? AND empresa_id = ?', [email, empresaId]);
    if (existingClient.length > 0) {
      return res.status(409).json({ message: 'Este email já está cadastrado para esta empresa.' });
    }
  }

  try {
    let hashedPassword = null;
    if (senha) {
      hashedPassword = await hashPassword(senha);
    }

    const [result] = await pool.query(
      `INSERT INTO clientes (empresa_id, nome, email, telefone, endereco, senha_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [empresaId, nome, email, telefone, endereco, hashedPassword]
    );

    res.status(201).json({
      message: 'Cliente cadastrado com sucesso!',
      clienteId: result.insertId
    });

  } catch (error) {
    next(error);
  }
};


module.exports = {
  adminLogin,
  funcionarioLogin,
  clienteLogin,
  registerClient
};