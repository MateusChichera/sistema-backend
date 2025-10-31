// Rotas para gerenciar rastreamento de entrega
const express = require('express');
const router = express.Router();
const rastreamentoController = require('../controllers/rastreamentoController');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

// IMPORTANTE: Rotas mais específicas devem vir ANTES das mais genéricas

// PUT /api/v1/gerencial/:slug/rastreamento/pedidos/:id/localizacao - Atualizar localização (ESPECÍFICA)
router.put('/gerencial/:slug/rastreamento/pedidos/:id/localizacao',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  rastreamentoController.atualizarLocalizacao
);

// POST /api/v1/gerencial/:slug/rastreamento/pedidos/:id/iniciar - Iniciar rastreamento (ESPECÍFICA)
router.post('/gerencial/:slug/rastreamento/pedidos/:id/iniciar',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  rastreamentoController.iniciarRastreamento
);

// POST /api/v1/gerencial/:slug/rastreamento/pedidos/:id/entregue - Marcar como entregue (ESPECÍFICA)
router.post('/gerencial/:slug/rastreamento/pedidos/:id/entregue',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  rastreamentoController.marcarEntregue
);

// GET /api/v1/gerencial/:slug/rastreamento/pedidos - Listar pedidos para motoboy
router.get('/gerencial/:slug/rastreamento/pedidos',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  rastreamentoController.listarPedidosMotoboy
);

// GET /api/v1/:slug/pedidos/:id/rastreamento/publico - Status do rastreamento (público - cliente) (GENÉRICA - ÚLTIMA)
router.get('/:slug/pedidos/:id/rastreamento/publico',
  rastreamentoController.getStatusRastreamento
);

module.exports = router;

