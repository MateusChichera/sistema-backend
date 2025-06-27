// backend/src/controllers/funcionarioController.js
const { pool } = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/authUtils');

// 1. Criar um novo funcionário
const createFuncionario = async (req, res, next) => {
  const { nome, email, senha, role, ativo } = req.body;
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId
  const requestingUserRole = req.user.role; // Role do usuário que está fazendo a requisição

  if (!nome || !email || !senha || !role) {
    return res.status(400).json({ message: 'Nome, email, senha e cargo são obrigatórios.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Apenas Proprietário pode criar/gerenciar funcionários
  if (requestingUserRole !== 'Proprietario') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário pode adicionar funcionários.' });
  }

  // Regra de negócio: Não permitir a criação de múltiplos Proprietarios
  if (role === 'Proprietario') {
      try {
          const [proprietarios] = await pool.query('SELECT COUNT(*) AS count FROM funcionarios WHERE empresa_id = ? AND role = "Proprietario"', [empresaId]);
          if (proprietarios[0].count > 0) {
              return res.status(403).json({ message: 'Já existe um Proprietário para esta empresa. Não é possível adicionar múltiplos.' });
          }
      } catch (error) {
          return next(error);
      }
  }

  try {
    const hashedPassword = await hashPassword(senha); // Hash da senha

    const [result] = await pool.query(
      `INSERT INTO funcionarios (empresa_id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)`,
      [empresaId, nome, email, hashedPassword, role, ativo !== undefined ? ativo : true] // ativo padrão como true
    );
    res.status(201).json({
      message: 'Funcionário criado com sucesso!',
      funcionario: {
        id: result.insertId,
        empresa_id: empresaId,
        nome,
        email,
        role,
        ativo: ativo !== undefined ? ativo : true
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Um funcionário com este email já existe para esta empresa.' });
    }
    next(error);
  }
};

// 2. Listar todos os funcionários de uma empresa
const getAllFuncionariosByEmpresa = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Apenas Proprietário pode listar todos os funcionários
  if (requestingUserRole !== 'Proprietario') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário pode visualizar todos os funcionários.' });
  }

  try {
    // Não retornar a senha_hash por segurança!
    const [funcionarios] = await pool.query(
      'SELECT id, nome, email, role, ativo FROM funcionarios WHERE empresa_id = ? ORDER BY nome',
      [empresaId]
    );
    res.status(200).json(funcionarios);
  } catch (error) {
    next(error);
  }
};

// 3. Obter um funcionário por ID
const getFuncionarioById = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;
  const requestingUserId = req.user.id; // ID do usuário que faz a requisição

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Proprietário pode ver qualquer um.
  // Gerente/Caixa/Funcionario só podem ver a si mesmos.
  if (requestingUserRole !== 'Proprietario' && parseInt(id) !== requestingUserId) {
    return res.status(403).json({ message: 'Acesso negado. Você só pode visualizar seu próprio perfil.' });
  }

  try {
    // Não retornar a senha_hash por segurança!
    const [rows] = await pool.query('SELECT id, nome, email, role, ativo FROM funcionarios WHERE id = ? AND empresa_id = ?', [id, empresaId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Funcionário não encontrado ou não pertence a esta empresa.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

// 4. Atualizar um funcionário
const updateFuncionario = async (req, res, next) => {
  const { id } = req.params;
  const { nome, email, senha, role, ativo } = req.body;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;
  const requestingUserId = req.user.id;
  
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Buscar o funcionário que está sendo atualizado para verificar sua role e ID
  let targetFuncionario;
  try {
      const [targetRows] = await pool.query('SELECT id, role FROM funcionarios WHERE id = ? AND empresa_id = ?', [id, empresaId]);
      if (targetRows.length === 0) {
          return res.status(404).json({ message: 'Funcionário não encontrado para atualização.' });
      }
      targetFuncionario = targetRows[0];
  } catch (error) {
      return next(error);
  }

  // Regras de Autorização para Atualização:
  // - Proprietário pode atualizar qualquer um (exceto a própria role de Proprietario para outra).
  // - Ninguém pode alterar o email (email é usado para login, deve ser único).
  // - Ninguém (nem o próprio proprietário) pode mudar a própria role.
  // - Proprietário pode desativar qualquer um, exceto a si mesmo.
  // - Funcionários não-Proprietarios só podem atualizar o próprio nome e senha.

  if (requestingUserRole === 'Proprietario') {
      // Proprietário tentando atualizar OUTRO funcionário:
      if (parseInt(id) !== requestingUserId) {
          // Proprietário não pode mudar a role de outro Proprietario
          if (targetFuncionario.role === 'Proprietario' && role && role !== 'Proprietario') {
              return res.status(403).json({ message: 'Proprietário não pode mudar a role de outro Proprietário.' });
          }
          // Proprietário não pode mudar a role para Proprietario se já existir um
          if (role === 'Proprietario' && targetFuncionario.role !== 'Proprietario') {
            const [proprietarios] = await pool.query('SELECT COUNT(*) AS count FROM funcionarios WHERE empresa_id = ? AND role = "Proprietario" AND id != ?', [empresaId, id]);
            if (proprietarios[0].count > 0) {
                return res.status(403).json({ message: 'Já existe um Proprietário para esta empresa. Não é possível ter múltiplos.' });
            }
          }
          // Proprietário pode desativar outros, mas não a si mesmo.
          if (ativo !== undefined && parseInt(id) === requestingUserId && !ativo) {
            return res.status(403).json({ message: 'Proprietário não pode desativar sua própria conta.' });
          }
      } else { // Proprietário tentando atualizar A SI MESMO:
          if (role && role !== 'Proprietario') { // Proprietario não pode mudar a própria role
              return res.status(403).json({ message: 'O Proprietário não pode alterar seu próprio cargo.' });
          }
          if (email && email !== req.user.email) { // Proprietario não pode alterar o próprio email
              return res.status(403).json({ message: 'O Proprietário não pode alterar seu próprio email.' });
          }
          if (ativo !== undefined && !ativo) { // Proprietario não pode desativar a si mesmo
              return res.status(403).json({ message: 'O Proprietário não pode desativar sua própria conta.' });
          }
      }
  } else { // Funcionário NÃO Proprietário tentando atualizar:
      // Só pode atualizar a si mesmo
      if (parseInt(id) !== requestingUserId) {
          return res.status(403).json({ message: 'Acesso negado. Você só pode atualizar seu próprio perfil.' });
      }
      // Não pode alterar email, role ou status ativo
      if (email && email !== req.user.email) {
          return res.status(403).json({ message: 'Você não pode alterar seu email.' });
      }
      if (role && role !== targetFuncionario.role) {
          return res.status(403).json({ message: 'Você não pode alterar seu cargo.' });
      }
      if (ativo !== undefined && ativo !== targetFuncionario.ativo) {
          return res.status(403).json({ message: 'Você não pode alterar seu status de ativo/inativo.' });
      }
  }


  let updateFields = [];
  let updateValues = [];

  if (nome !== undefined) { updateFields.push('nome = ?'); updateValues.push(nome); }
  // Email não pode ser alterado via updateFuncionario (considerar rota separada para email)
  // if (email !== undefined) { updateFields.push('email = ?'); updateValues.push(email); }
  if (role !== undefined) { updateFields.push('role = ?'); updateValues.push(role); }
  if (ativo !== undefined) { updateFields.push('ativo = ?'); updateValues.push(ativo); }
  
  if (senha !== undefined && senha !== '') {
    const hashedPassword = await hashPassword(senha);
    updateFields.push('senha_hash = ?');
    updateValues.push(hashedPassword);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ message: 'Nenhum dado para atualizar fornecido.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE funcionarios SET ${updateFields.join(', ')} WHERE id = ? AND empresa_id = ?`,
      [...updateValues, id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Funcionário não encontrado ou nenhum dado alterado.' });
    }

    res.status(200).json({ message: 'Funcionário atualizado com sucesso!' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      // Caso algum dia o email possa ser alterado e cause duplicidade
      return res.status(409).json({ message: 'Este email já está em uso por outro funcionário nesta empresa.' });
    }
    next(error);
  }
};

// 5. Excluir um funcionário
const deleteFuncionario = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;
  const requestingUserId = req.user.id;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Apenas Proprietário pode excluir funcionários
  if (requestingUserRole !== 'Proprietario') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário pode excluir funcionários.' });
  }

  // Proprietário não pode excluir a si mesmo
  if (parseInt(id) === requestingUserId) {
    return res.status(403).json({ message: 'Você não pode excluir sua própria conta.' });
  }

  // Proprietário não pode excluir outros Proprietarios (deve ser um processo de transferência de posse)
  try {
      const [targetRows] = await pool.query('SELECT role FROM funcionarios WHERE id = ? AND empresa_id = ?', [id, empresaId]);
      if (targetRows.length > 0 && targetRows[0].role === 'Proprietario') {
          return res.status(403).json({ message: 'Não é possível excluir outro Proprietário. A posse da empresa deve ser transferida primeiro.' });
      }
  } catch (error) {
      return next(error);
  }

  try {
    const [result] = await pool.query('DELETE FROM funcionarios WHERE id = ? AND empresa_id = ?', [id, empresaId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Funcionário não encontrado ou não pertence a esta empresa.' });
    }
    res.status(200).json({ message: 'Funcionário excluído com sucesso!' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFuncionario,
  getAllFuncionariosByEmpresa,
  getFuncionarioById,
  updateFuncionario,
  deleteFuncionario
};