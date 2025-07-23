// backend/src/routes/produtoRoutes.js
const express = require('express');
const router = express.Router();
const produtoController = require('../controllers/produtoController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');
const upload = require('../config/multerConfig'); // Importa a configuração do Multer

// Middleware Multer para uploads de imagens de produtos
// Crie uma pasta 'backend/public/uploads/produtos' para as imagens.
const uploadProdutoImage = upload.single('foto_produto'); // 'foto_produto' é o nome do campo no formulário

// Rotas para gerenciamento de Produtos (Por Empresa)

// Criar novo produto: POST /api/v1/gerencial/:slug/produtos
router.post(
  '/gerencial/:slug/produtos',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  uploadProdutoImage, // Middleware de upload ANTES do controller
  produtoController.createProduto
);

// Listar todos os produtos da empresa: GET /api/v1/gerencial/:slug/produtos
router.get(
  '/gerencial/:slug/produtos',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  produtoController.getAllProdutosByEmpresa
);

// Obter produto por ID: GET /api/v1/gerencial/:slug/produtos/:id
router.get(
  '/gerencial/:slug/produtos/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Funcionario', 'Caixa']),
  produtoController.getProdutoById
);

// Atualizar produto: PUT /api/v1/gerencial/:slug/produtos/:id
router.put(
  '/gerencial/:slug/produtos/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  uploadProdutoImage, // Middleware de upload para nova foto, se houver
  produtoController.updateProduto
);

// Excluir produto: DELETE /api/v1/gerencial/:slug/produtos/:id
router.delete(
  '/gerencial/:slug/produtos/:id',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  produtoController.deleteProduto
);

// Listar todos os perfis tributários (pode ser usado no cadastro/edição de produtos)
router.get('/perfis-tributarios', produtoController.getAllPerfisTributarios);

module.exports = router;