// backend/src/routes/formaPagamentoRoutes.js
const express = require('express');
const router = express.Router();
const formaPagamentoController = require('../controllers/formaPagamentoController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware'); // Importa para uso local

// Rotas para gerenciamento de Formas de Pagamento (Por Empresa)
// O middleware 'extractEmpresaId' é aplicado explicitamente aqui.

// Criar nova forma de pagamento: POST /api/v1/gerencial/:slug/formas-pagamento
router.post(
  '/gerencial/:slug/formas-pagamento',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']), // Apenas Proprietario/Gerente pode criar
  formaPagamentoController.createFormaPagamento
);

// Listar todas as formas de pagamento da empresa: GET /api/v1/gerencial/:slug/formas-pagamento
router.get(
  '/gerencial/:slug/formas-pagamento',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']), // Todos os funcionários podem ver
  formaPagamentoController.getAllFormasPagamentoByEmpresa
);

// Obter forma de pagamento por ID: GET /api/v1/gerencial/:slug/formas-pagamento/:id
router.get(
  '/gerencial/:slug/formas-pagamento/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  formaPagamentoController.getFormaPagamentoById
);

// Atualizar forma de pagamento: PUT /api/v1/gerencial/:slug/formas-pagamento/:id
router.put(
  '/gerencial/:slug/formas-pagamento/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']), // Apenas Proprietario/Gerente pode atualizar
  formaPagamentoController.updateFormaPagamento
);

// Excluir forma de pagamento: DELETE /api/v1/gerencial/:slug/formas-pagamento/:id
router.delete(
  '/gerencial/:slug/formas-pagamento/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']), // Apenas Proprietario/Gerente pode excluir
  formaPagamentoController.deleteFormaPagamento
);

module.exports = router;