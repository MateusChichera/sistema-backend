// backend/src/controllers/categoriaController.js
const { pool } = require('../config/db');
const { get } = require('../routes/configEmpresaRoutes');

// 1. Criar uma nova categoria
const createCategoria = async (req, res, next) => {
  const { descricao, ordem } = req.body;
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId

  if (!descricao) {
    return res.status(400).json({ message: 'A descrição da categoria é obrigatória.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  try {
    // Se não foi informada uma ordem, busca a próxima ordem disponível
    let ordemFinal = ordem;
    if (!ordemFinal) {
      const [maxOrder] = await pool.query(
        'SELECT COALESCE(MAX(ordem), 0) + 1 as next_order FROM categorias WHERE empresa_id = ?',
        [empresaId]
      );
      ordemFinal = maxOrder[0].next_order;
    }

    const [result] = await pool.query(
      'INSERT INTO categorias (empresa_id, descricao, ordem) VALUES (?, ?, ?)',
      [empresaId, descricao, ordemFinal]
    );
    res.status(201).json({
      message: 'Categoria criada com sucesso!',
      categoria: {
        id: result.insertId,
        empresa_id: empresaId,
        descricao: descricao,
        ordem: ordemFinal,
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
      'SELECT id, descricao, ativo, ordem FROM categorias WHERE empresa_id = ? ORDER BY ordem ASC, descricao ASC',
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
    const [rows] = await pool.query('SELECT id, descricao, ativo, ordem FROM categorias WHERE id = ? AND empresa_id = ?', [id, empresaId]);

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
  const { descricao, ativo, ordem } = req.body;
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId

  if (!descricao || ativo === undefined) { // 'ativo' pode ser false, então verificamos se não é undefined
    return res.status(400).json({ message: 'Descrição e status (ativo) da categoria são obrigatórios.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE categorias SET descricao = ?, ativo = ?, ordem = ? WHERE id = ? AND empresa_id = ?',
      [descricao, ativo, ordem || 0, id, empresaId]
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
const getPublicCategoriasByEmpresa = async (req, res, next) => {
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Não há verificação de role aqui, pois é uma rota pública.
  // Apenas categorias ativas devem ser retornadas.
  try {
    const [categorias] = await pool.query(
      'SELECT id, descricao, ativo, ordem FROM categorias WHERE empresa_id = ? AND ativo = TRUE ORDER BY ordem ASC, descricao ASC',
      [empresaId]
    );
    res.status(200).json(categorias);
  } catch (error) {
    next(error);
  }
};

// 6. Atualizar ordem das categorias em lote
const updateOrdemCategorias = async (req, res, next) => {
  const { categorias } = req.body; // Array de objetos { id, ordem }
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Apenas Proprietário ou Gerente podem alterar a ordem das categorias
  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode alterar a ordem das categorias.' });
  }

  if (!Array.isArray(categorias) || categorias.length === 0) {
    return res.status(400).json({ message: 'Lista de categorias com ordem é obrigatória.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Atualizar cada categoria com sua nova ordem
    for (const categoria of categorias) {
      if (!categoria.id || categoria.ordem === undefined) {
        throw new Error('ID e ordem são obrigatórios para cada categoria.');
      }

      await connection.query(
        'UPDATE categorias SET ordem = ? WHERE id = ? AND empresa_id = ?',
        [categoria.ordem, categoria.id, empresaId]
      );
    }

    await connection.commit();
    res.status(200).json({ message: 'Ordem das categorias atualizada com sucesso!' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

module.exports = {
  createCategoria,
  getAllCategoriasByEmpresa,
  getCategoriaById,
  updateCategoria,
  deleteCategoria,
  getPublicCategoriasByEmpresa,
  updateOrdemCategorias
};