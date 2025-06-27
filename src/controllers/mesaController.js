// backend/src/controllers/mesaController.js
const { pool } = require('../config/db');

// 1. Criar uma nova mesa
const createMesa = async (req, res, next) => {
  const { numero, capacidade, status, ativo } = req.body;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!numero || !capacidade) {
    return res.status(400).json({ message: 'Número da mesa e capacidade são obrigatórios.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Apenas Proprietário ou Gerente podem criar/gerenciar mesas
  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode adicionar mesas.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO mesas (empresa_id, numero, capacidade, status, ativo) VALUES (?, ?, ?, ?, ?)`,
      [empresaId, numero, capacidade, status || 'Livre', ativo !== undefined ? ativo : true]
    );
    res.status(201).json({
      message: 'Mesa criada com sucesso!',
      mesa: {
        id: result.insertId,
        empresa_id: empresaId,
        numero,
        capacidade,
        status: status || 'Livre',
        ativo: ativo !== undefined ? ativo : true
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('unique_numero_empresa')) {
      return res.status(409).json({ message: 'Uma mesa com este número já existe para esta empresa.' });
    }
    next(error);
  }
};

// 2. Listar todas as mesas de uma empresa
const getAllMesasByEmpresa = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Todos os funcionários podem visualizar as mesas
  const allowedRoles = ['Proprietario', 'Gerente', 'Funcionario', 'Caixa'];
  if (!allowedRoles.includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar mesas.' });
  }

  try {
    const [mesas] = await pool.query(
      'SELECT id, numero, capacidade, status, ativo FROM mesas WHERE empresa_id = ? ORDER BY numero',
      [empresaId]
    );
    res.status(200).json(mesas);
  } catch (error) {
    next(error);
  }
};

// 3. Obter uma mesa por ID
const getMesaById = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  const allowedRoles = ['Proprietario', 'Gerente', 'Funcionario', 'Caixa'];
  if (!allowedRoles.includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar esta mesa.' });
  }

  try {
    const [rows] = await pool.query('SELECT id, numero, capacidade, status, ativo FROM mesas WHERE id = ? AND empresa_id = ?', [id, empresaId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Mesa não encontrada ou não pertence a esta empresa.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

// 4. Atualizar uma mesa
const updateMesa = async (req, res, next) => {
  const { id } = req.params;
  const { numero, capacidade, status, ativo } = req.body;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!numero || !capacidade || !status || ativo === undefined) {
    return res.status(400).json({ message: 'Número, capacidade, status e ativo são obrigatórios.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode atualizar mesas.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE mesas SET numero = ?, capacidade = ?, status = ?, ativo = ? WHERE id = ? AND empresa_id = ?`,
      [numero, capacidade, status, ativo, id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Mesa não encontrada ou não pertence a esta empresa.' });
    }
    res.status(200).json({ message: 'Mesa atualizada com sucesso!' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('unique_numero_empresa')) {
      return res.status(409).json({ message: 'Uma mesa com este número já existe para esta empresa.' });
    }
    next(error);
  }
};

// 5. Excluir uma mesa
const deleteMesa = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode excluir mesas.' });
  }

  try {
    const [result] = await pool.query('DELETE FROM mesas WHERE id = ? AND empresa_id = ?', [id, empresaId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Mesa não encontrada ou não pertence a esta empresa.' });
    }
    res.status(200).json({ message: 'Mesa excluída com sucesso!' });
  } catch (error) {
    // Pode haver erro de chave estrangeira se houver pedidos vinculados a esta mesa
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ message: 'Não é possível excluir esta mesa pois existem pedidos associados a ela.' });
    }
    next(error);
  }
};

module.exports = {
  createMesa,
  getAllMesasByEmpresa,
  getMesaById,
  updateMesa,
  deleteMesa
};