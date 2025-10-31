# Debug - Rastreamento 404 Error

## 🔍 Problema Identificado

O erro **404** ao tentar atualizar localização significa que:
- ✅ A rota está funcionando corretamente
- ❌ O rastreamento não foi encontrado OU não está com status `em_entrega`

---

## 📋 Fluxo Correto do Rastreamento

### Passo 1: Pedido muda para "Pronto"
```
Status: "Pendente" → "Pronto"
↓
Sistema cria rastreamento automaticamente (status: "pendente")
```

### Passo 2: Motoboy Inicia Entrega
```
POST /api/v1/gerencial/:slug/rastreamento/pedidos/:id/iniciar
↓
Rastreamento muda para status: "em_entrega"
```

### Passo 3: Motoboy Atualiza Localização
```
PUT /api/v1/gerencial/:slug/rastreamento/pedidos/:id/localizacao
↓
Funciona apenas se status = "em_entrega"
```

---

## 🐛 Possíveis Causas do 404

### Causa 1: Rastreamento não foi criado
**Erro:** `RASTREAMENTO_NAO_ENCONTRADO`

**Verificar:**
- ✅ Pedido está com status "Pronto"?
- ✅ Configuração `whatsapp_rastreamento_pedido` está ativada?
- ✅ Rastreamento existe na tabela `rastreamento_entrega`?

**Solução:**
- Mude status do pedido para "Pronto" primeiro
- Ou crie rastreamento manualmente se necessário

---

### Causa 2: Rastreamento não foi iniciado
**Erro:** `RASTREAMENTO_NAO_INICIADO`

**Status atual:** `pendente`

**Verificar no Frontend:**
```javascript
// Verificar status do rastreamento antes de atualizar localização
const response = await axios.get(
  `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoId}`
);

if (response.data.rastreamento?.status !== 'em_entrega') {
  // Primeiro precisa iniciar a entrega
  await axios.post(
    `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoId}/iniciar`
  );
}
```

**Solução:**
- Clique no botão "Iniciar Entrega" antes de atualizar localização

---

### Causa 3: Pedido ID incorreto
**Verificar:**
- ✅ O `pedidoId` sendo enviado existe?
- ✅ O `pedidoId` pertence à empresa correta?
- ✅ No frontend, está usando o `pedidoId` correto?

---

## 🔧 Checklist de Verificação no Frontend

### 1. Verificar se pedido existe e está pronto
```javascript
// Verificar pedido
const pedido = await axios.get(
  `/api/v1/gerencial/${slug}/pedidos/${pedidoId}`
);

console.log('Status do pedido:', pedido.data.status); // Deve ser "Pronto"
```

### 2. Verificar se rastreamento foi criado
```javascript
// Verificar rastreamento (usar lista de pedidos)
const pedidos = await axios.get(
  `/api/v1/gerencial/${slug}/rastreamento/pedidos`
);

const pedido = pedidos.data.pedidos.find(p => p.id === pedidoId);
console.log('Rastreamento:', pedido?.rastreamento);
// Deve ter: { id, status: 'pendente' }
```

### 3. Verificar se rastreamento foi iniciado
```javascript
if (pedido?.rastreamento?.status === 'pendente') {
  // Iniciar primeiro
  await axios.post(
    `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoId}/iniciar`
  );
  
  // Aguardar um pouco
  await new Promise(resolve => setTimeout(resolve, 500));
}

// Agora pode atualizar localização
await axios.put(
  `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoId}/localizacao`,
  { latitude, longitude }
);
```

---

## 💡 Fluxo Correto no Frontend

### Sequência de Ações

