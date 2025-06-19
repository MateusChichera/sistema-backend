// backend/src/config/multerConfig.js
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Importa o módulo 'fs' para criar diretórios

// Garante que os diretórios de upload existam
const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Configuração de armazenamento para o Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;
    // Define o diretório de destino baseado no tipo de arquivo (fieldname)
    if (file.fieldname === 'logo') {
      uploadPath = path.join(__dirname, '../../public/uploads/logos');
    } else if (file.fieldname === 'foto_produto') { // Novo destino para produtos
      uploadPath = path.join(__dirname, '../../public/uploads/produtos');
    } else {
      uploadPath = path.join(__dirname, '../../public/uploads/temp'); // Fallback
    }

    ensureDirExists(uploadPath); // Garante que a pasta exista
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Define o nome do arquivo, evitando colisões com um timestamp e mantendo a extensão original.
    // Ex: logo-1678888888.png ou produto-123456789.jpg
    const namePrefix = file.fieldname.includes('logo') ? 'logo' : 'produto';
    cb(null, `${namePrefix}-${Date.now()}${path.extname(file.originalname)}`);
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