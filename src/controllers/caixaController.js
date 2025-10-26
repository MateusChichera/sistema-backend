const { pool } = require('../config/db');

// Abrir um novo caixa
const openCaixa = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUser = req.user;
  const { valor_abertura } = req.body;

  // Somente Proprietario, Gerente ou Caixa podem abrir
  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para abrir o caixa.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verifica se já existe um caixa aberto para esta empresa
    const [openRows] = await connection.query(
      `SELECT id FROM caixas WHERE empresas_id = ? AND status = 'Aberto' LIMIT 1`,
      [empresaId]
    );
    if (openRows.length > 0) {
      await connection.rollback();
      return res.status(409).json({ message: 'Já existe um caixa aberto para esta empresa.', caixa_id: openRows[0].id });
    }

    // 2. Busca valor inicial padrão da config se não enviado
    let valorAberturaFinal = parseFloat(valor_abertura);
    if (isNaN(valorAberturaFinal)) {
      const [[configRow]] = await connection.query(
        `SELECT valor_inicial_caixa_padrao FROM config_empresa WHERE empresa_id = ?`,
        [empresaId]
      );
      valorAberturaFinal = parseFloat(configRow?.valor_inicial_caixa_padrao) || 0.0;
    }

    // 3. Determina o número sequencial do caixa do dia
    const [[lastCaixa]] = await connection.query(
      `SELECT MAX(numero_caixa_dia) AS last_num FROM caixas WHERE empresas_id = ? AND DATE(data_abertura) = CURDATE()`,
      [empresaId]
    );
    const numeroCaixaDia = (lastCaixa?.last_num || 0) + 1;

    // 4. Insere o novo caixa
    const [insertResult] = await connection.query(
      `INSERT INTO caixas (empresas_id, funcionario_id_abertura, valor_abertura, numero_caixa_dia) VALUES (?,?,?,?)`,
      [empresaId, requestingUser.id, valorAberturaFinal, numeroCaixaDia]
    );

    await connection.commit();

    return res.status(201).json({
      message: 'Caixa aberto com sucesso.',
      caixa_id: insertResult.insertId,
      numero_caixa_dia: numeroCaixaDia,
      valor_abertura: valorAberturaFinal
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

// Obter detalhes consolidados para fechamento (via VIEW)
const getFechamentoDetalhes = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const caixaId = req.params.id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  try {
    // Verifica se o caixa pertence à empresa
    const [[caixaRow]] = await pool.query(
      `SELECT id FROM caixas WHERE id = ? AND empresas_id = ?`,
      [caixaId, empresaId]
    );
    if (!caixaRow) {
      return res.status(404).json({ message: 'Caixa não encontrado para esta empresa.' });
    }

    const [detalhes] = await pool.query(
      `SELECT * FROM view_fechamento_caixa_dinheiro WHERE caixa_id = ?`,
      [caixaId]
    );

    // --- Totalizadores por forma de pagamento ---
    const [totaisForma] = await pool.query(
      `SELECT
          fp.id AS forma_pagamento_id,
          fp.descricao AS forma_pagamento_descricao,
          COALESCE(p_agg.total_pagamentos_sistema, 0) AS total_pagamentos_sistema,
          COALESCE(m_agg.total_suprimentos, 0) AS total_suprimentos,
          COALESCE(m_agg.total_sangrias, 0) AS total_sangrias,
          (
              COALESCE(p_agg.total_pagamentos_sistema, 0) +
              COALESCE(m_agg.total_suprimentos, 0) -
              COALESCE(m_agg.total_sangrias, 0)
          ) AS valor_sistema_calculado_por_forma
       FROM formas_pagamento fp
       LEFT JOIN (
           SELECT p.id_forma_pagamento, SUM(p.valor_pago) AS total_pagamentos_sistema
           FROM pagamentos p
           JOIN pedidos ped ON p.id_pedido = ped.id
           JOIN caixas c_p ON p.empresa_id = c_p.empresas_id
                          AND p.data_pagamento >= c_p.data_abertura
                          AND (p.data_pagamento < c_p.data_fechamento OR c_p.status = 'Aberto')
           WHERE c_p.id = ? AND c_p.empresas_id = ?
                 AND ped.status IN ('Entregue', 'Pronto', 'Finalizado')
           GROUP BY p.id_forma_pagamento
       ) AS p_agg ON fp.id = p_agg.id_forma_pagamento
       LEFT JOIN (
           SELECT cm.id_forma_pagamento,
                  SUM(CASE WHEN cm.tipo_movimentacao = 'Suprimento' THEN cm.valor ELSE 0 END) AS total_suprimentos,
                  SUM(CASE WHEN cm.tipo_movimentacao = 'Sangria' THEN cm.valor ELSE 0 END) AS total_sangrias
           FROM caixa_movimentacoes cm
           JOIN caixas c_m ON cm.caixa_id = c_m.id
                          AND cm.empresas_id = c_m.empresas_id
                          AND cm.data_movimentacao >= c_m.data_abertura
                          AND (cm.data_movimentacao < c_m.data_fechamento OR c_m.status = 'Aberto')
           WHERE c_m.id = ? AND c_m.empresas_id = ?
           GROUP BY cm.id_forma_pagamento
       ) AS m_agg ON fp.id = m_agg.id_forma_pagamento
       WHERE fp.empresa_id = ?
       GROUP BY fp.id, fp.descricao
       ORDER BY fp.descricao`,
      [caixaId, empresaId, caixaId, empresaId, empresaId]
    );

    return res.status(200).json({
      resumo_caixa: detalhes[0] || null,
      totalizadores_formas_pagamento: totaisForma
    });
  } catch (error) {
    next(error);
  }
};

// Novo: Fechamento completo via VIEW (um caixa específico)
const getFechamentoCompleto = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const caixaId = req.params.id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM view_fechamento_caixa_completo WHERE caixa_id = ? AND empresas_id = ?`,
      [caixaId, empresaId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Dados de fechamento não encontrados para este caixa.' });
    }

    return res.status(200).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

// Novo: Listar fechamentos completos de todos os caixas de uma empresa (pode filtrar por período)
const listFechamentosCompletos = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUser = req.user;
  const { data_inicio, data_fim, status } = req.query;

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  let query = `SELECT * FROM view_fechamento_caixa_completo WHERE empresas_id = ?`;
  const params = [empresaId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (data_inicio) {
    query += ' AND DATE(data_abertura) >= ?';
    params.push(data_inicio);
  }
  if (data_fim) {
    query += ' AND DATE(data_abertura) <= ?';
    params.push(data_fim);
  }

  query += ' ORDER BY data_abertura DESC, numero_caixa_dia DESC';

  try {
    const [rows] = await pool.query(query, params);
    return res.status(200).json(rows);
  } catch (error) {
    next(error);
  }
};

// Fechar caixa
const closeCaixa = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const caixaId = req.params.id;
  const requestingUser = req.user;
  const { valor_fechamento_informado, observacoes_fechamento } = req.body;

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Valida se o caixa está aberto
    const [[caixaRow]] = await connection.query(
      `SELECT status FROM caixas WHERE id = ? AND empresas_id = ? FOR UPDATE`,
      [caixaId, empresaId]
    );
    if (!caixaRow) {
      await connection.rollback();
      return res.status(404).json({ message: 'Caixa não encontrado para esta empresa.' });
    }
    if (caixaRow.status !== 'Aberto') {
      await connection.rollback();
      return res.status(400).json({ message: 'Caixa já está fechado.' });
    }

    // 2. Calcula valor do sistema via VIEW
    const [[sistemaRow]] = await connection.query(
      `SELECT valor_fechamento_sistema_calculado AS valor_sistema FROM view_fechamento_caixa_dinheiro WHERE caixa_id = ?`,
      [caixaId]
    );
    const valorSistema = parseFloat(sistemaRow?.valor_sistema) || 0.0;

    const valorInformado = parseFloat(valor_fechamento_informado) || 0.0;
    const diferenca = valorInformado - valorSistema;


    // 3. Atualiza o caixa
    await connection.query(
      `UPDATE caixas 
       SET data_fechamento = NOW(), funcionario_id_fechamento = ?, valor_fechamento_sistema = ?, valor_fechamento_informado = ?, diferenca = ?, observacoes_fechamento = ?, status = 'Fechado'
       WHERE id = ?`,
      [requestingUser.id, valorSistema, valorInformado, diferenca, observacoes_fechamento || null, caixaId]
    );

    await connection.commit();

    return res.status(200).json({
      message: 'Caixa fechado com sucesso.',
      caixa_id: caixaId,
      valor_sistema: valorSistema,
      valor_informado: valorInformado,
      diferenca
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

// Registrar suprimento/sangria
const addMovimentacao = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const caixaId = req.params.id;
  const requestingUser = req.user;

  // Tipo pode vir definido pelo pré-middleware da rota ou no corpo da requisição
  let { tipo_movimentacao, valor, id_forma_pagamento, observacoes } = req.body;
  if (!tipo_movimentacao && req.tipoMovimentacao) {
    tipo_movimentacao = req.tipoMovimentacao;
  }

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  if (!['Suprimento', 'Sangria'].includes(tipo_movimentacao)) {
    return res.status(400).json({ message: 'Tipo de movimentação inválido.' });
  }

  const valorNum = parseFloat(valor);
  if (isNaN(valorNum) || valorNum <= 0) {
    return res.status(400).json({ message: 'Valor deve ser numérico positivo.' });
  }

  try {
    // Verifica status do caixa
    const [[caixaRow]] = await pool.query(
      `SELECT status FROM caixas WHERE id = ? AND empresas_id = ?`,
      [caixaId, empresaId]
    );
    if (!caixaRow) {
      return res.status(404).json({ message: 'Caixa não encontrado para esta empresa.' });
    }
    if (caixaRow.status !== 'Aberto') {
      return res.status(400).json({ message: 'Não é possível registrar movimentações em um caixa fechado.' });
    }

    const [insertResult] = await pool.query(
      `INSERT INTO caixa_movimentacoes (caixa_id, empresas_id, funcionario_id, tipo_movimentacao, valor, id_forma_pagamento, observacoes)
       VALUES (?,?,?,?,?,?,?)`,
      [caixaId, empresaId, requestingUser.id, tipo_movimentacao, valorNum, id_forma_pagamento, observacoes || null]
    );

    return res.status(201).json({
      message: 'Movimentação registrada com sucesso.',
      movimentacao_id: insertResult.insertId
    });
  } catch (error) {
    next(error);
  }
};

// Listar movimentações de um caixa
const listMovimentacoes = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const caixaId = req.params.id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT cm.id, cm.tipo_movimentacao, cm.valor, cm.id_forma_pagamento, fp.descricao AS forma_pagamento_descricao,
              cm.observacoes, cm.data_movimentacao, f.nome AS nome_funcionario
       FROM caixa_movimentacoes cm
       JOIN formas_pagamento fp ON cm.id_forma_pagamento = fp.id
       JOIN funcionarios f ON cm.funcionario_id = f.id
       WHERE cm.caixa_id = ? AND cm.empresas_id = ?
       ORDER BY cm.data_movimentacao DESC`,
      [caixaId, empresaId]
    );

    return res.status(200).json(rows);
  } catch (error) {
    next(error);
  }
};

