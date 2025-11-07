// Controller para gerenciar rastreamento de entrega
const { pool } = require('../config/db');
const whatsappNotificationService = require('../services/whatsappNotificationService');

// Função auxiliar para obter coordenadas do destino do pedido
const getCoordenadasDestino = (pedido) => {
  // Prioridade: latitude_destino > latitude_entrega > endereco_latitude > lat_destino
  const latitudeDestino = pedido?.latitude_destino || 
                          pedido?.latitude_entrega || 
                          pedido?.endereco_latitude || 
                          pedido?.lat_destino || 
                          null;
  
  const longitudeDestino = pedido?.longitude_destino || 
                           pedido?.longitude_entrega || 
                           pedido?.endereco_longitude || 
                           pedido?.lng_destino || 
                           null;

  return {
    latitude_destino: latitudeDestino ? parseFloat(latitudeDestino) : null,
    longitude_destino: longitudeDestino ? parseFloat(longitudeDestino) : null
  };
};

// Criar rastreamento quando pedido muda para "Pronto" (se rastreamento ativado)
const criarRastreamento = async (pedidoId, empresaId) => {
  try {
    // Verificar se rastreamento já existe
    const [existing] = await pool.query(
      'SELECT id FROM rastreamento_entrega WHERE pedido_id = ? AND empresa_id = ?',
      [pedidoId, empresaId]
    );

    if (existing.length > 0) {
      return existing[0].id;
    }

    // Criar novo rastreamento
    const [result] = await pool.query(
      'INSERT INTO rastreamento_entrega (pedido_id, empresa_id, status) VALUES (?, ?, ?)',
      [pedidoId, empresaId, 'pendente']
    );

    return result.insertId;
  } catch (error) {
    console.error(`[Rastreamento] Erro ao criar rastreamento:`, error);
    return null;
  }
};

