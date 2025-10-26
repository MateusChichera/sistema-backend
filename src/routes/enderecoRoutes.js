const express = require('express');
const router = express.Router();
const {
  createEndereco,
  getAllEnderecos,
  getEnderecoById,
  updateEndereco,
  deleteEndereco,
  addDiaSemana,
  getDiasSemana,
  updateDiaSemana,
  deleteDiaSemana,
  getEnderecoDiaAtual,
  createAviso,
  createAvisoGeral,
  getAvisosEndereco,
  getAvisosDiaAtual,
  updateAviso,
  deleteAviso,
  desativarAviso,
  getEnderecoPorDia
} = require('../controllers/enderecoController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { extractEmpresaId } = require('../middlewares/empresaMiddleware');
const { authorizeRole } = require('../middlewares/authMiddleware');

// =====================================================
// ROTAS PARA GERENCIAMENTO DE ENDEREÇOS
// =====================================================

// ROTAS ALTERNATIVAS PARA AVISOS (sem especificar endereço)
// POST /api/v1/gerencial/:slug/avisos - Criar aviso (rota alternativa)
router.post('/gerencial/:slug/avisos', 
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  createAvisoGeral
);

// GET /api/v1/gerencial/:slug/avisos - Listar avisos (rota alternativa)
router.get('/gerencial/:slug/avisos', 
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa', 'Funcionario']),
  getAvisosEndereco
);

// 1. CRUD de Endereços
// POST /api/v1/gerencial/:slug/enderecos - Criar endereço
router.post('/gerencial/:slug/enderecos', 
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  createEndereco
);

// GET /api/v1/gerencial/:slug/enderecos - Listar endereços
router.get('/gerencial/:slug/enderecos', 
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa', 'Funcionario']),
  getAllEnderecos
);

// GET /api/v1/gerencial/:slug/enderecos/dia-atual - Endereço do dia atual
router.get('/gerencial/:slug/enderecos/dia-atual', 
  extractEmpresaId,
  authenticateToken,
  getEnderecoDiaAtual
);

// GET /api/v1/gerencial/:slug/enderecos/:id - Obter endereço por ID
router.get('/gerencial/:slug/enderecos/:id', 
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa', 'Funcionario']),
  getEnderecoById
);

// PUT /api/v1/gerencial/:slug/enderecos/:id - Atualizar endereço
router.put('/gerencial/:slug/enderecos/:id', 
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  updateEndereco
);

// DELETE /api/v1/gerencial/:slug/enderecos/:id - Deletar endereço
router.delete('/gerencial/:slug/enderecos/:id', 
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  deleteEndereco
);

// 2. Gestão de Dias da Semana
// POST /api/v1/gerencial/:slug/enderecos/:id/dias-semana - Adicionar dia da semana
router.post('/gerencial/:slug/enderecos/:id/dias-semana', 
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  addDiaSemana
);

// GET /api/v1/gerencial/:slug/enderecos/:id/dias-semana - Listar dias da semana
router.get('/gerencial/:slug/enderecos/:id/dias-semana', 
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa', 'Funcionario']),
  getDiasSemana
);

// PUT /api/v1/gerencial/:slug/enderecos/:id/dias-semana/:diaId - Atualizar dia da semana
router.put('/gerencial/:slug/enderecos/:id/dias-semana/:diaId', 
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  updateDiaSemana
);

// DELETE /api/v1/gerencial/:slug/enderecos/:id/dias-semana/:diaId - Excluir dia da semana
router.delete('/gerencial/:slug/enderecos/:id/dias-semana/:diaId', 
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  deleteDiaSemana
);

// 3. Gestão de Avisos
// POST /api/v1/gerencial/:slug/enderecos/:id/avisos - Criar aviso
router.post('/gerencial/:slug/enderecos/:id/avisos', 
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  createAviso
);

// GET /api/v1/gerencial/:slug/enderecos/:id/avisos - Listar avisos do endereço
router.get('/gerencial/:slug/enderecos/:id/avisos', 
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente', 'Caixa', 'Funcionario']),
  getAvisosEndereco
);

// GET /api/v1/gerencial/:slug/enderecos/avisos/dia-atual - Avisos do dia atual
router.get('/gerencial/:slug/enderecos/avisos/dia-atual', 
  extractEmpresaId,
  authenticateToken,
  getAvisosDiaAtual
);

// =====================================================
// ROTAS PARA GERENCIAMENTO DE AVISOS
// =====================================================

// PUT /api/v1/gerencial/:slug/enderecos/:id/avisos/:avisoId - Atualizar aviso
router.put('/gerencial/:slug/enderecos/:id/avisos/:avisoId', 
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  updateAviso
);

// DELETE /api/v1/gerencial/:slug/enderecos/:id/avisos/:avisoId - Excluir aviso
router.delete('/gerencial/:slug/enderecos/:id/avisos/:avisoId', 
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  deleteAviso
);

// PATCH /api/v1/gerencial/:slug/enderecos/:id/avisos/:avisoId/desativar - Desativar/Ativar aviso
router.patch('/gerencial/:slug/enderecos/:id/avisos/:avisoId/desativar', 
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  desativarAviso
);

// =====================================================
// ROTAS PARA BUSCAR ENDEREÇOS POR DIA
// =====================================================

// GET /api/v1/gerencial/:slug/enderecos/dia/:dia - Buscar endereço por dia específico
router.get('/gerencial/:slug/enderecos/dia/:dia', 
  extractEmpresaId,
  authenticateToken,
  getEnderecoPorDia
);

module.exports = router;
