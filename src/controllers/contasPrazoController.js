const { pool } = require('../config/db');
const { registrarRecebimentoTitulo } = require('../utils/caixaUtils');

// Função auxiliar para gerar número único de título
const gerarNumeroTituloUnico = async (connection, empresaId) => {
  try {
    // Buscar todos os números existentes para esta empresa
    const [titulosExistentes] = await connection.query(
      `SELECT numero_titulo
       FROM titulos 
       WHERE empresa_id = ? AND numero_titulo REGEXP '^[0-9]+$'
       ORDER BY CAST(numero_titulo AS UNSIGNED) DESC`,
      [empresaId]
    );
    
    // Encontrar o maior número
    let maxNumero = 0;
    titulosExistentes.forEach(titulo => {
      const numero = parseInt(titulo.numero_titulo, 10);
      if (!isNaN(numero) && numero > maxNumero) {
        maxNumero = numero;
      }
    });
    
    const proximoNumero = maxNumero + 1;
    const numeroTitulo = proximoNumero.toString();
    
    console.log(`Gerando título: ${numeroTitulo} (próximo após ${maxNumero})`);
    
    return numeroTitulo;
    
  } catch (error) {
    console.error('Erro ao gerar número do título:', error);
    // Fallback: usar timestamp se houver erro
    return Date.now().toString().slice(-6);
  }
};

// =====================================================
// CONTROLLER PARA CONTAS A PRAZO
// =====================================================

// 1. Criar um novo título (conta a prazo)
const createTitulo = async (req, res, next) => {
  const {
    cliente_id,
    pedido_id,
    descricao,
    valor_total,
    data_vencimento,
    observacoes,
    itens
  } = req.body;

  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!cliente_id || !descricao || !valor_total || !data_vencimento) {
    return res.status(400).json({ 
      message: 'Cliente, descrição, valor total e data de vencimento são obrigatórios.' 
    });
  }

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas Proprietário, Gerente ou Caixa podem criar títulos.' 
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verificar se o cliente pertence à empresa
    const [clienteRows] = await connection.query(
      'SELECT id, nome FROM clientes_contas_prazo WHERE id = ? AND empresa_id = ?',
      [cliente_id, empresaId]
    );
    if (clienteRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Cliente não encontrado para esta empresa.' });
    }

    // 2. Gerar número único do título
    const numeroTitulo = await gerarNumeroTituloUnico(connection, empresaId);

    // 3. Inserir o título
    const [tituloResult] = await connection.query(
      `INSERT INTO titulos (
        empresa_id, cliente_id, pedido_id, numero_titulo, descricao, 
        valor_total, valor_restante, data_vencimento, observacoes, funcionario_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId, cliente_id, pedido_id || null, numeroTitulo, descricao,
        parseFloat(valor_total), parseFloat(valor_total), data_vencimento, 
        observacoes || null, requestingUser.id
      ]
    );

    const tituloId = tituloResult.insertId;

    // 4. Inserir itens do título (se fornecidos)
    if (itens && Array.isArray(itens) && itens.length > 0) {
      for (const item of itens) {
        const valorTotalItem = parseFloat(item.quantidade) * parseFloat(item.preco_unitario);
        await connection.query(
          `INSERT INTO titulo_itens (
            titulo_id, produto_id, quantidade, preco_unitario, valor_total, 
            descricao, observacoes
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            tituloId, item.produto_id, item.quantidade, item.preco_unitario,
            valorTotalItem, item.descricao || null, item.observacoes || null
          ]
        );
      }
    }

    await connection.commit();

    res.status(201).json({
      message: 'Título criado com sucesso!',
      titulo: {
        id: tituloId,
        numero_titulo: numeroTitulo,
        cliente_nome: clienteRows[0].nome
      }
    });

  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

