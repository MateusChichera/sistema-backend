// backend/src/routes/pedidoRoutes.js
const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');
const pedidoContasPrazoController = require('../controllers/pedidoContasPrazoController');
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

// Rota pública para acompanhamento de pedido por slug e id
// GET /api/v1/:slug/pedidos/publico/:id
router.get(
  '/:slug/pedidos/publico/:id',
  extractEmpresaId,
  pedidoController.getPedidoPublico
);

// =====================================================
// ROTAS PARA CONTAS A PRAZO (INTEGRAÇÃO COM PEDIDOS)
// =====================================================

// Finalizar pedido com pagamento a prazo
// POST /api/v1/gerencial/:slug/pedidos/:id/finalizar-a-prazo
router.post(
  '/gerencial/:slug/pedidos/:id/finalizar-a-prazo',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa']),
  pedidoContasPrazoController.finalizePedidoContasPrazo
);

// Buscar clientes para seleção no finalizamento
// GET /api/v1/gerencial/:slug/pedidos/clientes/buscar
router.get(
  '/gerencial/:slug/pedidos/clientes/buscar',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa', 'Funcionario']),
  pedidoContasPrazoController.searchClientesForPedido
);

// Cadastrar cliente rapidamente durante finalização
// POST /api/v1/gerencial/:slug/pedidos/clientes/rapido
router.post(
  '/gerencial/:slug/pedidos/clientes/rapido',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa']),
  pedidoContasPrazoController.createClienteRapidoForPedido
);

module.exports = router;