 // backend/src/routes/produtoAdicionalRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/produtoAdicionalController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');

// Adicionar adicional a produto: POST /api/v1/gerencial/:slug/produtos/:id/adicionais
router.post(
  '/gerencial/:slug/produtos/:id/adicionais',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  controller.addAdicionalToProduto
);

// Remover adicional de produto: DELETE /api/v1/gerencial/:slug/produtos/:id/adicionais/:adicionalId
router.delete(
  '/gerencial/:slug/produtos/:id/adicionais/:adicionalId',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  controller.removeAdicionalFromProduto
);

// Listar adicionais de um produto: GET /api/v1/gerencial/:slug/produtos/:id/adicionais
router.get(
  '/gerencial/:slug/produtos/:id/adicionais',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  controller.listAdicionaisByProduto
);

module.exports = router;