```javascript
// 1. Motoboy abre página de rastreamento do pedido
const pedidoId = 1; // ou o ID que vem da URL

// 2. Verificar status do rastreamento
const pedidos = await axios.get(
  `/api/v1/gerencial/${slug}/rastreamento/pedidos`
);

const pedidoAtual = pedidos.data.pedidos.find(p => p.id === pedidoId);

if (!pedidoAtual?.rastreamento) {
  alert('Rastreamento ainda não foi criado. O pedido precisa estar "Pronto".');
  return;
}

// 3. Se status for "pendente", iniciar entrega
if (pedidoAtual.rastreamento.status === 'pendente') {
  await axios.post(
    `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoId}/iniciar`
  );
}

// 4. Agora pode atualizar localização
navigator.geolocation.watchPosition(
  async (position) => {
    try {
      await axios.put(
        `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoId}/localizacao`,
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }
      );
      console.log('Localização atualizada');
    } catch (error) {
      if (error.response?.status === 404) {
        console.error('Erro:', error.response.data.message);
        // Mostrar mensagem ao usuário
      }
    }
  }
);
```

---

## 🔍 Mensagens de Erro Atualizadas

### Erro 404 - Rastreamento não encontrado
```json
{
  "message": "Rastreamento não encontrado para este pedido. Certifique-se de que o pedido está com status \"Pronto\" e o rastreamento foi iniciado.",
  "error": "RASTREAMENTO_NAO_ENCONTRADO"
}
```

**Ação:**
1. Verificar se pedido está "Pronto"
2. Verificar se configuração de rastreamento está ativada
3. Aguardar sistema criar rastreamento automaticamente

---

### Erro 400 - Rastreamento não iniciado
```json
{
  "message": "Rastreamento não está em andamento. Status atual: pendente. É necessário iniciar a entrega primeiro.",
  "error": "RASTREAMENTO_NAO_INICIADO",
  "status_atual": "pendente"
}
```

**Ação:**
1. Chamar endpoint `/iniciar` primeiro
2. Aguardar resposta de sucesso
3. Depois atualizar localização

---

## ✅ Solução Rápida

### No Frontend - Adicionar Verificação

```javascript
const atualizarLocalizacao = async (latitude, longitude) => {
  try {
    await axios.put(
      `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoId}/localizacao`,
      { latitude, longitude }
    );
  } catch (error) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      const erro = error.response.data;
      
      if (erro.error === 'RASTREAMENTO_NAO_ENCONTRADO') {
        alert('Rastreamento não encontrado. Verifique se o pedido está "Pronto".');
      } else if (erro.error === 'RASTREAMENTO_NAO_INICIADO') {
        // Tentar iniciar automaticamente
        try {
          await axios.post(
            `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoId}/iniciar`
          );
          // Tentar novamente atualizar localização
          await axios.put(
            `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoId}/localizacao`,
            { latitude, longitude }
          );
        } catch (err) {
          alert('Erro ao iniciar rastreamento: ' + err.response?.data?.message);
        }
      } else {
        alert(erro.message);
      }
    } else {
      console.error('Erro ao atualizar localização:', error);
    }
  }
};
```

---

## 🧪 Como Testar

### 1. Criar Pedido de Teste
```
1. Criar pedido delivery
2. Mudar status para "Pronto"
3. Verificar se rastreamento foi criado:
   SELECT * FROM rastreamento_entrega WHERE pedido_id = ?;
```

### 2. Iniciar Rastreamento
```
POST /api/v1/gerencial/demo-restaurante/rastreamento/pedidos/1/iniciar
```

### 3. Atualizar Localização
```
PUT /api/v1/gerencial/demo-restaurante/rastreamento/pedidos/1/localizacao
Body: { "latitude": -23.5505, "longitude": -46.6333 }
```

---

## 📝 Resumo

O erro 404 indica que o **rastreamento não existe ou não está iniciado**, não que a rota está errada.

**Ordem correta:**
1. ✅ Pedido muda para "Pronto" → Sistema cria rastreamento
2. ✅ Motoboy clica "Iniciar Entrega" → Status muda para "em_entrega"
3. ✅ Motoboy atualiza localização → Funciona normalmente

**Verificar no frontend:**
- Se rastreamento existe antes de atualizar
- Se rastreamento foi iniciado antes de atualizar
- Mostrar mensagens de erro claras ao usuário

