// Serviço para gerenciar múltiplas sessões WhatsApp (Baileys) por empresa
const P = require('pino');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const crypto = require('crypto');

// Garantir que globalThis.crypto esteja disponível para o Baileys
// No Node.js 15+, a Web Crypto API está disponível via crypto.webcrypto
if (!globalThis.crypto) {
  globalThis.crypto = crypto.webcrypto;
} else if (!globalThis.crypto.subtle && crypto.webcrypto && crypto.webcrypto.subtle) {
  // Se crypto existe mas não tem subtle, usar webcrypto do Node.js
  globalThis.crypto.subtle = crypto.webcrypto.subtle;
}

// Variáveis para armazenar imports dinâmicos do Baileys (ES Module)
let baileysModule = null;
let makeWASocket = null;
let DisconnectReason = null;
let useMultiFileAuthState = null;
let fetchLatestBaileysVersion = null;

// Carregar módulo Baileys dinamicamente
async function loadBaileys() {
  if (!baileysModule) {
    baileysModule = await import('@whiskeysockets/baileys');
    makeWASocket = baileysModule.default;
    DisconnectReason = baileysModule.DisconnectReason;
    useMultiFileAuthState = baileysModule.useMultiFileAuthState;
    fetchLatestBaileysVersion = baileysModule.fetchLatestBaileysVersion;
  }
  return {
    makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
  };
}

class WhatsAppManager {
  constructor() {
    // Mapa para armazenar as sessões ativas: { empresaId: socket }
    this.sessions = new Map();
    // Mapa para armazenar status das sessões: { empresaId: { connected: boolean, qr: string } }
    this.sessionStatus = new Map();
    // Diretório base para armazenar credenciais das sessões
    this.authDir = path.join(__dirname, '../../whatsapp_auth');
    
    // Criar diretório se não existir
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  // Obter diretório de autenticação para uma empresa específica
  getAuthPath(empresaId) {
    return path.join(this.authDir, `empresa_${empresaId}`);
  }

  // Inicializar conexão WhatsApp para uma empresa
  async connectEmpresa(empresaId) {
    try {
      // Carregar módulo Baileys dinamicamente
      const baileys = await loadBaileys();
      const { makeWASocket: makeSocket, useMultiFileAuthState: useAuth, fetchLatestBaileysVersion: fetchVersion, DisconnectReason: Disconnect } = baileys;

      // Se já existe uma sessão ativa, retorna o status
      if (this.sessions.has(empresaId)) {
        const socket = this.sessions.get(empresaId);
        if (socket && socket.user) {
          return {
            success: true,
            connected: true,
            message: 'WhatsApp já está conectado para esta empresa.',
            jid: socket.user.id
          };
        }
      }

      const authPath = this.getAuthPath(empresaId);
      const { state, saveCreds } = await useAuth(authPath);

      // Atualizar versão do Baileys
      const { version } = await fetchVersion();
      console.log(`[WhatsApp ${empresaId}] Usando versão Baileys:`, version);

      // Criar socket WhatsApp
      const socket = makeSocket({
        version,
        printQRInTerminal: false, // Não imprimir QR no terminal, vamos usar API
        auth: state,
        logger: P({ level: 'silent' }), // Silenciar logs do Baileys
        browser: ['Sistema Restaurante', 'Chrome', '1.0.0'],
        getMessage: async (key) => {
          // Implementar cache de mensagens se necessário
          return undefined;
        }
      });

      // Eventos do socket
      socket.ev.on('creds.update', saveCreds);
      
      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          // QR Code gerado - converter para base64 imagem
          try {
            // Converter QR Code string do Baileys para imagem base64
            const qrImageBase64 = await QRCode.toDataURL(qr, {
              type: 'image/png',
              quality: 0.92,
              margin: 1,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });

            this.sessionStatus.set(empresaId, {
              connected: false,
              qr: qrImageBase64, // Agora é data:image/png;base64,...
              message: 'Escaneie o QR Code para conectar'
            });
            console.log(`[WhatsApp ${empresaId}] QR Code gerado e convertido para base64`);
          } catch (qrError) {
            console.error(`[WhatsApp ${empresaId}] Erro ao converter QR Code:`, qrError);
            // Se falhar a conversão, armazenar o QR original
            this.sessionStatus.set(empresaId, {
              connected: false,
              qr: qr,
              message: 'Escaneie o QR Code para conectar'
            });
          }
        }

        if (connection === 'close') {
          // Conexão fechada
          const baileys = await loadBaileys();
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== baileys.DisconnectReason.loggedOut;
          
          this.sessions.delete(empresaId);
          this.sessionStatus.set(empresaId, {
            connected: false,
            qr: null,
            message: 'Desconectado'
          });

          console.log(`[WhatsApp ${empresaId}] Conexão fechada. Reconectar: ${shouldReconnect}`);
          
          // Reconectar automaticamente se não foi logout manual
          if (shouldReconnect) {
            setTimeout(() => {
              console.log(`[WhatsApp ${empresaId}] Tentando reconectar...`);
              this.connectEmpresa(empresaId);
            }, 3000);
          }
        } else if (connection === 'open') {
          // Conexão estabelecida
          this.sessions.set(empresaId, socket);
          this.sessionStatus.set(empresaId, {
            connected: true,
            qr: null,
            message: 'Conectado com sucesso',
            jid: socket.user?.id
          });
          console.log(`[WhatsApp ${empresaId}] Conectado com sucesso!`, socket.user?.id);
        }
      });