// 2. Listar títulos de uma empresa
const getAllTitulosByEmpresa = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUser = req.user;
  const { status, cliente_id, data_inicio, data_fim } = req.query;

  if (!['Proprietario', 'Gerente', 'Caixa', 'Funcionario'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Você não tem permissão para visualizar títulos.' 
    });
  }

  let query = `
    SELECT 
      t.id, t.numero_titulo, t.descricao, t.valor_total, t.valor_pago, 
      t.valor_restante, t.data_vencimento, t.data_emissao, t.data_pagamento,
      t.status, t.observacoes,
      c.nome AS cliente_nome, c.telefone AS cliente_telefone, c.ativo AS cliente_ativo,
      f.nome AS funcionario_nome,
      DATEDIFF(CURDATE(), t.data_vencimento) AS dias_vencimento
    FROM titulos t
    LEFT JOIN clientes_contas_prazo c ON t.cliente_contas_prazo_id = c.id
    LEFT JOIN funcionarios f ON t.funcionario_id = f.id
    WHERE t.empresa_id = ?
  `;
  
  const params = [empresaId];

  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }
  if (cliente_id) {
    query += ' AND t.cliente_id = ?';
    params.push(cliente_id);
  }
  if (data_inicio) {
    query += ' AND t.data_vencimento >= ?';
    params.push(data_inicio);
  }
  if (data_fim) {
    query += ' AND t.data_vencimento <= ?';
    params.push(data_fim);
  }

  query += ' ORDER BY t.data_vencimento ASC, t.status ASC';

  try {
    const [titulos] = await pool.query(query, params);
    res.status(200).json(titulos);
  } catch (error) {
    next(error);
  }
};

// 3. Obter detalhes de um título específico
const getTituloById = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente', 'Caixa', 'Funcionario'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Você não tem permissão para visualizar este título.' 
    });
  }

  try {
    // Buscar dados do título
    const [tituloRows] = await pool.query(
      `SELECT 
        t.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone, c.email AS cliente_email, c.ativo AS cliente_ativo,
        f.nome AS funcionario_nome,
        DATEDIFF(CURDATE(), t.data_vencimento) AS dias_vencimento
       FROM titulos t
       LEFT JOIN clientes_contas_prazo c ON t.cliente_contas_prazo_id = c.id
       LEFT JOIN funcionarios f ON t.funcionario_id = f.id
       WHERE t.id = ? AND t.empresa_id = ?`,
      [id, empresaId]
    );

    if (tituloRows.length === 0) {
      return res.status(404).json({ message: 'Título não encontrado.' });
    }

    const titulo = tituloRows[0];

    // Buscar itens do título
    const [itensRows] = await pool.query(
      `SELECT 
        ti.*, p.nome AS produto_nome
       FROM titulo_itens ti
       LEFT JOIN produtos p ON ti.produto_id = p.id
       WHERE ti.titulo_id = ?`,
      [id]
    );

    // Buscar pagamentos do título
    const [pagamentosRows] = await pool.query(
      `SELECT 
        tp.*, fp.descricao AS forma_pagamento_descricao,
        f.nome AS funcionario_nome
       FROM titulo_pagamentos tp
       LEFT JOIN formas_pagamento fp ON tp.forma_pagamento_id = fp.id
       LEFT JOIN funcionarios f ON tp.funcionario_id = f.id
       WHERE tp.titulo_id = ?
       ORDER BY tp.data_pagamento DESC`,
      [id]
    );

    titulo.itens = itensRows;
    titulo.pagamentos = pagamentosRows;

    res.status(200).json(titulo);
  } catch (error) {
    next(error);
  }
};

