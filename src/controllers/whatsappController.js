// Controller para gerenciar WhatsApp por empresa
const whatsappManager = require('../services/whatsappManager');
const { pool } = require('../config/db');

// Conectar WhatsApp de uma empresa
const connectWhatsApp = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente'].includes(requestingUser.role)) {
    return res.status(403).json({
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem gerenciar WhatsApp.'
    });
  }

  try {
    const result = await whatsappManager.connectEmpresa(empresaId);
    
    if (result.success) {
      res.status(200).json({
        message: result.message,
        connected: result.connected,
        qr: result.qr,
        jid: result.jid
      });
    } else {
      res.status(400).json({
        message: result.message
      });
    }
  } catch (error) {
    next(error);
  }
};

// Obter QR Code para conectar WhatsApp
const getQRCode = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente'].includes(requestingUser.role)) {
    return res.status(403).json({
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem visualizar QR Code.'
    });
  }

  try {
    const status = whatsappManager.getStatus(empresaId);
    
    // Se já está conectado, não precisa de QR Code
    if (status.connected) {
      return res.status(200).json({
        connected: true,
        message: 'WhatsApp já está conectado',
        qr: null,
        jid: status.jid
      });
    }

    // Se não tem QR Code, tenta conectar
    if (!status.qr) {
      const result = await whatsappManager.connectEmpresa(empresaId);
      if (result.success && result.qr) {
        return res.status(200).json({
          connected: false,
          message: 'Escaneie o QR Code para conectar',
          qr: result.qr,
          jid: null
        });
      }
    }

    // Retorna QR Code existente
    res.status(200).json({
      connected: false,
      message: status.message || 'Escaneie o QR Code para conectar',
      qr: status.qr,
      jid: null
    });
  } catch (error) {
    next(error);
  }
};

// Desconectar WhatsApp de uma empresa
const disconnectWhatsApp = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente'].includes(requestingUser.role)) {
    return res.status(403).json({
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem gerenciar WhatsApp.'
    });
  }

  try {
    const result = await whatsappManager.disconnectEmpresa(empresaId);
    
    if (result.success) {
      res.status(200).json({
        message: result.message
      });
    } else {
      res.status(400).json({
        message: result.message
      });
    }
  } catch (error) {
    next(error);
  }
};

// Obter status da conexão WhatsApp
const getWhatsAppStatus = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente', 'Caixa', 'Funcionario'].includes(requestingUser.role)) {
    return res.status(403).json({
      message: 'Acesso negado. Você não tem permissão para visualizar status do WhatsApp.'
    });
  }

  try {
    const status = whatsappManager.getStatus(empresaId);
    res.status(200).json(status);
  } catch (error) {
    next(error);
  }
};

// Enviar mensagem de teste
const sendTestMessage = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const { phoneNumber, message } = req.body;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente'].includes(requestingUser.role)) {
    return res.status(403).json({
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem enviar mensagens.'
    });
  }

  if (!phoneNumber || !message) {
    return res.status(400).json({
      message: 'Número de telefone e mensagem são obrigatórios.'
    });
  }

  try {
    const result = await whatsappManager.sendMessage(empresaId, phoneNumber, message);
    
    if (result.success) {
      res.status(200).json({
        message: result.message,
        to: result.to
      });
    } else {
      res.status(400).json({
        message: result.message
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppStatus,
  getQRCode,
  sendTestMessage
};
