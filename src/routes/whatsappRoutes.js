// Rotas para gerenciar WhatsApp por empresa
const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');
const { authenticateToken } = require('../middlewares/authMiddleware');

// POST /api/v1/gerencial/:slug/whatsapp/connect - Conectar WhatsApp
router.post('/gerencial/:slug/whatsapp/connect',
  extractEmpresaId,
  authenticateToken,
  whatsappController.connectWhatsApp
);

// POST /api/v1/gerencial/:slug/whatsapp/disconnect - Desconectar WhatsApp
router.post('/gerencial/:slug/whatsapp/disconnect',
  extractEmpresaId,
  authenticateToken,
  whatsappController.disconnectWhatsApp
);

// GET /api/v1/gerencial/:slug/whatsapp/status - Obter status da conexão
router.get('/gerencial/:slug/whatsapp/status',
  extractEmpresaId,
  authenticateToken,
  whatsappController.getWhatsAppStatus
);

// GET /api/v1/gerencial/:slug/whatsapp/qrcode - Obter QR Code para conectar
router.get('/gerencial/:slug/whatsapp/qrcode',
  extractEmpresaId,
  authenticateToken,
  whatsappController.getQRCode
);

// POST /api/v1/gerencial/:slug/whatsapp/send-test - Enviar mensagem de teste
router.post('/gerencial/:slug/whatsapp/send-test',
  extractEmpresaId,
  authenticateToken,
  whatsappController.sendTestMessage
);

module.exports = router;
