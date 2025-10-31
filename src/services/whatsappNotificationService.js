// Serviço para enviar notificações automáticas via WhatsApp
const whatsappManager = require('./whatsappManager');
const { pool } = require('../config/db');
const dotenv = require('dotenv');

dotenv.config();

class WhatsAppNotificationService {
  // Gerar link para acompanhar pedido
  async getTrackingLink(empresaId, pedidoId) {
    try {
      // Buscar slug da empresa
      const [empresaRows] = await pool.query(
        'SELECT slug FROM empresas WHERE id = ?',
        [empresaId]
      );

      if (empresaRows.length === 0) {
        return null;
      }

      const slug = empresaRows[0].slug;
      
      // URL base do front-end (pode ser configurada via variável de ambiente)
      const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://athospp.com.br';
      
      // Gerar link para acompanhar pedido
      // Opção 1: Link para página de acompanhamento do front-end
      const trackingLink = `${frontendUrl}/${slug}/acompanhar/${pedidoId}`;
      
      return trackingLink;
    } catch (error) {
      console.error(`[WhatsApp ${empresaId}] Erro ao gerar link de acompanhamento:`, error);
      return null;
    }
  }
  // Verificar se deve enviar notificação baseado nas configurações da empresa
  async shouldSendNotification(empresaId, notificationType) {
    try {
      const [configRows] = await pool.query(
        `SELECT whatsapp_enviar_novo_pedido, whatsapp_enviar_status_pedido, whatsapp_enviar_saiu_entrega
         FROM config_empresa WHERE empresa_id = ?`,
        [empresaId]
      );

      if (configRows.length === 0) {
        return false;
      }

      const config = configRows[0];
      
      switch (notificationType) {
        case 'novo_pedido':
          return config.whatsapp_enviar_novo_pedido === 1;
        case 'status_pedido':
          return config.whatsapp_enviar_status_pedido === 1;
        case 'saiu_entrega':
          return config.whatsapp_enviar_saiu_entrega === 1;
        default:
          return false;
      }
    } catch (error) {
      console.error(`[WhatsApp ${empresaId}] Erro ao verificar configurações:`, error);
      return false;
    }
  }

  // Enviar notificação de novo pedido recebido
  async notifyNewPedido(empresaId, pedidoData) {
    try {
      // Verificar configuração da empresa
      if (!(await this.shouldSendNotification(empresaId, 'novo_pedido'))) {
        return { success: false, message: 'Notificação de novo pedido desabilitada nas configurações' };
      }

      // Verificar se WhatsApp está conectado para esta empresa
      if (!whatsappManager.isConnected(empresaId)) {
        console.log(`[WhatsApp ${empresaId}] WhatsApp não está conectado. Pulando notificação.`);
        return { success: false, message: 'WhatsApp não está conectado' };
      }

      // Buscar telefone do cliente no pedido
      const telefoneCliente = pedidoData.telefone_cliente || pedidoData.telefone;
      
      if (!telefoneCliente) {
        return { success: false, message: 'Telefone do cliente não encontrado' };
      }

      // Gerar link de acompanhamento
      const trackingLink = await this.getTrackingLink(empresaId, pedidoData.id);
      const linkTexto = trackingLink ? `\n🔗 Acompanhe seu pedido: ${trackingLink}` : '';

      // Calcular valor total com taxa de entrega
      const valorBase = parseFloat(pedidoData.valor_total || 0);
      const taxaEntrega = parseFloat(pedidoData.taxa_entrega || 0);
      const valorTotalComTaxa = valorBase + taxaEntrega;

      // Montar linha de valor
      let valorTexto = `💰 Valor Total: R$ ${valorTotalComTaxa.toFixed(2)}`;
      if (taxaEntrega > 0) {
        valorTexto += `\n   (Pedido: R$ ${valorBase.toFixed(2)} + Taxa de entrega: R$ ${taxaEntrega.toFixed(2)})`;
      }

      // Formatar mensagem
      const mensagem = `🍽️ *Novo Pedido Recebido!*\n\n` +
        `📋 Pedido #${pedidoData.numero_pedido || pedidoData.id}\n` +
        `👤 Cliente: ${pedidoData.nome_cliente || 'Cliente'}\n` +
        `📱 Telefone: ${telefoneCliente}\n` +
        `${valorTexto}\n` +
        `🚚 Tipo: ${pedidoData.tipo_entrega || 'Não informado'}\n\n` +
        `Seu pedido foi recebido e está sendo preparado! 🎉${linkTexto}\n\n` +
        `Obrigado pela preferência!`;

      const result = await whatsappManager.sendMessage(empresaId, telefoneCliente, mensagem);
      return result;

    } catch (error) {
      console.error(`[WhatsApp ${empresaId}] Erro ao enviar notificação de novo pedido:`, error);
      return { success: false, message: error.message };
    }
  }

