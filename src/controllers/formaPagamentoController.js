// backend/src/controllers/formaPagamentoController.js
const { pool } = require('../config/db');

// 1. Criar uma nova forma de pagamento
const createFormaPagamento = async (req, res, next) => {
  const { descricao, porcentagem_desconto_geral, ativo, ordem } = req.body;
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
    // Se ordem não foi especificada, definir como a próxima disponível
    let ordemFinal = ordem;
    if (!ordem || ordem <= 0) {
      const [maxOrdem] = await pool.query(
        'SELECT COALESCE(MAX(ordem), 0) + 1 as proxima_ordem FROM formas_pagamento WHERE empresa_id = ?',
        [empresaId]
      );
      ordemFinal = maxOrdem[0].proxima_ordem;
    }

    const [result] = await pool.query(
      `INSERT INTO formas_pagamento (empresa_id, descricao, porcentagem_desconto_geral, ativo, ordem) VALUES (?, ?, ?, ?, ?)`,
      [empresaId, descricao, porcentagem_desconto_geral || 0, ativo !== undefined ? ativo : true, ordemFinal]
    );
    res.status(201).json({
      message: 'Forma de pagamento criada com sucesso!',
      formaPagamento: {
        id: result.insertId,
        empresa_id: empresaId,
        descricao,
        porcentagem_desconto_geral: porcentagem_desconto_geral || 0,
        ativo: ativo !== undefined ? ativo : true,
        ordem: ordemFinal
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
      'SELECT id, descricao, porcentagem_desconto_geral, ativo, ordem FROM formas_pagamento WHERE empresa_id = ? ORDER BY ordem ASC, id ASC',
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
    const [rows] = await pool.query('SELECT id, descricao, porcentagem_desconto_geral, ativo, ordem FROM formas_pagamento WHERE id = ? AND empresa_id = ?', [id, empresaId]);

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
  const { descricao, porcentagem_desconto_geral, ativo, ordem } = req.body;
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
    // Se ordem foi fornecida, atualizar ordem
    if (ordem !== undefined && ordem > 0) {
      const [result] = await pool.query(
        `UPDATE formas_pagamento SET descricao = ?, porcentagem_desconto_geral = ?, ativo = ?, ordem = ? WHERE id = ? AND empresa_id = ?`,
        [descricao, porcentagem_desconto_geral, ativo, ordem, id, empresaId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Forma de pagamento não encontrada ou não pertence a esta empresa.' });
      }
    } else {
      const [result] = await pool.query(
        `UPDATE formas_pagamento SET descricao = ?, porcentagem_desconto_geral = ?, ativo = ? WHERE id = ? AND empresa_id = ?`,
        [descricao, porcentagem_desconto_geral, ativo, id, empresaId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Forma de pagamento não encontrada ou não pertence a esta empresa.' });
      }
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

    // Adicionar ordenação por ordem
    query += ' ORDER BY ordem ASC, id ASC';

    try {
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar formas de pagamento:", err);
        res.status(500).json({ message: 'Erro ao buscar formas de pagamento.' });
    }
};

// 6. Alterar ordem de uma forma de pagamento
const alterarOrdemFormaPagamento = async (req, res, next) => {
  const { id } = req.params;
  const { nova_ordem } = req.body;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!nova_ordem || nova_ordem <= 0) {
    return res.status(400).json({ message: 'Nova ordem deve ser um número positivo.' });
  }

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Apenas Proprietário ou Gerente podem alterar ordem
  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode alterar a ordem das formas de pagamento.' });
  }

  try {
    // Verificar se a forma de pagamento existe
    const [forma] = await pool.query(
      'SELECT id, ordem FROM formas_pagamento WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (forma.length === 0) {
      return res.status(404).json({ message: 'Forma de pagamento não encontrada ou não pertence a esta empresa.' });
    }

    const ordemAtual = forma[0].ordem;

    // Se a nova ordem é maior que a atual, mover outras para baixo
    if (nova_ordem > ordemAtual) {
      await pool.query(
        'UPDATE formas_pagamento SET ordem = ordem - 1 WHERE empresa_id = ? AND ordem > ? AND ordem <= ?',
        [empresaId, ordemAtual, nova_ordem]
      );
    }
    // Se a nova ordem é menor que a atual, mover outras para cima
    else if (nova_ordem < ordemAtual) {
      await pool.query(
        'UPDATE formas_pagamento SET ordem = ordem + 1 WHERE empresa_id = ? AND ordem >= ? AND ordem < ?',
        [empresaId, nova_ordem, ordemAtual]
      );
    }

    // Atualizar a ordem da forma de pagamento
    await pool.query(
      'UPDATE formas_pagamento SET ordem = ? WHERE id = ? AND empresa_id = ?',
      [nova_ordem, id, empresaId]
    );

    res.status(200).json({ 
      message: 'Ordem alterada com sucesso!',
      forma_pagamento_id: id,
      ordem_anterior: ordemAtual,
      nova_ordem: nova_ordem
    });
  } catch (error) {
    next(error);
  }
};

// 7. Trocar ordem entre duas formas de pagamento
const trocarOrdemFormasPagamento = async (req, res, next) => {
  const { forma_pagamento_id_1, forma_pagamento_id_2 } = req.body;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!forma_pagamento_id_1 || !forma_pagamento_id_2) {
    return res.status(400).json({ message: 'IDs de ambas as formas de pagamento são obrigatórios.' });
  }

  if (forma_pagamento_id_1 === forma_pagamento_id_2) {
    return res.status(400).json({ message: 'Não é possível trocar ordem de uma forma de pagamento com ela mesma.' });
  }

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Apenas Proprietário ou Gerente podem trocar ordem
  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode trocar a ordem das formas de pagamento.' });
  }

  try {
    // Verificar se ambas as formas existem e são da mesma empresa
    const [forma1] = await pool.query(
      'SELECT id, ordem FROM formas_pagamento WHERE id = ? AND empresa_id = ?',
      [forma_pagamento_id_1, empresaId]
    );
    
    const [forma2] = await pool.query(
      'SELECT id, ordem FROM formas_pagamento WHERE id = ? AND empresa_id = ?',
      [forma_pagamento_id_2, empresaId]
    );

    if (forma1.length === 0 || forma2.length === 0) {
      return res.status(404).json({ 
        message: 'Uma ou ambas as formas de pagamento não foram encontradas ou não pertencem a esta empresa.' 
      });
    }

    const ordem1 = forma1[0].ordem;
    const ordem2 = forma2[0].ordem;

    // Trocar as ordens diretamente
    await pool.query(
      'UPDATE formas_pagamento SET ordem = ? WHERE id = ? AND empresa_id = ?',
      [ordem2, forma_pagamento_id_1, empresaId]
    );
    
    await pool.query(
      'UPDATE formas_pagamento SET ordem = ? WHERE id = ? AND empresa_id = ?',
      [ordem1, forma_pagamento_id_2, empresaId]
    );

    res.status(200).json({ 
      message: 'Ordem trocada com sucesso!',
      forma_pagamento_1: forma_pagamento_id_1,
      forma_pagamento_2: forma_pagamento_id_2,
      ordem_anterior_1: ordem1,
      ordem_anterior_2: ordem2
    });
  } catch (error) {
    next(error);
  }
};

// 8. Reordenar todas as formas de pagamento de uma empresa
const reordenarFormasPagamento = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Apenas Proprietário ou Gerente podem reordenar
  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode reordenar as formas de pagamento.' });
  }

  try {
    // Reordenar todas as formas de pagamento da empresa
    const [formas] = await pool.query(
      'SELECT id FROM formas_pagamento WHERE empresa_id = ? ORDER BY ordem ASC, id ASC',
      [empresaId]
    );

    // Atualizar ordem sequencial (1, 2, 3, 4...)
    for (let i = 0; i < formas.length; i++) {
      await pool.query(
        'UPDATE formas_pagamento SET ordem = ? WHERE id = ? AND empresa_id = ?',
        [i + 1, formas[i].id, empresaId]
      );
    }

    res.status(200).json({ 
      message: 'Formas de pagamento reordenadas com sucesso!',
      empresa_id: empresaId,
      total_formas: formas.length
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFormaPagamento,
  getAllFormasPagamentoByEmpresa,
  getAllFormasPagamentoByEmpresaP,
  getFormaPagamentoById,
  updateFormaPagamento,
  deleteFormaPagamento,
  alterarOrdemFormaPagamento,
  trocarOrdemFormasPagamento,
  reordenarFormasPagamento
};