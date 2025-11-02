// backend/src/server.js
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const cors = require('cors');

const http = require('http'); // Importa o módulo HTTP
const https = require('https'); // Importa o módulo HTTPS
const fs = require('fs'); // Para ler certificados SSL
const { Server } = require('socket.io'); // Importa o Server do socket.io

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
const cardapioPublicRoutes = require('./routes/cardapioPublicRoutes');
const mesasRoutes = require('./routes/mesaRoutes');
const caixaRoutes = require('./routes/caixaRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const acessoPublicRoutes = require('./routes/acessoPublicRoutes');
const adicionalRoutes = require('./routes/adicionalRoutes');
const produtoAdicionalRoutes = require('./routes/produtoAdicionalRoutes');
const integracaoRoutes = require('./routes/integracaoRoutes');
const relatoriosRoutes = require('./routes/relatoriosRoutes');
const avisoRoutes = require('./routes/avisoRoutes');
const avisosCardapioRoutes = require('./routes/avisosCardapioRoutes');
const contasPrazoRoutes = require('./routes/contasPrazoRoutes');
const enderecoRoutes = require('./routes/enderecoRoutes');
const comprovanteRoutes = require('./routes/comprovanteRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const rastreamentoRoutes = require('./routes/rastreamentoRoutes');

dotenv.config();

const app = express();

// ============================================
// Configuração SSL/HTTPS
// ============================================
let httpsOptions = null;
const sslCertPath = process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/athospp.com.br';
const sslKeyPath = path.join(sslCertPath, 'privkey.pem');
const sslCertFilePath = path.join(sslCertPath, 'fullchain.pem');

// Verificar se os certificados SSL estão disponíveis
try {
  if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertFilePath)) {
    httpsOptions = {
      key: fs.readFileSync(sslKeyPath, 'utf8'),
      cert: fs.readFileSync(sslCertFilePath, 'utf8')
    };
    console.log('✅ Certificados SSL encontrados - HTTPS será habilitado');
  } else {
    console.log('⚠️ Certificados SSL não encontrados - Apenas HTTP será usado');
    console.log(`   Procurando em: ${sslCertPath}`);
  }
} catch (error) {
  console.log('⚠️ Erro ao carregar certificados SSL - Apenas HTTP será usado');
  console.log(`   Erro: ${error.message}`);
}

// ============================================
// Criar servidores HTTP e HTTPS
// ============================================
const httpServer = http.createServer(app); // Servidor HTTP
let httpsServer = null; // Servidor HTTPS (criado apenas se certificados estiverem disponíveis)

const port = process.env.PORT || 3001;
const httpsPort = process.env.HTTPS_PORT || 3002;

// Criar servidor HTTPS se certificados estiverem disponíveis
if (httpsOptions) {
  try {
    httpsServer = https.createServer(httpsOptions, app);
    console.log('✅ Servidor HTTPS criado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao criar servidor HTTPS:', error.message);
    httpsServer = null;
  }
}

// ============================================
// Configurar Socket.IO
// ============================================
// Socket.IO será anexado aos servidores HTTP e HTTPS
const io = new Server(httpServer, { // Socket.IO no servidor HTTP
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000', 
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://212.85.23.251:5173',
      'http://212.85.23.251:3000',
      'https://athospp.com.br',
      'http://athospp.com.br'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }
});

// Se servidor HTTPS estiver disponível, criar instância do Socket.IO para HTTPS também
let ioHttps = null;
if (httpsServer) {
  ioHttps = new Server(httpsServer, {
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000', 
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://212.85.23.251:5173',
        'http://212.85.23.251:3000',
        'https://athospp.com.br',
        'http://athospp.com.br'
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    }
  });
}

