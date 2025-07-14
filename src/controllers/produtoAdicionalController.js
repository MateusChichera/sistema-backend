// backend/src/controllers/produtoAdicionalController.js
const { pool } = require('../config/db');

// Adicionar um adicional a um produto
const addAdicionalToProduto = async (req, res, next) => {
  const { id: produtoId } = req.params; // produto ID na rota
  const { id_adicional } = req.body;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!id_adicional) {
    return res.status(400).json({ message: 'ID do adicional é obrigatório.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }
  if (!['Proprietario', 'Gerente'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode vincular adicionais a produtos.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verificar se produto pertence à empresa
    const [prodRows] = await connection.query('SELECT id FROM produtos WHERE id = ? AND empresa_id = ?', [produtoId, empresaId]);
    if (prodRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Produto não encontrado ou não pertence a esta empresa.' });
    }

    // Verificar se adicional pertence à empresa
    const [addRows] = await connection.query('SELECT id FROM adicionais WHERE id = ? AND empresa_id = ?', [id_adicional, empresaId]);
    if (addRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Adicional não encontrado ou não pertence a esta empresa.' });
    }

    // Inserir relação se não existir
    await connection.query(
      `INSERT INTO produto_adicionais (id_produto, id_adicional, empresa_id, ativo) VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE ativo = 1`,
      [produtoId, id_adicional, empresaId]
    );

    await connection.commit();

    res.status(201).json({ message: 'Adicional vinculado ao produto com sucesso!' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

// Remover vínculo de adicional de um produto
const removeAdicionalFromProduto = async (req, res, next) => {
  const { id: produtoId, adicionalId } = req.params; // produtoId e adicionalId nas rotas
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }
  if (!['Proprietario', 'Gerente'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode remover adicionais do produto.' });
  }

  try {
    const [result] = await pool.query(
      'DELETE FROM produto_adicionais WHERE id_produto = ? AND id_adicional = ? AND empresa_id = ?',
      [produtoId, adicionalId, empresaId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Vínculo produto-adicional não encontrado.' });
    }
    res.status(200).json({ message: 'Adicional removido do produto com sucesso!' });
  } catch (error) {
    next(error);
  }
};

// Listar adicionais vinculados a um produto
const listAdicionaisByProduto = async (req, res, next) => {
  const { id: produtoId } = req.params;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }
  if (!['Proprietario', 'Gerente', 'Funcionario', 'Caixa'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar adicionais do produto.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.nome, a.descricao, a.preco, a.ativo
       FROM produto_adicionais pa
       JOIN adicionais a ON pa.id_adicional = a.id
       WHERE pa.id_produto = ? AND pa.empresa_id = ? AND pa.ativo = 1`,
      [produtoId, empresaId]
    );
    res.status(200).json(rows);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addAdicionalToProduto,
  removeAdicionalFromProduto,
  listAdicionaisByProduto
}; 