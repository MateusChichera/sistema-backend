// backend/src/controllers/adicionalController.js
const { pool } = require('../config/db');

// 1. Criar um novo adicional
const createAdicional = async (req, res, next) => {
  const { nome, descricao, preco, ativo } = req.body;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!nome || preco === undefined) {
    return res.status(400).json({ message: 'Nome e preço são obrigatórios.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }
  // Apenas Proprietário ou Gerente podem criar adicionais
  if (!['Proprietario', 'Gerente'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode adicionar adicionais.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO adicionais (empresa_id, nome, descricao, preco, ativo) VALUES (?, ?, ?, ?, ?)`,
      [empresaId, nome, descricao || null, parseFloat(preco), ativo !== undefined ? ativo : true]
    );
    res.status(201).json({
      message: 'Adicional criado com sucesso!',
      adicional: {
        id: result.insertId,
        empresa_id: empresaId,
        nome,
        descricao: descricao || null,
        preco: parseFloat(preco),
        ativo: ativo !== undefined ? ativo : true
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Um adicional com este nome já existe para esta empresa.' });
    }
    next(error);
  }
};

// 2. Listar todos os adicionais da empresa
const getAllAdicionaisByEmpresa = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }
  // Todos funcionários podem visualizar
  if (!['Proprietario', 'Gerente', 'Funcionario', 'Caixa'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar adicionais.' });
  }

  try {
    const [adicionais] = await pool.query(
      'SELECT id, nome, descricao, preco, ativo, data_cadastro, data_atualizacao FROM adicionais WHERE empresa_id = ? ORDER BY nome',
      [empresaId]
    );
    res.status(200).json(adicionais);
  } catch (error) {
    next(error);
  }
};

// 3. Obter adicional por ID
const getAdicionalById = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }
  if (!['Proprietario', 'Gerente', 'Funcionario', 'Caixa'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar adicionais.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, nome, descricao, preco, ativo, data_cadastro, data_atualizacao FROM adicionais WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Adicional não encontrado ou não pertence a esta empresa.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

// 4. Atualizar adicional
const updateAdicional = async (req, res, next) => {
  const { id } = req.params;
  const { nome, descricao, preco, ativo } = req.body;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }
  if (!['Proprietario', 'Gerente'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode atualizar adicionais.' });
  }

  let updateFields = [];
  let updateValues = [];
  if (nome !== undefined) { updateFields.push('nome = ?'); updateValues.push(nome); }
  if (descricao !== undefined) { updateFields.push('descricao = ?'); updateValues.push(descricao); }
  if (preco !== undefined) { updateFields.push('preco = ?'); updateValues.push(parseFloat(preco)); }
  if (ativo !== undefined) { updateFields.push('ativo = ?'); updateValues.push(ativo); }

  if (updateFields.length === 0) {
    return res.status(400).json({ message: 'Nenhum dado para atualizar fornecido.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE adicionais SET ${updateFields.join(', ')} WHERE id = ? AND empresa_id = ?`,
      [...updateValues, id, empresaId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Adicional não encontrado ou não pertence a esta empresa.' });
    }
    res.status(200).json({ message: 'Adicional atualizado com sucesso!' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Um adicional com este nome já existe para esta empresa.' });
    }
    next(error);
  }
};

// 5. Excluir adicional
const deleteAdicional = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }
  if (!['Proprietario', 'Gerente'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode excluir adicionais.' });
  }

  try {
    const [result] = await pool.query('DELETE FROM adicionais WHERE id = ? AND empresa_id = ?', [id, empresaId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Adicional não encontrado ou não pertence a esta empresa.' });
    }
    res.status(200).json({ message: 'Adicional excluído com sucesso!' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ message: 'Não é possível excluir este adicional pois ele está vinculado a produtos ou pedidos.' });
    }
    next(error);
  }
};

module.exports = {
  createAdicional,
  getAllAdicionaisByEmpresa,
  getAdicionalById,
  updateAdicional,
  deleteAdicional
}; 