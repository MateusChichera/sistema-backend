// backend/src/controllers/categoriaController.js
const { pool } = require('../config/db');

// 1. Criar uma nova categoria
const createCategoria = async (req, res, next) => {
  const { descricao } = req.body;
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId

  if (!descricao) {
    return res.status(400).json({ message: 'A descrição da categoria é obrigatória.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO categorias (empresa_id, descricao) VALUES (?, ?)',
      [empresaId, descricao]
    );
    res.status(201).json({
      message: 'Categoria criada com sucesso!',
      categoria: {
        id: result.insertId,
        empresa_id: empresaId,
        descricao: descricao,
        ativo: true // Default no DB
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Categoria com esta descrição já existe para esta empresa.' });
    }
    next(error);
  }
};

// 2. Listar todas as categorias de uma empresa
const getAllCategoriasByEmpresa = async (req, res, next) => {
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  try {
    const [categorias] = await pool.query(
      'SELECT id, descricao, ativo FROM categorias WHERE empresa_id = ? ORDER BY descricao',
      [empresaId]
    );
    res.status(200).json(categorias);
  } catch (error) {
    next(error);
  }
};

// 3. Obter uma categoria por ID
const getCategoriaById = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  try {
    // Garante que a categoria pertence à empresa do token/slug
    const [rows] = await pool.query('SELECT id, descricao, ativo FROM categorias WHERE id = ? AND empresa_id = ?', [id, empresaId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Categoria não encontrada ou não pertence a esta empresa.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

// 4. Atualizar uma categoria
const updateCategoria = async (req, res, next) => {
  const { id } = req.params;
  const { descricao, ativo } = req.body;
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId

  if (!descricao || ativo === undefined) { // 'ativo' pode ser false, então verificamos se não é undefined
    return res.status(400).json({ message: 'Descrição e status (ativo) da categoria são obrigatórios.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE categorias SET descricao = ?, ativo = ? WHERE id = ? AND empresa_id = ?',
      [descricao, ativo, id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Categoria não encontrada ou não pertence a esta empresa.' });
    }
    res.status(200).json({ message: 'Categoria atualizada com sucesso!' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Categoria com esta descrição já existe para esta empresa.' });
    }
    next(error);
  }
};

// 5. Excluir uma categoria
const deleteCategoria = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  try {
    // Garante que a categoria pertence à empresa do token/slug
    const [result] = await pool.query('DELETE FROM categorias WHERE id = ? AND empresa_id = ?', [id, empresaId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Categoria não encontrada ou não pertence a esta empresa.' });
    }
    res.status(200).json({ message: 'Categoria excluída com sucesso!' });
  } catch (error) {
    // MySQL pode retornar ER_ROW_IS_REFERENCED se houver produtos vinculados
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(409).json({ message: 'Não é possível excluir esta categoria pois existem produtos associados a ela.' });
    }
    next(error);
  }
};

module.exports = {
  createCategoria,
  getAllCategoriasByEmpresa,
  getCategoriaById,
  updateCategoria,
  deleteCategoria
};