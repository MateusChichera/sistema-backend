// backend/src/routes/categoriaRoutes.js
const express = require('express');
const router = express.Router();
const categoriaController = require('../controllers/categoriaController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware'); // <--- NOVA IMPORTAÇÃO AQUI!

// Rotas para gerenciamento de Categorias (Por Empresa)
// O extractEmpresaId será aplicado diretamente aqui para garantir que o :slug correto seja pego.

// Criar nova categoria: POST /api/v1/gerencial/:slug/categorias
router.post(
  '/gerencial/:slug/categorias',
  extractEmpresaId, // <--- APLICAR AQUI!
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  categoriaController.createCategoria
);

// Listar todas as categorias da empresa: GET /api/v1/gerencial/:slug/categorias
router.get(
  '/gerencial/:slug/categorias',
  extractEmpresaId, // <--- APLICAR AQUI!
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  categoriaController.getAllCategoriasByEmpresa
);

// Obter categoria por ID: GET /api/v1/gerencial/:slug/categorias/:id
router.get(
  '/gerencial/:slug/categorias/:id',
  extractEmpresaId, // <--- APLICAR AQUI!
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  categoriaController.getCategoriaById
);

// Atualizar categoria: PUT /api/v1/gerencial/:slug/categorias/:id
router.put(
  '/gerencial/:slug/categorias/:id',
  extractEmpresaId, // <--- APLICAR AQUI!
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  categoriaController.updateCategoria
);

// Excluir categoria: DELETE /api/v1/gerencial/:slug/categorias/:id
router.delete(
  '/gerencial/:slug/categorias/:id',
  extractEmpresaId, // <--- APLICAR AQUI!
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  categoriaController.deleteCategoria
);

module.exports = router;