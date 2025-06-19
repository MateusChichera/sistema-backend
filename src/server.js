// backend/src/server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const { testConnection } = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');

// Importa as rotas
const testRoutes = require('./routes/testRoutes');
const authRoutes = require('./routes/authRoutes');
const empresaRoutes = require('./routes/empresaRoutes');
const configEmpresaRoutes = require('./routes/configEmpresaRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const funcionarioRoutes = require('./routes/funcionarioRoutes');
const formaPagamentoRoutes = require('./routes/formaPagamentoRoutes');
const produtoRoutes = require('./routes/produtoRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');
const cardapioPublicRoutes = require('./routes/cardapioPublicRoutes'); // <--- NOVA IMPORTAÇÃO
const mesaRoutes = require('./routes/mesaRoutes');

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

// Rotas (extractEmpresaId é aplicado dentro de cada arquivo de rota ou grupo de rotas)
app.get('/', (req, res) => {
  res.send('API do Sistema de Restaurantes está online!');
});

app.use('/api/v1', authRoutes); // Autenticação (inclui logins de funcionário/cliente por slug)
app.use('/api/v1', empresaRoutes); // Admin Master (gerenciamento de empresas)

// Rotas Públicas do Cardápio (NÃO PROTEGIDAS POR TOKEN)
app.use('/api/v1', cardapioPublicRoutes); // <--- NOVA ROTA PÚBLICA

// Rotas Gerenciais (PROTEGIDAS POR TOKEN E ROLE)
app.use('/api/v1', configEmpresaRoutes);
app.use('/api/v1', categoriaRoutes);
app.use('/api/v1', funcionarioRoutes);
app.use('/api/v1', formaPagamentoRoutes);
app.use('/api/v1', produtoRoutes);
app.use('/api/v1', mesaRoutes); // Rotas de mesa, onde a criação não exige token, mas outras sim.
app.use('/api/v1', pedidoRoutes); // Rotas de pedido, onde a criação não exige token, mas outras sim.

app.use('/api/v1', testRoutes);

// Middleware de tratamento de erros (DEVE SER O ÚLTIMO MIDDLEWARE)
app.use(errorHandler);

// Inicia o servidor e testa a conexão com o banco de dados
app.listen(port, async () => {
  console.log(`Servidor rodando na porta ${port}`);
  console.log(`Acesse: http://localhost:${port}`);
  await testConnection();
});