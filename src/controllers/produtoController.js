// backend/src/controllers/produtoController.js
const { pool } = require('../config/db');

// 1. Criar um novo produto
const createProduto = async (req, res, next) => {
  const { 
    id_categoria, nome, descricao, preco,
    promocao, promo_ativa, ativo
  } = req.body;
  
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId
  const requestingUserRole = req.user.role; // Role do usuário que está fazendo a requisição

  // req.file conterá as informações do arquivo se um upload foi feito
  const foto_url = req.file ? `/uploads/produtos/${req.file.filename}` : null;

  if (!id_categoria || !nome || !preco) {
    return res.status(400).json({ message: 'Categoria, nome e preço são obrigatórios.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Apenas Proprietário ou Gerente podem criar/gerenciar produtos
  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode adicionar produtos.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO produtos (
        empresa_id, id_categoria, nome, descricao, preco,
        promocao, promo_ativa, ativo, foto_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId, id_categoria, nome, descricao || null, preco,
        promocao || null, promo_ativa || false, ativo !== undefined ? ativo : true, foto_url
      ]
    );
    res.status(201).json({
      message: 'Produto criado com sucesso!',
      produto: {
        id: result.insertId,
        empresa_id: empresaId,
        id_categoria,
        nome,
        descricao: descricao || null,
        preco,
        promocao: promocao || null,
        promo_ativa: promo_ativa || false,
        ativo: ativo !== undefined ? ativo : true,
        foto_url
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Um produto com este nome já existe para esta empresa.' });
    }
    next(error);
  }
};

// 2. Listar todos os produtos de uma empresa (opcionalmente por categoria)
const getAllProdutosByEmpresa = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const { id_categoria } = req.query; // Pode filtrar por categoria
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Todos os funcionários podem visualizar os produtos
  if (!['Proprietario', 'Gerente', 'Funcionario', 'Caixa'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar produtos.' });
  }

  let query = 'SELECT p.id, p.nome, p.descricao, p.preco, p.promocao, p.promo_ativa, p.ativo, p.foto_url, c.descricao AS categoria_nome, p.id_categoria FROM produtos p JOIN categorias c ON p.id_categoria = c.id WHERE p.empresa_id = ?';
  let queryParams = [empresaId];

  if (id_categoria) {
    query += ' AND p.id_categoria = ?';
    queryParams.push(id_categoria);
  }

  query += ' ORDER BY p.nome';

  try {
    const [produtos] = await pool.query(query, queryParams);
    res.status(200).json(produtos);
  } catch (error) {
    next(error);
  }
};

// 3. Obter um produto por ID
const getProdutoById = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Todos os funcionários podem visualizar (para exibição de detalhes)
  if (!['Proprietario', 'Gerente', 'Funcionario', 'Caixa'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar este produto.' });
  }

  try {
    const [rows] = await pool.query('SELECT p.id, p.nome, p.descricao, p.preco, p.promocao, p.promo_ativa, p.ativo, p.foto_url, c.descricao AS categoria_nome, p.id_categoria FROM produtos p JOIN categorias c ON p.id_categoria = c.id WHERE p.id = ? AND p.empresa_id = ?', [id, empresaId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Produto não encontrado ou não pertence a esta empresa.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

// 4. Atualizar um produto
const updateProduto = async (req, res, next) => {
  const { id } = req.params;
  const { 
    id_categoria, nome, descricao, preco,
    promocao, promo_ativa, ativo,
    remover_foto // Flag para remover a foto existente
  } = req.body;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  // req.file conterá a nova foto, se enviada
  const nova_foto_url = req.file ? `/uploads/produtos/${req.file.filename}` : undefined;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Apenas Proprietário ou Gerente podem atualizar produtos
  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode atualizar produtos.' });
  }

  let updateFields = [];
  let updateValues = [];

  if (id_categoria !== undefined) { updateFields.push('id_categoria = ?'); updateValues.push(id_categoria); }
  if (nome !== undefined) { updateFields.push('nome = ?'); updateValues.push(nome); }
  if (descricao !== undefined) { updateFields.push('descricao = ?'); updateValues.push(descricao); }
  if (preco !== undefined) { updateFields.push('preco = ?'); updateValues.push(preco); }
  if (promocao !== undefined) { updateFields.push('promocao = ?'); updateValues.push(promocao); }
  if (promo_ativa !== undefined) { updateFields.push('promo_ativa = ?'); updateValues.push(promo_ativa); }
  if (ativo !== undefined) { updateFields.push('ativo = ?'); updateValues.push(ativo); }
  
  if (nova_foto_url !== undefined) { // Se uma nova foto foi enviada
    updateFields.push('foto_url = ?'); updateValues.push(nova_foto_url);
  } else if (remover_foto === true) { // Se pediu para remover a foto existente
    updateFields.push('foto_url = ?'); updateValues.push(null);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ message: 'Nenhum dado para atualizar fornecido.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE produtos SET ${updateFields.join(', ')} WHERE id = ? AND empresa_id = ?`,
      [...updateValues, id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Produto não encontrado ou não pertence a esta empresa.' });
    }

    res.status(200).json({ message: 'Produto atualizado com sucesso!' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Um produto com este nome já existe para esta empresa.' });
    }
    next(error);
  }
};

// 5. Excluir um produto
const deleteProduto = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Apenas Proprietário ou Gerente podem excluir produtos
  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode excluir produtos.' });
  }

  try {
    const [result] = await pool.query('DELETE FROM produtos WHERE id = ? AND empresa_id = ?', [id, empresaId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Produto não encontrado ou não pertence a esta empresa.' });
    }
    res.status(200).json({ message: 'Produto excluído com sucesso!' });
  } catch (error) {
    // Pode haver erro de chave estrangeira se houver itens de pedido vinculados
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ message: 'Não é possível excluir este produto pois existem pedidos associados a ele.' });
    }
    next(error);
  }
};
const getPublicProdutosByEmpresa = async (req, res, next) => {
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Não há verificação de role aqui, pois é uma rota pública.
  // Apenas produtos ativos e que são para o cardápio devem ser retornados.
  let query = `
    SELECT 
        p.id, p.nome, p.descricao, p.preco, p.promocao, p.promo_ativa, p.ativo, p.foto_url, 
        c.descricao AS categoria_nome, p.id_categoria
    FROM produtos p 
    JOIN categorias c ON p.id_categoria = c.id 
    WHERE p.empresa_id = ? AND p.ativo = TRUE
  `;
  // Futuramente, adicionar filtro por 'disponivel_cardapio' se houver essa coluna
  // e se o produto não for um combo (se combos não forem exibidos diretamente no cardápio inicial)

  try {
    const [produtos] = await pool.query(query, [empresaId]);
    res.status(200).json(produtos);
  } catch (error) {
    next(error);
  }
};
module.exports = {
  createProduto,
  getAllProdutosByEmpresa,
  getProdutoById,
  updateProduto,
  deleteProduto,
  getPublicProdutosByEmpresa
};