      // Eventos de mensagens recebidas (opcional, para comandos)
      // Removido log de mensagens recebidas para não poluir o console
      // socket.ev.on('messages.upsert', (m) => {
      //   // Processar mensagens recebidas se necessário
      // });

      return {
        success: true,
        connected: false,
        qr: this.sessionStatus.get(empresaId)?.qr || null,
        message: 'Conexão em andamento. Escaneie o QR Code quando aparecer.'
      };

    } catch (error) {
      console.error(`[WhatsApp ${empresaId}] Erro ao conectar:`, error);
      return {
        success: false,
        connected: false,
        message: `Erro ao conectar WhatsApp: ${error.message}`
      };
    }
  }

  // Desconectar WhatsApp de uma empresa
  async disconnectEmpresa(empresaId) {
    try {
      const socket = this.sessions.get(empresaId);
      if (socket) {
        await socket.logout();
        this.sessions.delete(empresaId);
        this.sessionStatus.set(empresaId, {
          connected: false,
          qr: null,
          message: 'Desconectado'
        });
        
        // Remover credenciais (opcional - comentado para permitir reconexão fácil)
        // const authPath = this.getAuthPath(empresaId);
        // if (fs.existsSync(authPath)) {
        //   fs.rmSync(authPath, { recursive: true, force: true });
        // }
        
        return {
          success: true,
          message: 'WhatsApp desconectado com sucesso'
        };
      }
      
      return {
        success: false,
        message: 'Nenhuma sessão ativa encontrada para esta empresa'
      };
    } catch (error) {
      console.error(`[WhatsApp ${empresaId}] Erro ao desconectar:`, error);
      return {
        success: false,
        message: `Erro ao desconectar: ${error.message}`
      };
    }
  }

  // Obter status da conexão de uma empresa
  getStatus(empresaId) {
    const status = this.sessionStatus.get(empresaId) || {
      connected: false,
      qr: null,
      message: 'Não conectado'
    };
    
    return {
      empresaId: empresaId,
      ...status
    };
  }

  // Enviar mensagem de texto para um número
  async sendMessage(empresaId, phoneNumber, message) {
    try {
      const socket = this.sessions.get(empresaId);
      
      if (!socket || !socket.user) {
        return {
          success: false,
          message: 'WhatsApp não está conectado para esta empresa'
        };
      }

      // Formatar número (remover caracteres especiais e adicionar código do país se necessário)
      let formattedNumber = phoneNumber.replace(/\D/g, '');
      
      // Se não começar com código do país, adicionar 55 (Brasil)
      if (!formattedNumber.startsWith('55') && formattedNumber.length === 11) {
        formattedNumber = '55' + formattedNumber;
      }
      
      const jid = `${formattedNumber}@s.whatsapp.net`;

      await socket.sendMessage(jid, { text: message });

      console.log(`[WhatsApp ${empresaId}] Mensagem enviada para ${phoneNumber}`);
      
      return {
        success: true,
        message: 'Mensagem enviada com sucesso',
        to: phoneNumber,
        jid: jid
      };

    } catch (error) {
      console.error(`[WhatsApp ${empresaId}] Erro ao enviar mensagem:`, error);
      return {
        success: false,
        message: `Erro ao enviar mensagem: ${error.message}`
      };
    }
  }

  // Verificar se WhatsApp está conectado para uma empresa
  isConnected(empresaId) {
    const socket = this.sessions.get(empresaId);
    return socket && socket.user ? true : false;
  }

  // Obter lista de empresas conectadas
  getConnectedEmpresas() {
    const connected = [];
    for (const [empresaId, socket] of this.sessions.entries()) {
      if (socket && socket.user) {
        connected.push({
          empresaId: empresaId,
          jid: socket.user.id
        });
      }
    }
    return connected;
  }
}

// Exportar instância singleton
module.exports = new WhatsAppManager();
