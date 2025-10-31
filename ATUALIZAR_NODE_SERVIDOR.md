# Atualizar Node.js no Servidor - Guia Rápido

## ✅ Situação

- ✅ **Sua máquina local:** Node.js 20+ (funcionando)
- ❌ **Servidor (Hostinger):** Node.js 18.20.8 (precisa atualizar)

**Solução:** Atualizar Node.js no servidor para 20+

---

## 🚀 Solução Rápida

### Conectar ao Servidor

```bash
ssh root@seu-servidor.com
```

### Atualizar Node.js

#### Opção 1: Usando NVM (Recomendado - Mais Fácil)

```bash
# 1. Instalar NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 2. Recarregar terminal
source ~/.bashrc

# 3. Instalar Node.js 20 LTS
nvm install 20

# 4. Usar Node.js 20
nvm use 20

# 5. Definir como padrão
nvm alias default 20

# 6. Verificar
node -v  # Deve mostrar v20.x.x
```

#### Opção 2: Atualizar Diretamente (NodeSource)

```bash
# 1. Instalar script do NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# 2. Instalar Node.js 20
sudo apt-get install -y nodejs

# 3. Verificar
node -v  # Deve mostrar v20.x.x
```

---

## 📋 Passos Completos

### 1. Conectar ao Servidor

```bash
ssh root@seu-servidor.com
```

### 2. Verificar Versão Atual

```bash
node -v
# Vai mostrar: v18.20.8
```

### 3. Instalar Node.js 20 (usando NVM)

```bash
# Instalar NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Recarregar
source ~/.bashrc

# Instalar Node 20
nvm install 20
nvm use 20
nvm alias default 20
```

### 4. Verificar Instalação

```bash
node -v
# Deve mostrar: v20.x.x

npm -v
```

### 5. Ir para o Projeto

```bash
cd /root/SISTEMA/backend
```

### 6. Limpar e Reinstalar Dependências

```bash
# Limpar cache
npm cache clean --force

# Remover node_modules e lock
rm -rf node_modules package-lock.json

# Instalar dependências novamente
npm install
```

### 7. Reiniciar Aplicação

#### Se usar PM2:

```bash
# Parar aplicação
pm2 stop sistema-backend

# Verificar Node.js que PM2 está usando
pm2 info sistema-backend

# Se necessário, reinstalar PM2
npm install -g pm2

# Reiniciar aplicação
pm2 start src/server.js --name sistema-backend

# Salvar configuração
pm2 save
```

#### Se não usar PM2:

```bash
# Parar aplicação atual (Ctrl+C ou kill)
# Reiniciar
node src/server.js
```

---

## ✅ Verificar se Funcionou

### 1. Verificar Versão do Node.js

```bash
node -v
# Deve mostrar: v20.x.x (não v18.x.x)
```

### 2. Verificar Instalação das Dependências

```bash
npm install
# Não deve dar erro de versão do Node.js
```

### 3. Verificar se Baileys Instalou

```bash
ls node_modules/@whiskeysockets/baileys
# Deve existir a pasta
```

### 4. Testar Aplicação

```bash
node src/server.js
# Deve iniciar sem erros
```

### 5. Testar WhatsApp

- Conectar WhatsApp
- Verificar se QR Code aparece
- Testar envio de mensagem

---

## 🔧 Comandos Resumidos (Copiar e Colar)

```bash
# 1. Instalar NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 2. Recarregar
source ~/.bashrc

# 3. Instalar Node 20
nvm install 20
nvm use 20
nvm alias default 20

# 4. Verificar
node -v

# 5. Ir para projeto
cd /root/SISTEMA/backend

# 6. Limpar e reinstalar
rm -rf node_modules package-lock.json
npm install

# 7. Reiniciar PM2
pm2 restart sistema-backend
```

---

## ⚠️ Se PM2 Não Usar Node.js 20

### Problema

PM2 pode estar usando versão antiga do Node.js

### Solução

```bash
# 1. Parar PM2
pm2 stop all

# 2. Verificar Node.js que PM2 está usando
pm2 info sistema-backend

# 3. Reinstalar PM2 (garante que usa Node.js 20)
npm install -g pm2

# 4. Remover processo antigo do PM2
pm2 delete sistema-backend

# 5. Iniciar novamente
cd /root/SISTEMA/backend
pm2 start src/server.js --name sistema-backend

# 6. Salvar configuração
pm2 save
```

---

## 📝 Verificação Final

Após atualizar, verifique:

```bash
# 1. Versão do Node.js
node -v  # v20.x.x ✅

# 2. Versão do npm
npm -v

# 3. Dependências instaladas
ls node_modules/@whiskeysockets/baileys  # Deve existir ✅

# 4. Aplicação rodando
pm2 status  # Ou verificar manualmente

# 5. Logs sem erro
pm2 logs sistema-backend  # Não deve ter erros de versão
```

---

## ✅ Pronto!

Após seguir esses passos:
- ✅ Node.js 20 instalado
- ✅ Dependências instaladas corretamente
- ✅ Baileys funcionando
- ✅ WhatsApp conectado
- ✅ Aplicação rodando

**Tempo estimado:** 5-10 minutos

---

## 🆘 Se Der Erro

### Erro: "command not found: node" após atualizar

**Solução:**
```bash
# Verificar onde está o Node.js
which node

# Adicionar ao PATH
export PATH="$HOME/.nvm/versions/node/v20.x.x/bin:$PATH"

# Ou recarregar terminal
source ~/.bashrc
```

### Erro: PM2 ainda usa Node.js antigo

**Solução:**
```bash
# Reinstalar PM2
npm install -g pm2

# Reiniciar tudo
pm2 delete all
pm2 start src/server.js --name sistema-backend
```

---

## 🎯 Resumo

**O que fazer:**
1. Conectar ao servidor SSH
2. Instalar Node.js 20 (NVM ou NodeSource)
3. Limpar node_modules antigo
4. Instalar dependências novamente
5. Reiniciar aplicação

**Isso é tudo!** 🚀

