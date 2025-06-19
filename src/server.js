// backend/src/server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const { testConnection } = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');

// Importa os middlewares
// const { extractEmpresaId } = require('./middlewares/empresaMiddleware'); // <--- REMOVA ESTA IMPORTAÇÃO GLOBAL. Será importada por rota.

// Importa as rotas
const testRoutes = require('./routes/testRoutes');
const authRoutes = require('./routes/authRoutes');
const empresaRoutes = require('./routes/empresaRoutes');
const configEmpresaRoutes = require('./routes/configEmpresaRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve arquivos estáticos da pasta 'public'.
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// REMOVIDO: Middleware global para extrair empresa_id de rotas com :slug.
// app.use('/api/v1/:slug', extractEmpresaId); // <--- ESTA LINHA SERÁ REMOVIDA

// Rotas
app.get('/', (req, res) => {
  res.send('API do Sistema de Restaurantes está online!');
});

// Use as rotas de autenticação (authRoutes já chama extractEmpresaId onde precisa)
app.use('/api/v1', authRoutes);

// Use as rotas de gerenciamento de empresas (Admin Master - não usa slug da empresa na URL)
app.use('/api/v1', empresaRoutes);

// Use as rotas de configuração da empresa (configEmpresaRoutes JÁ TEM extractEmpresaId INTERNAMENTE)
app.use('/api/v1', configEmpresaRoutes);

// Use as rotas de gerenciamento de categorias (categoriaRoutes JÁ TEM extractEmpresaId INTERNAMENTE)
app.use('/api/v1', categoriaRoutes);

// Rotas de teste (testRoutes JÁ TEM extractEmpresaId INTERNAMENTE)
app.use('/api/v1', testRoutes);

// Middleware de tratamento de erros (DEVE SER O ÚLTIMO MIDDLEWARE)
app.use(errorHandler);

// Inicia o servidor e testa a conexão com o banco de dados
app.listen(port, async () => {
  console.log(`Servidor rodando na porta ${port}`);
  console.log(`Acesse: http://localhost:${port}`);
  await testConnection();
});