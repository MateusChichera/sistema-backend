const express = require('express');
const router = express.Router();
const configEmpresaController = require('../controllers/configEmpresaController');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const upload = require('../config/multerConfig'); // Importa a configuração do Multer

// Rota pública para obter as configurações de uma empresa pelo slug
// Ex: GET /api/v1/demo-restaurante/config
router.get('/:slug/config', extractEmpresaId, configEmpresaController.getConfigBySlug);

// Rota para atualizar as configurações de uma empresa
// Exige autenticação (Proprietário ou Gerente da empresa)
// Ex: PUT /api/v1/gerencial/demo-restaurante/config
router.put(
  '/gerencial/:slug/config',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']), // Apenas proprietário ou gerente podem alterar
  configEmpresaController.updateConfig
);

// Nova rota para upload de logo da empresa
// Ex: POST /api/v1/gerencial/demo-restaurante/config/upload-logo
router.post(
  '/gerencial/:slug/config/upload-logo',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']), // Apenas proprietário ou gerente podem fazer upload
  upload.single('logo'), // Middleware do Multer: 'logo' é o nome do campo do formulário
  configEmpresaController.uploadLogo
);

module.exports = router;