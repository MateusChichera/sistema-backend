// backend/src/routes/adicionalRoutes.js
const express = require('express');
const router = express.Router();
const adicionalController = require('../controllers/adicionalController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');

// Criar novo adicional: POST /api/v1/gerencial/:slug/adicionais
router.post(
  '/gerencial/:slug/adicionais',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  adicionalController.createAdicional
);

// Listar todos os adicionais da empresa: GET /api/v1/gerencial/:slug/adicionais
router.get(
  '/gerencial/:slug/adicionais',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  adicionalController.getAllAdicionaisByEmpresa
);

// Obter adicional por ID: GET /api/v1/gerencial/:slug/adicionais/:id
router.get(
  '/gerencial/:slug/adicionais/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  adicionalController.getAdicionalById
);

// Atualizar adicional: PUT /api/v1/gerencial/:slug/adicionais/:id
router.put(
  '/gerencial/:slug/adicionais/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  adicionalController.updateAdicional
);

// Excluir adicional: DELETE /api/v1/gerencial/:slug/adicionais/:id
router.delete(
  '/gerencial/:slug/adicionais/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  adicionalController.deleteAdicional
);

module.exports = router; 