const express = require('express');
const router = express.Router();
const avisosCardapioController = require('../controllers/avisosCardapioController');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/authMiddleware');

// =====================================================
// ROTAS PARA AVISOS DO CARDÁPIO
// =====================================================

// GET /api/v1/gerencial/:slug/avisos-cardapio - Listar todos os avisos do cardápio
router.get('/gerencial/:slug/avisos-cardapio',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa', 'Funcionario']),
  avisosCardapioController.getAllAvisosCardapio
);

// GET /api/v1/gerencial/:slug/avisos-cardapio/:id - Buscar aviso por ID
router.get('/gerencial/:slug/avisos-cardapio/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa', 'Funcionario']),
  avisosCardapioController.getAvisoCardapioById
);

// POST /api/v1/gerencial/:slug/avisos-cardapio - Criar novo aviso do cardápio
router.post('/gerencial/:slug/avisos-cardapio',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  avisosCardapioController.createAvisoCardapio
);

// PUT /api/v1/gerencial/:slug/avisos-cardapio/:id - Atualizar aviso do cardápio
router.put('/gerencial/:slug/avisos-cardapio/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  avisosCardapioController.updateAvisoCardapio
);

// DELETE /api/v1/gerencial/:slug/avisos-cardapio/:id - Excluir aviso do cardápio
router.delete('/gerencial/:slug/avisos-cardapio/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  avisosCardapioController.deleteAvisoCardapio
);

// PATCH /api/v1/gerencial/:slug/avisos-cardapio/:id/toggle - Ativar/Desativar aviso
router.patch('/gerencial/:slug/avisos-cardapio/:id/toggle',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  avisosCardapioController.toggleAvisoCardapio
);

// GET /api/v1/:slug/avisos-cardapio-dia-atual - Buscar avisos do dia atual (rota pública)
router.get('/:slug/avisos-cardapio-dia-atual',
  extractEmpresaId,
  avisosCardapioController.getAvisosDiaAtual
);

module.exports = router;
