
const express = require('express');
const router = express.Router();
const acessoController = require('../controllers/acessoController');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');

// Rotas PÚBLICAS para o Cardápio Digital (não precisam de autenticação via token)
// O middleware extractEmpresaId já valida se a empresa está ativa e passa o empresa_id


// POST /api/v1/:slug/cardapio/categorias
router.post(
  '/:slug/acesso',
  extractEmpresaId,
  acessoController.saveCardapioDigitalAccess
);


module.exports = router;