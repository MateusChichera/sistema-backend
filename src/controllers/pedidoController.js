// backend/src/controllers/pedidoController.js
const { pool } = require('../config/db');
const { sendOrderConfirmationEmail } = require('../services/emailService');

const generateNumeroPedido = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;
};

// 1. Criar um novo pedido
const createPedido = async (req, res, next) => {
  const {
    id_mesa,
    id_cliente,
    nome_cliente_convidado,
    email_cliente_convidado,
    telefone_cliente_convidado,
    tipo_entrega,
    observacoes,
    itens,
    nome_cliente_mesa
  } = req.body;

  const empresaId = req.empresa_id;
  const requestingUser = req.user;
  const io = req.io; // <--- OBTÉM A INSTÂNCIA DO SOCKET.IO

  const idFuncionarioLogado = requestingUser?.id && ['Funcionario', 'Caixa', 'Gerente', 'Proprietario'].includes(requestingUser.role)
    ? requestingUser.id : null;

  if (!empresaId || !tipo_entrega || !itens || itens.length === 0) {
    return res.status(400).json({ message: 'Dados do pedido e itens são obrigatórios.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let valorTotal = 0;
    let clienteIdParaPedido = id_cliente;
    let nomeClienteParaPedido = nome_cliente_convidado;

    // Gerenciar cliente convidado / cliente logado
    if (requestingUser?.id && requestingUser.role === 'cliente') {
        clienteIdParaPedido = requestingUser.id;
        nomeClienteParaPedido = requestingUser.nome;
    } else if (!clienteIdParaPedido && nome_cliente_convidado && telefone_cliente_convidado) {
        const [existingGuest] = await connection.query(
            `SELECT id, nome FROM clientes WHERE empresa_id = ? AND telefone = ? AND email = ?`,
            [empresaId, telefone_cliente_convidado, email_cliente_convidado || null]
        );
        if (existingGuest.length > 0) {
            clienteIdParaPedido = existingGuest[0].id;
            nomeClienteParaPedido = existingGuest[0].nome;
        } else {
            const [newGuestResult] = await connection.query(
                `INSERT INTO clientes (empresa_id, nome, telefone, email) VALUES (?, ?, ?, ?)`,
                [empresaId, nome_cliente_convidado, telefone_cliente_convidado, email_cliente_convidado || null]
            );
            clienteIdParaPedido = newGuestResult.insertId;
            nomeClienteParaPedido = nome_cliente_convidado;
        }
    } else if (tipo_entrega === 'Mesa' && nome_cliente_mesa) {
        nomeClienteParaPedido = nome_cliente_mesa;
    }


    // --- Validações de Pré-Pedido ---
    if (tipo_entrega === 'Mesa') {
        if (!id_mesa) {
            await connection.rollback();
            return res.status(400).json({ message: 'Para pedidos de mesa, é necessário informar o ID da mesa.' });
        }
        const [mesaStatus] = await connection.query(`SELECT status FROM mesas WHERE id = ? AND empresa_id = ?`, [id_mesa, empresaId]);
        if (mesaStatus.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Mesa não encontrada.' });
        }
        if (mesaStatus[0].status !== 'Livre') {
            await connection.rollback();
            return res.status(409).json({ message: `Mesa ${id_mesa} não está livre. Status atual: ${mesaStatus[0].status}.` });
        }
    } else if (tipo_entrega === 'Delivery' && !id_cliente && (!nome_cliente_convidado || !telefone_cliente_convidado)) {
        await connection.rollback();
        return res.status(400).json({ message: 'Para pedidos de delivery, é necessário o ID do cliente ou nome e telefone do convidado.' });
    }

    // 1. Inserir o pedido principal
    const numeroPedido = generateNumeroPedido();
    const [pedidoResult] = await connection.query(
      `INSERT INTO pedidos (empresa_id, numero_pedido, id_mesa, id_cliente, nome_cliente_convidado, tipo_entrega, status, observacoes, id_funcionario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, numeroPedido, id_mesa || null, clienteIdParaPedido || null, nomeClienteParaPedido || null, tipo_entrega, 'Pendente', observacoes || null, idFuncionarioLogado]
    );
    const pedidoId = pedidoResult.insertId;

    // 2. Inserir os itens do pedido e calcular o valor total
    for (const item of itens) {
      const [produtoRows] = await connection.query('SELECT preco, promocao, promo_ativa FROM produtos WHERE id = ? AND empresa_id = ?', [item.id_produto, empresaId]);
      if (produtoRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: `Produto com ID ${item.id_produto} não encontrado ou não pertence a esta empresa.` });
      }
      const produtoPreco = parseFloat(produtoRows[0].preco);
      const produtoPromocao = parseFloat(produtoRows[0].promocao);
      const produtoPromoAtiva = produtoRows[0].promo_ativa;

      const precoUnitarioAplicado = (produtoPromoAtiva && produtoPromocao > 0) ? produtoPromocao : produtoPreco;
      valorTotal += precoUnitarioAplicado * item.quantidade;

      await connection.query(
        `INSERT INTO itens_pedido (id_pedido, id_produto, quantidade, preco_unitario, observacoes) VALUES (?, ?, ?, ?, ?)`,
        [pedidoId, item.id_produto, item.quantidade, precoUnitarioAplicado, item.observacoes || null]
      );
    }

    // 3. Atualizar o valor total do pedido
    await connection.query('UPDATE pedidos SET valor_total = ? WHERE id = ?', [valorTotal, pedidoId]);

    // 4. Se o pedido for de mesa, atualiza o status da mesa para 'Ocupada'
    if (tipo_entrega === 'Mesa' && id_mesa) {
        await connection.query(`UPDATE mesas SET status = 'Ocupada' WHERE id = ? AND empresa_id = ?`, [id_mesa, empresaId]);
        // EMITIR EVENTO SOCKET.IO PARA ATUALIZAÇÃO DA MESA
        io.to(`company_${empresaId}`).emit('mesaUpdated', { id: id_mesa, status: 'Ocupada' });
    }

    await connection.commit();

    // --- Lógica de E-mail de Confirmação ---
    const [configRows] = await pool.query(`
      SELECT ce.enviar_email_confirmacao, ce.mensagem_confirmacao_pedido,
             e.nome_fantasia, e.email_contato, e.telefone_contato
      FROM config_empresa ce
      JOIN empresas e ON ce.empresa_id = e.id
      WHERE ce.empresa_id = ?`, [empresaId]);
    
    const companyConfig = configRows[0];
    const clientEmail = email_cliente_convidado || (clienteIdParaPedido ? (await pool.query('SELECT email FROM clientes WHERE id = ?', [clienteIdParaPedido]))[0][0]?.email : null);

    if (companyConfig?.enviar_email_confirmacao && clientEmail) {
        const [itensDetalhes] = await pool.query(`
            SELECT ip.quantidade, ip.preco_unitario, ip.observacoes, p.nome AS nome_produto
            FROM itens_pedido ip
            JOIN produtos p ON ip.id_produto = p.id
            WHERE ip.id_pedido = ?
        `, [pedidoId]);

        const orderEmailDetails = {
            numero_pedido: numeroPedido,
            tipo_entrega: tipo_entrega,
            id_mesa: id_mesa,
            observacoes: observacoes,
            valor_total: valorTotal,
            cliente_nome: nomeClienteParaPedido,
            itens: itensDetalhes
        };
        sendOrderConfirmationEmail(clientEmail, orderEmailDetails, companyConfig);
    }

    const newPedidoData = { // Dados completos do novo pedido para emitir
        id: pedidoId,
        numero_pedido: numeroPedido,
        id_mesa: id_mesa || null,
        numero_mesa: (tipo_entrega === 'Mesa' && id_mesa) ? (await pool.query('SELECT numero FROM mesas WHERE id = ?', [id_mesa]))[0][0].numero : null,
        id_cliente: clienteIdParaPedido || null,
        nome_cliente: nomeClienteParaPedido,
        nome_cliente_convidado: nomeClienteParaPedido,
        tipo_entrega: tipo_entrega,
        status: 'Pendente',
        valor_total: valorTotal,
        observacoes: observacoes || null,
        data_pedido: new Date().toISOString(),
        data_atualizacao: new Date().toISOString(),
        itens: itens // Inclui itens para facilitar o frontend
    };

    io.to(`company_${empresaId}`).emit('newOrder', newPedidoData); // <--- EMITE EVENTO DE NOVO PEDIDO

    res.status(201).json({
      message: 'Pedido criado com sucesso!',
      pedido: newPedidoData // Retorna o objeto completo para o frontend
    });

  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

// 4. Atualizar status de um pedido
const updatePedidoStatus = async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;
  const io = req.io; // <--- OBTÉM A INSTÂNCIA DO SOCKET.IO

  if (!status) {
    return res.status(400).json({ message: 'Status é obrigatório.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  const validStatusTransitions = {
    'Pendente': ['Preparando', 'Cancelado'],
    'Preparando': ['Pronto', 'Cancelado'],
    'Pronto': ['Entregue', 'Cancelado'],
    'Entregue': [],
    'Cancelado': []
  };

  const allowedRolesForStatusChange = {
    'Proprietario': ['Pendente', 'Preparando', 'Pronto', 'Entregue', 'Cancelado'],
    'Gerente': ['Pendente', 'Preparando', 'Pronto', 'Entregue', 'Cancelado'],
    'Caixa': ['Preparando', 'Pronto', 'Entregue', 'Cancelado'],
    'Funcionario': ['Preparando', 'Cancelado']
  };

  let currentStatusData;
  try {
      const [orderRows] = await pool.query('SELECT status, id_mesa FROM pedidos WHERE id = ? AND empresa_id = ?', [id, empresaId]);
      if (orderRows.length === 0) {
          return res.status(404).json({ message: 'Pedido não encontrado ou não pertence a esta empresa.' });
      }
      currentStatusData = orderRows[0];
  } catch (error) {
      return next(error);
  }

  if (!allowedRolesForStatusChange[requestingUserRole]?.includes(status) && requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: `Acesso negado. Sua role (${requestingUserRole}) não pode definir este status.` });
  }
  
  if (!validStatusTransitions[currentStatusData.status]?.includes(status) && requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(400).json({ message: `Transição de status inválida de '${currentStatusData.status}' para '${status}'.` });
  }


  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `UPDATE pedidos SET status = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ? AND empresa_id = ?`,
      [status, id, empresaId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Pedido não encontrado ou não pertence a esta empresa.' });
    }

    if (currentStatusData.id_mesa && (status === 'Entregue' || status === 'Cancelado')) {
        await connection.query(`UPDATE mesas SET status = 'Livre' WHERE id = ? AND empresa_id = ?`, [currentStatusData.id_mesa, empresaId]);
        // EMITIR EVENTO SOCKET.IO PARA ATUALIZAÇÃO DA MESA
        io.to(`company_${empresaId}`).emit('mesaUpdated', { id: currentStatusData.id_mesa, status: 'Livre' });
    }

    await connection.commit();

    // EMITIR EVENTO SOCKET.IO PARA ATUALIZAÇÃO DO PEDIDO
    io.to(`company_${empresaId}`).emit('orderUpdated', { id: id, newStatus: status, data_atualizacao: new Date().toISOString() });

    res.status(200).json({ message: `Status do pedido #${id} atualizado para '${status}' com sucesso!` });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

// 5. Excluir um pedido (raramente usado em produção, mais para dev/testes)
const deletePedido = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;
  const io = req.io; // <--- OBTÉM A INSTÂNCIA DO SOCKET.IO

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  if (requestingUserRole !== 'Proprietario') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário pode excluir pedidos.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Obter o ID da mesa antes de excluir o pedido
    const [pedidoMesaRows] = await connection.query('SELECT id_mesa FROM pedidos WHERE id = ? AND empresa_id = ?', [id, empresaId]);
    const idMesaDoPedido = pedidoMesaRows.length > 0 ? pedidoMesaRows[0].id_mesa : null;

    // Primeiro, excluir itens do pedido e pagamentos associados
    await connection.query('DELETE FROM itens_pedido WHERE id_pedido = ?', [id]);
    await connection.query('DELETE FROM pagamentos WHERE id_pedido = ?', [id]);

    const [result] = await connection.query('DELETE FROM pedidos WHERE id = ? AND empresa_id = ?', [id, empresaId]);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Pedido não encontrado ou não pertence a esta empresa.' });
    }

    if (idMesaDoPedido) {
        await connection.query(`UPDATE mesas SET status = 'Livre' WHERE id = ? AND empresa_id = ?`, [idMesaDoPedido, empresaId]);
        // EMITIR EVENTO SOCKET.IO PARA ATUALIZAÇÃO DA MESA
        io.to(`company_${empresaId}`).emit('mesaUpdated', { id: idMesaDoPedido, status: 'Livre' });
    }

    await connection.commit();

    io.to(`company_${empresaId}`).emit('orderDeleted', { id: id }); // <--- EMITE EVENTO DE PEDIDO EXCLUÍDO

    res.status(200).json({ message: 'Pedido excluído com sucesso!' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};


// 6. Finalizar Pedido (Registrar Pagamento) - Endpoint específico para o Caixa
const finalizePedidoAndRegisterPayment = async (req, res, next) => {
  const { 
    valor_pago,
    forma_pagamento_id,
    itens_cobrados_ids,
    dividir_conta_qtd_pessoas,
    observacoes_pagamento
  } = req.body;

  const { id: pedidoId } = req.params;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;
  const io = req.io; // <--- OBTÉM A INSTÂNCIA DO SOCKET.IO

  if (!valor_pago || !forma_pagamento_id || !itens_cobrados_ids || itens_cobrados_ids.length === 0) {
    return res.status(400).json({ message: 'Valor pago, forma de pagamento e itens a cobrar são obrigatórios.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para finalizar pedidos.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [pedidosRows] = await connection.query('SELECT valor_total, id_mesa, status FROM pedidos WHERE id = ? AND empresa_id = ?', [pedidoId, empresaId]);
    if (pedidosRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Pedido não encontrado ou não pertence a esta empresa.' });
    }
    const pedido = pedidosRows[0];

    // Impedir finalização de pedidos já finalizados/cancelados
    if (['Entregue', 'Cancelado'].includes(pedido.status)) {
        await connection.rollback();
        return res.status(400).json({ message: `Este pedido já está com status '${pedido.status}'.` });
    }


    const [itensPedidoCompleto] = await connection.query('SELECT id, quantidade, preco_unitario FROM itens_pedido WHERE id_pedido = ?', [pedidoId]);
    
    let subtotalItensCobrados = 0;
    itensPedidoCompleto.forEach(item => {
        if (itens_cobrados_ids.includes(item.id)) {
            subtotalItensCobrados += parseFloat(item.quantidade) * parseFloat(item.preco_unitario);
        }
    });

    let valorFinalCobrado = subtotalItensCobrados;
    if (dividir_conta_qtd_pessoas && dividir_conta_qtd_pessoas > 1) {
        valorFinalCobrado = subtotalItensCobrados / dividir_conta_qtd_pessoas;
    }
    
    // 2. Registrar o pagamento
    await connection.query(
        `INSERT INTO pagamentos (empresa_id, id_pedido, id_forma_pagamento, valor_pago, observacoes) VALUES (?, ?, ?, ?, ?)`,
        [empresaId, pedidoId, forma_pagamento_id, valorFinalCobrado, observacoes_pagamento || null]
    );

    // 3. Atualizar status do pedido para 'Entregue'
    await connection.query(`UPDATE pedidos SET status = 'Entregue', data_atualizacao = CURRENT_TIMESTAMP WHERE id = ? AND empresa_id = ?`, [pedidoId, empresaId]);

    // 4. Liberar a mesa se for um pedido de mesa
    if (pedido.id_mesa) {
        await connection.query(`UPDATE mesas SET status = 'Livre' WHERE id = ? AND empresa_id = ?`, [pedido.id_mesa, empresaId]);
        // EMITIR EVENTO SOCKET.IO PARA ATUALIZAÇÃO DA MESA
        io.to(`company_${empresaId}`).emit('mesaUpdated', { id: pedido.id_mesa, status: 'Livre' });
    }

    await connection.commit();

    // EMITIR EVENTO SOCKET.IO PARA ATUALIZAÇÃO DO PEDIDO (agora com status 'Entregue')
    io.to(`company_${empresaId}`).emit('orderUpdated', { id: pedidoId, newStatus: 'Entregue', data_atualizacao: new Date().toISOString() });
    io.to(`company_${empresaId}`).emit('orderFinalized', { id: pedidoId, newStatus: 'Entregue', valor_pago_finalizado: valorFinalCobrado });


    res.status(200).json({ 
        message: 'Pedido finalizado e pagamento registrado com sucesso!',
        valor_cobrado: valorFinalCobrado
    });

  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};


// Adicionar itens a um pedido existente (para Comanda / Garçom)
const addItensToExistingOrder = async (req, res, next) => {
  const { id: pedidoId } = req.params;
  const { itens: newItens } = req.body;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;
  const io = req.io; // <--- OBTÉM A INSTÂNCIA DO SOCKET.IO

  const idFuncionarioLogado = requestingUser?.id && ['Funcionario', 'Caixa', 'Gerente', 'Proprietario'].includes(requestingUser.role)
    ? requestingUser.id : null;

  if (!newItens || newItens.length === 0) {
    return res.status(400).json({ message: 'Nenhum item para adicionar fornecido.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  if (!idFuncionarioLogado) {
    return res.status(403).json({ message: 'Acesso negado. Apenas funcionários podem adicionar itens a pedidos.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [pedidoRows] = await connection.query(`SELECT id, status, valor_total, id_mesa FROM pedidos WHERE id = ? AND empresa_id = ?`, [pedidoId, empresaId]);
    if (pedidoRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Pedido não encontrado ou não pertence a esta empresa.' });
    }
    const pedido = pedidoRows[0];

    if (['Entregue', 'Cancelado'].includes(pedido.status)) {
        await connection.rollback();
        return res.status(400).json({ message: `Não é possível adicionar itens a um pedido com status '${pedido.status}'.` });
    }

    let novoValorTotalDoPedido = parseFloat(pedido.valor_total);

    for (const item of newItens) {
      const [produtoRows] = await connection.query('SELECT preco, promocao, promo_ativa FROM produtos WHERE id = ? AND empresa_id = ?', [item.id_produto, empresaId]);
      if (produtoRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: `Produto com ID ${item.id_produto} não encontrado ou não pertence a esta empresa.` });
      }
      const produtoPreco = parseFloat(produtoRows[0].preco);
      const produtoPromocao = parseFloat(produtoRows[0].promocao);
      const produtoPromoAtiva = produtoRows[0].promo_ativa;

      const precoUnitarioAplicado = (produtoPromoAtiva && produtoPromocao > 0) ? produtoPromocao : produtoPreco;
      novoValorTotalDoPedido += precoUnitarioAplicado * item.quantidade;

      await connection.query(
        `INSERT INTO itens_pedido (id_pedido, id_produto, quantidade, preco_unitario, observacoes) VALUES (?, ?, ?, ?, ?)`,
        [pedidoId, item.id_produto, item.quantidade, precoUnitarioAplicado, item.observacoes || null]
      );
    }

    await connection.query('UPDATE pedidos SET valor_total = ?, id_funcionario = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?', [novoValorTotalDoPedido, idFuncionarioLogado, pedidoId]);

    // Opcional: Se adicionar itens a uma mesa que estava 'Livre' por engano, mude para 'Ocupada'
    if (pedido.id_mesa) {
        const [mesaStatusAfterAdd] = await connection.query(`SELECT status FROM mesas WHERE id = ? AND empresa_id = ?`, [pedido.id_mesa, empresaId]);
        if (mesaStatusAfterAdd.length > 0 && mesaStatusAfterAdd[0].status === 'Livre') {
            await connection.query(`UPDATE mesas SET status = 'Ocupada' WHERE id = ? AND empresa_id = ?`, [pedido.id_mesa, empresaId]);
            io.to(`company_${empresaId}`).emit('mesaUpdated', { id: pedido.id_mesa, status: 'Ocupada' });
        }
    }


    await connection.commit();

    // Re-buscar pedido completo para emitir o objeto atualizado
    const [updatedPedidoRows] = await pool.query(
        `SELECT 
            p.id, p.numero_pedido, p.id_mesa, m.numero AS numero_mesa, 
            p.id_cliente, c.nome AS nome_cliente, c.email AS email_cliente, c.telefone AS telefone_cliente,
            p.nome_cliente_convidado, p.tipo_entrega, p.status, p.valor_total, p.observacoes, 
            p.data_pedido, p.data_atualizacao,
            f.nome as nome_funcionario, f.email as email_funcionario
        FROM pedidos p
        LEFT JOIN mesas m ON p.id_mesa = m.id
        LEFT JOIN clientes c ON p.id_cliente = c.id
        LEFT JOIN funcionarios f ON p.id_funcionario = f.id
        WHERE p.id = ? AND p.empresa_id = ?`,
        [pedidoId, empresaId]
    );
    const updatedPedido = updatedPedidoRows[0];
    const [updatedItensPedido] = await pool.query(
        `SELECT ip.id, ip.id_produto, pr.nome AS nome_produto, ip.quantidade, ip.preco_unitario, ip.observacoes
        FROM itens_pedido ip
        JOIN produtos pr ON ip.id_produto = pr.id
        WHERE ip.id_pedido = ?`,
        [pedidoId]
    );
    updatedPedido.itens = updatedItensPedido;


    io.to(`company_${empresaId}`).emit('orderUpdated', updatedPedido); // <--- EMITE EVENTO DE PEDIDO ATUALIZADO (agora com o objeto completo)

    res.status(200).json({
      message: 'Itens adicionados ao pedido com sucesso!',
      pedido_id: pedidoId,
      novo_valor_total: novoValorTotalDoPedido
    });

  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};
// 2. Listar todos os pedidos de uma empresa (com filtros)
const getAllPedidosByEmpresa = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;
  const { status, tipo_entrega, data_inicio, data_fim, search } = req.query; // Filtros

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Todos os funcionários podem visualizar pedidos (com permissões para Caixa/Funcionario)
  const allowedRoles = ['Proprietario', 'Gerente', 'Funcionario', 'Caixa'];
  if (!allowedRoles.includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar pedidos.' });
  }

  let query = `
    SELECT 
        p.id, p.numero_pedido, p.id_mesa, m.numero AS numero_mesa, 
        p.id_cliente, c.nome AS nome_cliente, c.email AS email_cliente, c.telefone AS telefone_cliente,
        p.nome_cliente_convidado, p.tipo_entrega, p.status, p.valor_total, p.observacoes, 
        p.data_pedido, p.data_atualizacao
    FROM pedidos p
    LEFT JOIN mesas m ON p.id_mesa = m.id
    LEFT JOIN clientes c ON p.id_cliente = c.id
    WHERE p.empresa_id = ?
  `;
  let queryParams = [empresaId];

  // Aplicar filtros
  if (status) {
    query += ` AND p.status IN (?)`; // Pode ser um array de status
    queryParams.push(status.split(',')); // Assume status vem como string CSV
  }
  if (tipo_entrega) {
    query += ` AND p.tipo_entrega = ?`;
    queryParams.push(tipo_entrega);
  }
  if (data_inicio) {
    query += ` AND p.data_pedido >= ?`;
    queryParams.push(`${data_inicio} 00:00:00`); // Inclui início do dia
  }
  if (data_fim) {
    query += ` AND p.data_pedido <= ?`;
    queryParams.push(`${data_fim} 23:59:59`); // Inclui final do dia
  }
  if (search) {
    query += ` AND (p.numero_pedido LIKE ? OR p.nome_cliente_convidado LIKE ? OR c.nome LIKE ?)`;
    queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY p.data_pedido DESC`; // Ordenar pelos mais recentes

  try {
    const [pedidos] = await pool.query(query, queryParams);
    res.status(200).json(pedidos);
  } catch (error) {
    next(error);
  }
};
// 3. Obter detalhes de um pedido específico
const getPedidoById = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  const allowedRoles = ['Proprietario', 'Gerente', 'Funcionario', 'Caixa'];
  if (!allowedRoles.includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar este pedido.' });
  }

  try {
    const [pedidos] = await pool.query(
      `SELECT 
          p.id, p.numero_pedido, p.id_mesa, m.numero AS numero_mesa, 
          p.id_cliente, c.nome AS nome_cliente, c.email AS email_cliente, c.telefone AS telefone_cliente,
          p.nome_cliente_convidado, p.tipo_entrega, p.status, p.valor_total, p.observacoes, 
          p.data_pedido, p.data_atualizacao
      FROM pedidos p
      LEFT JOIN mesas m ON p.id_mesa = m.id
      LEFT JOIN clientes c ON p.id_cliente = c.id
      WHERE p.id = ? AND p.empresa_id = ?`,
      [id, empresaId]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({ message: 'Pedido não encontrado ou não pertence a esta empresa.' });
    }

    const pedido = pedidos[0];

    // Buscar os itens do pedido
    const [itensPedido] = await pool.query(
      `SELECT ip.id, ip.id_produto, pr.nome AS nome_produto, ip.quantidade, ip.preco_unitario, ip.observacoes
       FROM itens_pedido ip
       JOIN produtos pr ON ip.id_produto = pr.id
       WHERE ip.id_pedido = ?`,
      [pedido.id]
    );
    pedido.itens = itensPedido; // Adiciona os itens ao objeto do pedido

    res.status(200).json(pedido);
  } catch (error) {
    next(error);
  }
};


module.exports = {
  createPedido,
  getAllPedidosByEmpresa,
  getPedidoById,
  updatePedidoStatus,
  deletePedido,
  finalizePedidoAndRegisterPayment,
  addItensToExistingOrder,
};