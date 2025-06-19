const express = require('express');
const router = express.Router();
const empresaController = require('../controllers/empresaController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

// Rotas para gerenciamento de empresas (ADMIN MASTER)
// Todas estas rotas exigem autenticação e a role 'admin_geral'

// Criar uma nova empresa (POST /api/v1/admin/empresas)
router.post('/admin/empresas', authenticateToken, authorizeRole('admin_geral'), empresaController.createEmpresa);

// Listar todas as empresas (GET /api/v1/admin/empresas)
router.get('/admin/empresas', authenticateToken, authorizeRole('admin_geral'), empresaController.getAllEmpresas);

// Obter detalhes de uma empresa por ID (GET /api/v1/admin/empresas/:id)
router.get('/admin/empresas/:id', authenticateToken, authorizeRole('admin_geral'), empresaController.getEmpresaById);

// Atualizar uma empresa por ID (PUT /api/v1/admin/empresas/:id)
router.put('/admin/empresas/:id', authenticateToken, authorizeRole('admin_geral'), empresaController.updateEmpresa);

// Excluir uma empresa por ID (DELETE /api/v1/admin/empresas/:id)
router.delete('/admin/empresas/:id', authenticateToken, authorizeRole('admin_geral'), empresaController.deleteEmpresa);

module.exports = router;