// Verificar se há caixa aberto
const getCaixaAberto = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente', 'Caixa', 'Funcionario'].includes(requestingUser.role)) {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, numero_caixa_dia, valor_abertura, data_abertura
       FROM caixas WHERE empresas_id = ? AND status = 'Aberto' LIMIT 1`,
      [empresaId]
    );

    if (rows.length === 0) {
      return res.status(200).json({ aberto: false });
    }

    return res.status(200).json({ aberto: true, caixa: rows[0] });
  } catch (error) {
    next(error);
  }
};

// Faturamento por forma de pagamento (VIEW)
const getFaturamentoPorFormaPagamento = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const caixaId = req.params.id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         fp.id AS forma_pagamento_id,
         fp.descricao AS forma_pagamento_descricao,
         COALESCE(SUM(p.valor_pago),0) AS total_faturamento_por_forma
       FROM formas_pagamento fp
       LEFT JOIN pagamentos p ON p.id_forma_pagamento = fp.id
       LEFT JOIN pedidos ped ON p.id_pedido = ped.id
       JOIN caixas c ON p.empresa_id = c.empresas_id
                     AND p.data_pagamento >= c.data_abertura
                     AND (p.data_pagamento < c.data_fechamento OR c.status = 'Aberto')
       WHERE c.id = ? AND c.empresas_id = ?
         AND ped.status IN ('Entregue','Pronto','Finalizado')
         AND fp.empresa_id = ?
       GROUP BY fp.id, fp.descricao
       ORDER BY fp.descricao`,
      [caixaId, empresaId, empresaId]
    );

    const totalGeral = rows.reduce((acc, r) => acc + parseFloat(r.total_faturamento_por_forma || 0), 0);

    return res.status(200).json({
      total_faturamento: totalGeral,
      detalhado_por_forma: rows
    });
  } catch (error) {
    next(error);
  }
};

