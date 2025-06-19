// backend/src/controllers/pedidoController.js
const { pool } = require('../config/db');
const { sendOrderConfirmationEmail } = require('../services/emailService'); // Importa o serviço de e-mail

// Função auxiliar para gerar um número de pedido único baseado em timestamp
const generateNumeroPedido = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2); // Últimos 2 dígitos do ano
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  // Formato: AAMMDDhhmmsszzz (ex: 240619153045123)
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
    nome_cliente_mesa // NOVO: Campo opcional para nome do cliente em pedido de mesa
  } = req.body;

  const empresaId = req.empresa_id;
  const requestingUser = req.user; // Objeto user do token (pode ser null se não autenticado)

  // Extrai id_funcionario_logado se a requisição veio de um funcionário autenticado
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
    let nomeClienteParaPedido = nome_cliente_convidado; // Assume convidado ou vem do formulário

    // Gerenciar cliente convidado / cliente logado
    if (requestingUser?.id && requestingUser.role === 'cliente') {
        clienteIdParaPedido = requestingUser.id;
        nomeClienteParaPedido = requestingUser.nome;
    } else if (!clienteIdParaPedido && nome_cliente_convidado && telefone_cliente_convidado) {
        // Tenta encontrar cliente convidado existente
        const [existingGuest] = await connection.query(
            `SELECT id, nome FROM clientes WHERE empresa_id = ? AND telefone = ? AND email = ?`,
            [empresaId, telefone_cliente_convidado, email_cliente_convidado || null]
        );
        if (existingGuest.length > 0) {
            clienteIdParaPedido = existingGuest[0].id;
            nomeClienteParaPedido = existingGuest[0].nome;
        } else {
            // Cria um novo registro de cliente (convidado)
            const [newGuestResult] = await connection.query(
                `INSERT INTO clientes (empresa_id, nome, telefone, email) VALUES (?, ?, ?, ?)`,
                [empresaId, nome_cliente_convidado, telefone_cliente_convidado, email_cliente_convidado || null]
            );
            clienteIdParaPedido = newGuestResult.insertId;
            nomeClienteParaPedido = nome_cliente_convidado;
        }
    } else if (tipo_entrega === 'Mesa' && nome_cliente_mesa) { // Para pedidos de mesa com nome opcional
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
    }

    // 1. Inserir o pedido principal
    const numeroPedido = generateNumeroPedido();
    const [pedidoResult] = await connection.query(
      `INSERT INTO pedidos (empresa_id, numero_pedido, id_mesa, id_cliente, nome_cliente_convidado, tipo_entrega, status, observacoes, id_funcionario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, numeroPedido, id_mesa || null, clienteIdParaPedido || null, nomeClienteParaPedido || null, tipo_entrega, 'Pendente', observacoes || null, idFuncionarioLogado] // SALVA id_funcionario
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
            cliente_nome: nomeClienteParaPedido, // Usa o nome resolvido
            itens: itensDetalhes
        };
        sendOrderConfirmationEmail(clientEmail, orderEmailDetails, companyConfig);
    }

    res.status(201).json({
      message: 'Pedido criado com sucesso!',
      pedido: {
        id: pedidoId,
        numero_pedido: numeroPedido,
        tipo_entrega,
        valor_total: valorTotal,
        status: 'Pendente'
      }
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

// 4. Atualizar status de um pedido
const updatePedidoStatus = async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body; // Novo status
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!status) {
    return res.status(400).json({ message: 'Status é obrigatório.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Proprietario e Gerente podem mudar qualquer status.
  // Caixa pode mudar Pendente -> Preparando -> Pronto.
  // Funcionário pode mudar Pendente -> Preparando.
  const validStatusTransitions = {
    'Pendente': ['Preparando', 'Cancelado'],
    'Preparando': ['Pronto', 'Cancelado'],
    'Pronto': ['Entregue', 'Cancelado'],
    'Entregue': [], // Entregue é final
    'Cancelado': [] // Cancelado é final
  };

  const allowedRolesForStatusChange = {
    'Proprietario': ['Pendente', 'Preparando', 'Pronto', 'Entregue', 'Cancelado'], // Pode forçar qualquer status
    'Gerente': ['Pendente', 'Preparando', 'Pronto', 'Entregue', 'Cancelado'],
    'Caixa': ['Preparando', 'Pronto', 'Entregue', 'Cancelado'], // Pode avançar status ou cancelar
    'Funcionario': ['Preparando', 'Cancelado'] // Pode iniciar preparo ou cancelar
  };

  // Buscar status atual do pedido
  let currentStatus;
  try {
      const [orderRows] = await pool.query('SELECT status, id_mesa FROM pedidos WHERE id = ? AND empresa_id = ?', [id, empresaId]);
      if (orderRows.length === 0) {
          return res.status(404).json({ message: 'Pedido não encontrado ou não pertence a esta empresa.' });
      }
      currentStatus = orderRows[0].status;
  } catch (error) {
      return next(error);
  }

  // Validação de permissão e transição de status
  if (!allowedRolesForStatusChange[requestingUserRole]?.includes(status) && requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: `Acesso negado. Sua role (${requestingUserRole}) não pode definir este status.` });
  }
  
  // Validação de transição de status (apenas para não-Proprietário/Gerente tentando transições inválidas)
  if (!validStatusTransitions[currentStatus]?.includes(status) && requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(400).json({ message: `Transição de status inválida de '${currentStatus}' para '${status}'.` });
  }


  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `UPDATE pedidos SET status = ? WHERE id = ? AND empresa_id = ?`,
      [status, id, empresaId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Pedido não encontrado ou não pertence a esta empresa.' });
    }
    const [orderRows] = await connection.query('SELECT id_mesa FROM pedidos WHERE id = ? AND empresa_id = ?', [id, empresaId]);
    // Se o status for 'Entregue' ou 'Cancelado' e for um pedido de MESA, liberar a mesa
    if (orderRows[0].id_mesa && (status === 'Entregue' || status === 'Cancelado')) {
        await connection.query(`UPDATE mesas SET status = 'Livre' WHERE id = ? AND empresa_id = ?`, [orderRows[0].id_mesa, empresaId]);
    }

    await connection.commit();
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

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Regra de negócio: Apenas Proprietário pode excluir pedidos
  if (requestingUserRole !== 'Proprietario') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário pode excluir pedidos.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Primeiro, excluir itens do pedido
    await connection.query('DELETE FROM itens_pedido WHERE id_pedido = ?', [id]);
    // Depois, excluir pagamentos associados (se houver)
    await connection.query('DELETE FROM pagamentos WHERE id_pedido = ?', [id]);

    const [result] = await connection.query('DELETE FROM pedidos WHERE id = ? AND empresa_id = ?', [id, empresaId]);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Pedido não encontrado ou não pertence a esta empresa.' });
    }

    // Se o pedido tinha mesa, liberar a mesa
    const [pedidoMesa] = await connection.query('SELECT id_mesa FROM pedidos WHERE id = ?', [id]);
    if (pedidoMesa.length > 0 && pedidoMesa[0].id_mesa) {
        await connection.query(`UPDATE mesas SET status = 'Livre' WHERE id = ? AND empresa_id = ?`, [pedidoMesa[0].id_mesa, empresaId]);
    }

    await connection.commit();
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
    valor_pago, // Total recebido
    forma_pagamento_id, // ID da forma de pagamento
    itens_cobrados_ids, // IDs dos itens que estão sendo cobrados (para divisão de conta)
    dividir_conta_qtd_pessoas, // Opcional: quantidade de pessoas para dividir a conta
    observacoes_pagamento // Opcional
  } = req.body;

  const { id: pedidoId } = req.params; // ID do pedido a ser finalizado
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!valor_pago || !forma_pagamento_id || !itens_cobrados_ids || itens_cobrados_ids.length === 0) {
    return res.status(400).json({ message: 'Valor pago, forma de pagamento e itens a cobrar são obrigatórios.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Apenas Proprietário, Gerente e Caixa podem finalizar pedidos
  if (!['Proprietario', 'Gerente', 'Caixa'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para finalizar pedidos.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Obter o pedido e seus itens para calcular o valor real a ser cobrado
    const [pedidosRows] = await connection.query('SELECT valor_total, id_mesa FROM pedidos WHERE id = ? AND empresa_id = ?', [pedidoId, empresaId]);
    if (pedidosRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Pedido não encontrado ou não pertence a esta empresa.' });
    }
    const pedido = pedidosRows[0];

    // Calcula o subtotal dos itens que estão sendo cobrados
    const [itensPedidoCompleto] = await connection.query('SELECT id, quantidade, preco_unitario FROM itens_pedido WHERE id_pedido = ?', [pedidoId]);
    
    let subtotalItensCobrados = 0;
    itensPedidoCompleto.forEach(item => {
        if (itens_cobrados_ids.includes(item.id)) {
            subtotalItensCobrados += parseFloat(item.quantidade) * parseFloat(item.preco_unitario);
        }
    });

    // Se houver divisão de conta, ajusta o valor total pago proporcionalmente
    let valorFinalCobrado = subtotalItensCobrados;
    if (dividir_conta_qtd_pessoas && dividir_conta_qtd_pessoas > 1) {
        valorFinalCobrado = subtotalItensCobrados / dividir_conta_qtd_pessoas;
    }
    
    // 2. Registrar o pagamento
    await connection.query(
        `INSERT INTO pagamentos (empresa_id, id_pedido, id_forma_pagamento, valor_pago, observacoes) VALUES (?, ?, ?, ?, ?)`,
        [empresaId, pedidoId, forma_pagamento_id, valorFinalCobrado, observacoes_pagamento || null]
    );

    // 3. Atualizar status do pedido para 'Entregue' (ou outro status final como 'Pago')
    // Nota: O status 'Entregue' já libera a mesa.
    await connection.query(`UPDATE pedidos SET status = 'Entregue' WHERE id = ? AND empresa_id = ?`, [pedidoId, empresaId]);

    // 4. Liberar a mesa se for um pedido de mesa
    if (pedido.id_mesa) {
        await connection.query(`UPDATE mesas SET status = 'Livre' WHERE id = ? AND empresa_id = ?`, [pedido.id_mesa, empresaId]);
    }

    await connection.commit();
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
// NOVA FUNÇÃO: Adicionar itens a um pedido existente (para Comanda / Garçom)
const addItensToExistingOrder = async (req, res, next) => {
  const { id: pedidoId } = req.params; // ID do pedido existente
  const { itens: newItens } = req.body; // Array de novos itens a adicionar: { id_produto, quantidade, observacoes }
  const empresaId = req.empresa_id;
  const requestingUserRole = req.user.role;

  if (!newItens || newItens.length === 0) {
    return res.status(400).json({ message: 'Nenhum item para adicionar fornecido.' });
  }
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Apenas Proprietário, Gerente, Caixa ou Garçom podem adicionar itens a pedidos existentes
  if (!['Proprietario', 'Gerente', 'Caixa', 'Funcionario'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para adicionar itens a pedidos.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verificar se o pedido existe e pertence à empresa
    const [pedidoRows] = await connection.query(`SELECT id, status, valor_total FROM pedidos WHERE id = ? AND empresa_id = ?`, [pedidoId, empresaId]);
    if (pedidoRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Pedido não encontrado ou não pertence a esta empresa.' });
    }
    const pedido = pedidoRows[0];

    // 2. Não permitir adicionar itens a pedidos já finalizados/cancelados
    if (['Entregue', 'Cancelado'].includes(pedido.status)) {
        await connection.rollback();
        return res.status(400).json({ message: `Não é possível adicionar itens a um pedido com status '${pedido.status}'.` });
    }

    let novoValorTotalDoPedido = parseFloat(pedido.valor_total);

    // 3. Adicionar novos itens e recalcular o total
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

    // 4. Atualizar o valor total do pedido principal
    await connection.query('UPDATE pedidos SET valor_total = ? WHERE id = ?', [novoValorTotalDoPedido, pedidoId]);

    await connection.commit();

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


module.exports = {
  createPedido,
  getAllPedidosByEmpresa,
  getPedidoById,
  updatePedidoStatus,
  deletePedido,
  finalizePedidoAndRegisterPayment,
    addItensToExistingOrder
};