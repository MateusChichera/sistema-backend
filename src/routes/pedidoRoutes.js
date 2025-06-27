// backend/src/routes/pedidoRoutes.js
const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');
const { authenticateToken, authorizeRole,authenticateOptional } = require('../middlewares/authMiddleware');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');

// Rotas para gerenciamento de Pedidos

// Criar um novo pedido (usado por garçom ou pelo cardápio digital)
// POST /api/v1/:slug/pedidos
router.post(
  '/:slug/pedidos',
  extractEmpresaId, // Para pegar o empresa_id
  authenticateOptional, // <<--- USE ESTE AGORA!
  pedidoController.createPedido
);

// Listar todos os pedidos de uma empresa
// GET /api/v1/gerencial/:slug/pedidos
router.get(
  '/gerencial/:slug/pedidos',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  pedidoController.getAllPedidosByEmpresa
);

// Obter detalhes de um pedido específico
// GET /api/v1/gerencial/:slug/pedidos/:id

router.get(
  '/gerencial/:slug/pedidos/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  pedidoController.getPedidoById
);

// Atualizar status de um pedido
// PUT /api/v1/gerencial/:slug/pedidos/:id/status
router.put(
  '/gerencial/:slug/pedidos/:id/status',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa', 'Funcionario']),
  pedidoController.updatePedidoStatus
);

// Finalizar pedido e registrar pagamento (Caixa)
// POST /api/v1/gerencial/:slug/pedidos/:id/finalizar
router.post(
  '/gerencial/:slug/pedidos/:id/finalizar',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa']),
  pedidoController.finalizePedidoAndRegisterPayment
);

router.post(
  '/gerencial/:slug/pedidos/:id/adicionar-itens',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa', 'Funcionario']), // Garçom pode
  pedidoController.addItensToExistingOrder
);

// Excluir um pedido
// DELETE /api/v1/gerencial/:slug/pedidos/:id
router.delete(
  '/gerencial/:slug/pedidos/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole('Proprietario'), // Apenas Proprietario pode excluir
  pedidoController.deletePedido
);

module.exports = router;