// Iniciar rastreamento (motoboy inicia entrega)
const iniciarRastreamento = async (req, res, next) => {
  const { id } = req.params; // pedido_id
  const { slug } = req.params; // slug da empresa
  const empresaId = req.empresa_id;
  const io = req.io; // Instância do Socket.IO

  try {
    // 1. Verificar se o pedido existe
    const [pedidoRows] = await pool.query(
      'SELECT id, numero_pedido, status FROM pedidos WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (pedidoRows.length === 0) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    const pedido = pedidoRows[0];

    // 2. Buscar rastreamento
    const [rastreamentoRows] = await pool.query(
      `SELECT r.*, p.numero_pedido, p.status as pedido_status
       FROM rastreamento_entrega r
       JOIN pedidos p ON r.pedido_id = p.id
       WHERE r.pedido_id = ? AND r.empresa_id = ?`,
      [id, empresaId]
    );

    let rastreamento;
    let criadoAutomaticamente = false;

    // 3. Se rastreamento não existir, criar automaticamente
    if (rastreamentoRows.length === 0) {
      console.log(`⚠️ [Rastreamento ${empresaId}] Rastreamento não encontrado para pedido ${id} - criando automaticamente`);
      
      // Criar rastreamento automaticamente
      const [result] = await pool.query(
        'INSERT INTO rastreamento_entrega (pedido_id, empresa_id, status) VALUES (?, ?, ?)',
        [id, empresaId, 'pendente']
      );

      // Buscar o rastreamento recém-criado
      const [novoRastreamentoRows] = await pool.query(
        `SELECT r.*, p.numero_pedido, p.status as pedido_status
         FROM rastreamento_entrega r
         JOIN pedidos p ON r.pedido_id = p.id
         WHERE r.id = ?`,
        [result.insertId]
      );

      rastreamento = novoRastreamentoRows[0];
      criadoAutomaticamente = true;
      
      console.log(`✅ [Rastreamento ${empresaId}] Rastreamento criado automaticamente para pedido ${id} (rastreamento_id: ${rastreamento.id})`);
    } else {
      rastreamento = rastreamentoRows[0];
    }

    if (rastreamento.status !== 'pendente') {
      return res.status(400).json({ message: `Rastreamento já está ${rastreamento.status}` });
    }

    // Atualizar status para "em_entrega" e data_inicio
    await pool.query(
      `UPDATE rastreamento_entrega 
       SET status = 'em_entrega', data_inicio = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [rastreamento.id]
    );

    // Buscar rastreamento atualizado para emitir via Socket.IO
    // Usando COALESCE para garantir compatibilidade caso campos não existam ainda
    const [rastreamentoAtualizado] = await pool.query(
      `SELECT r.*, 
              p.numero_pedido,
              COALESCE(p.latitude_destino, p.latitude_entrega, p.endereco_latitude, p.lat_destino) as latitude_destino,
              COALESCE(p.longitude_destino, p.longitude_entrega, p.endereco_longitude, p.lng_destino) as longitude_destino,
              p.latitude_entrega,
              p.longitude_entrega,
              p.endereco_latitude,
              p.endereco_longitude,
              p.lat_destino,
              p.lng_destino
       FROM rastreamento_entrega r
       JOIN pedidos p ON r.pedido_id = p.id
       WHERE r.id = ?`,
      [rastreamento.id]
    );

    const rastreamentoCompleto = rastreamentoAtualizado[0] || rastreamento;
    const coordenadasDestino = getCoordenadasDestino(rastreamentoCompleto);

    // Emitir evento Socket.IO para a sala do rastreamento público
    if (io && slug) {
      const room = `rastreamento:${slug}:pedido:${id}`;
      io.to(room).emit('rastreamento_updated', {
        rastreamento: {
          id: rastreamentoCompleto.id,
          status: 'em_entrega',
          latitude: rastreamentoCompleto.latitude,
          longitude: rastreamentoCompleto.longitude,
          latitude_destino: coordenadasDestino.latitude_destino,
          longitude_destino: coordenadasDestino.longitude_destino,
          data_inicio: rastreamentoCompleto.data_inicio,
          numero_pedido: rastreamentoCompleto.numero_pedido
        },
        pedidoId: parseInt(id)
      });
      console.log(`[Socket] Evento emitido para sala ${room}: rastreamento_updated (iniciado)`);
    }

    // Buscar dados do pedido para enviar WhatsApp
    const [pedidoWhatsAppRows] = await pool.query(
      `SELECT p.id, p.numero_pedido, p.tipo_entrega, p.valor_total,
              p.nome_cliente_convidado, p.taxa_entrega, p.troco,
              p.endereco_entrega, p.complemento_entrega, p.numero_entrega,
              c.telefone as telefone_cliente, c.nome as nome_cliente
       FROM pedidos p
       LEFT JOIN clientes c ON p.id_cliente = c.id
       WHERE p.id = ? AND p.empresa_id = ?`,
      [id, empresaId]
    );

    if (pedidoWhatsAppRows.length > 0) {
      const pedidoWhatsApp = pedidoWhatsAppRows[0];
      const telefoneCliente = pedidoWhatsApp.telefone_cliente;
      
      // Enviar WhatsApp de "Saiu para Entrega" quando motoboy iniciar entrega
      if (telefoneCliente) {
        whatsappNotificationService.notifyPedidoSaiuParaEntrega(empresaId, id).catch(err => 
          console.error(`[WhatsApp ${empresaId}] Erro ao enviar notificação de entrega:`, err)
        );
      }
    }

    res.status(200).json({
      message: criadoAutomaticamente 
        ? 'Rastreamento criado e iniciado com sucesso' 
        : 'Rastreamento iniciado com sucesso',
      rastreamento: {
        id: rastreamento.id,
        pedido_id: parseInt(id),
        status: 'em_entrega',
        data_inicio: new Date(),
        criado_automaticamente: criadoAutomaticamente // Flag opcional para indicar que foi criado automaticamente
      }
    });

  } catch (error) {
    console.error(`[Rastreamento] Erro ao iniciar rastreamento:`, error);
    next(error);
  }
};

// Atualizar localização do motoboy
const atualizarLocalizacao = async (req, res, next) => {
  const { id } = req.params; // pedido_id
  const { slug } = req.params; // slug da empresa
  const { latitude, longitude } = req.body;
  const empresaId = req.empresa_id;
  const io = req.io; // Instância do Socket.IO

  try {
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude e longitude são obrigatórias' });
    }

    // Buscar rastreamento (verificar se existe e qual o status)
    const [rastreamentoRows] = await pool.query(
      'SELECT id, status FROM rastreamento_entrega WHERE pedido_id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (rastreamentoRows.length === 0) {
      return res.status(404).json({ 
        message: 'Rastreamento não encontrado para este pedido. Certifique-se de que o pedido está com status "Pronto" e o rastreamento foi iniciado.',
        error: 'RASTREAMENTO_NAO_ENCONTRADO'
      });
    }

    const rastreamento = rastreamentoRows[0];
    
    if (rastreamento.status !== 'em_entrega') {
      return res.status(400).json({ 
        message: `Rastreamento não está em andamento. Status atual: ${rastreamento.status}. É necessário iniciar a entrega primeiro.`,
        error: 'RASTREAMENTO_NAO_INICIADO',
        status_atual: rastreamento.status
      });
    }

    const rastreamentoId = rastreamento.id;

    // Atualizar localização atual
    await pool.query(
      `UPDATE rastreamento_entrega 
       SET latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [parseFloat(latitude), parseFloat(longitude), rastreamentoId]
    );

    // Salvar no histórico
    await pool.query(
      'INSERT INTO rastreamento_localizacao (rastreamento_id, latitude, longitude) VALUES (?, ?, ?)',
      [rastreamentoId, parseFloat(latitude), parseFloat(longitude)]
    );

    // Emitir evento Socket.IO para a sala do rastreamento público
    if (io && slug) {
      const room = `rastreamento:${slug}:pedido:${id}`;
      io.to(room).emit('localizacao_updated', {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        pedidoId: parseInt(id),
        timestamp: new Date().toISOString()
      });
      console.log(`[Socket] Evento emitido para sala ${room}: localizacao_updated`);
    }

    res.status(200).json({
      message: 'Localização atualizada com sucesso',
      localizacao: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error(`[Rastreamento] Erro ao atualizar localização:`, error);
    next(error);
  }
};

// Marcar como entregue (motoboy entrega pedido)
const marcarEntregue = async (req, res, next) => {
  const { id } = req.params; // pedido_id
  const { slug } = req.params; // slug da empresa
  const { observacoes } = req.body;
  const empresaId = req.empresa_id;
  const io = req.io; // Instância do Socket.IO

  try {
    // Buscar rastreamento
    const [rastreamentoRows] = await pool.query(
      `SELECT r.*, p.numero_pedido, p.status as pedido_status
       FROM rastreamento_entrega r
       JOIN pedidos p ON r.pedido_id = p.id
       WHERE r.pedido_id = ? AND r.empresa_id = ?`,
      [id, empresaId]
    );

    if (rastreamentoRows.length === 0) {
      return res.status(404).json({ message: 'Rastreamento não encontrado para este pedido' });
    }

    const rastreamento = rastreamentoRows[0];

    if (rastreamento.status === 'entregue') {
      return res.status(400).json({ message: 'Pedido já foi marcado como entregue' });
    }

    // Atualizar status para "entregue" e data_entrega
    await pool.query(
      `UPDATE rastreamento_entrega 
       SET status = 'entregue', data_entrega = CURRENT_TIMESTAMP, observacoes = ?
       WHERE id = ?`,
      [observacoes || null, rastreamento.id]
    );

    // Buscar rastreamento atualizado para emitir via Socket.IO
    // Usando COALESCE para garantir compatibilidade caso campos não existam ainda
    const [rastreamentoAtualizado] = await pool.query(
      `SELECT r.*, 
              p.numero_pedido,
              COALESCE(p.latitude_destino, p.latitude_entrega, p.endereco_latitude, p.lat_destino) as latitude_destino,
              COALESCE(p.longitude_destino, p.longitude_entrega, p.endereco_longitude, p.lng_destino) as longitude_destino,
              p.latitude_entrega,
              p.longitude_entrega,
              p.endereco_latitude,
              p.endereco_longitude,
              p.lat_destino,
              p.lng_destino
       FROM rastreamento_entrega r
       JOIN pedidos p ON r.pedido_id = p.id
       WHERE r.id = ?`,
      [rastreamento.id]
    );

    const rastreamentoCompleto = rastreamentoAtualizado[0] || rastreamento;
    const coordenadasDestino = getCoordenadasDestino(rastreamentoCompleto);

    // Emitir evento Socket.IO para a sala do rastreamento público
    if (io && slug) {
      const room = `rastreamento:${slug}:pedido:${id}`;
      io.to(room).emit('rastreamento_updated', {
        rastreamento: {
          id: rastreamentoCompleto.id,
          status: 'entregue',
          latitude: rastreamentoCompleto.latitude,
          longitude: rastreamentoCompleto.longitude,
          latitude_destino: coordenadasDestino.latitude_destino,
          longitude_destino: coordenadasDestino.longitude_destino,
          data_inicio: rastreamentoCompleto.data_inicio,
          data_entrega: rastreamentoCompleto.data_entrega,
          numero_pedido: rastreamentoCompleto.numero_pedido
        },
        pedidoId: parseInt(id)
      });
      console.log(`[Socket] Evento emitido para sala ${room}: rastreamento_updated (entregue)`);
    }

    // Buscar dados do pedido para enviar WhatsApp
    const [pedidoRows] = await pool.query(
      `SELECT p.id, p.numero_pedido,
              c.telefone as telefone_cliente, c.nome as nome_cliente
       FROM pedidos p
       LEFT JOIN clientes c ON p.id_cliente = c.id
       WHERE p.id = ? AND p.empresa_id = ?`,
      [id, empresaId]
    );

    if (pedidoRows.length > 0) {
      const pedido = pedidoRows[0];
      const telefoneCliente = pedido.telefone_cliente;
      
      // Enviar WhatsApp avisando que entregou (SEM mudar status do pedido)
      if (telefoneCliente) {
        const mensagem = `🎉 *Pedido Entregue!*\n\n` +
          `📋 Pedido #${pedido.numero_pedido || pedido.id}\n\n` +
          `✅ Seu pedido foi *entregue* com sucesso!\n\n` +
          `Esperamos que tenha gostado! Obrigado pela preferência! 🍽️`;

        // Enviar mensagem diretamente (sem usar a função de status, pois não muda status)
        const whatsappManager = require('../services/whatsappManager');
        if (whatsappManager.isConnected(empresaId)) {
          whatsappManager.sendMessage(empresaId, telefoneCliente, mensagem).catch(err => 
            console.error(`[WhatsApp ${empresaId}] Erro ao enviar notificação de entrega:`, err)
          );
        }
      }
    }

    res.status(200).json({
      message: 'Pedido marcado como entregue com sucesso',
      rastreamento: {
        id: rastreamento.id,
        pedido_id: parseInt(id),
        status: 'entregue',
        data_entrega: new Date()
      }
    });

    // IMPORTANTE: NÃO muda status do pedido para "Entregue"
    // Status do pedido continua "Pronto"

  } catch (error) {
    console.error(`[Rastreamento] Erro ao marcar como entregue:`, error);
    next(error);
  }
};

// Obter status do rastreamento (público - cliente)
const getStatusRastreamento = async (req, res, next) => {
  const { id } = req.params; // pedido_id
  const { slug } = req.params;

  try {
    // Buscar empresa_id pelo slug
    const [empresaRows] = await pool.query(
      'SELECT id FROM empresas WHERE slug = ?',
      [slug]
    );

    if (empresaRows.length === 0) {
      return res.status(404).json({ message: 'Empresa não encontrada' });
    }

    const empresaId = empresaRows[0].id;

    // Buscar rastreamento com coordenadas do destino do pedido
    // Usando COALESCE para garantir compatibilidade caso campos não existam ainda
    const [rastreamentoRows] = await pool.query(
      `SELECT r.*, 
              p.numero_pedido, 
              p.endereco_entrega, 
              p.complemento_entrega, 
              p.numero_entrega,
              COALESCE(p.latitude_destino, p.latitude_entrega, p.endereco_latitude, p.lat_destino) as latitude_destino,
              COALESCE(p.longitude_destino, p.longitude_entrega, p.endereco_longitude, p.lng_destino) as longitude_destino,
              p.latitude_entrega,
              p.longitude_entrega,
              p.endereco_latitude,
              p.endereco_longitude,
              p.lat_destino,
              p.lng_destino
       FROM rastreamento_entrega r
       JOIN pedidos p ON r.pedido_id = p.id
       WHERE r.pedido_id = ? AND r.empresa_id = ?`,
      [id, empresaId]
    );

    if (rastreamentoRows.length === 0) {
      return res.status(404).json({ message: 'Rastreamento não encontrado' });
    }

    const rastreamento = rastreamentoRows[0];

    // Obter coordenadas do destino (prioridade: latitude_destino > latitude_entrega > endereco_latitude > lat_destino)
    const latitudeDestino = rastreamento.latitude_destino || 
                            rastreamento.latitude_entrega || 
                            rastreamento.endereco_latitude || 
                            rastreamento.lat_destino || 
                            null;
    
    const longitudeDestino = rastreamento.longitude_destino || 
                             rastreamento.longitude_entrega || 
                             rastreamento.endereco_longitude || 
                             rastreamento.lng_destino || 
                             null;

    // Buscar últimas 20 localizações do histórico
    const [localizacoes] = await pool.query(
      `SELECT latitude, longitude, timestamp 
       FROM rastreamento_localizacao 
       WHERE rastreamento_id = ? 
       ORDER BY timestamp DESC 
       LIMIT 20`,
      [rastreamento.id]
    );

    res.status(200).json({
      rastreamento: {
        id: rastreamento.id,
        pedido_id: parseInt(id),
        numero_pedido: rastreamento.numero_pedido,
        status: rastreamento.status,
        latitude: rastreamento.latitude, // Coordenadas do MOTOBOY
        longitude: rastreamento.longitude, // Coordenadas do MOTOBOY
        latitude_destino: latitudeDestino ? parseFloat(latitudeDestino) : null, // Coordenadas do DESTINO (PEDIDO)
        longitude_destino: longitudeDestino ? parseFloat(longitudeDestino) : null, // Coordenadas do DESTINO (PEDIDO)
        data_inicio: rastreamento.data_inicio,
        data_entrega: rastreamento.data_entrega,
        endereco_entrega: rastreamento.endereco_entrega,
        historico: localizacoes.reverse() // Mais antiga primeiro
      }
    });

  } catch (error) {
    console.error(`[Rastreamento] Erro ao buscar status:`, error);
    next(error);
  }
};

// Listar pedidos para motoboy (com rastreamento pendente ou em andamento)
const listarPedidosMotoboy = async (req, res, next) => {
  const empresaId = req.empresa_id;

  try {
    const [pedidosRows] = await pool.query(
      `SELECT 
          p.id, p.numero_pedido, p.status, p.tipo_entrega, p.valor_total,
          p.nome_cliente_convidado, p.endereco_entrega, p.complemento_entrega, p.numero_entrega,
          p.data_pedido,
          c.nome as nome_cliente, c.telefone as telefone_cliente,
          r.id as rastreamento_id, r.status as rastreamento_status, r.data_inicio
       FROM pedidos p
       LEFT JOIN clientes c ON p.id_cliente = c.id
       LEFT JOIN rastreamento_entrega r ON p.id = r.pedido_id
       WHERE p.empresa_id = ? 
         AND p.status = 'Pronto'
         AND p.tipo_entrega = 'Delivery'
         AND (r.id IS NULL OR r.status IN ('pendente', 'em_entrega'))
       ORDER BY p.data_pedido DESC`,
      [empresaId]
    );

    res.status(200).json({
      pedidos: pedidosRows.map(pedido => ({
        id: pedido.id,
        numero_pedido: pedido.numero_pedido,
        status: pedido.status,
        tipo_entrega: pedido.tipo_entrega,
        valor_total: parseFloat(pedido.valor_total || 0),
        cliente: pedido.nome_cliente || pedido.nome_cliente_convidado || 'Cliente',
        telefone: pedido.telefone_cliente || null,
        endereco: pedido.endereco_entrega 
          ? `${pedido.endereco_entrega}${pedido.numero_entrega ? ', ' + pedido.numero_entrega : ''}${pedido.complemento_entrega ? ' - ' + pedido.complemento_entrega : ''}`
          : null,
        data_pedido: pedido.data_pedido,
        rastreamento: pedido.rastreamento_id ? {
          id: pedido.rastreamento_id,
          status: pedido.rastreamento_status,
          data_inicio: pedido.data_inicio
        } : null
      }))
    });

  } catch (error) {
    console.error(`[Rastreamento] Erro ao listar pedidos:`, error);
    next(error);
  }
};

module.exports = {
  criarRastreamento,
  iniciarRastreamento,
  atualizarLocalizacao,
  marcarEntregue,
  getStatusRastreamento,
  listarPedidosMotoboy
};

