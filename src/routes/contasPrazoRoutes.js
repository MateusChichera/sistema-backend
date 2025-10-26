const express = require('express');
const router = express.Router();
const {
  createTitulo,
  getAllTitulosByEmpresa,
  getTituloById,
  getDetalhesTitulo,
  registrarPagamentoTitulo,
  pagamentoMultiploTitulos,
  getTitulosByCliente,
  createClienteRapido,
  searchClientes,
  getTitulosVencidos,
  getHistoricoCliente
} = require('../controllers/contasPrazoController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');

// =====================================================
// ROTAS PARA TÍTULOS (CONTAS A PRAZO)
// =====================================================

// POST /api/v1/gerencial/:slug/contas-prazo/titulos - Criar novo título
router.post('/gerencial/:slug/contas-prazo/titulos', 
  extractEmpresaId,
  authenticateToken,
  createTitulo
);

// GET /api/v1/gerencial/:slug/contas-prazo/titulos - Listar títulos da empresa
router.get('/gerencial/:slug/contas-prazo/titulos', 
  extractEmpresaId,
  authenticateToken,
  getAllTitulosByEmpresa
);

// GET /api/v1/gerencial/:slug/contas-prazo/titulos/:id - Obter detalhes de um título
router.get('/gerencial/:slug/contas-prazo/titulos/:id', 
  extractEmpresaId,
  authenticateToken,
  getTituloById
);

// GET /api/v1/gerencial/:slug/contas-prazo/titulos/:id/detalhes - Obter detalhes completos de um título
router.get('/gerencial/:slug/contas-prazo/titulos/:id/detalhes', 
  extractEmpresaId,
  authenticateToken,
  getDetalhesTitulo
);

// POST /api/v1/gerencial/:slug/contas-prazo/titulos/:id/pagamento - Registrar pagamento de título
router.post('/gerencial/:slug/contas-prazo/titulos/:id/pagamento', 
  extractEmpresaId,
  authenticateToken,
  registrarPagamentoTitulo
);

// POST /api/v1/gerencial/:slug/contas-prazo/titulos/pagamento-multiplo - Pagamento múltiplo de títulos
router.post('/gerencial/:slug/contas-prazo/titulos/pagamento-multiplo', 
  extractEmpresaId,
  authenticateToken,
  pagamentoMultiploTitulos
);

// GET /api/v1/gerencial/:slug/contas-prazo/clientes/:cliente_id/titulos - Listar títulos de um cliente
router.get('/gerencial/:slug/contas-prazo/clientes/:cliente_id/titulos', 
  extractEmpresaId,
  authenticateToken,
  getTitulosByCliente
);

// GET /api/v1/gerencial/:slug/contas-prazo/clientes/:cliente_id/historico - Histórico completo do cliente
router.get('/gerencial/:slug/contas-prazo/clientes/:cliente_id/historico', 
  extractEmpresaId,
  authenticateToken,
  getHistoricoCliente
);

// =====================================================
// ROTAS PARA CLIENTES
// =====================================================

// POST /api/v1/gerencial/:slug/contas-prazo/clientes/rapido - Cadastrar cliente rapidamente
router.post('/gerencial/:slug/contas-prazo/clientes/rapido', 
  extractEmpresaId,
  authenticateToken,
  createClienteRapido
);

// GET /api/v1/gerencial/:slug/contas-prazo/clientes/buscar - Buscar clientes
router.get('/gerencial/:slug/contas-prazo/clientes/buscar', 
  extractEmpresaId,
  authenticateToken,
  searchClientes
);

// =====================================================
// ROTAS PARA RELATÓRIOS
// =====================================================

// GET /api/v1/gerencial/:slug/contas-prazo/relatorios/vencidos - Títulos vencidos
router.get('/gerencial/:slug/contas-prazo/relatorios/vencidos', 
  extractEmpresaId,
  authenticateToken,
  getTitulosVencidos
);

module.exports = router;