// Middlewares
// Configuração de CORS simples para desenvolvimento
app.use(cors({
  origin: true, // Permite todas as origens em desenvolvimento
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Middleware adicional para lidar com requisições OPTIONS (preflight)
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve arquivos estáticos da pasta 'public'.
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Middleware para injetar 'io' (socket.io) no objeto de requisição
// Cria um objeto que permite usar ambos os sockets (HTTP e HTTPS) para broadcast
// Mantém compatibilidade com código existente que usa req.io.to(room).emit(event, data)
app.use((req, res, next) => {
  // Criar objeto que permite broadcast em ambos os servidores (HTTP e HTTPS)
  // Compatível com uso: req.io.to(room).emit(event, data)
  req.io = {
    // Socket.IO HTTP (sempre disponível)
    http: io,
    // Socket.IO HTTPS (disponível apenas se servidor HTTPS estiver ativo)
    https: ioHttps,
    // Método to() compatível com Socket.IO padrão - broadcast em ambos os servidores
    to: (room) => {
      return {
        emit: (event, data) => {
          // Emitir para HTTP (sempre disponível)
          io.to(room).emit(event, data);
          // Emitir para HTTPS se disponível
          if (ioHttps) {
            ioHttps.to(room).emit(event, data);
          }
        }
      };
    },
    // Função helper para broadcast geral em ambos os servidores
    emit: (event, data) => {
      io.emit(event, data);
      if (ioHttps) ioHttps.emit(event, data);
    }
  };
  next();
});


// Rotas (extractEmpresaId é aplicado dentro de cada arquivo de rota onde necessário)
app.get('/', (req, res) => {
  res.send('API do Sistema de Restaurantes está online!');
});

app.use('/api/v1', authRoutes);
app.use('/api/v1', empresaRoutes);
app.use('/api/v1', configEmpresaRoutes);
app.use('/api/v1', categoriaRoutes);
app.use('/api/v1', funcionarioRoutes);
app.use('/api/v1', formaPagamentoRoutes);
app.use('/api/v1', produtoRoutes);
// Rotas de rastreamento ANTES das rotas de pedidos para evitar conflito
app.use('/api/v1', rastreamentoRoutes);
app.use('/api/v1', pedidoRoutes);
app.use('/api/v1', cardapioPublicRoutes);
app.use('/api/v1', mesasRoutes);
app.use('/api/v1', caixaRoutes);
app.use('/api/v1', dashboardRoutes);
app.use('/api/v1', acessoPublicRoutes);
app.use('/api/v1', adicionalRoutes);
app.use('/api/v1', produtoAdicionalRoutes);
app.use('/api/v1', integracaoRoutes);
app.use('/api/v1', relatoriosRoutes);
app.use('/api/v1', avisoRoutes);
app.use('/api/v1', avisosCardapioRoutes);
app.use('/api/v1', contasPrazoRoutes);
app.use('/api/v1', enderecoRoutes);
app.use('/api/v1', comprovanteRoutes);
app.use('/api/v1', whatsappRoutes);

app.use('/api/v1', testRoutes);

// Middleware de tratamento de erros (DEVE SER O ÚLTIMO MIDDLEWARE)
app.use(errorHandler);

// Eventos do Socket.IO (opcional, para logging de conexão)
io.on('connection', (socket) => {
  console.log(`Socket.IO: Cliente conectado: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Socket.IO: Cliente desconectado: ${socket.id}`);
  });

  // Evento para entrar na sala da empresa
  socket.on('join_company_room', (empresaId) => {
    socket.join(`company_${empresaId}`);
    console.log(`Socket.IO: Cliente ${socket.id} entrou na sala da empresa ${empresaId}`);
  });

  // Evento para o cliente acompanhar um pedido específico
  // Espera receber: { slug, pedidoId }
  socket.on('join_pedido_room', ({ slug, pedidoId }) => {
    if (slug && pedidoId) {
      const roomName = `pedido_${slug}_${pedidoId}`;
      socket.join(roomName);
      console.log(`Socket.IO: Cliente ${socket.id} entrou na sala do pedido ${roomName}`);
    }
  });

  // ============================================
  // Eventos Socket.IO - Rastreamento Público
  // ============================================

  // Cliente entra na sala do rastreamento público
  // Espera receber: { slug, pedidoId }
  socket.on('join_rastreamento_room', ({ slug, pedidoId }) => {
    if (slug && pedidoId) {
      const roomName = `rastreamento:${slug}:pedido:${pedidoId}`;
      socket.join(roomName);
      console.log(`[Socket] Cliente ${socket.id} entrou na sala ${roomName}`);
    } else {
      console.warn(`[Socket] join_rastreamento_room inválido - slug: ${slug}, pedidoId: ${pedidoId}`);
    }
  });

  // Cliente sai da sala do rastreamento público
  // Espera receber: { slug, pedidoId }
  socket.on('leave_rastreamento_room', ({ slug, pedidoId }) => {
    if (slug && pedidoId) {
      const roomName = `rastreamento:${slug}:pedido:${pedidoId}`;
      socket.leave(roomName);
      console.log(`[Socket] Cliente ${socket.id} saiu da sala ${roomName}`);
    }
  });
});


// ============================================
// Iniciar servidores HTTP e HTTPS
// ============================================

// Inicia o servidor HTTP (sempre disponível)
httpServer.listen(port, async () => {
  console.log('='.repeat(60));
  console.log(`✅ Servidor HTTP rodando na porta ${port}`);
  console.log(`   Acesse: http://localhost:${port}`);
  console.log('='.repeat(60));
  await testConnection();
});

// Criar variável global 'io' compatível com código existente que usa 'io' diretamente
// Permite broadcast em ambos os protocolos (HTTP e HTTPS)
const globalIo = {
  to: (room) => {
    return {
      emit: (event, data) => {
        // Emitir para HTTP (sempre disponível)
        io.to(room).emit(event, data);
        // Emitir para HTTPS se disponível
        if (ioHttps) {
          ioHttps.to(room).emit(event, data);
        }
      }
    };
  },
  emit: (event, data) => {
    io.emit(event, data);
    if (ioHttps) ioHttps.emit(event, data);
  }
};

// Tornar disponível globalmente para código que usa 'io' diretamente
global.io = globalIo;

// Inicia o servidor HTTPS (apenas se certificados estiverem disponíveis)
if (httpsServer) {
  httpsServer.listen(httpsPort, async () => {
    console.log('='.repeat(60));
    console.log(`✅ Servidor HTTPS rodando na porta ${httpsPort}`);
    console.log(`   Acesse: https://localhost:${httpsPort}`);
    console.log(`   Ou via domínio: https://athospp.com.br:${httpsPort}`);
    console.log('='.repeat(60));
  });

  // Compartilhar os mesmos eventos do Socket.IO para HTTPS
  if (ioHttps) {
    // Eventos do Socket.IO para HTTPS (idênticos ao HTTP)
    ioHttps.on('connection', (socket) => {
      console.log(`[HTTPS] Socket.IO: Cliente conectado: ${socket.id}`);

      socket.on('disconnect', () => {
        console.log(`[HTTPS] Socket.IO: Cliente desconectado: ${socket.id}`);
      });

      // Evento para entrar na sala da empresa
      socket.on('join_company_room', (empresaId) => {
        socket.join(`company_${empresaId}`);
        console.log(`[HTTPS] Socket.IO: Cliente ${socket.id} entrou na sala da empresa ${empresaId}`);
      });

      // Evento para o cliente acompanhar um pedido específico
      socket.on('join_pedido_room', ({ slug, pedidoId }) => {
        if (slug && pedidoId) {
          const roomName = `pedido_${slug}_${pedidoId}`;
          socket.join(roomName);
          console.log(`[HTTPS] Socket.IO: Cliente ${socket.id} entrou na sala do pedido ${roomName}`);
        }
      });

      // Eventos Socket.IO - Rastreamento Público
      socket.on('join_rastreamento_room', ({ slug, pedidoId }) => {
        if (slug && pedidoId) {
          const roomName = `rastreamento:${slug}:pedido:${pedidoId}`;
          socket.join(roomName);
          console.log(`[HTTPS] [Socket] Cliente ${socket.id} entrou na sala ${roomName}`);
        } else {
          console.warn(`[HTTPS] [Socket] join_rastreamento_room inválido - slug: ${slug}, pedidoId: ${pedidoId}`);
        }
      });

      socket.on('leave_rastreamento_room', ({ slug, pedidoId }) => {
        if (slug && pedidoId) {
          const roomName = `rastreamento:${slug}:pedido:${pedidoId}`;
          socket.leave(roomName);
          console.log(`[HTTPS] [Socket] Cliente ${socket.id} saiu da sala ${roomName}`);
        }
      });
    });
  }
} else {
  console.log('ℹ️  Servidor HTTPS não foi iniciado (certificados não encontrados)');
  console.log('ℹ️  O backend continuará funcionando normalmente em HTTP');
  console.log('ℹ️  O Nginx continuará fazendo proxy HTTPS -> HTTP');
}