  // Enviar notificação de mudança de status do pedido
  async notifyPedidoStatusChange(empresaId, pedidoId, novoStatus) {
    try {
      // Status "Pronto" usa a configuração de "saiu para entrega"
      let shouldSend = false;
      let notificationType = 'status_pedido';
      
      if (novoStatus === 'Pronto') {
        // Quando status for "Pronto", verifica configuração de "saiu para entrega"
        notificationType = 'saiu_entrega';
        shouldSend = await this.shouldSendNotification(empresaId, 'saiu_entrega');
      } else {
        // Para outros status, usa configuração normal de status
        shouldSend = await this.shouldSendNotification(empresaId, 'status_pedido');
      }

      if (!shouldSend) {
        return { success: false, message: 'Notificação desabilitada nas configurações' };
      }

      if (!whatsappManager.isConnected(empresaId)) {
        return { success: false, message: 'WhatsApp não está conectado' };
      }

      // Buscar dados do pedido
      const [pedidoRows] = await pool.query(
        `SELECT p.id, p.numero_pedido, p.status, p.tipo_entrega, p.valor_total,
                p.nome_cliente_convidado, p.taxa_entrega, p.troco,
                p.endereco_entrega, p.complemento_entrega, p.numero_entrega,
                c.telefone as telefone_cliente, c.nome as nome_cliente
         FROM pedidos p
         LEFT JOIN clientes c ON p.id_cliente = c.id
         WHERE p.id = ? AND p.empresa_id = ?`,
        [pedidoId, empresaId]
      );

      if (pedidoRows.length === 0) {
        return { success: false, message: 'Pedido não encontrado' };
      }

      const pedido = pedidoRows[0];
      const telefoneCliente = pedido.telefone_cliente;
      
      if (!telefoneCliente) {
        return { success: false, message: 'Telefone do cliente não encontrado' };
      }

      // Gerar link de acompanhamento
      const trackingLink = await this.getTrackingLink(empresaId, pedidoId);

      // Se status for "Pronto", verificar se rastreamento está ativado
      if (novoStatus === 'Pronto') {
        // Verificar se rastreamento está ativado
        const [configRows] = await pool.query(
          'SELECT whatsapp_rastreamento_pedido FROM config_empresa WHERE empresa_id = ?',
          [empresaId]
        );

        const rastreamentoAtivado = configRows.length > 0 && configRows[0].whatsapp_rastreamento_pedido === 1;

        // Se rastreamento está ativado, NÃO enviar mensagem agora
        // A mensagem será enviada quando motoboy iniciar entrega
        if (rastreamentoAtivado) {
          return { success: false, message: 'Rastreamento ativado - Mensagem será enviada quando motoboy iniciar entrega' };
        }

        // Se rastreamento NÃO está ativado, enviar mensagem normalmente
        // Continua com a lógica de mensagem de entrega
        let enderecoTexto = '';
        if (pedido.endereco_entrega) {
          enderecoTexto = `\n📍 Endereço: ${pedido.endereco_entrega}`;
          if (pedido.numero_entrega) enderecoTexto += `, ${pedido.numero_entrega}`;
          if (pedido.complemento_entrega) enderecoTexto += ` - ${pedido.complemento_entrega}`;
        }

        const linkTexto = trackingLink ? `\n\n🔗 Acompanhe seu pedido:\n${trackingLink}` : '';

        // Calcular valor total com taxa de entrega
        const valorBase = parseFloat(pedido.valor_total || 0);
        const taxaEntrega = parseFloat(pedido.taxa_entrega || 0);
        const valorTotalComTaxa = valorBase + taxaEntrega;

        // Montar linha de valor
        let valorTexto = `💰 Valor: R$ ${valorTotalComTaxa.toFixed(2)}`;
        if (taxaEntrega > 0) {
          valorTexto += `\n   (Pedido: R$ ${valorBase.toFixed(2)} + Taxa de entrega: R$ ${taxaEntrega.toFixed(2)})`;
        }

        // Mostrar troco apenas se existir e for maior que zero
        let trocoTexto = '';
        const troco = parseFloat(pedido.troco || 0);
        if (troco > 0) {
          trocoTexto = `\n💵 Troco: R$ ${troco.toFixed(2)}`;
        }

        const mensagem = `🛵 *Pedido Saiu para Entrega!*\n\n` +
          `📋 Pedido #${pedido.numero_pedido || pedido.id}\n` +
          `👤 Cliente: ${pedido.nome_cliente || pedido.nome_cliente_convidado || 'Cliente'}\n` +
          `${enderecoTexto}\n\n` +
          `🛵 Nosso motoboy está a caminho! Em breve você receberá seu pedido.\n\n` +
          `${valorTexto}${trocoTexto}${linkTexto}\n\n` +
          `Mantenha seu telefone por perto para facilitar a entrega! 📱`;

        const result = await whatsappManager.sendMessage(empresaId, telefoneCliente, mensagem);
        return result;
      }

      // Para outros status, usar mensagens normais
      const statusMessages = {
        'Pendente': '⏳ Seu pedido está *pendente* e aguardando confirmação.',
        'Em Preparação': '👨‍🍳 Seu pedido está *em preparação*! Logo estará pronto.',
        'Entregue': '🎉 Seu pedido foi *entregue*! Aproveite sua refeição!',
        'Cancelado': '❌ Infelizmente seu pedido foi *cancelado*. Entre em contato conosco para mais informações.'
      };

      const mensagemStatus = statusMessages[novoStatus] || `Status do pedido alterado para: *${novoStatus}*`;

      const linkTexto = trackingLink ? `\n\n🔗 Acompanhe seu pedido em tempo real:\n${trackingLink}` : '\n\nAcompanhe seu pedido em tempo real no nosso sistema!';

      const mensagem = `🍽️ *Atualização do Pedido*\n\n` +
        `📋 Pedido #${pedido.numero_pedido || pedido.id}\n\n` +
        `${mensagemStatus}${linkTexto}`;

      const result = await whatsappManager.sendMessage(empresaId, telefoneCliente, mensagem);
      return result;

    } catch (error) {
      console.error(`[WhatsApp ${empresaId}] Erro ao enviar notificação de status:`, error);
      return { success: false, message: error.message };
    }
  }

