const express = require('express');
const router = express.Router();
const caixaController = require('../controllers/caixaController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');

// Abrir caixa: POST /api/v1/gerencial/:slug/caixas/abrir
router.post(
  '/gerencial/:slug/caixas/abrir',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa']),
  caixaController.openCaixa
);

// Detalhes para fechamento: GET /api/v1/gerencial/:slug/caixas/:id/detalhes-fechamento
router.get(
  '/gerencial/:slug/caixas/:id/detalhes-fechamento',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa']),
  caixaController.getFechamentoDetalhes
);

// Fechar caixa: PUT /api/v1/gerencial/:slug/caixas/:id/fechar
router.put(
  '/gerencial/:slug/caixas/:id/fechar',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa']),
  caixaController.closeCaixa
);

// Registrar SUPRIMENTO: POST /api/v1/gerencial/:slug/caixas/:id/suprimento
router.post(
  '/gerencial/:slug/caixas/:id/suprimento',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa']),
  (req, res, next) => { req.body.tipo_movimentacao = 'Suprimento'; next(); },
  caixaController.addMovimentacao
);

// Registrar SANGRIA: POST /api/v1/gerencial/:slug/caixas/:id/sangria
router.post(
  '/gerencial/:slug/caixas/:id/sangria',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa']),
  (req, res, next) => { req.body.tipo_movimentacao = 'Sangria'; next(); },
  caixaController.addMovimentacao
);

// Listar movimentações: GET /api/v1/gerencial/:slug/caixas/:id/movimentacoes
router.get(
  '/gerencial/:slug/caixas/:id/movimentacoes',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa']),
  caixaController.listMovimentacoes
);

// Verificar se há caixa aberto: GET /api/v1/gerencial/:slug/caixas/aberto
router.get(
  '/gerencial/:slug/caixas/aberto',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa', 'Funcionario']),
  caixaController.getCaixaAberto
);

module.exports = router; 