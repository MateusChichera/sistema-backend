const { pool } = require('../config/db');

// =====================================================
// CONTROLLER PARA COMPROVANTES DE RECEBIMENTO
// =====================================================

// Gerar comprovante de recebimento
const gerarComprovanteRecebimento = async (req, res, next) => {
  const { titulo_id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para gerar comprovantes.' });
  }

  const connection = await pool.getConnection();
  try {
    // 1. Buscar dados do título e pagamento
    const [tituloRows] = await connection.query(`
      SELECT 
        t.id,
        t.numero_titulo,
        t.descricao,
        t.valor_total,
        t.valor_pago,
        t.valor_restante,
        t.data_emissao,
        t.data_pagamento,
        t.status,
        c.nome AS cliente_nome,
        c.telefone AS cliente_telefone,
        c.email AS cliente_email,
        f.nome AS funcionario_nome,
        e.nome AS empresa_nome,
        e.endereco AS empresa_endereco,
        e.telefone AS empresa_telefone,
        e.cnpj AS empresa_cnpj
      FROM titulos t
      LEFT JOIN clientes_contas_prazo c ON t.cliente_contas_prazo_id = c.id
      LEFT JOIN funcionarios f ON t.funcionario_id = f.id
      LEFT JOIN empresas e ON t.empresa_id = e.id
      WHERE t.id = ? AND t.empresa_id = ?
    `, [titulo_id, empresaId]);

    if (tituloRows.length === 0) {
      return res.status(404).json({ message: 'Título não encontrado.' });
    }

    const titulo = tituloRows[0];

    // 2. Buscar último pagamento do título
    const [pagamentoRows] = await connection.query(`
      SELECT 
        tp.id,
        tp.valor_pago,
        tp.data_pagamento,
        tp.observacoes,
        fp.nome AS forma_pagamento_nome,
        f.nome AS funcionario_nome
      FROM titulo_pagamentos tp
      LEFT JOIN formas_pagamento fp ON tp.forma_pagamento_id = fp.id
      LEFT JOIN funcionarios f ON tp.funcionario_id = f.id
      WHERE tp.titulo_id = ?
      ORDER BY tp.data_pagamento DESC
      LIMIT 1
    `, [titulo_id]);

    const ultimoPagamento = pagamentoRows[0];

    // 3. Buscar todos os títulos em aberto do cliente
    const [titulosAbertosRows] = await connection.query(`
      SELECT 
        t.id,
        t.numero_titulo,
        t.descricao,
        t.valor_total,
        t.valor_pago,
        t.valor_restante,
        t.data_vencimento,
        t.status,
        DATEDIFF(CURDATE(), t.data_vencimento) AS dias_vencimento
      FROM titulos t
      WHERE t.cliente_contas_prazo_id = ? 
      AND t.empresa_id = ?
      AND t.status = 'Pendente'
      AND t.valor_restante > 0
      ORDER BY t.data_vencimento ASC
    `, [titulo.cliente_contas_prazo_id, empresaId]);

    // 4. Calcular saldo total em aberto
    const saldoTotalAberto = titulosAbertosRows.reduce((total, t) => total + parseFloat(t.valor_restante), 0);

    // 5. Montar dados do comprovante
    const comprovante = {
      empresa: {
        nome: titulo.empresa_nome,
        endereco: titulo.empresa_endereco,
        telefone: titulo.empresa_telefone,
        cnpj: titulo.empresa_cnpj
      },
      cliente: {
        nome: titulo.cliente_nome,
        telefone: titulo.cliente_telefone,
        email: titulo.cliente_email
      },
      titulo: {
        id: titulo.id,
        numero: titulo.numero_titulo,
        descricao: titulo.descricao,
        valor_total: parseFloat(titulo.valor_total),
        valor_pago: parseFloat(titulo.valor_pago),
        valor_restante: parseFloat(titulo.valor_restante),
        data_emissao: titulo.data_emissao,
        data_pagamento: titulo.data_pagamento,
        status: titulo.status
      },
      pagamento: ultimoPagamento ? {
        valor: parseFloat(ultimoPagamento.valor_pago),
        data: ultimoPagamento.data_pagamento,
        forma_pagamento: ultimoPagamento.forma_pagamento_nome,
        funcionario: ultimoPagamento.funcionario_nome,
        observacoes: ultimoPagamento.observacoes
      } : null,
      saldo_cliente: {
        total_aberto: saldoTotalAberto,
        titulos_abertos: titulosAbertosRows.map(t => ({
          numero: t.numero_titulo,
          descricao: t.descricao,
          valor_restante: parseFloat(t.valor_restante),
          data_vencimento: t.data_vencimento,
          dias_vencimento: t.dias_vencimento
        }))
      },
      comprovante: {
        data_emissao: new Date().toISOString(),
        funcionario: requestingUser.nome,
        numero_comprovante: `COMP-${Date.now()}`
      }
    };

    res.json({
      success: true,
      data: comprovante,
      message: 'Comprovante gerado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao gerar comprovante:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor ao gerar comprovante' 
    });
  } finally {
    connection.release();
  }
};

