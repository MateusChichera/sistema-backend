const express = require('express');
const router = express.Router();
const comprovanteController = require('../controllers/comprovanteController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');

// =====================================================
// ROTAS PARA COMPROVANTES DE RECEBIMENTO
// =====================================================

// Gerar comprovante de recebimento completo
// GET /api/v1/gerencial/:slug/comprovantes/titulos/:titulo_id
router.get(
  '/gerencial/:slug/comprovantes/titulos/:titulo_id',
  extractEmpresaId,
  authenticateToken,
  comprovanteController.gerarComprovanteRecebimento
);

// Gerar template de comprovante para impressão (80mm)
// GET /api/v1/gerencial/:slug/comprovantes/titulos/:titulo_id/template
router.get(
  '/gerencial/:slug/comprovantes/titulos/:titulo_id/template',
  extractEmpresaId,
  authenticateToken,
  comprovanteController.gerarTemplateComprovante
);

// Listar títulos em aberto de um cliente
// GET /api/v1/gerencial/:slug/comprovantes/clientes/:cliente_id/titulos-abertos
router.get(
  '/gerencial/:slug/comprovantes/clientes/:cliente_id/titulos-abertos',
  extractEmpresaId,
  authenticateToken,
  comprovanteController.listarTitulosAbertosCliente
);

module.exports = router;
