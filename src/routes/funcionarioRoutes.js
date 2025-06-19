// backend/src/routes/funcionarioRoutes.js
const express = require('express');
const router = express.Router();
const funcionarioController = require('../controllers/funcionarioController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware'); // Importa para uso local na rota

// Rotas para gerenciamento de Funcionários (Por Empresa)
// O middleware 'extractEmpresaId' é aplicado explicitamente aqui.

// Criar novo funcionário: POST /api/v1/gerencial/:slug/funcionarios
router.post(
  '/gerencial/:slug/funcionarios',
  extractEmpresaId, // Garante que empresa_id está no req
  authenticateToken,
  authorizeRole('Proprietario'), // Apenas Proprietario pode criar
  funcionarioController.createFuncionario
);

// Listar todos os funcionários da empresa: GET /api/v1/gerencial/:slug/funcionarios
router.get(
  '/gerencial/:slug/funcionarios',
  extractEmpresaId, // Garante que empresa_id está no req
  authenticateToken,
  authorizeRole('Proprietario'), // Apenas Proprietario pode listar todos
  funcionarioController.getAllFuncionariosByEmpresa
);

// Obter funcionário por ID: GET /api/v1/gerencial/:slug/funcionarios/:id
router.get(
  '/gerencial/:slug/funcionarios/:id',
  extractEmpresaId, // Garante que empresa_id está no req
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']), // Pode ser visto por qualquer um (se for o próprio perfil)
  funcionarioController.getFuncionarioById
);

// Atualizar funcionário: PUT /api/v1/gerencial/:slug/funcionarios/:id
router.put(
  '/gerencial/:slug/funcionarios/:id',
  extractEmpresaId, // Garante que empresa_id está no req
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']), // Proprietario pode atualizar qualquer um, outros só a si mesmos
  funcionarioController.updateFuncionario
);

// Excluir funcionário: DELETE /api/v1/gerencial/:slug/funcionarios/:id
router.delete(
  '/gerencial/:slug/funcionarios/:id',
  extractEmpresaId, // Garante que empresa_id está no req
  authenticateToken,
  authorizeRole('Proprietario'), // Apenas Proprietario pode excluir
  funcionarioController.deleteFuncionario
);

module.exports = router;