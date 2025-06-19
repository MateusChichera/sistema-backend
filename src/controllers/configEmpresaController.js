const { pool } = require('../config/db');

// Obter configurações da empresa (acessível publicamente via slug)
const getConfigBySlug = async (req, res, next) => {
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId

  try {
    const [rows] = await pool.query(`SELECT
          e.id, e.nome_fantasia, e.razao_social, e.cnpj, e.slug, e.email_contato, e.telefone_contato,
          e.endereco, e.cidade, e.estado, e.cep, e.observacoes, e.status, e.valor_mensalidade,
          e.data_vencimento_mensalidade, e.data_cadastro, e.data_atualizacao,
          ce.logo_url, ce.horario_funcionamento, ce.numero_mesas, ce.taxa_entrega,
          ce.tempo_medio_preparo, ce.config_impressora
       FROM empresas e
       LEFT JOIN config_empresa ce ON e.id = ce.empresa_id
       WHERE e.id = ?`, [empresaId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Configurações da empresa não encontradas.' });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

// Atualizar configurações da empresa (Proprietário ou Gerente da empresa)
const updateConfig = async (req, res, next) => {
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId
  const { logo_url, horario_funcionamento, numero_mesas, taxa_entrega, tempo_medio_preparo, config_impressora } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE config_empresa SET
        logo_url = ?, horario_funcionamento = ?, numero_mesas = ?,
        taxa_entrega = ?, tempo_medio_preparo = ?, config_impressora = ?
       WHERE empresa_id = ?`,
      [logo_url, horario_funcionamento, numero_mesas, taxa_entrega, tempo_medio_preparo, config_impressora, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Configurações da empresa não encontradas ou nenhum dado alterado.' });
    }

    res.status(200).json({ message: 'Configurações da empresa atualizadas com sucesso!' });
  } catch (error) {
    next(error);
  }
};

// Nova função para upload de logo
const uploadLogo = async (req, res, next) => {
  const empresaId = req.empresa_id; // Vem do middleware extractEmpresaId

  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo de logo foi enviado.' });
  }

  // O caminho do arquivo será relativo à pasta 'public'
  // Ex: /uploads/logos/logo-1678888888.png
  const logoUrl = `/uploads/logos/${req.file.filename}`;

  try {
    const [result] = await pool.query(
      'UPDATE config_empresa SET logo_url = ? WHERE empresa_id = ?',
      [logoUrl, empresaId]
    );

    if (result.affectedRows === 0) {
      // Se a config_empresa não existir, podemos criá-la aqui
      // No entanto, já estamos criando no `createEmpresa`, então este caso é mais para erro
      return res.status(404).json({ message: 'Configurações da empresa não encontradas para atualizar o logo.' });
    }

    res.status(200).json({
      message: 'Logo da empresa atualizada com sucesso!',
      logo_url: logoUrl
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConfigBySlug,
  updateConfig,
  uploadLogo // Exporta a nova função
};