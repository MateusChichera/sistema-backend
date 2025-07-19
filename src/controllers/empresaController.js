const { pool } = require('../config/db');
const { hashPassword } = require('../utils/authUtils');
const slugify = require('slugify'); // Necessário instalar: npm install slugify

// --- Funções Auxiliares para o Controller ---

// Função para gerar um slug único
const generateUniqueSlug = async (nomeFantasia) => {
  let baseSlug = slugify(nomeFantasia, { lower: true, strict: true });
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const [rows] = await pool.query('SELECT id FROM empresas WHERE slug = ?', [slug]);
    if (rows.length === 0) {
      return slug;
    }
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

// --- Métodos CRUD para Empresas ---

// 1. Criar uma nova empresa
const createEmpresa = async (req, res, next) => {
  const {
    nome_fantasia,
    razao_social,
    cnpj,
    email_contato,
    telefone_contato,
    endereco,
    cidade,
    estado,
    cep,
    valor_mensalidade,
    segmento, // <-- Adicionado
    // Proprietario inicial:
    proprietario_nome,
    proprietario_email,
    proprietario_senha
  } = req.body;

  if (!nome_fantasia || !razao_social || !cnpj || !email_contato || !proprietario_email || !proprietario_senha) {
    return res.status(400).json({ message: 'Dados essenciais da empresa e do proprietário são obrigatórios.' });
  }

  const connection = await pool.getConnection(); // Obtém uma conexão
  try {
    await connection.beginTransaction(); // Inicia uma transação

    // 1. Gerar slug único
    const slug = await generateUniqueSlug(nome_fantasia);

    // 2. Inserir a nova empresa
    const [empresaResult] = await connection.query(
      `INSERT INTO empresas (
        nome_fantasia, razao_social, cnpj, slug, email_contato, telefone_contato,
        endereco, cidade, estado, cep, valor_mensalidade, status, data_vencimento_mensalidade, segmento
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE() + INTERVAL 30 DAY, ?)`,
      [
        nome_fantasia, razao_social, cnpj, slug, email_contato, telefone_contato,
        endereco, cidade, estado, cep, valor_mensalidade || 99.90, 'Ativa', segmento || 'Restaurante'
      ]
    );

    const empresaId = empresaResult.insertId;

    // 3. Hash da senha do proprietário
    const hashedPassword = await hashPassword(proprietario_senha);

    // 4. Inserir o proprietário inicial como funcionário da empresa
    await connection.query(
      `INSERT INTO funcionarios (empresa_id, nome, email, senha_hash, role)
       VALUES (?, ?, ?, ?, 'Proprietario')`,
      [empresaId, proprietario_nome || nome_fantasia + ' Proprietário', proprietario_email, hashedPassword]
    );

    // 5. Criar uma entrada de configuração padrão para a nova empresa
    await connection.query(
      `INSERT INTO config_empresa (empresa_id) VALUES (?)`,
      [empresaId]
    );

    await connection.commit(); // Confirma a transação

    res.status(201).json({
      message: 'Empresa e proprietário inicial cadastrados com sucesso!',
      empresa: {
        id: empresaId,
        nome_fantasia,
        slug,
        email_contato,
        segmento: segmento || 'Restaurante'
      }
    });

  } catch (error) {
    await connection.rollback(); // Desfaz a transação em caso de erro
    // Erro de CNPJ ou email de funcionário duplicado
    if (error.code === 'ER_DUP_ENTRY') {
      let message = 'Erro de duplicidade.';
      if (error.message.includes('cnpj')) {
        message = 'CNPJ já cadastrado.';
      } else if (error.message.includes('unique_email_empresa')) {
        message = 'E-mail do proprietário já está em uso por esta empresa.';
      }
      return res.status(409).json({ message }); // 409 Conflict
    }
    next(error); // Passa outros erros para o middleware de erro
  } finally {
    connection.release(); // Sempre libera a conexão
  }
};

// 2. Listar todas as empresas (Apenas para Admin Geral)
const getAllEmpresas = async (req, res, next) => {
  try {
    const [empresas] = await pool.query('SELECT id, nome_fantasia, cnpj, slug, status, valor_mensalidade, data_cadastro, segmento FROM empresas ORDER BY nome_fantasia');
    res.status(200).json(empresas);
  } catch (error) {
    next(error);
  }
};

// 3. Obter detalhes de uma empresa por ID (Apenas para Admin Geral)
const getEmpresaById = async (req, res, next) => {
  const { id } = req.params; // Pega o ID da URL

  try {
    const [rows] = await pool.query('SELECT * FROM empresas WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Empresa não encontrada.' });
    }

    res.status(200).json(rows[0]); // Retorna os detalhes da empresa
  } catch (error) {
    next(error);
  }
};

// 4. Atualizar uma empresa por ID (Apenas para Admin Geral)
const updateEmpresa = async (req, res, next) => {
  const { id } = req.params;
  const {
    nome_fantasia,
    razao_social,
    cnpj,
    email_contato,
    telefone_contato,
    endereco,
    cidade,
    estado,
    cep,
    status,
    valor_mensalidade,
    data_vencimento_mensalidade,
    segmento // <-- Adicionado
  } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE empresas SET
        nome_fantasia = ?, razao_social = ?, cnpj = ?, email_contato = ?,
        telefone_contato = ?, endereco = ?, cidade = ?, estado = ?, cep = ?,
        status = ?, valor_mensalidade = ?, data_vencimento_mensalidade = ?,
        segmento = ?
       WHERE id = ?`,
      [
        nome_fantasia, razao_social, cnpj, email_contato,
        telefone_contato, endereco, cidade, estado, cep,
        status, valor_mensalidade, data_vencimento_mensalidade,
        segmento, id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Empresa não encontrada ou nenhum dado alterado.' });
    }

    res.status(200).json({ message: 'Empresa atualizada com sucesso!' });
  } catch (error) {
    // Erro de CNPJ duplicado
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('cnpj')) {
      return res.status(409).json({ message: 'CNPJ já cadastrado para outra empresa.' });
    }
    next(error);
  }
};

// 5. Excluir uma empresa por ID (Apenas para Admin Geral)
const deleteEmpresa = async (req, res, next) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query('DELETE FROM empresas WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Empresa não encontrada.' });
    }

    res.status(200).json({ message: 'Empresa excluída com sucesso!' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createEmpresa,
  getAllEmpresas,
  getEmpresaById,
  updateEmpresa,
  deleteEmpresa
};