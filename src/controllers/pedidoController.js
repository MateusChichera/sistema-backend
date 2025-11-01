// backend/src/controllers/pedidoController.js
const { pool } = require('../config/db');
const whatsappNotificationService = require('../services/whatsappNotificationService');
const { sendOrderConfirmationEmail } = require('../services/emailService');
//const { io } = require('../utils/socket'); // Certifique-se de que `io` está configurado e exportado corretamente

// NOVO: Função para gerar número de pedido menor (até 4 dígitos)
const generateNumeroPedido = async (empresaId) => {
    const [result] = await pool.query('SELECT COUNT(*) as count FROM pedidos WHERE empresa_id = ? AND DATE(data_pedido) = CURDATE()', [empresaId]);
    const countToday = result[0].count;
    const randomNumber = Math.floor(100 + Math.random() * 900); // 3 dígitos aleatórios
    const dayCounter = String(countToday + 1).padStart(2, '0'); // Contador diário
    return `${dayCounter}${randomNumber}`; // Ex: "01345", "02876"
};

const formatToMySQLDateTime = (dateString) => {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;
  // Ajusta para o fuso local, remove o 'Z' e milissegundos
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

// Função auxiliar para buscar pedido COMPLETO (com itens e pagamentos)
const getFullPedidoDetails = async (connection, pedidoId, empresaId) => {
    const [pedidosRows] = await connection.query(
        `SELECT 
            p.id, p.numero_pedido, p.id_mesa, m.numero AS numero_mesa, 
            p.id_cliente, c.nome AS nome_cliente, c.email AS email_cliente, c.telefone AS telefone_cliente,
            p.nome_cliente_convidado, p.tipo_entrega, p.status, p.valor_total, p.valor_recebido_parcial, p.observacoes,p.troco,p.formapagamento,p.taxa_entrega,
            p.data_pedido, p.data_atualizacao,
            f.nome AS nome_funcionario, f.email AS email_funcionario,
            p.endereco_entrega, p.complemento_entrega, p.numero_entrega, p.bairro_entrega, p.cidade_entrega, p.estado_entrega, p.cep_entrega,
            p.Nfce, p.NfceId, p.NfceEmissao, p.NfceStatus
        FROM pedidos p
        LEFT JOIN mesas m ON p.id_mesa = m.id
        LEFT JOIN clientes c ON p.id_cliente = c.id
        LEFT JOIN funcionarios f ON p.id_funcionario = f.id
        WHERE p.id = ? AND p.empresa_id = ?`,
        [pedidoId, empresaId]
    );

    if (pedidosRows.length === 0) return null;

    const pedido = pedidosRows[0];

    const [itensPedido] = await connection.query(
        `SELECT ip.id, ip.id_produto, pr.nome AS nome_produto, ip.quantidade, ip.preco_unitario, ip.observacoes, pr.ncm, pr.perfil_tributario_id
         FROM itens_pedido ip
         JOIN produtos pr ON ip.id_produto = pr.id
         WHERE ip.id_pedido = ?`,
        [pedido.id]
    );

    // Para cada item, buscar adicionais vinculados e perfil tributário
    for (const item of itensPedido) {
        const [adicionaisRows] = await connection.query(
            `SELECT ipa.id_adicional, a.nome, ipa.quantidade, ipa.preco_unitario_adicional
             FROM itens_pedido_adicionais ipa
             JOIN adicionais a ON ipa.id_adicional = a.id
             WHERE ipa.id_item_pedido = ?`,
            [item.id]
        );
        item.adicionais = adicionaisRows;
        // Buscar perfil tributário se houver
        if (item.perfil_tributario_id) {
            const [perfilRows] = await connection.query(
                `SELECT id, descricao, cfop, csosn, origem_produto, icms_aliquota, pis_aliquota, cofins_aliquota
                 FROM perfis_tributarios WHERE id = ?`,
                [item.perfil_tributario_id]
            );
            item.perfil_tributario = perfilRows[0] || null;
        } else {
            item.perfil_tributario = null;
        }
    }
    pedido.itens = itensPedido;

    const [pagamentosAnteriores] = await connection.query(
        `SELECT pg.id, pg.valor_pago, fp.descricao AS forma_pagamento_descricao, pg.data_pagamento, pg.observacoes
         FROM pagamentos pg
         JOIN formas_pagamento fp ON pg.id_forma_pagamento = fp.id
         WHERE pg.id_pedido = ? ORDER BY pg.data_pagamento DESC`,
        [pedido.id]
    );
    pedido.pagamentos_recebidos = pagamentosAnteriores;

    return pedido;
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
        troco,
        formapagamento,
        taxa_entrega,
        nome_cliente_mesa,
        endereco_entrega, complemento_entrega, numero_entrega, bairro_entrega, cidade_entrega, estado_entrega, cep_entrega
    } = req.body;
    
    // Importar serviço de geocoding
    const geocodingService = require('../services/geocodingService');

    const empresaId = req.empresa_id;
    const requestingUser = req.user;
    const io = req.io; // Utilizando req.io

    const idFuncionarioLogado = requestingUser?.id && ['Funcionario', 'Caixa', 'Gerente', 'Proprietario'].includes(requestingUser.role)
        ? requestingUser.id : null;

    if (!empresaId || !tipo_entrega || !itens || itens.length === 0) {
        return res.status(400).json({ message: 'Dados do pedido e itens são obrigatórios.' });
    }

    const connection = await pool.getConnection();

    // Busca configuração da empresa para estoque
    const [configEstoqueRows] = await connection.query('SELECT permitir_pedidos_estoque_zerado FROM config_empresa WHERE empresa_id = ?', [empresaId]);
    const permitirEstoqueZerado = configEstoqueRows.length > 0 ? parseInt(configEstoqueRows[0].permitir_pedidos_estoque_zerado) : 0;

    try {
        await connection.beginTransaction();

        let valorTotal = 0;
        let clienteIdParaPedido = id_cliente;
        let nomeClienteParaPedido = nome_cliente_convidado;

        // Gerenciar cliente convidado / cliente logado
        if (requestingUser?.id && requestingUser.role === 'cliente') {
            clienteIdParaPedido = requestingUser.id;
            nomeClienteParaPedido = requestingUser.nome;
        } else if (nome_cliente_convidado && telefone_cliente_convidado) {
            // Para delivery ou pedidos com cliente convidado, sempre verificar/criar na tabela clientes
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
        } else if (tipo_entrega === 'Delivery' && (!nome_cliente_convidado || !telefone_cliente_convidado || !endereco_entrega)) {
             // Validação mais rigorosa para delivery
            await connection.rollback();
            return res.status(400).json({ message: 'Para delivery, nome, telefone e endereço de entrega são obrigatórios.' });
        }

        // 1. Inserir o pedido principal
        const numeroPedido = await generateNumeroPedido(empresaId); // Utiliza a nova função
        
        // Fazer geocoding do endereço para obter coordenadas (apenas para delivery)
        let latDestinoFinal = null;
        let lngDestinoFinal = null;
        
        if (tipo_entrega === 'Delivery' && endereco_entrega) {
            console.log('[Pedido] 📍 Fazendo geocoding do endereço de entrega...');
            
            // Log para debug - verificar o que está chegando
            console.log('[Pedido] 📍 Dados do endereço recebidos:', {
                endereco_entrega: endereco_entrega || 'null',
                numero_entrega: numero_entrega || 'null',
                complemento_entrega: complemento_entrega || 'null',
                bairro_entrega: bairro_entrega || 'null',
                cidade_entrega: cidade_entrega || 'null',
                estado_entrega: estado_entrega || 'null',
                cep_entrega: cep_entrega || 'null'
            });
            
            try {
                const coordenadas = await geocodingService.geocodeEnderecoCompleto({
                    endereco_entrega,
                    numero_entrega,
                    complemento_entrega,
                    bairro_entrega,
                    cidade_entrega,
                    estado_entrega,
                    cep_entrega
                });
                
                latDestinoFinal = coordenadas.latitude;
                lngDestinoFinal = coordenadas.longitude;
                
                if (latDestinoFinal && lngDestinoFinal) {
                    console.log(`[Pedido] ✅ Coordenadas obtidas via geocoding: ${latDestinoFinal}, ${lngDestinoFinal}`);
                } else {
                    console.log('[Pedido] ⚠️ Não foi possível obter coordenadas via geocoding');
                }
            } catch (error) {
                console.error('[Pedido] Erro ao fazer geocoding:', error);
                // Continua mesmo se geocoding falhar
            }
        } else {
            if (tipo_entrega !== 'Delivery') {
                console.log('[Pedido] ℹ️ Tipo de entrega não é Delivery, geocoding não necessário');
            } else if (!endereco_entrega) {
                console.log('[Pedido] ⚠️ Endereço de entrega não informado');
            }
        }
        
        const [pedidoResult] = await connection.query(
            `INSERT INTO pedidos (
                empresa_id, numero_pedido, id_mesa, id_cliente, nome_cliente_convidado, tipo_entrega, status, observacoes, id_funcionario,
                endereco_entrega, complemento_entrega, numero_entrega, bairro_entrega, cidade_entrega, estado_entrega, cep_entrega, troco, formapagamento, taxa_entrega,
                latitude_destino, longitude_destino, latitude_entrega, longitude_entrega, endereco_latitude, endereco_longitude, lat_destino, lng_destino
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                empresaId, numeroPedido, id_mesa || null, clienteIdParaPedido || null, nomeClienteParaPedido || null, tipo_entrega, 'Pendente', observacoes || null, idFuncionarioLogado,
                endereco_entrega || null, complemento_entrega || null, numero_entrega || null, bairro_entrega || null, cidade_entrega || null, estado_entrega || null, cep_entrega || null, troco || 0.0, formapagamento || null, taxa_entrega || 0.0,
                latDestinoFinal, lngDestinoFinal, // latitude_destino, longitude_destino
                null, // latitude_entrega (mantido para compatibilidade)
                null, // longitude_entrega (mantido para compatibilidade)
                null, // endereco_latitude (mantido para compatibilidade)
                null, // endereco_longitude (mantido para compatibilidade)
                null, // lat_destino (mantido para compatibilidade)
                null  // lng_destino (mantido para compatibilidade)
            ]
        );
        
        // Log para verificar se salvou
        if (latDestinoFinal || lngDestinoFinal) {
            console.log(`[Pedido] Pedido criado com ID ${pedidoResult.insertId} - Coordenadas salvas: Lat=${latDestinoFinal}, Lng=${lngDestinoFinal}`);
        }
        const pedidoId = pedidoResult.insertId;

        // 2. Inserir os itens do pedido e calcular o valor total
        for (const item of itens) {
            const [produtoRows] = await connection.query('SELECT preco, promocao, promo_ativa, estoque FROM produtos WHERE id = ? AND empresa_id = ?', [item.id_produto, empresaId]);
            if (produtoRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: `Produto com ID ${item.id_produto} não encontrado ou não pertence a esta empresa.` });
            }
            // Verifica se há estoque suficiente (se o estoque for gerenciado)
            const estoqueAtual = produtoRows[0].estoque;
            if (permitirEstoqueZerado === 0 && estoqueAtual !== null && estoqueAtual < item.quantidade) {
                await connection.rollback();
                return res.status(409).json({ message: `Estoque insuficiente para o produto ID ${item.id_produto}. Disponível: ${estoqueAtual}, solicitado: ${item.quantidade}.` });
            }
            const produtoPreco = parseFloat(produtoRows[0].preco);
            const produtoPromocao = parseFloat(produtoRows[0].promocao);
            const produtoPromoAtiva = produtoRows[0].promo_ativa;

            const precoUnitarioAplicado = (produtoPromoAtiva && produtoPromocao > 0) ? produtoPromocao : produtoPreco;
            valorTotal += precoUnitarioAplicado * item.quantidade;

            const [itemResult] = await connection.query(
                `INSERT INTO itens_pedido (id_pedido, id_produto, quantidade, preco_unitario, observacoes) VALUES (?, ?, ?, ?, ?)`,
                [pedidoId, item.id_produto, item.quantidade, precoUnitarioAplicado, item.observacoes || null]
            );
            // Atualiza o estoque do produto (desconta)
            await connection.query('UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND empresa_id = ?', [item.quantidade, item.id_produto, empresaId]);
            const itemPedidoId = itemResult.insertId;

            // --- Processar adicionais (se houver) ---
            if (item.adicionais && Array.isArray(item.adicionais) && item.adicionais.length > 0) {
                for (const adicional of item.adicionais) {
                    const quantidadeAdicional = adicional.quantidade ? parseInt(adicional.quantidade) : 1;
                    const [addRows] = await connection.query('SELECT preco FROM adicionais WHERE id = ? AND empresa_id = ?', [adicional.id_adicional, empresaId]);
                    if (addRows.length === 0) {
                        await connection.rollback();
                        return res.status(404).json({ message: `Adicional com ID ${adicional.id_adicional} não encontrado ou não pertence a esta empresa.` });
                    }
                    const precoAdicional = parseFloat(addRows[0].preco);
                    valorTotal += precoAdicional * quantidadeAdicional;

                    await connection.query(
                        `INSERT INTO itens_pedido_adicionais (id_item_pedido, id_adicional, quantidade, preco_unitario_adicional) VALUES (?, ?, ?, ?)`,
                        [itemPedidoId, adicional.id_adicional, quantidadeAdicional, precoAdicional]
                    );
                }
            }
        }

        // 3. Atualizar o valor total do pedido E valor_recebido_parcial (que inicia em 0)
        await connection.query('UPDATE pedidos SET valor_total = ?, valor_recebido_parcial = 0 WHERE id = ?', [valorTotal, pedidoId]);

        // 4. Se o pedido for de mesa, atualiza o status da mesa para 'Ocupada'
        if (tipo_entrega === 'Mesa' && id_mesa) {
            await connection.query(`UPDATE mesas SET status = 'Ocupada' WHERE id = ? AND empresa_id = ?`, [id_mesa, empresaId]);
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

        // Re-buscar o pedido COMPLETO após a criação para emitir pelo Socket.IO
        const newPedidoData = await getFullPedidoDetails(connection, pedidoId, empresaId);

        io.to(`company_${empresaId}`).emit('newOrder', newPedidoData);
        // Emitir também para a sala do pedido (cliente acompanha)
        io.to(`pedido_${req.params.slug || req.body.slug}_${pedidoId}`).emit('pedidoUpdated', newPedidoData);

        // Buscar telefone do cliente da tabela clientes para WhatsApp
        let telefoneClienteParaWhatsApp = null;
        if (clienteIdParaPedido) {
            const [clienteRows] = await pool.query(
                'SELECT telefone FROM clientes WHERE id = ? AND empresa_id = ?',
                [clienteIdParaPedido, empresaId]
            );
            if (clienteRows.length > 0) {
                telefoneClienteParaWhatsApp = clienteRows[0].telefone;
            }
        }

        // Enviar notificação WhatsApp de novo pedido (async, não bloqueia resposta)
        // Só envia se tiver telefone do cliente
        if (telefoneClienteParaWhatsApp) {
            whatsappNotificationService.notifyNewPedido(empresaId, {
                id: pedidoId,
                numero_pedido: numeroPedido,
                nome_cliente: nomeClienteParaPedido,
                telefone_cliente: telefoneClienteParaWhatsApp,
                valor_total: valorTotal,
                taxa_entrega: taxa_entrega || 0,
                tipo_entrega: tipo_entrega
            }).catch(err => console.error(`[WhatsApp ${empresaId}] Erro ao enviar notificação de novo pedido:`, err));
        }

        res.status(201).json({
            message: 'Pedido criado com sucesso!',
            pedido: newPedidoData
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
    const { status, tipo_entrega, data_inicio, data_fim, search } = req.query;

    if (!empresaId) {
        return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
    }

    const allowedRoles = ['Proprietario', 'Gerente', 'Funcionario', 'Caixa'];
    if (!allowedRoles.includes(requestingUserRole)) {
        return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar pedidos.' });
    }

    let query = `
        SELECT 
            p.id, p.numero_pedido, p.id_mesa, m.numero AS numero_mesa, 
            p.id_cliente, c.nome AS nome_cliente, c.email AS email_cliente, c.telefone AS telefone_cliente,
            p.nome_cliente_convidado, p.tipo_entrega, p.status, p.valor_total, p.valor_recebido_parcial, p.observacoes, 
            p.data_pedido, p.data_atualizacao,
            f.nome as nome_funcionario, f.email as email_funcionario,
            p.endereco_entrega, p.complemento_entrega, p.numero_entrega, p.bairro_entrega, p.cidade_entrega, p.estado_entrega, p.cep_entrega,p.troco,p.formapagamento,p.taxa_entrega,
            p.Nfce, p.NfceId, p.NfceEmissao, p.NfceStatus
        FROM pedidos p
        LEFT JOIN mesas m ON p.id_mesa = m.id
        LEFT JOIN clientes c ON p.id_cliente = c.id
        LEFT JOIN funcionarios f ON p.id_funcionario = f.id
        WHERE p.empresa_id = ?
    `;
    let queryParams = [empresaId];

    if (status) {
        query += ` AND p.status IN (?)`;
        queryParams.push(status.split(','));
    }
    if (tipo_entrega) {
        query += ` AND p.tipo_entrega = ?`;
        queryParams.push(tipo_entrega);
    }
    if (data_inicio) {
        query += ` AND p.data_pedido >= ?`;
        queryParams.push(`${data_inicio} 00:00:00`);
    }
    if (data_fim) {
        query += ` AND p.data_pedido <= ?`;
        queryParams.push(`${data_fim} 23:59:59`);
    }
    if (search) {
        query += ` AND (p.numero_pedido LIKE ? OR p.nome_cliente_convidado LIKE ? OR c.nome LIKE ?)`;
        queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY p.data_pedido DESC`; // Ordena do mais recente para o mais antigo (para o caixa)

    const connection = await pool.getConnection();
    try {
        const [pedidosBase] = await connection.query(query, queryParams);

        // PONTO CRÍTICO: Buscar itens e pagamentos para CADA pedido
        const pedidosCompletos = await Promise.all(pedidosBase.map(async (pedido) => {
            const connectionForDetail = await pool.getConnection(); // Obtém nova conexão para cada promessa
            try {
                const fullPedido = await getFullPedidoDetails(connectionForDetail, pedido.id, empresaId);
                return fullPedido;
            } finally {
                connectionForDetail.release();
            }
        }));

        res.status(200).json(pedidosCompletos.filter(Boolean)); // Filtra por null se algum pedido não foi encontrado
    } catch (error) {
        next(error);
    } finally {
        connection.release(); // Garante que a conexão seja liberada
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

    const connection = await pool.getConnection();
    try {
        const pedido = await getFullPedidoDetails(connection, id, empresaId);

        if (!pedido) {
            return res.status(404).json({ message: 'Pedido não encontrado ou não pertence a esta empresa.' });
        }

        res.status(200).json(pedido);
    } catch (error) {
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
    const io = req.io; // Utilizando req.io

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
    const connection = await pool.getConnection();
    try {
        const [orderRows] = await connection.query('SELECT status, id_mesa, valor_total, valor_recebido_parcial FROM pedidos WHERE id = ? AND empresa_id = ?', [id, empresaId]);
        if (orderRows.length === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado ou não pertence a esta empresa.' });
        }
        currentStatusData = orderRows[0];
    } catch (error) {
        connection.release(); 
        return next(error);
    }

    // Validação: Só pode mudar para 'Entregue' se o valor total foi pago
    if (status === 'Entregue' && parseFloat(currentStatusData.valor_recebido_parcial) < parseFloat(currentStatusData.valor_total)) {
        connection.release();
        return res.status(400).json({ message: `Não é possível mudar para 'Entregue'. Valor total (${currentStatusData.valor_total}) não foi totalmente recebido (Recebido: ${currentStatusData.valor_recebido_parcial}).` });
    }

    // Validação de role para a TRANSIÇÃO
    if (!allowedRolesForStatusChange[requestingUserRole]?.includes(status)) {
        if (!['Proprietario', 'Gerente'].includes(requestingUserRole)) {
            connection.release();
            return res.status(403).json({ message: `Acesso negado. Sua role (${requestingUserRole}) não pode definir este status.` });
        }
    }
    
    // Validação de transição de status (se for Proprietário/Gerente, eles podem forçar transições)
    if (!validStatusTransitions[currentStatusData.status]?.includes(status)) {
        if (!['Proprietario', 'Gerente'].includes(requestingUserRole)) {
            connection.release();
            return res.status(400).json({ message: `Transição de status inválida de '${currentStatusData.status}' para '${status}'.` });
        }
    }

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

        if (status === 'Cancelado' && currentStatusData.status !== 'Cancelado') {
            // Repor estoque dos itens do pedido
            const [itensCancelar] = await connection.query('SELECT id_produto, quantidade FROM itens_pedido WHERE id_pedido = ?', [id]);
            for (const item of itensCancelar) {
                await connection.query('UPDATE produtos SET estoque = estoque + ? WHERE id = ? AND empresa_id = ?', [item.quantidade, item.id_produto, empresaId]);
            }
        }

        if (currentStatusData.id_mesa && (status === 'Entregue' || status === 'Cancelado')) {
            await connection.query(`UPDATE mesas SET status = 'Livre' WHERE id = ? AND empresa_id = ?`, [currentStatusData.id_mesa, empresaId]);
            io.to(`company_${empresaId}`).emit('mesaUpdated', { id: currentStatusData.id_mesa, status: 'Livre' });
        }

        await connection.commit();

        // Se status mudou para "Pronto", verificar se precisa criar rastreamento
        if (status === 'Pronto') {
          // Verificar se rastreamento está ativado
          const [configRows] = await pool.query(
            'SELECT whatsapp_rastreamento_pedido FROM config_empresa WHERE empresa_id = ?',
            [empresaId]
          );

          const rastreamentoAtivado = configRows.length > 0 && configRows[0].whatsapp_rastreamento_pedido === 1;

          if (rastreamentoAtivado) {
            // Criar rastreamento se estiver ativado
            const rastreamentoController = require('./rastreamentoController');
            rastreamentoController.criarRastreamento(id, empresaId).catch(err =>
              console.error(`[Rastreamento ${empresaId}] Erro ao criar rastreamento:`, err)
            );
            // NÃO enviar WhatsApp agora - será enviado quando motoboy iniciar entrega
          } else {
            // Se rastreamento NÃO está ativado, enviar WhatsApp normalmente
            whatsappNotificationService.notifyPedidoStatusChange(empresaId, id, status).catch(err => 
              console.error(`[WhatsApp ${empresaId}] Erro ao enviar notificação de status:`, err)
            );
          }
        } else {
          // Para outros status, enviar notificação normalmente
          whatsappNotificationService.notifyPedidoStatusChange(empresaId, id, status).catch(err => 
            console.error(`[WhatsApp ${empresaId}] Erro ao enviar notificação de status:`, err)
          );
        }

        // Re-buscar pedido completo para emitir o objeto atualizado
        const updatedPedido = await getFullPedidoDetails(connection, id, empresaId);

        io.to(`company_${empresaId}`).emit('orderUpdated', updatedPedido); 
        // Emitir também para a sala do pedido (cliente acompanha)
        io.to(`pedido_${req.params.slug}_${id}`).emit('pedidoUpdated', updatedPedido);

        if (status === 'Entregue' || status === 'Cancelado') {
             io.to(`company_${empresaId}`).emit('orderFinalized', { id: id, numero_pedido: updatedPedido.numero_pedido });
        }

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
    const io = req.io; // Utilizando req.io

    if (!empresaId) {
        return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
    }

    if (requestingUserRole !== 'Proprietario') {
        return res.status(403).json({ message: 'Acesso negado. Apenas o Proprietário pode excluir pedidos.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [pedidoMesaRows] = await connection.query('SELECT id_mesa FROM pedidos WHERE id = ? AND empresa_id = ?', [id, empresaId]);
        const idMesaDoPedido = pedidoMesaRows.length > 0 ? pedidoMesaRows[0].id_mesa : null;

        await connection.query('DELETE FROM itens_pedido WHERE id_pedido = ?', [id]);
        await connection.query('DELETE FROM pagamentos WHERE id_pedido = ?', [id]);

        const [result] = await connection.query('DELETE FROM pedidos WHERE id = ? AND empresa_id = ?', [id, empresaId]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Pedido não encontrado ou não pertence a esta empresa.' });
        }

        if (idMesaDoPedido) {
            await connection.query(`UPDATE mesas SET status = 'Livre' WHERE id = ? AND empresa_id = ?`, [idMesaDoPedido, empresaId]);
            io.to(`company_${empresaId}`).emit('mesaUpdated', { id: idMesaDoPedido, status: 'Livre' });
        }

        await connection.commit();

        io.to(`company_${empresaId}`).emit('orderDeleted', { id: id });

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
    const io = req.io; // Utilizando req.io

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

        const [pedidosRows] = await connection.query('SELECT valor_total, valor_recebido_parcial, id_mesa, status FROM pedidos WHERE id = ? AND empresa_id = ?', [pedidoId, empresaId]);
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

        // Buscar a forma de pagamento para aplicar o desconto
        const [formaPagamentoRows] = await connection.query('SELECT porcentagem_desconto_geral FROM formas_pagamento WHERE id = ?', [forma_pagamento_id]);
        const porcentagemDesconto = formaPagamentoRows.length > 0 ? parseFloat(formaPagamentoRows[0].porcentagem_desconto_geral) : 0;

        let valorTotalPedidoComDesconto = parseFloat(pedido.valor_total);
        if (porcentagemDesconto > 0) {
            valorTotalPedidoComDesconto *= (1 - (porcentagemDesconto / 100));
        }

        // 2. Registrar o pagamento na tabela `pagamentos`
        await connection.query(
            `INSERT INTO pagamentos (empresa_id, id_pedido, id_forma_pagamento, valor_pago, observacoes) VALUES (?, ?, ?, ?, ?)`,
            [empresaId, pedidoId, forma_pagamento_id, parseFloat(valor_pago), observacoes_pagamento || null]
        );

        // 3. ATUALIZAR o valor_recebido_parcial do pedido
        const novoValorRecebidoParcial = parseFloat(pedido.valor_recebido_parcial) + parseFloat(valor_pago);
        await connection.query(`UPDATE pedidos SET valor_recebido_parcial = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ? AND empresa_id = ?`, [novoValorRecebidoParcial, pedidoId, empresaId]);

        // 4. Se o valor recebido parcial agora é >= valor_total_COM_DESCONTO, mude o status para 'Entregue'
        let novoStatus = pedido.status;
        if (novoValorRecebidoParcial >= valorTotalPedidoComDesconto) { // AQUI A VALIDAÇÃO CRÍTICA COM DESCONTO
            novoStatus = 'Entregue';
            let atualizarparcial = 0.0;
            await connection.query(`UPDATE pedidos SET status = ?, data_atualizacao = CURRENT_TIMESTAMP , valor_recebido_parcial = ?  WHERE id = ? AND empresa_id = ?`, [novoStatus,atualizarparcial, pedidoId, empresaId]);
            
            // Enviar notificação WhatsApp de mudança de status
            // Quando status for "Pronto", a função já trata como "Saiu para Entrega" e usa a config correta
            whatsappNotificationService.notifyPedidoStatusChange(empresaId, pedidoId, novoStatus).catch(err => 
                console.error(`[WhatsApp ${empresaId}] Erro ao enviar notificação de status:`, err)
            );
            
            // Se o status for 'Entregue' e for um pedido de MESA, liberar a mesa
            if (pedido.id_mesa) {
                await connection.query(`UPDATE mesas SET status = 'Livre' WHERE id = ? AND empresa_id = ?`, [pedido.id_mesa, empresaId]);
                io.to(`company_${empresaId}`).emit('mesaUpdated', { id: pedido.id_mesa, status: 'Livre' });
            }
        }


        await connection.commit();

        // Re-buscar pedido completo para emitir o objeto atualizado
        const updatedPedido = await getFullPedidoDetails(connection, pedidoId, empresaId);

        io.to(`company_${empresaId}`).emit('orderUpdated', updatedPedido); 
        if (novoStatus === 'Entregue' || novoStatus === 'Cancelado') { // Se o pedido foi finalizado ou cancelado agora
            io.to(`company_${empresaId}`).emit('orderFinalized', { id: pedidoId, numero_pedido: updatedPedido.numero_pedido });
        }


        res.status(200).json({ 
            message: 'Pagamento registrado com sucesso!',
            valor_recebido_total_no_pedido: novoValorRecebidoParcial, 
            novo_status_pedido: novoStatus
        });

    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};
const addItensToExistingOrder = async (req, res, next) => {
    const { id: pedidoId } = req.params;
    const { itens: newItens } = req.body;
    const empresaId = req.empresa_id;
    const requestingUser = req.user;
    const io = req.io; // Utilizando req.io

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

    // Busca configuração da empresa para estoque
    const [configEstoqueRows] = await connection.query('SELECT permitir_pedidos_estoque_zerado FROM config_empresa WHERE empresa_id = ?', [empresaId]);
    const permitirEstoqueZerado = configEstoqueRows.length > 0 ? parseInt(configEstoqueRows[0].permitir_pedidos_estoque_zerado) : 0;

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
            const [produtoRows] = await connection.query('SELECT preco, promocao, promo_ativa, estoque FROM produtos WHERE id = ? AND empresa_id = ?', [item.id_produto, empresaId]);
            if (produtoRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: `Produto com ID ${item.id_produto} não encontrado ou não pertence a esta empresa.` });
            }
            // Verifica estoque suficiente
            const estoqueAtual = produtoRows[0].estoque;
            if (permitirEstoqueZerado === 0 && estoqueAtual !== null && estoqueAtual < item.quantidade) {
                await connection.rollback();
                return res.status(409).json({ message: `Estoque insuficiente para o produto ID ${item.id_produto}. Disponível: ${estoqueAtual}, solicitado: ${item.quantidade}.` });
            }
            const produtoPreco = parseFloat(produtoRows[0].preco);
            const produtoPromocao = parseFloat(produtoRows[0].promocao);
            const produtoPromoAtiva = produtoRows[0].promo_ativa;

            const precoUnitarioAplicado = (produtoPromoAtiva && produtoPromocao > 0) ? produtoPromocao : produtoPreco;
            novoValorTotalDoPedido += precoUnitarioAplicado * item.quantidade;

            const [itemResult] = await connection.query(
                `INSERT INTO itens_pedido (id_pedido, id_produto, quantidade, preco_unitario, observacoes) VALUES (?, ?, ?, ?, ?)`,
                [pedidoId, item.id_produto, item.quantidade, precoUnitarioAplicado, item.observacoes || null]
            );
            // Desconta estoque
            await connection.query('UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND empresa_id = ?', [item.quantidade, item.id_produto, empresaId]);
            const itemPedidoId = itemResult.insertId;

            // Processar adicionais
            if (item.adicionais && Array.isArray(item.adicionais) && item.adicionais.length > 0) {
                for (const adicional of item.adicionais) {
                    const quantidadeAdicional = adicional.quantidade ? parseInt(adicional.quantidade) : 1;
                    const [addRows] = await connection.query('SELECT preco FROM adicionais WHERE id = ? AND empresa_id = ?', [adicional.id_adicional, empresaId]);
                    if (addRows.length === 0) {
                        await connection.rollback();
                        return res.status(404).json({ message: `Adicional com ID ${adicional.id_adicional} não encontrado ou não pertence a esta empresa.` });
                    }
                    const precoAdicional = parseFloat(addRows[0].preco);
                    novoValorTotalDoPedido += precoAdicional * quantidadeAdicional;

                    await connection.query(
                        `INSERT INTO itens_pedido_adicionais (id_item_pedido, id_adicional, quantidade, preco_unitario_adicional) VALUES (?, ?, ?, ?)`,
                        [itemPedidoId, adicional.id_adicional, quantidadeAdicional, precoAdicional]
                    );
                }
            }
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
        const updatedPedido = await getFullPedidoDetails(connection, pedidoId, empresaId);


        io.to(`company_${empresaId}`).emit('orderUpdated', updatedPedido); 

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

// Função pública para acompanhamento do pedido
const getPedidoPublico = async (req, res) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const connection = await pool.getConnection();
  try {
    const pedido = await getFullPedidoDetails(connection, id, empresaId);
    if (!pedido) {
      return res.status(404).json({ mensagem: 'Pedido não encontrado' });
    }
    // Retornar apenas dados públicos
    res.json({
      id: pedido.id,
      numero_pedido: pedido.numero_pedido,
      status: pedido.status,
      tipo_entrega: pedido.tipo_entrega,
      itens: pedido.itens,
      valor_total: pedido.valor_total,
      taxa_entrega: pedido.taxa_entrega, // Adicionado
      data_pedido: pedido.data_pedido,
      data_atualizacao: pedido.data_atualizacao
    });
  } catch (err) {
    res.status(500).json({ mensagem: 'Erro ao buscar pedido' });
  } finally {
    connection.release();
  }
};

// Atualiza campos de NFC-e de um pedido via integração
const updateNfceByIntegration = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const { id } = req.params;
  let { Nfce, NfceId, NfceEmissao, NfceStatus } = req.body;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Converte NfceEmissao para formato MySQL se enviado
  if (typeof NfceEmissao !== 'undefined' && NfceEmissao) {
    NfceEmissao = formatToMySQLDateTime(NfceEmissao);
  }

  // Monta dinamicamente os campos a serem atualizados
  const fields = [];
  const values = [];
  if (typeof Nfce !== 'undefined') {
    fields.push('Nfce = ?');
    values.push(Nfce);
  }
  if (typeof NfceId !== 'undefined') {
    fields.push('NfceId = ?');
    values.push(NfceId);
  }
  if (typeof NfceEmissao !== 'undefined') {
    fields.push('NfceEmissao = ?');
    values.push(NfceEmissao);
  }
  if (typeof NfceStatus !== 'undefined') {
    fields.push('NfceStatus = ?');
    values.push(NfceStatus);
  }
  if (fields.length === 0) {
    return res.status(400).json({ message: 'Nenhum campo de NFC-e enviado para atualização.' });
  }
  values.push(id, empresaId);

  try {
    const [result] = await pool.query(
      `UPDATE pedidos SET ${fields.join(', ')} WHERE id = ? AND empresa_id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Pedido não encontrado ou não pertence a esta empresa.' });
    }
    res.status(200).json({ message: 'Dados de NFC-e atualizados com sucesso!' });
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
    getPedidoPublico,
    updateNfceByIntegration // Exporta a nova função
};