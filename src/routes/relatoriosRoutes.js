const express = require('express');
const router = express.Router();
const relatoriosController = require('../controllers/relatoriosController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');



// Rota para obter o relatório de caixa
router.get('/gerencial/:slug/relatorios/caixa',
    extractEmpresaId,
    authenticateToken,
    authorizeRole(['Proprietario','Gerente']),
    relatoriosController.getRelatorioCaixa
);

// Rota para obter o relatório de pedidos
router.get('/gerencial/:slug/relatorios/pedidos',
    extractEmpresaId,
    authenticateToken,
    authorizeRole(['Proprietario','Gerente','Caixa']),
    relatoriosController.getRelatorioPedidos
);

// Rota para obter o relatório de estoque (stored procedure)
router.get('/gerencial/:slug/relatorios/estoque',
    extractEmpresaId,
    authenticateToken,
    authorizeRole(['Proprietario','Gerente']),
    relatoriosController.getRelatorioEstoque
);




module.exports = router;