// 3.5. Obter detalhes completos de um título (com itens e histórico)
const getDetalhesTitulo = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente', 'Caixa', 'Funcionario'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Você não tem permissão para visualizar este título.' 
    });
  }

  try {
    // Buscar dados completos do título
    const [tituloRows] = await pool.query(
      `SELECT 
        t.*, 
        c.nome AS cliente_nome, c.ativo AS cliente_ativo, 
        c.telefone AS cliente_telefone, 
        c.email AS cliente_email,
        c.endereco AS cliente_endereco,
        f.nome AS funcionario_nome,
        e.razao_social AS empresa_nome,
        e.juros_titulos AS percentual_juros_empresa,
        DATEDIFF(CURDATE(), t.data_vencimento) AS dias_vencimento,
        CASE 
          WHEN t.status = 'Pago' THEN 'Pago'
          WHEN t.data_vencimento < CURDATE() AND t.status = 'Pendente' THEN 'Vencido'
          WHEN t.data_vencimento = CURDATE() AND t.status = 'Pendente' THEN 'Vence hoje'
          WHEN t.status = 'Pendente' THEN 'Em dia'
          ELSE t.status
        END AS situacao_titulo,
        -- Calcular juros se vencido
        CASE 
          WHEN t.data_vencimento < CURDATE() AND t.status = 'Pendente' AND e.juros_titulos > 0 THEN
            ROUND((t.valor_restante * e.juros_titulos / 100) * DATEDIFF(CURDATE(), t.data_vencimento) / 30, 2)
          ELSE 0
        END AS juros_calculado,
        -- Valor total com juros
        CASE 
          WHEN t.data_vencimento < CURDATE() AND t.status = 'Pendente' AND e.juros_titulos > 0 THEN
            t.valor_restante + ROUND((t.valor_restante * e.juros_titulos / 100) * DATEDIFF(CURDATE(), t.data_vencimento) / 30, 2)
          ELSE t.valor_restante
        END AS valor_total_com_juros
       FROM titulos t
       LEFT JOIN clientes_contas_prazo c ON t.cliente_contas_prazo_id = c.id
       LEFT JOIN funcionarios f ON t.funcionario_id = f.id
       LEFT JOIN empresas e ON t.empresa_id = e.id
       WHERE t.id = ? AND t.empresa_id = ?`,
      [id, empresaId]
    );

    if (tituloRows.length === 0) {
      return res.status(404).json({ message: 'Título não encontrado.' });
    }

    const titulo = tituloRows[0];

    // Buscar itens detalhados do título
    const [itensRows] = await pool.query(
      `SELECT 
        ti.*, 
        p.nome AS produto_nome,
        p.descricao AS produto_descricao,
        p.preco AS produto_preco_original,
        c.descricao AS categoria_nome
       FROM titulo_itens ti
       LEFT JOIN produtos p ON ti.produto_id = p.id
        LEFT JOIN categorias c ON p.id_categoria = c.id
       WHERE ti.titulo_id = ?
       ORDER BY ti.id ASC`,
      [id]
    );

    // Buscar pagamentos detalhados do título
    const [pagamentosRows] = await pool.query(
      `SELECT 
        tp.*, 
        fp.descricao AS forma_pagamento_descricao,
        f.nome AS funcionario_nome
       FROM titulo_pagamentos tp
       LEFT JOIN formas_pagamento fp ON tp.forma_pagamento_id = fp.id
       LEFT JOIN funcionarios f ON tp.funcionario_id = f.id
       WHERE tp.titulo_id = ?
       ORDER BY tp.data_pagamento DESC, tp.id DESC`,
      [id]
    );

    // Buscar histórico de juros (se existir)
    const [jurosRows] = await pool.query(
      `SELECT 
        tj.*
       FROM titulo_juros tj
       WHERE tj.titulo_id = ?
       ORDER BY tj.data_calculo DESC`,
      [id]
    );

    // Calcular totais
    const totalItens = itensRows.reduce((sum, item) => sum + (item.quantidade * item.preco_unitario), 0);
    const totalPagamentos = pagamentosRows.reduce((sum, pag) => sum + parseFloat(pag.valor_pago), 0);
    const totalJuros = jurosRows.reduce((sum, juro) => sum + parseFloat(juro.valor_juros), 0);

    // Montar resposta completa
    const detalhesTitulo = {
      ...titulo,
      itens: itensRows,
      pagamentos: pagamentosRows,
      historico_juros: jurosRows,
      totais: {
        valor_itens: totalItens,
        valor_pago: totalPagamentos,
        valor_juros: totalJuros,
        valor_restante: titulo.valor_restante,
        valor_total_com_juros: titulo.valor_total_com_juros
      },
      estatisticas: {
        total_itens: itensRows.length,
        total_pagamentos: pagamentosRows.length,
        total_juros_aplicados: jurosRows.length,
        dias_em_atraso: Math.max(0, titulo.dias_vencimento),
        percentual_pago: titulo.valor_total > 0 ? (totalPagamentos / titulo.valor_total) * 100 : 0
      }
    };

    res.status(200).json({
      success: true,
      data: detalhesTitulo,
      message: 'Detalhes do título obtidos com sucesso!'
    });
  } catch (error) {
    next(error);
  }
};

