const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware'); // Importa o middleware para extrair empresa_id
const { integrationLogin } = require('../controllers/authController'); // Importa a nova função

// Rota para o login do Administrador Geral (não precisa de slug)
router.post('/admin/login', authController.adminLogin);

// Rotas de autenticação para empresas específicas (funcionários e clientes)
// Estas rotas usam o middleware extractEmpresaId para obter o empresa_id do slug na URL
// Ex: POST /api/v1/demo-restaurante/funcionario/login
router.post('/:slug/funcionario/login', extractEmpresaId, authController.funcionarioLogin);
router.post('/:slug/cliente/login', extractEmpresaId, authController.clienteLogin);
router.post('/:slug/cliente/register', extractEmpresaId, authController.registerClient); // Rota de cadastro de cliente

// Rota de autenticação para integração desktop
router.post('/:slug/integracao/login', integrationLogin);

module.exports = router;