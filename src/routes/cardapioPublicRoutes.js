// backend/src/routes/cardapioPublicRoutes.js
const express = require('express');
const router = express.Router();
const produtoController = require('../controllers/produtoController');
const categoriaController = require('../controllers/categoriaController');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');

// Rotas PÚBLICAS para o Cardápio Digital (não precisam de autenticação via token)
// O middleware extractEmpresaId já valida se a empresa está ativa e passa o empresa_id

// Listar todas as categorias para o cardápio público
// GET /api/v1/:slug/cardapio/categorias
router.get(
  '/:slug/cardapio/categorias',
  extractEmpresaId,
  categoriaController.getPublicCategoriasByEmpresa
);

// Listar todos os produtos para o cardápio público
// GET /api/v1/:slug/cardapio/produtos
router.get(
  '/:slug/cardapio/produtos',
  extractEmpresaId,
  produtoController.getPublicProdutosByEmpresa
);

// Listar adicionais de um produto (rota pública)
// GET /api/v1/:slug/cardapio/produtos/:id/adicionais
router.get(
  '/:slug/cardapio/produtos/:id/adicionais',
  extractEmpresaId,
  produtoController.getPublicAdicionaisByProduto
);

module.exports = router;