// 4.5. Pagamento múltiplo de títulos
const pagamentoMultiploTitulos = async (req, res, next) => {
  const { titulos_ids, valor_total_pago, forma_pagamento_id, observacoes, cobrar_juros = false } = req.body;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Você não tem permissão para registrar pagamentos.' 
    });
  }

  // Validações básicas
  if (!titulos_ids || !Array.isArray(titulos_ids) || titulos_ids.length === 0) {
    return res.status(400).json({ 
      message: 'IDs dos títulos são obrigatórios' 
    });
  }

  if (titulos_ids.length > 10) {
    return res.status(400).json({ 
      message: 'Máximo de 10 títulos por pagamento múltiplo' 
    });
  }

  if (!valor_total_pago || valor_total_pago <= 0) {
    return res.status(400).json({ 
      message: 'Valor total pago deve ser maior que zero' 
    });
  }

  if (!forma_pagamento_id) {
    return res.status(400).json({ 
      message: 'Forma de pagamento é obrigatória' 
    });
  }

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Buscar todos os títulos pendentes ordenados por vencimento (mais antigo primeiro)
    const [titulosRows] = await connection.query(
      `SELECT 
        t.*, 
        c.nome AS cliente_nome, c.ativo AS cliente_ativo,
        e.juros_titulos AS percentual_juros_empresa
       FROM titulos t
       LEFT JOIN clientes_contas_prazo c ON t.cliente_contas_prazo_id = c.id
       LEFT JOIN empresas e ON t.empresa_id = e.id
       WHERE t.id IN (${titulos_ids.map(() => '?').join(',')})
       AND t.empresa_id = ?
       AND t.status = 'Pendente'
       ORDER BY t.data_vencimento ASC`,
      [...titulos_ids, empresaId]
    );

    if (titulosRows.length !== titulos_ids.length) {
      await connection.rollback();
      return res.status(400).json({ 
        message: 'Alguns títulos não foram encontrados ou não estão pendentes' 
      });
    }

    // Calcular valor total dos títulos (com juros se necessário)
    let valorTotalTitulos = 0;
    const titulosComJuros = [];

    for (const titulo of titulosRows) {
      let valorRestante = parseFloat(titulo.valor_restante);
      let jurosCalculado = 0;

      // Calcular juros se solicitado e título vencido
      if (cobrar_juros && new Date(titulo.data_vencimento) < new Date()) {
        const diasAtraso = Math.ceil((new Date() - new Date(titulo.data_vencimento)) / (1000 * 60 * 60 * 24));
        const taxaJuros = parseFloat(titulo.percentual_juros_empresa || 0);
        jurosCalculado = (valorRestante * (taxaJuros / 100) * diasAtraso) / 30;
        
        titulosComJuros.push({
          ...titulo,
          juros_calculado: jurosCalculado,
          valor_com_juros: valorRestante + jurosCalculado
        });
        
        valorTotalTitulos += valorRestante + jurosCalculado;
      } else {
        titulosComJuros.push({
          ...titulo,
          juros_calculado: 0,
          valor_com_juros: valorRestante
        });
        
        valorTotalTitulos += valorRestante;
      }
    }

    if (valor_total_pago > valorTotalTitulos) {
      await connection.rollback();
      return res.status(400).json({ 
        message: `Valor pago (R$ ${valor_total_pago.toFixed(2)}) não pode ser maior que o valor total dos títulos (R$ ${valorTotalTitulos.toFixed(2)})` 
      });
    }

    // Distribuir pagamento pelos títulos
    const pagamentos = [];
    let valorRestanteParaDistribuir = parseFloat(valor_total_pago);

    for (const titulo of titulosComJuros) {
      if (valorRestanteParaDistribuir <= 0) break;

      const valorComJuros = parseFloat(titulo.valor_com_juros);
      const valorAPagar = Math.min(valorRestanteParaDistribuir, valorComJuros);

      // Criar pagamento
      await connection.query(
        `INSERT INTO titulo_pagamentos (
          titulo_id, valor_pago, forma_pagamento_id, funcionario_id, observacoes, data_pagamento
        ) VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          titulo.id, 
          valorAPagar, 
          forma_pagamento_id, 
          requestingUser.id, 
          observacoes || `Pagamento múltiplo - ${titulosComJuros.length} títulos${cobrar_juros ? ' (com juros)' : ''}`
        ]
      );

      pagamentos.push({
        titulo_id: titulo.id,
        valor_pago: valorAPagar,
        juros_incluido: titulo.juros_calculado
      });

      valorRestanteParaDistribuir -= valorAPagar;
    }

    // Buscar títulos atualizados para retornar
    const [titulosAtualizados] = await connection.query(
      `SELECT 
        t.*, 
        c.nome AS cliente_nome, c.ativo AS cliente_ativo,
        c.telefone AS cliente_telefone,
        f.nome AS funcionario_nome
       FROM titulos t
       LEFT JOIN clientes_contas_prazo c ON t.cliente_contas_prazo_id = c.id
       LEFT JOIN funcionarios f ON t.funcionario_id = f.id
       WHERE t.id IN (${titulos_ids.map(() => '?').join(',')})
       ORDER BY t.data_vencimento ASC`,
      titulos_ids
    );

    await connection.commit();

    res.status(200).json({
      success: true,
      message: `Pagamento distribuído em ${pagamentos.length} título(s)`,
      pagamentos_criados: pagamentos.length,
      valor_total_distribuido: valor_total_pago,
      titulos_atualizados: titulosAtualizados,
      resumo_distribuicao: pagamentos
    });

  } catch (error) {
    await connection.rollback();
    console.error('Erro no pagamento múltiplo:', error);
    next(error);
  } finally {
    connection.release();
  }
};

// 5. Registrar pagamento de um título
const registrarPagamentoTitulo = async (req, res, next) => {
  const { id } = req.params;
  const { valor_pago, forma_pagamento_id, observacoes } = req.body;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!valor_pago || !forma_pagamento_id) {
    return res.status(400).json({ 
      message: 'Valor pago e forma de pagamento são obrigatórios.' 
    });
  }

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas Proprietário, Gerente ou Caixa podem registrar pagamentos.' 
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verificar se o título existe e não está pago
    const [tituloRows] = await connection.query(
      'SELECT * FROM titulos WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (tituloRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Título não encontrado.' });
    }

    const titulo = tituloRows[0];

    if (titulo.status === 'Pago') {
      await connection.rollback();
      return res.status(400).json({ message: 'Este título já foi totalmente pago.' });
    }

    // 2. Verificar se o valor não excede o restante
    const valorPago = parseFloat(valor_pago);
    const valorRestante = parseFloat(titulo.valor_restante);

    if (valorPago > valorRestante) {
      await connection.rollback();
      return res.status(400).json({ 
        message: `Valor pago (${valorPago}) não pode ser maior que o valor restante (${valorRestante}).` 
      });
    }

    // 3. Registrar o pagamento
    await connection.query(
      `INSERT INTO titulo_pagamentos (
        titulo_id, valor_pago, forma_pagamento_id, funcionario_id, observacoes
      ) VALUES (?, ?, ?, ?, ?)`,
      [id, valorPago, forma_pagamento_id, requestingUser.id, observacoes || null]
    );

    // 4. Registrar movimentação no caixa (se estiver aberto)
    await registrarRecebimentoTitulo(
      connection, empresaId, requestingUser.id, valorPago, 
      forma_pagamento_id, titulo.numero_titulo, observacoes
    );

    await connection.commit();

    res.status(201).json({
      message: 'Pagamento registrado com sucesso!',
      valor_pago: valorPago,
      valor_restante: valorRestante - valorPago
    });

  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

// 5. Listar títulos por cliente
const getTitulosByCliente = async (req, res, next) => {
  const { cliente_id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;
  const { status } = req.query;

  if (!['Proprietario', 'Gerente', 'Caixa', 'Funcionario'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Você não tem permissão para visualizar títulos.' 
    });
  }

  let query = `
    SELECT 
      t.id, t.numero_titulo, t.descricao, t.valor_total, t.valor_pago, 
      t.valor_restante, t.data_vencimento, t.data_emissao, t.data_pagamento,
      t.status, t.observacoes,
      DATEDIFF(CURDATE(), t.data_vencimento) AS dias_vencimento
    FROM titulos t
    WHERE t.empresa_id = ? AND t.cliente_contas_prazo_id = ?
  `;
  
  const params = [empresaId, cliente_id];

  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }

  query += ' ORDER BY t.data_vencimento ASC, t.status ASC';

  try {
    const [titulos] = await pool.query(query, params);
    res.status(200).json(titulos);
  } catch (error) {
    next(error);
  }
};

// 6. Cadastrar cliente rapidamente (para uso no caixa)
const createClienteRapido = async (req, res, next) => {
  const { nome, telefone, email, cpf_cnpj } = req.body;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!nome || !telefone) {
    return res.status(400).json({ 
      message: 'Nome e telefone são obrigatórios.' 
    });
  }

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas Proprietário, Gerente ou Caixa podem cadastrar clientes.' 
    });
  }

  try {
    // Verificar se já existe cliente com este telefone
    const [existingCliente] = await pool.query(
      'SELECT id, nome FROM clientes_contas_prazo WHERE empresa_id = ? AND telefone = ?',
      [empresaId, telefone]
    );

    if (existingCliente.length > 0) {
      return res.status(200).json({
        message: 'Cliente já existe.',
        cliente: existingCliente[0]
      });
    }

    // Criar novo cliente
    const [result] = await pool.query(
      `INSERT INTO clientes_contas_prazo (empresa_id, nome, telefone, email, cpf_cnpj, funcionario_cadastro_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [empresaId, nome, telefone, email || null, cpf_cnpj || null, requestingUser.id]
    );

    res.status(201).json({
      message: 'Cliente cadastrado com sucesso!',
      cliente: {
        id: result.insertId,
        nome,
        telefone,
        email
      }
    });

  } catch (error) {
    next(error);
  }
};