// Listar títulos em aberto de um cliente
const listarTitulosAbertosCliente = async (req, res, next) => {
  const { cliente_id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar títulos.' });
  }

  const connection = await pool.getConnection();
  try {
    // Buscar títulos em aberto do cliente
    const [titulosRows] = await connection.query(`
      SELECT 
        t.id,
        t.numero_titulo,
        t.descricao,
        t.valor_total,
        t.valor_pago,
        t.valor_restante,
        t.data_emissao,
        t.data_vencimento,
        t.status,
        DATEDIFF(CURDATE(), t.data_vencimento) AS dias_vencimento,
        CASE 
          WHEN t.data_vencimento < CURDATE() THEN 'Vencido'
          WHEN t.data_vencimento = CURDATE() THEN 'Vence hoje'
          ELSE 'Em dia'
        END AS situacao_vencimento
      FROM titulos t
      WHERE t.cliente_contas_prazo_id = ? 
      AND t.empresa_id = ?
      AND t.status = 'Pendente'
      AND t.valor_restante > 0
      ORDER BY t.data_vencimento ASC
    `, [cliente_id, empresaId]);

    // Calcular saldo total
    const saldoTotal = titulosRows.reduce((total, t) => total + parseFloat(t.valor_restante), 0);

    res.json({
      success: true,
      data: {
        cliente_id: parseInt(cliente_id),
        saldo_total: saldoTotal,
        titulos: titulosRows.map(t => ({
          id: t.id,
          numero: t.numero_titulo,
          descricao: t.descricao,
          valor_total: parseFloat(t.valor_total),
          valor_pago: parseFloat(t.valor_pago),
          valor_restante: parseFloat(t.valor_restante),
          data_emissao: t.data_emissao,
          data_vencimento: t.data_vencimento,
          dias_vencimento: t.dias_vencimento,
          situacao_vencimento: t.situacao_vencimento
        }))
      }
    });

  } catch (error) {
    console.error('Erro ao listar títulos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor ao listar títulos' 
    });
  } finally {
    connection.release();
  }
};

// Gerar template de comprovante para impressão
const gerarTemplateComprovante = async (req, res, next) => {
  const { titulo_id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para gerar comprovantes.' });
  }

  const connection = await pool.getConnection();
  try {
    // Buscar dados do comprovante (mesma query do gerarComprovanteRecebimento)
    const [tituloRows] = await connection.query(`
      SELECT 
        t.id,
        t.numero_titulo,
        t.descricao,
        t.valor_total,
        t.valor_pago,
        t.valor_restante,
        t.data_emissao,
        t.data_pagamento,
        t.status,
        c.nome AS cliente_nome,
        c.telefone AS cliente_telefone,
        f.nome AS funcionario_nome,
        e.nome AS empresa_nome,
        e.endereco AS empresa_endereco,
        e.telefone AS empresa_telefone,
        e.cnpj AS empresa_cnpj
      FROM titulos t
      LEFT JOIN clientes_contas_prazo c ON t.cliente_contas_prazo_id = c.id
      LEFT JOIN funcionarios f ON t.funcionario_id = f.id
      LEFT JOIN empresas e ON t.empresa_id = e.id
      WHERE t.id = ? AND t.empresa_id = ?
    `, [titulo_id, empresaId]);

    if (tituloRows.length === 0) {
      return res.status(404).json({ message: 'Título não encontrado.' });
    }

    const titulo = tituloRows[0];

    // Buscar último pagamento
    const [pagamentoRows] = await connection.query(`
      SELECT 
        tp.valor_pago,
        tp.data_pagamento,
        fp.nome AS forma_pagamento_nome
      FROM titulo_pagamentos tp
      LEFT JOIN formas_pagamento fp ON tp.forma_pagamento_id = fp.id
      WHERE tp.titulo_id = ?
      ORDER BY tp.data_pagamento DESC
      LIMIT 1
    `, [titulo_id]);

    const ultimoPagamento = pagamentoRows[0];

    // Gerar template para impressora 80mm
    const template = `
═══════════════════════════════════════════════════════════════════════════════
                           COMPROVANTE DE RECEBIMENTO
═══════════════════════════════════════════════════════════════════════════════

EMPRESA: ${titulo.empresa_nome}
${titulo.empresa_endereco}
Tel: ${titulo.empresa_telefone}
CNPJ: ${titulo.empresa_cnpj}

───────────────────────────────────────────────────────────────────────────────

CLIENTE: ${titulo.cliente_nome}
Tel: ${titulo.cliente_telefone}

───────────────────────────────────────────────────────────────────────────────

TÍTULO: ${titulo.numero_titulo}
Descrição: ${titulo.descricao}
Valor Total: R$ ${parseFloat(titulo.valor_total).toFixed(2)}
Valor Pago: R$ ${parseFloat(titulo.valor_pago).toFixed(2)}
Valor Restante: R$ ${parseFloat(titulo.valor_restante).toFixed(2)}

${ultimoPagamento ? `
ÚLTIMO PAGAMENTO:
Valor: R$ ${parseFloat(ultimoPagamento.valor_pago).toFixed(2)}
Data: ${new Date(ultimoPagamento.data_pagamento).toLocaleDateString('pt-BR')}
Forma: ${ultimoPagamento.forma_pagamento_nome}
` : ''}

───────────────────────────────────────────────────────────────────────────────

Data do Comprovante: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}
Funcionário: ${requestingUser.nome}

═══════════════════════════════════════════════════════════════════════════════
                           OBRIGADO PELA PREFERÊNCIA!
═══════════════════════════════════════════════════════════════════════════════
    `.trim();

    res.json({
      success: true,
      data: {
        template: template,
        titulo_id: titulo.id,
        numero_titulo: titulo.numero_titulo,
        cliente_nome: titulo.cliente_nome,
        valor_pago: ultimoPagamento ? parseFloat(ultimoPagamento.valor_pago) : 0,
        data_pagamento: ultimoPagamento ? ultimoPagamento.data_pagamento : null
      }
    });

  } catch (error) {
    console.error('Erro ao gerar template:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor ao gerar template' 
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  gerarComprovanteRecebimento,
  listarTitulosAbertosCliente,
  gerarTemplateComprovante
};
