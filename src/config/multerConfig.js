const multer = require('multer');
const path = require('path');

// Configuração de armazenamento para o Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Define o diretório de destino dos arquivos.
    // __dirname aponta para 'backend/src/config', então precisamos voltar duas pastas
    // para chegar na raiz 'backend' e então ir para 'public/uploads/logos'.
    cb(null, path.join(__dirname, '../../public/uploads/logos'));
  },
  filename: (req, file, cb) => {
    // Define o nome do arquivo, evitando colisões com um timestamp e mantendo a extensão original.
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

// Filtro para aceitar apenas arquivos de imagem
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/pjpeg', 'image/png', 'image/gif', 'image/svg+xml'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true); // Aceita o arquivo
  } else {
    cb(new Error('Tipo de arquivo inválido. Apenas imagens são permitidas!'), false); // Rejeita o arquivo
  }
};

// Configuração final do Multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Limite de 5MB por arquivo
  }
});

module.exports = upload;