// 7. Buscar clientes para seleção no caixa
const searchClientes = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUser = req.user;
  const { search } = req.query;

  if (!['Proprietario', 'Gerente', 'Caixa', 'Funcionario'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Você não tem permissão para buscar clientes.' 
    });
  }

  let query = `
    SELECT id, nome, telefone, email, cpf_cnpj, ativo
    FROM clientes_contas_prazo 
    WHERE empresa_id = ?
  `;
  
  const params = [empresaId];

  if (search) {
    query += ' AND (nome LIKE ? OR telefone LIKE ? OR email LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  query += ' ORDER BY ativo DESC, nome ASC LIMIT 20';

  try {
    const [clientes] = await pool.query(query, params);
    res.status(200).json(clientes);
  } catch (error) {
    next(error);
  }
};

// 8. Atualizar status ativo do cliente
const updateClienteStatus = async (req, res, next) => {
  const { id } = req.params;
  const { ativo } = req.body;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (ativo === undefined) {
    return res.status(400).json({ 
      message: 'O campo ativo é obrigatório.' 
    });
  }

  if (typeof ativo !== 'boolean' && ativo !== 0 && ativo !== 1) {
    return res.status(400).json({ 
      message: 'O campo ativo deve ser um valor booleano (true/false ou 1/0).' 
    });
  }

  if (!['Proprietario', 'Gerente'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem atualizar status de clientes.' 
    });
  }

  try {
    // Verificar se o cliente existe e pertence à empresa
    const [clienteRows] = await pool.query(
      'SELECT id, nome FROM clientes_contas_prazo WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (clienteRows.length === 0) {
      return res.status(404).json({ 
        message: 'Cliente não encontrado ou não pertence a esta empresa.' 
      });
    }

    // Atualizar o status ativo
    const ativoValue = ativo === true || ativo === 1 ? 1 : 0;
    const [result] = await pool.query(
      'UPDATE clientes_contas_prazo SET ativo = ? WHERE id = ? AND empresa_id = ?',
      [ativoValue, id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        message: 'Cliente não encontrado ou não foi possível atualizar.' 
      });
    }

    res.status(200).json({
      message: `Cliente ${ativoValue === 1 ? 'ativado' : 'desativado'} com sucesso!`,
      cliente: {
        id: parseInt(id),
        ativo: ativoValue === 1
      }
    });

  } catch (error) {
    next(error);
  }
};

