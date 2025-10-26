// Middleware de CORS para desenvolvimento
const cors = require('cors');

const corsDevOptions = {
  origin: function (origin, callback) {
    // Em desenvolvimento, permite todas as origens
    console.log('CORS - Origin recebida:', origin);
    
    // Lista de origens permitidas para desenvolvimento
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174', 
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:3000',
      'https://athospp.com.br',
      'http://athospp.com.br'
    ];
    
    // Permite requisições sem origin (ex: Postman, curl)
    if (!origin) {
      return callback(null, true);
    }
    
    // Verifica se a origin está na lista permitida
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Para desenvolvimento, permite qualquer origin local
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Em desenvolvimento, permite todas as origens
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  credentials: true,
  optionsSuccessStatus: 200 // Para suportar navegadores legados
};

module.exports = cors(corsDevOptions);
