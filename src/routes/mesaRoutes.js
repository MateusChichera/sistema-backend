// backend/src/routes/mesaRoutes.js
const express = require('express');
const router = express.Router();
const mesaController = require('../controllers/mesaController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');

// Rotas para gerenciamento de Mesas (Por Empresa)

// Criar nova mesa: POST /api/v1/gerencial/:slug/mesas
router.post(
  '/gerencial/:slug/mesas',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  mesaController.createMesa
);

// Listar todas as mesas da empresa: GET /api/v1/gerencial/:slug/mesas
router.get(
  '/gerencial/:slug/mesas',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']), // Todos podem visualizar
  mesaController.getAllMesasByEmpresa
);

// Obter mesa por ID: GET /api/v1/gerencial/:slug/mesas/:id
router.get(
  '/gerencial/:slug/mesas/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  mesaController.getMesaById
);

// Atualizar mesa: PUT /api/v1/gerencial/:slug/mesas/:id
router.put(
  '/gerencial/:slug/mesas/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  mesaController.updateMesa
);

// Excluir mesa: DELETE /api/v1/gerencial/:slug/mesas/:id
router.delete(
  '/gerencial/:slug/mesas/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  mesaController.deleteMesa
);

module.exports = router;