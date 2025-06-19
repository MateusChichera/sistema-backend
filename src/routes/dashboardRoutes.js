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

module.exports = router;