// Listar movimentações de contas a prazo de um caixa
const getMovimentacoesContasPrazo = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const caixaId = req.params.id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  try {
    // Verificar se o caixa pertence à empresa
    const [[caixaRow]] = await pool.query(
      `SELECT id FROM caixas WHERE id = ? AND empresas_id = ?`,
      [caixaId, empresaId]
    );
    if (!caixaRow) {
      return res.status(404).json({ message: 'Caixa não encontrado para esta empresa.' });
    }

    const [movimentacoes] = await pool.query(
      `SELECT 
        cm.id, cm.tipo_movimentacao, cm.valor, cm.data_movimentacao, cm.observacoes,
        fp.descricao AS forma_pagamento_descricao,
        f.nome AS funcionario_nome,
        tp.titulo_id,
        t.numero_titulo,
        c.nome AS cliente_nome
       FROM caixa_movimentacoes cm
       LEFT JOIN formas_pagamento fp ON cm.id_forma_pagamento = fp.id
       LEFT JOIN funcionarios f ON cm.funcionario_id = f.id
       LEFT JOIN titulo_pagamentos tp ON cm.observacoes LIKE CONCAT('%Título #', t.numero_titulo, '%')
       LEFT JOIN titulos t ON tp.titulo_id = t.id
       LEFT JOIN clientes_contas_prazo c ON t.cliente_contas_prazo_id = c.id
       WHERE cm.caixa_id = ? AND cm.empresas_id = ?
       AND cm.observacoes LIKE '%conta a prazo%'
       ORDER BY cm.data_movimentacao DESC`,
      [caixaId, empresaId]
    );

    return res.status(200).json(movimentacoes);
  } catch (error) {
    next(error);
  }
};

// Exportações atualizadas
module.exports = {
  openCaixa,
  getFechamentoDetalhes,
  getFechamentoCompleto,
  closeCaixa,
  addMovimentacao,
  listMovimentacoes,
  getCaixaAberto,
  getFaturamentoPorFormaPagamento,
  listFechamentosCompletos,
  getMovimentacoesContasPrazo
}; 