// 9. Relatório de títulos vencidos
const getTitulosVencidos = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Você não tem permissão para visualizar relatórios.' 
    });
  }

  try {
    const [titulos] = await pool.query(
      `SELECT 
        t.id, t.numero_titulo, t.descricao, t.valor_total, t.valor_pago, 
        t.valor_restante, t.data_vencimento, t.status,
        c.nome AS cliente_nome, c.ativo AS cliente_ativo, c.telefone AS cliente_telefone, c.ativo AS cliente_ativo,
        DATEDIFF(CURDATE(), t.data_vencimento) AS dias_vencimento
       FROM titulos t
       LEFT JOIN clientes_contas_prazo c ON t.cliente_contas_prazo_id = c.id
       WHERE t.empresa_id = ? 
       AND t.status IN ('Pendente', 'Vencido')
       AND t.data_vencimento < CURDATE()
       ORDER BY t.data_vencimento ASC`,
      [empresaId]
    );

    res.status(200).json(titulos);
  } catch (error) {
    next(error);
  }
};

// 9. Histórico completo do cliente
const getHistoricoCliente = async (req, res, next) => {
  const { cliente_id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente', 'Caixa', 'Funcionario'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Você não tem permissão para visualizar histórico de clientes.' 
    });
  }

  try {
    // Buscar dados do cliente
    const [clienteRows] = await pool.query(
      `SELECT 
        id, nome, telefone, email, endereco, data_cadastro, ativo
       FROM clientes_contas_prazo 
       WHERE id = ? AND empresa_id = ?`,
      [cliente_id, empresaId]
    );

    if (clienteRows.length === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado.' });
    }

    const cliente = clienteRows[0];

    // Buscar todos os títulos do cliente
    const [titulosRows] = await pool.query(
      `SELECT 
        t.*,
        f.nome AS funcionario_nome,
        e.razao_social AS empresa_nome,
        e.juros_titulos AS percentual_juros_empresa,
        DATEDIFF(CURDATE(), t.data_vencimento) AS dias_vencimento,
        CASE 
          WHEN t.status = 'Pago' THEN 'Pago'
          WHEN t.data_vencimento < CURDATE() AND t.status = 'Pendente' THEN 'Vencido'
          WHEN t.data_vencimento = CURDATE() AND t.status = 'Pendente' THEN 'Vence hoje'
          WHEN t.status = 'Pendente' THEN 'Em dia'
          ELSE t.status
        END AS situacao_titulo,
        -- Calcular juros se vencido
        CASE 
          WHEN t.data_vencimento < CURDATE() AND t.status = 'Pendente' AND e.juros_titulos > 0 THEN
            ROUND((t.valor_restante * e.juros_titulos / 100) * DATEDIFF(CURDATE(), t.data_vencimento) / 30, 2)
          ELSE 0
        END AS juros_calculado,
        -- Valor total com juros
        CASE 
          WHEN t.data_vencimento < CURDATE() AND t.status = 'Pendente' AND e.juros_titulos > 0 THEN
            t.valor_restante + ROUND((t.valor_restante * e.juros_titulos / 100) * DATEDIFF(CURDATE(), t.data_vencimento) / 30, 2)
          ELSE t.valor_restante
        END AS valor_total_com_juros
       FROM titulos t
       LEFT JOIN funcionarios f ON t.funcionario_id = f.id
       LEFT JOIN empresas e ON t.empresa_id = e.id
       WHERE t.cliente_contas_prazo_id = ? AND t.empresa_id = ?
       ORDER BY t.data_emissao DESC`,
      [cliente_id, empresaId]
    );

    // Para cada título, buscar itens e pagamentos
    const titulosComDetalhes = await Promise.all(
      titulosRows.map(async (titulo) => {
        // Buscar itens do título
        const [itensRows] = await pool.query(
          `SELECT 
            ti.*, 
            p.nome AS produto_nome,
            p.descricao AS produto_descricao,
            p.preco AS produto_preco_original,
            c.descricao AS categoria_nome
           FROM titulo_itens ti
           LEFT JOIN produtos p ON ti.produto_id = p.id
           LEFT JOIN categorias c ON p.id_categoria = c.id
           WHERE ti.titulo_id = ?
           ORDER BY ti.id ASC`,
          [titulo.id]
        );

        // Buscar pagamentos do título
        const [pagamentosRows] = await pool.query(
          `SELECT 
            tp.*, 
            fp.descricao AS forma_pagamento_descricao,
            f.nome AS funcionario_nome
           FROM titulo_pagamentos tp
           LEFT JOIN formas_pagamento fp ON tp.forma_pagamento_id = fp.id
           LEFT JOIN funcionarios f ON tp.funcionario_id = f.id
           WHERE tp.titulo_id = ?
           ORDER BY tp.data_pagamento DESC, tp.id DESC`,
          [titulo.id]
        );

        // Buscar histórico de juros (se existir)
        const [jurosRows] = await pool.query(
          `SELECT 
            tj.*
           FROM titulo_juros tj
           WHERE tj.titulo_id = ?
           ORDER BY tj.data_calculo DESC`,
          [titulo.id]
        );

        // Calcular totais
        const totalItens = itensRows.reduce((sum, item) => sum + (item.quantidade * item.preco_unitario), 0);
        const totalPagamentos = pagamentosRows.reduce((sum, pag) => sum + parseFloat(pag.valor_pago), 0);
        const totalJuros = jurosRows.reduce((sum, juro) => sum + parseFloat(juro.valor_juros), 0);

        return {
          ...titulo,
          itens: itensRows,
          pagamentos: pagamentosRows,
          historico_juros: jurosRows,
          totais: {
            valor_itens: totalItens,
            valor_pago: totalPagamentos,
            valor_juros: totalJuros,
            valor_restante: titulo.valor_restante,
            valor_total_com_juros: titulo.valor_total_com_juros
          },
          estatisticas: {
            total_itens: itensRows.length,
            total_pagamentos: pagamentosRows.length,
            total_juros_aplicados: jurosRows.length,
            dias_em_atraso: Math.max(0, titulo.dias_vencimento),
            percentual_pago: titulo.valor_total > 0 ? (totalPagamentos / titulo.valor_total) * 100 : 0
          }
        };
      })
    );

    // Calcular estatísticas gerais do cliente
    const estatisticasGerais = {
      total_titulos: titulosComDetalhes.length,
      titulos_pagos: titulosComDetalhes.filter(t => t.status === 'Pago').length,
      titulos_pendentes: titulosComDetalhes.filter(t => t.status === 'Pendente').length,
      titulos_vencidos: titulosComDetalhes.filter(t => t.situacao_titulo === 'Vencido').length,
      valor_total_emprestado: titulosComDetalhes.reduce((sum, t) => sum + parseFloat(t.valor_total), 0),
      valor_total_pago: titulosComDetalhes.reduce((sum, t) => sum + parseFloat(t.totais.valor_pago), 0),
      valor_total_restante: titulosComDetalhes.reduce((sum, t) => sum + parseFloat(t.valor_restante), 0),
      valor_total_juros: titulosComDetalhes.reduce((sum, t) => sum + parseFloat(t.totais.valor_juros), 0),
      percentual_pago_geral: titulosComDetalhes.length > 0 ? 
        (titulosComDetalhes.reduce((sum, t) => sum + parseFloat(t.totais.valor_pago), 0) / 
         titulosComDetalhes.reduce((sum, t) => sum + parseFloat(t.valor_total), 0)) * 100 : 0
    };

    // Montar resposta completa
    const historicoCompleto = {
      cliente: cliente,
      titulos: titulosComDetalhes,
      estatisticas_gerais: estatisticasGerais,
      resumo_por_periodo: {
        ultimos_30_dias: titulosComDetalhes.filter(t => 
          new Date(t.data_emissao) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ).length,
        ultimos_90_dias: titulosComDetalhes.filter(t => 
          new Date(t.data_emissao) >= new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        ).length,
        ultimo_ano: titulosComDetalhes.filter(t => 
          new Date(t.data_emissao) >= new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        ).length
      }
    };

    res.status(200).json({
      success: true,
      data: historicoCompleto,
      message: 'Histórico do cliente obtido com sucesso!'
    });

  } catch (error) {
    console.error('Erro ao buscar histórico do cliente:', error);
    next(error);
  }
};

module.exports = {
  createTitulo,
  getAllTitulosByEmpresa,
  getTituloById,
  getDetalhesTitulo,
  registrarPagamentoTitulo,
  pagamentoMultiploTitulos,
  getTitulosByCliente,
  createClienteRapido,
  searchClientes,
  updateClienteStatus,
  getTitulosVencidos,
  getHistoricoCliente
};
