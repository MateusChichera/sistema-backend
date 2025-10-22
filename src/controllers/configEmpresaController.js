// backend/src/controllers/configEmpresaController.js
const { pool } = require('../config/db');

// Obter configurações da empresa (acessível publicamente via slug)
const getConfigBySlug = async (req, res, next) => {
  const empresaId = req.empresa_id;

  try {
    const [rows] = await pool.query(
      `SELECT
          e.id, e.nome_fantasia, e.razao_social, e.cnpj, e.slug, e.email_contato, e.telefone_contato,
          e.endereco, e.cidade, e.estado, e.cep, e.observacoes, e.status, e.valor_mensalidade,
          e.data_vencimento_mensalidade, e.data_cadastro, e.data_atualizacao,
          e.segmento,
          ce.logo_url, ce.horario_funcionamento, ce.numero_mesas, ce.taxa_entrega,
          ce.tempo_medio_preparo, ce.config_impressora,
          ce.permitir_pedido_online, ce.pedido_minimo_delivery, ce.desativar_entrega,
          ce.desativar_retirada, ce.tempo_corte_pedido_online, ce.mensagem_confirmacao_pedido,
          ce.auto_aprovar_pedidos, ce.cor_primaria_cardapio, ce.mostrar_promocoes_na_home,
          ce.layout_cardapio, ce.alerta_estoque_baixo_ativo, ce.limite_estoque_baixo,
          ce.enviar_email_confirmacao, ce.som_notificacao_cozinha, ce.som_notificacao_delivery,
          ce.valor_inicial_caixa_padrao, ce.exibir_valores_fechamento_caixa, ce.usa_controle_caixa,ce.porcentagem_garcom,ce.permitir_acompanhar_status,
          ce.permitir_pedidos_estoque_zerado, ce.nao_mostrar_cardapio_estoque_zerado
       FROM empresas e
       LEFT JOIN config_empresa ce ON e.id = ce.empresa_id
       WHERE e.id = ?`,
      [empresaId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Configurações da empresa não encontradas.' });
    }

    // Buscar categorias ordenadas para incluir na resposta
    const [categorias] = await pool.query(
      'SELECT id, descricao, ativo, ordem FROM categorias WHERE empresa_id = ? AND ativo = TRUE ORDER BY ordem ASC, descricao ASC',
      [empresaId]
    );

    const config = rows[0];
    config.categorias = categorias;

    res.status(200).json(config);
  } catch (error) {
    next(error);
  }
};

// Atualizar configurações da empresa (Proprietário ou Gerente da empresa)
const updateConfig = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const { 
    horario_funcionamento, numero_mesas, taxa_entrega, tempo_medio_preparo, config_impressora,
    permitir_pedido_online, pedido_minimo_delivery, desativar_entrega,
    desativar_retirada, tempo_corte_pedido_online, mensagem_confirmacao_pedido,
    auto_aprovar_pedidos, cor_primaria_cardapio, mostrar_promocoes_na_home,
    layout_cardapio, alerta_estoque_baixo_ativo, limite_estoque_baixo,
    enviar_email_confirmacao, som_notificacao_cozinha, som_notificacao_delivery,
    valor_inicial_caixa_padrao, exibir_valores_fechamento_caixa, usa_controle_caixa,porcentagem_garcom,permitir_acompanhar_status,
    permitir_pedidos_estoque_zerado, nao_mostrar_cardapio_estoque_zerado
  } = req.body;
  const requestingUserRole = req.user.role;

  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para atualizar configurações.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE config_empresa SET
        horario_funcionamento = ?, numero_mesas = ?, taxa_entrega = ?,
        tempo_medio_preparo = ?, config_impressora = ?,
        permitir_pedido_online = ?, pedido_minimo_delivery = ?, desativar_entrega = ?,
        desativar_retirada = ?, tempo_corte_pedido_online = ?, mensagem_confirmacao_pedido = ?,
        auto_aprovar_pedidos = ?, cor_primaria_cardapio = ?, mostrar_promocoes_na_home = ?,
        layout_cardapio = ?, alerta_estoque_baixo_ativo = ?, limite_estoque_baixo = ?,
        enviar_email_confirmacao = ?, som_notificacao_cozinha = ?, som_notificacao_delivery = ?,
        valor_inicial_caixa_padrao = ?, exibir_valores_fechamento_caixa = ?, usa_controle_caixa = ?,porcentagem_garcom = ?,permitir_acompanhar_status = ?,
        permitir_pedidos_estoque_zerado = ?, nao_mostrar_cardapio_estoque_zerado = ?
       WHERE empresa_id = ?`,
      [
        horario_funcionamento, parseInt(numero_mesas) || 0, parseFloat(taxa_entrega) || 0.00, // <--- GARANTE FLOAT AQUI
        tempo_medio_preparo, config_impressora,
        permitir_pedido_online, parseFloat(pedido_minimo_delivery) || 0.00, desativar_entrega,
        desativar_retirada, tempo_corte_pedido_online, mensagem_confirmacao_pedido,
        auto_aprovar_pedidos, cor_primaria_cardapio, mostrar_promocoes_na_home,
        layout_cardapio, alerta_estoque_baixo_ativo, parseInt(limite_estoque_baixo) || 0,
        enviar_email_confirmacao, som_notificacao_cozinha, som_notificacao_delivery,
        parseFloat(valor_inicial_caixa_padrao) || 0.00, exibir_valores_fechamento_caixa, usa_controle_caixa,porcentagem_garcom,
        permitir_acompanhar_status,
        permitir_pedidos_estoque_zerado, nao_mostrar_cardapio_estoque_zerado,
        empresaId
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Configurações da empresa não encontradas ou nenhum dado alterado.' });
    }

    res.status(200).json({ message: 'Configurações da empresa atualizadas com sucesso!' });
  } catch (error) {
    next(error);
  }
};

const uploadLogo = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo de logo foi enviado.' });
  }

  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário ou Gerente pode fazer upload de logo.' });
  }

  const logoUrl = `/uploads/logos/${req.file.filename}`;

  try {
    const [result] = await pool.query(
      'UPDATE config_empresa SET logo_url = ? WHERE empresa_id = ?',
      [logoUrl, empresaId]
    );

    if (result.affectedRows === 0) {
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
  uploadLogo
};