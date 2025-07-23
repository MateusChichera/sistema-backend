const express = require('express');
const router = express.Router();
const { integrationAuth } = require('../middlewares/authMiddleware');
const pedidoController = require('../controllers/pedidoController');
const empresaController = require('../controllers/empresaController');

// Rota para buscar todos os pedidos da empresa autenticada pelo integration_token
router.get('/:slug/integracao/pedidos', integrationAuth, pedidoController.getAllPedidosByEmpresa);
// Rota para buscar dados da empresa autenticada pelo integration_token
router.get('/:slug/integracao/empresa', integrationAuth, empresaController.getEmpresaByIntegration);
// Atualiza dados de NFC-e de um pedido via integração
router.put('/:slug/integracao/pedidos/:id/nfce', integrationAuth, pedidoController.updateNfceByIntegration);

module.exports = router; 