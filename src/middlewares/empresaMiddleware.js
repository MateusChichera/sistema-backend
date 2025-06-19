// backend/src/middlewares/empresaMiddleware.js
const { pool } = require('../config/db');

/**
 * Middleware para extrair o slug da URL, encontrar a empresa correspondente
 * e adicionar o ID da empresa (empresa_id) ao objeto req.
 * Isso é essencial para rotas multi-tenant.
 */
const extractEmpresaId = async (req, res, next) => {
  const { slug } = req.params; // Pega o slug do parâmetro da URL

  // --- LOGS DE DEPURAÇÃO PARA O BACK-END ---
  console.log('Backend Middleware: extractEmpresaId - Início');
  console.log('Backend Middleware: Slug recebido em req.params:', slug);

  if (!slug) {
    console.log('Backend Middleware: Slug é nulo ou vazio. Retornando 400.');
    return res.status(400).json({ message: 'Slug da empresa é obrigatório na URL.' });
  }

  try {
    // Consulta o banco de dados para encontrar a empresa pelo slug
    // Usamos .trim() e .toLowerCase() para garantir que a comparação seja robusta
    // contra espaços em branco e diferenças de maiúsculas/minúsculas.
    const [rows] = await pool.query('SELECT id, status FROM empresas WHERE slug = ?', [slug.toLowerCase().trim()]);

    console.log('Backend Middleware: Resultado da consulta SQL para slug:', slug, '->', rows);

    if (rows.length === 0) {
      console.log('Backend Middleware: Empresa não encontrada para o slug:', slug);
      return res.status(404).json({ message: 'Empresa não encontrada para o slug fornecido.' });
    }

    const empresa = rows[0];

    // Verifica se a empresa está ativa
    if (empresa.status !== 'Ativa') {
      console.log('Backend Middleware: Empresa encontrada, mas não está ativa. Status:', empresa.status);
      return res.status(403).json({ message: 'Acesso negado. Esta empresa não está ativa.' });
    }

    // Se tudo ok, adiciona o empresa_id ao objeto de requisição
    req.empresa_id = empresa.id;
    console.log('Backend Middleware: Empresa ID adicionado ao req.empresa_id:', empresa.id);
    next(); // Continua para a próxima função middleware/rota

  } catch (error) {
    console.error('Backend Middleware: Erro no extractEmpresaId:', error);
    next(error); // Passa o erro para o errorHandler
  }
};

module.exports = {
  extractEmpresaId
};