  // Enviar notificação quando pedido sair para entrega
  async notifyPedidoSaiuParaEntrega(empresaId, pedidoId) {
    try {
      // Verificar configuração da empresa
      if (!(await this.shouldSendNotification(empresaId, 'saiu_entrega'))) {
        return { success: false, message: 'Notificação de saída para entrega desabilitada nas configurações' };
      }

      if (!whatsappManager.isConnected(empresaId)) {
        return { success: false, message: 'WhatsApp não está conectado' };
      }

      const [pedidoRows] = await pool.query(
        `SELECT p.id, p.numero_pedido, p.tipo_entrega, p.valor_total,
                p.nome_cliente_convidado, p.taxa_entrega, p.troco,
                p.endereco_entrega, p.complemento_entrega, p.numero_entrega,
                c.telefone as telefone_cliente, c.nome as nome_cliente
         FROM pedidos p
         LEFT JOIN clientes c ON p.id_cliente = c.id
         WHERE p.id = ? AND p.empresa_id = ?`,
        [pedidoId, empresaId]
      );

      if (pedidoRows.length === 0) {
        return { success: false, message: 'Pedido não encontrado' };
      }

      const pedido = pedidoRows[0];
      const telefoneCliente = pedido.telefone_cliente;
      
      if (!telefoneCliente) {
        return { success: false, message: 'Telefone do cliente não encontrado' };
      }

      // Gerar link de rastreamento
      const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://athospp.com.br';
      const [empresaRows] = await pool.query(
        'SELECT slug FROM empresas WHERE id = ?',
        [empresaId]
      );
      const slug = empresaRows.length > 0 ? empresaRows[0].slug : '';
      const rastreamentoLink = `${frontendUrl}/${slug}/rastrear/${pedidoId}`;
      const linkTexto = `\n\n🔗 Rastreie seu pedido em tempo real:\n${rastreamentoLink}`;

      let enderecoTexto = '';
      if (pedido.endereco_entrega) {
        enderecoTexto = `\n📍 Endereço: ${pedido.endereco_entrega}`;
        if (pedido.numero_entrega) enderecoTexto += `, ${pedido.numero_entrega}`;
        if (pedido.complemento_entrega) enderecoTexto += ` - ${pedido.complemento_entrega}`;
      }

      // Calcular valor total com taxa de entrega
      const valorBase = parseFloat(pedido.valor_total || 0);
      const taxaEntrega = parseFloat(pedido.taxa_entrega || 0);
      const valorTotalComTaxa = valorBase + taxaEntrega;

      // Montar linha de valor
      let valorTexto = `💰 Valor: R$ ${valorTotalComTaxa.toFixed(2)}`;
      if (taxaEntrega > 0) {
        valorTexto += `\n   (Pedido: R$ ${valorBase.toFixed(2)} + Taxa de entrega: R$ ${taxaEntrega.toFixed(2)})`;
      }

      // Mostrar troco apenas se existir e for maior que zero
      let trocoTexto = '';
      const troco = parseFloat(pedido.troco || 0);
      if (troco > 0) {
        trocoTexto = `\n💵 Troco: R$ ${troco.toFixed(2)}`;
      }

      const mensagem = `🛵 *Pedido Saiu para Entrega!*\n\n` +
        `📋 Pedido #${pedido.numero_pedido || pedido.id}\n` +
        `👤 Cliente: ${pedido.nome_cliente || pedido.nome_cliente_convidado || 'Cliente'}\n` +
        `${enderecoTexto}\n\n` +
        `🛵 Nosso motoboy está a caminho! Em breve você receberá seu pedido.\n\n` +
        `${valorTexto}${trocoTexto}${linkTexto}\n\n` +
        `Mantenha seu telefone por perto para facilitar a entrega! 📱`;

      const result = await whatsappManager.sendMessage(empresaId, telefoneCliente, mensagem);
      return result;

    } catch (error) {
      console.error(`[WhatsApp ${empresaId}] Erro ao enviar notificação de entrega:`, error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = new WhatsAppNotificationService();
