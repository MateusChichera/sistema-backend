// backend/src/controllers/formaPagamentoController.js
const { pool } = require('../config/db');

// 1. Criar uma nova forma de pagamento
const createFormaPagamento = async (req, res, next) => {
  const { descricao, porcentagem_desconto_geral, ativo } = req.body;
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId
  const requestingUserRole = req.user.role; // Role do usuário que está fazendo a requisição

  if (!descricao) {
    return res.status(400).json({ message: 'A descrição da forma de pagamento é obrigatória.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Apenas Proprietário ou Gerente podem criar/gerenciar formas de pagamento
  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode adicionar formas de pagamento.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO formas_pagamento (empresa_id, descricao, porcentagem_desconto_geral, ativo) VALUES (?, ?, ?, ?)`,
      [empresaId, descricao, porcentagem_desconto_geral || 0, ativo !== undefined ? ativo : true]
    );
    res.status(201).json({
      message: 'Forma de pagamento criada com sucesso!',
      formaPagamento: {
        id: result.insertId,
        empresa_id: empresaId,
        descricao,
        porcentagem_desconto_geral: porcentagem_desconto_geral || 0,
        ativo: ativo !== undefined ? ativo : true
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Uma forma de pagamento com esta descrição já existe para esta empresa.' });
    }
    next(error);
  }
};

// 2. Listar todas as formas de pagamento de uma empresa
const getAllFormasPagamentoByEmpresa = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Todos os funcionários podem visualizar as formas de pagamento
  if (!['Proprietario', 'Gerente', 'Funcionario', 'Caixa'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar formas de pagamento.' });
  }

  try {
    const [formasPagamento] = await pool.query(
      'SELECT id, descricao, porcentagem_desconto_geral, ativo FROM formas_pagamento WHERE empresa_id = ? ORDER BY descricao',
      [empresaId]
    );
    res.status(200).json(formasPagamento);
  } catch (error) {
    next(error);
  }
};

// 3. Obter uma forma de pagamento por ID
const getFormaPagamentoById = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Todos os funcionários podem visualizar (para exibição de detalhes)
  if (!['Proprietario', 'Gerente', 'Funcionario', 'Caixa'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar esta forma de pagamento.' });
  }

  try {
    const [rows] = await pool.query('SELECT id, descricao, porcentagem_desconto_geral, ativo FROM formas_pagamento WHERE id = ? AND empresa_id = ?', [id, empresaId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Forma de pagamento não encontrada ou não pertence a esta empresa.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

// 4. Atualizar uma forma de pagamento
const updateFormaPagamento = async (req, res, next) => {
  const { id } = req.params;
  const { descricao, porcentagem_desconto_geral, ativo } = req.body;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!descricao || porcentagem_desconto_geral === undefined || ativo === undefined) {
    return res.status(400).json({ message: 'Descrição, porcentagem de desconto e status ativo são obrigatórios.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Apenas Proprietário ou Gerente podem atualizar formas de pagamento
  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode atualizar formas de pagamento.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE formas_pagamento SET descricao = ?, porcentagem_desconto_geral = ?, ativo = ? WHERE id = ? AND empresa_id = ?`,
      [descricao, porcentagem_desconto_geral, ativo, id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Forma de pagamento não encontrada ou não pertence a esta empresa.' });
    }
    res.status(200).json({ message: 'Forma de pagamento atualizada com sucesso!' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Uma forma de pagamento com esta descrição já existe para esta empresa.' });
    }
    next(error);
  }
};

// 5. Excluir uma forma de pagamento
const deleteFormaPagamento = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Apenas Proprietário ou Gerente podem excluir formas de pagamento
  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode excluir formas de pagamento.' });
  }

  try {
    const [result] = await pool.query('DELETE FROM formas_pagamento WHERE id = ? AND empresa_id = ?', [id, empresaId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Forma de pagamento não encontrada ou não pertence a esta empresa.' });
    }
    res.status(200).json({ message: 'Forma de pagamento excluída com sucesso!' });
  } catch (error) {
    // Pode haver erro de chave estrangeira se houver pagamentos vinculados
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ message: 'Não é possível excluir esta forma de pagamento pois existem pagamentos ou pedidos associados a ela.' });
    }
    next(error);
  }
};

const getAllFormasPagamentoByEmpresaP = async (req, res) => {
    const { empresa_id } = req; // Obtido do middleware extractEmpresaId
    const { status } = req.query; // Para filtros futuros, se houver
    
    const isAuthenticatedRequest = !!req.user; 

    let query = 'SELECT * FROM formas_pagamento WHERE empresa_id = ?';
    const params = [empresa_id];

    if (isAuthenticatedRequest) {
        // Se a requisição é autenticada (gerencial), permite filtrar por status, etc.
        // E só permite ver formas ativas se o funcionário não for proprietário/gerente
        const requestingUserRole = req.user.role; // Agora é seguro acessar req.user.role
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        // Se não for Proprietário ou Gerente, só pode ver formas ativas
        if (!['Proprietario', 'Gerente'].includes(requestingUserRole)) {
            query += ' AND ativo = 1';
        }
    } else {
        // Se a requisição NÃO é autenticada (pública),
        // SÓ PODE ver formas de pagamento que estão ativas E marcadas para pedido online.
        query += ' AND ativo = 1';
    }

    try {
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar formas de pagamento:", err);
        res.status(500).json({ message: 'Erro ao buscar formas de pagamento.' });
    }
};

module.exports = {
  createFormaPagamento,
  getAllFormasPagamentoByEmpresa,
  getAllFormasPagamentoByEmpresaP,
  getFormaPagamentoById,
  updateFormaPagamento,
  deleteFormaPagamento
};