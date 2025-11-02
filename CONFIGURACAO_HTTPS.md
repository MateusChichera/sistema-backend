# Configuração HTTPS para Backend

## ✅ O que foi implementado

### 1. Suporte Dual HTTP/HTTPS
O backend agora suporta tanto **HTTP** quanto **HTTPS** simultaneamente:

- **HTTP**: Porta 3001 (padrão) - mantém compatibilidade total com front-end e APK
- **HTTPS**: Porta 3002 (opcional) - usado quando certificados SSL estão disponíveis

### 2. Certificados SSL
O sistema usa automaticamente os certificados Let's Encrypt instalados no servidor:

- Caminho padrão: `/etc/letsencrypt/live/athospp.com.br/`
- Certificados usados:
  - `privkey.pem` (chave privada)
  - `fullchain.pem` (certificado completo)

### 3. Fallback Automático
Se os certificados SSL não estiverem disponíveis:
- Backend continua funcionando normalmente em **HTTP**
- Nginx continua fazendo proxy HTTPS → HTTP (como antes)
- Sistema não quebra

### 4. Socket.IO Dual
Socket.IO está configurado para funcionar em ambos os protocolos:
- **HTTP Socket.IO**: Porta 3001
- **HTTPS Socket.IO**: Porta 3002 (se HTTPS estiver ativo)

### 5. Broadcast Automático
Quando você usa `req.io.to(room).emit(event, data)`, o sistema automaticamente:
- Emite para clientes conectados via **HTTP**
- Emite para clientes conectados via **HTTPS**
- Mantém todos os clientes sincronizados

## 🔧 Configuração do Ambiente

### Variáveis de Ambiente (.env)

Opcionalmente, você pode configurar:

```env
PORT=3001              # Porta HTTP (padrão: 3001)
HTTPS_PORT=3002        # Porta HTTPS (padrão: 3002)
SSL_CERT_PATH=/etc/letsencrypt/live/athospp.com.br  # Caminho dos certificados
```

## 📋 Como Funciona

### Cenário 1: Front-end Web (via Nginx)
```
Cliente → https://athospp.com.br/api/v1/...
          ↓ (Nginx faz proxy)
Backend HTTP → http://localhost:3001/api/v1/...
```
**Status**: ✅ Funciona (como antes)

### Cenário 2: App Android/iOS (HTTPS direto)
```
App → https://athospp.com.br:3002/api/v1/...
      ↓ (direto)
Backend HTTPS → https://localhost:3002/api/v1/...
```
**Status**: ✅ Funciona (novo!)

### Cenário 3: App Android/iOS (HTTP direto - fallback)
```
App → http://athospp.com.br:3001/api/v1/...
      ↓ (direto)
Backend HTTP → http://localhost:3001/api/v1/...
```
**Status**: ✅ Funciona (como antes)

## 🚀 Iniciar o Servidor

O servidor detecta automaticamente se os certificados estão disponíveis:

```bash
# HTTP sempre funcionará
✅ Servidor HTTP rodando na porta 3001

# HTTPS só funcionará se certificados estiverem disponíveis
✅ Servidor HTTPS rodando na porta 3002
   Ou
ℹ️  Servidor HTTPS não foi iniciado (certificados não encontrados)
```

## 📝 Notas Importantes

1. **Compatibilidade Total**: Nada que estava funcionando antes será quebrado
2. **Nginx**: Continua funcionando normalmente, fazendo proxy HTTPS → HTTP
3. **APK**: Pode usar tanto HTTP quanto HTTPS, conforme necessário
4. **Certificados**: Se não estiverem disponíveis, sistema continua funcionando

## 🔍 Verificar se HTTPS está Ativo

Quando o servidor iniciar, você verá no console:

```
✅ Certificados SSL encontrados - HTTPS será habilitado
✅ Servidor HTTPS criado com sucesso
✅ Servidor HTTP rodando na porta 3001
✅ Servidor HTTPS rodando na porta 3002
```

Ou se certificados não estiverem disponíveis:

```
⚠️ Certificados SSL não encontrados - Apenas HTTP será usado
✅ Servidor HTTP rodando na porta 3001
ℹ️  Servidor HTTPS não foi iniciado (certificados não encontrados)
```

## 🔐 Configuração do Firewall

Se precisar abrir a porta HTTPS diretamente no firewall:

```bash
# Ubuntu/Debian
sudo ufw allow 3002/tcp

# Ou configurar regra específica para permitir apenas do Nginx
```

## 📱 Uso no App

No seu app Android/iOS, você pode usar:

```javascript
// Opção 1: HTTPS direto (recomendado para produção)
const API_URL = 'https://athospp.com.br:3002/api/v1';

// Opção 2: Via Nginx (já está funcionando)
const API_URL = 'https://athospp.com.br/api/v1';

// Opção 3: HTTP (fallback, não recomendado para produção)
const API_URL = 'http://athospp.com.br:3001/api/v1';
```

## ⚠️ Importante

- **Nginx continuará fazendo proxy HTTPS → HTTP** (padrão recomendado)
- **Backend HTTPS é opcional** e só é usado se necessário
- **Tudo continua funcionando mesmo sem certificados SSL**

---

**Data de configuração**: Configurado para funcionar com ambos os protocolos simultaneamente.

