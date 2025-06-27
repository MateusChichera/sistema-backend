// backend/src/routes/testRoutes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware'); // <--- NOVA IMPORTAÇÃO AQUI!

// Rota de teste para verificar a conexão com o banco de dados e o slug
router.get('/:slug/test-db-connection', extractEmpresaId, async (req, res, next) => {
  // req.empresa_id já foi definido pelo middleware extractEmpresaId
  const { slug } = req.params; // Este 'slug' agora será 'demo-restaurante'
  const empresaId = req.empresa_id;

  res.status(200).json({
    message: `Conexão com o banco de dados OK! Empresa encontrada para o slug '${slug}' (ID: ${empresaId}).`,
    slug_encontrado: slug,
    empresa_id: empresaId,
    status_empresa: 'Ativa'
  });
});

module.exports = router;