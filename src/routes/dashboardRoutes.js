// backend/src/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');

// Rota para obter dados do Dashboard
// GET /api/v1/gerencial/:slug/dashboard-data
router.get(
  '/gerencial/:slug/dashboard-data',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']), // Apenas Proprietário e Gerente podem ver
  dashboardController.getDashboardData
);

// Rota para obter Relatório de Acessos x Pedidos
// GET /api/v1/gerencial/:slug/relatorio-acessos-pedidos?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get(
  '/gerencial/:slug/relatorio-acessos-pedidos',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  dashboardController.getRelatorioAcessosPedidos
);

module.exports = router;