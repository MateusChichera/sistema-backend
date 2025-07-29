// backend/src/routes/avisoRoutes.js
const express = require('express');
const router = express.Router();
const avisoController = require('../controllers/avisoController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');

// Rotas para gerenciamento de Avisos (Sistema Global)

// Criar novo aviso: POST /api/v1/admin/avisos
router.post(
  '/admin/avisos',
  authenticateToken,
  authorizeRole(['admin_geral']),
  avisoController.createAviso
);

// Listar todos os avisos: GET /api/v1/gerencial/:slug/avisos
router.get(
  '/gerencial/:slug/avisos',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  avisoController.getAllAvisos
);

// Obter aviso por ID: GET /api/v1/gerencial/:slug/avisos/:id
router.get(
  '/gerencial/:slug/avisos/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  avisoController.getAvisoById
);

// Atualizar aviso: PUT /api/v1/admin/avisos/:id
router.put(
  '/admin/avisos/:id',
  authenticateToken,
  authorizeRole(['admin_geral']),
  avisoController.updateAviso
);

// Excluir aviso: DELETE /api/v1/admin/avisos/:id
router.delete(
  '/admin/avisos/:id',
  authenticateToken,
  authorizeRole(['admin_geral']),
  avisoController.deleteAviso
);

// Atualizar status do aviso (marcar como lido/não lido): PATCH /api/v1/gerencial/:slug/avisos/:id/status
router.patch(
  '/gerencial/:slug/avisos/:id/status',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  avisoController.updateAvisoStatus
);

// Verificar se há avisos não lidos: GET /api/v1/gerencial/:slug/avisos/check/nao-lidos
router.get(
  '/gerencial/:slug/avisos/check/nao-lidos',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  avisoController.checkAvisosNaoLidos
);



// Listar todos os avisos com detalhes por empresa (apenas admin): GET /api/v1/admin/avisos/detalhes
router.get(
  '/admin/avisos/detalhes',
  authenticateToken,
  authorizeRole(['admin_geral']),
  avisoController.getAllAvisosWithDetails
);

module.exports = router; 