const { pool } = require('../config/db');
const { registrarRecebimentoInicialPedido } = require('../utils/caixaUtils');

// =====================================================
// CONTROLLER PARA INTEGRAÇÃO PEDIDOS + CONTAS A PRAZO
// =====================================================

// Finalizar pedido com pagamento a prazo
const finalizePedidoContasPrazo = async (req, res, next) => {
  const { 
    valor_pago, 
    forma_pagamento_id,
    itens_cobrados_ids, 
    cliente_id,
    data_vencimento,
    observacoes_pagamento
  } = req.body;

  const { id: pedidoId } = req.params;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  // Para contas a prazo, valor_pago pode ser 0 (sem entrada)
  // Converter valor_pago para número se for string
  const valorPagoNumerico = parseFloat(valor_pago) || 0;
  
  if (valor_pago === undefined || valor_pago === null || !forma_pagamento_id || !itens_cobrados_ids || itens_cobrados_ids.length === 0) {
    return res.status(400).json({ message: 'Forma de pagamento e itens a cobrar são obrigatórios. Valor pago pode ser 0 para sem entrada.' });
  }

  if (!cliente_id || !data_vencimento) {
    return res.status(400).json({ message: 'Cliente e data de vencimento são obrigatórios para pagamento a prazo.' });
  }

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUser.role)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para finalizar pedidos.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verificar se o pedido existe e está válido
    const [pedidosRows] = await connection.query(
      'SELECT valor_total, valor_recebido_parcial, id_mesa, status FROM pedidos WHERE id = ? AND empresa_id = ?',
      [pedidoId, empresaId]
    );
    
    if (pedidosRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Pedido não encontrado ou não pertence a esta empresa.' });
    }
    
    const pedido = pedidosRows[0];

    if (['Entregue', 'Cancelado'].includes(pedido.status)) {
      await connection.rollback();
      return res.status(400).json({ message: `Este pedido já está com status '${pedido.status}'.` });
    }

    // 2. Verificar se a forma de pagamento é "A Prazo"
    const [formaPagamentoRows] = await connection.query(
      'SELECT descricao FROM formas_pagamento WHERE id = ? AND empresa_id = ?',
      [forma_pagamento_id, empresaId]
    );
    
    if (formaPagamentoRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Forma de pagamento não encontrada.' });
    }

    const isAPrazo = formaPagamentoRows[0].descricao === 'A Prazo';

    if (!isAPrazo) {
      await connection.rollback();
      return res.status(400).json({ message: 'Esta função é apenas para pagamentos a prazo.' });
    }

    // 3. Verificar se o cliente existe
    const [clienteRows] = await connection.query(
      'SELECT id, nome FROM clientes_contas_prazo WHERE id = ? AND empresa_id = ?',
      [cliente_id, empresaId]
    );
    
    if (clienteRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Cliente não encontrado para esta empresa.' });
    }

    // 4. Buscar itens do pedido para criar o título
    const [itensPedido] = await connection.query(
      `SELECT 
        ip.id, ip.id_produto, ip.quantidade, ip.preco_unitario, ip.observacoes,
        p.nome AS produto_nome
       FROM itens_pedido ip
       JOIN produtos p ON ip.id_produto = p.id
       WHERE ip.id_pedido = ?`,
      [pedidoId]
    );

    // 5. Gerar número único do título
    const numeroTitulo = await gerarNumeroTituloUnico(connection, empresaId);

    // 6. Criar o título
    const [tituloResult] = await connection.query(
      `INSERT INTO titulos (
        empresa_id, cliente_contas_prazo_id, pedido_id, numero_titulo, descricao, 
        valor_total, valor_restante, data_vencimento, observacoes, funcionario_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId, cliente_id, pedidoId, numeroTitulo, 
        `Pedido #${pedidoId} - ${clienteRows[0].nome}`,
        parseFloat(pedido.valor_total), parseFloat(pedido.valor_total), 
        data_vencimento, observacoes_pagamento || null, requestingUser.id
      ]
    );

    const tituloId = tituloResult.insertId;

    // 7. Criar itens do título baseados nos itens do pedido
    for (const item of itensPedido) {
      const valorTotalItem = parseFloat(item.quantidade) * parseFloat(item.preco_unitario);
      await connection.query(
        `INSERT INTO titulo_itens (
          titulo_id, produto_id, quantidade, preco_unitario, valor_total, 
          descricao, observacoes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tituloId, item.id_produto, item.quantidade, item.preco_unitario,
          valorTotalItem, item.produto_nome, item.observacoes || null
        ]
      );
    }

    // 8. Registrar pagamento inicial (se houver entrada)
    if (valorPagoNumerico > 0) {
      // Registrar o pagamento no título
      await connection.query(
        `INSERT INTO titulo_pagamentos (
          titulo_id, valor_pago, forma_pagamento_id, funcionario_id, observacoes
        ) VALUES (?, ?, ?, ?, ?)`,
        [tituloId, valorPagoNumerico, forma_pagamento_id, requestingUser.id, 'Pagamento inicial']
      );

      // Registrar movimentação no caixa se estiver aberto
      await registrarRecebimentoInicialPedido(
        connection, empresaId, requestingUser.id, valorPagoNumerico, 
        forma_pagamento_id, pedidoId, numeroTitulo
      );
    }
    // Se valor_pago = 0, o título fica pendente sem pagamento inicial

    // 9. Atualizar o pedido
    const novoValorRecebidoParcial = parseFloat(pedido.valor_recebido_parcial) + valorPagoNumerico;
    await connection.query(
      `UPDATE pedidos SET 
        valor_recebido_parcial = ?, 
        data_atualizacao = CURRENT_TIMESTAMP,
        status = 'Entregue'
       WHERE id = ? AND empresa_id = ?`,
      [novoValorRecebidoParcial, pedidoId, empresaId]
    );

    // 10. Se for pedido de mesa, liberar a mesa
    if (pedido.id_mesa) {
      await connection.query(
        `UPDATE mesas SET status = 'Livre' WHERE id = ? AND empresa_id = ?`,
        [pedido.id_mesa, empresaId]
      );
    }

    await connection.commit();

    res.status(200).json({
      message: 'Pedido finalizado com pagamento a prazo!',
      titulo: {
        id: tituloId,
        numero_titulo: numeroTitulo,
        valor_total: pedido.valor_total,
        valor_pago: valor_pago,
        valor_restante: parseFloat(pedido.valor_total) - parseFloat(valor_pago),
        data_vencimento: data_vencimento,
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

// Buscar clientes para seleção no finalizamento de pedido
const searchClientesForPedido = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUser = req.user;
  const { search } = req.query;

  if (!['Proprietario', 'Gerente', 'Caixa', 'Funcionario'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Você não tem permissão para buscar clientes.' 
    });
  }

  let query = `
    SELECT id, nome, telefone, email, cpf_cnpj
    FROM clientes_contas_prazo 
    WHERE empresa_id = ? AND ativo = 1
  `;
  
  const params = [empresaId];

  if (search) {
    query += ' AND (nome LIKE ? OR telefone LIKE ? OR email LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  query += ' ORDER BY nome ASC LIMIT 10';

  try {
    const [clientes] = await pool.query(query, params);
    res.status(200).json(clientes);
  } catch (error) {
    next(error);
  }
};

// Cadastrar cliente rapidamente durante finalização de pedido
const createClienteRapidoForPedido = async (req, res, next) => {
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

// Função auxiliar para gerar número único de título
const gerarNumeroTituloUnico = async (connection, empresaId) => {
  let tentativas = 0;
  const maxTentativas = 1000;
  
  while (tentativas < maxTentativas) {
    // Buscar o próximo número sequencial (sem prefixo TP)
    const [maxResult] = await connection.query(
      `SELECT COALESCE(MAX(CAST(numero_titulo AS UNSIGNED)), 0) + 1 as proximo_numero
       FROM titulos 
       WHERE empresa_id = ? AND numero_titulo REGEXP '^[0-9]+$'`,
      [empresaId]
    );
    
    const proximoNumero = maxResult[0].proximo_numero + tentativas;
    const numeroTitulo = proximoNumero.toString();
    
    // Verificar se o número já existe
    const [existeResult] = await connection.query(
      'SELECT COUNT(*) as count FROM titulos WHERE empresa_id = ? AND numero_titulo = ?',
      [empresaId, numeroTitulo]
    );
    
    if (existeResult[0].count === 0) {
      return numeroTitulo;
    }
    
    tentativas++;
  }
  
  // Se chegou ao limite, usar timestamp
  return Date.now().toString();
};

module.exports = {
  finalizePedidoContasPrazo,
  searchClientesForPedido,
  createClienteRapidoForPedido,
  gerarNumeroTituloUnico
};
