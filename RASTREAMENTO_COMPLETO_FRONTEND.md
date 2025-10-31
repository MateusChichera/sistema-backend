# Sistema de Rastreamento - Documentação Completa Frontend

## 📋 Visão Geral

Sistema completo de rastreamento de entrega em tempo real. O motoboy acessa uma página web, inicia a entrega e o cliente acompanha a localização em tempo real.

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `rastreamento_entrega`

```sql
CREATE TABLE rastreamento_entrega (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pedido_id INT NOT NULL,              -- ID do pedido (IMPORTANTE!)
  empresa_id INT NOT NULL,
  status ENUM('pendente', 'em_entrega', 'entregue', 'cancelado'),
  latitude DECIMAL(10, 8) NULL,
  longitude DECIMAL(11, 8) NULL,
  data_inicio DATETIME NULL,
  data_entrega DATETIME NULL,
  observacoes TEXT NULL,
  created_at DATETIME,
  updated_at DATETIME
);
```

**Campos Importantes:**
- `pedido_id`: ID do pedido na tabela `pedidos` (USE ESTE ID!)
- `status`: Estado atual do rastreamento
- `latitude/longitude`: Posição atual do motoboy (atualizada durante entrega)

**Exemplo de Registro:**
```
id: 2
pedido_id: 406          ← USE ESTE ID nas rotas!
empresa_id: 1
status: 'em_entrega'
latitude: NULL
longitude: NULL
data_inicio: '2025-10-31 16:04:52'
```

### Tabela: `rastreamento_localizacao`

Armazena histórico de localizações durante a entrega.

---

## ⚠️ PROBLEMA COMUM: Pedido ID Incorreto

### ❌ Erro Comum

```
PUT /api/v1/gerencial/demo-restaurante/rastreamento/pedidos/4/localizacao 404
```

Mas o rastreamento foi criado para `pedido_id: 406`!

### ✅ Solução

**SEMPRE use o `pedido_id` do banco de dados**, não outro número!

**Como obter o pedido_id correto:**
1. Quando lista pedidos: usar o `id` retornado
2. Quando clica no pedido: usar o `id` do pedido clicado
3. Na URL da página: usar o `pedidoId` da URL

---

## 🔄 Fluxo Completo do Sistema

### 1. Pedido Muda para "Pronto"

**Backend automático:**
```
Status: "Pendente" → "Pronto"
↓
Sistema verifica se rastreamento está ativado
↓
Se ativado: Cria rastreamento automaticamente (status: "pendente")
INSERT INTO rastreamento_entrega (pedido_id, empresa_id, status) 
VALUES (406, 1, 'pendente')
```

**Resultado no banco:**
```
id: 2
pedido_id: 406         ← Este é o ID que você deve usar!
status: 'pendente'
```

---

### 2. Motoboy Visualiza Pedidos

**GET** `/api/v1/gerencial/:slug/rastreamento/pedidos`

**Resposta:**
```json
{
  "pedidos": [
    {
      "id": 406,                    ← USE ESTE ID!
      "numero_pedido": "P001",
      "status": "Pronto",
      "tipo_entrega": "Delivery",
      "valor_total": 45.50,
      "cliente": "João Silva",
      "endereco": "Rua das Flores, 100",
      "rastreamento": {
        "id": 2,                     ← ID do rastreamento (não use este!)
        "status": "pendente",        ← Status do rastreamento
        "data_inicio": null
      }
    },
    {
      "id": 407,                    ← Outro pedido
      "numero_pedido": "P002",
      "rastreamento": null          ← Sem rastreamento ainda
    }
  ]
}
```

**⚠️ IMPORTANTE:**
- Use `pedido.id` (406) nas rotas, **NÃO** `rastreamento.id` (2)
- O `rastreamento.id` é apenas para referência interna

---

### 3. Motoboy Clica em "Iniciar Entrega"

**POST** `/api/v1/gerencial/:slug/rastreamento/pedidos/:id/iniciar`

**URL:** `/api/v1/gerencial/demo-restaurante/rastreamento/pedidos/406/iniciar`

**Headers:**
```javascript
{
  Authorization: 'Bearer {token}'
}
```

**Resposta de Sucesso:**
```json
{
  "message": "Rastreamento iniciado com sucesso",
  "rastreamento": {
    "id": 2,
    "pedido_id": 406,
    "status": "em_entrega",
    "data_inicio": "2025-10-31 16:04:52"
  }
}
```

**O que acontece:**
1. Status muda de `pendente` → `em_entrega`
2. `data_inicio` é preenchida
3. WhatsApp é enviado ao cliente: "Pedido Saiu para Entrega!"

**No banco:**
```
id: 2
pedido_id: 406
status: 'em_entrega'          ← Agora está pronto para receber localização!
data_inicio: '2025-10-31 16:04:52'
```

---

### 4. Motoboy Atualiza Localização

**PUT** `/api/v1/gerencial/:slug/rastreamento/pedidos/:id/localizacao`

**URL:** `/api/v1/gerencial/demo-restaurante/rastreamento/pedidos/406/localizacao`

**⚠️ IMPORTANTE:** Use o mesmo `pedido_id` (406) da rota anterior!

**Body:**
```json
{
  "latitude": -23.5505,
  "longitude": -46.6333
}
```

**Headers:**
```javascript
{
  Authorization: 'Bearer {token}',
  'Content-Type': 'application/json'
}
```

**Resposta de Sucesso:**
```json
{
  "message": "Localização atualizada com sucesso",
  "localizacao": {
    "latitude": -23.5505,
    "longitude": -46.6333,
    "timestamp": "2025-10-31 16:05:00.000Z"
  }
}
```

**O que acontece:**
1. `latitude` e `longitude` são atualizados na tabela `rastreamento_entrega`
2. Nova entrada é salva na tabela `rastreamento_localizacao` (histórico)
3. Cliente pode ver a posição atualizada

**No banco:**
```
rastreamento_entrega:
  id: 2
  pedido_id: 406
  latitude: -23.5505        ← Atualizado
  longitude: -46.6333       ← Atualizado

rastreamento_localizacao:
  rastreamento_id: 2
  latitude: -23.5505
  longitude: -46.6333
  timestamp: '2025-10-31 16:05:00'
```

---

### 5. Motoboy Marca como Entregue

**POST** `/api/v1/gerencial/:slug/rastreamento/pedidos/:id/entregue`

**URL:** `/api/v1/gerencial/demo-restaurante/rastreamento/pedidos/406/entregue`

**Body (opcional):**
```json
{
  "observacoes": "Entregue na portaria"
}
```

**Resposta:**
```json
{
  "message": "Pedido marcado como entregue com sucesso",
  "rastreamento": {
    "id": 2,
    "pedido_id": 406,
    "status": "entregue",
    "data_entrega": "2025-10-31 16:30:00.000Z"
  }
}
```

**O que acontece:**
1. Status muda para `entregue`
2. `data_entrega` é preenchida
3. WhatsApp é enviado ao cliente: "Pedido Entregue! ✅"
4. **IMPORTANTE:** Status do pedido NÃO muda (continua "Pronto")

---

## 🛠️ Rotas da API - Resumo Completo

### Listar Pedidos para Motoboy

**GET** `/api/v1/gerencial/:slug/rastreamento/pedidos`

**Resposta:**
```json
{
  "pedidos": [
    {
      "id": 406,                      ← USE ESTE ID nas outras rotas!
      "numero_pedido": "P001",
      "status": "Pronto",
      "tipo_entrega": "Delivery",
      "valor_total": 45.50,
      "cliente": "João Silva",
      "telefone": "11999999999",
      "endereco": "Rua das Flores, 100 - Apto 5",
      "data_pedido": "2025-10-31 15:00:00.000Z",
      "rastreamento": {
        "id": 2,
        "status": "pendente",
        "data_inicio": null
      }
    }
  ]
}
```

**Como usar:**
```javascript
const response = await axios.get(
  `/api/v1/gerencial/${slug}/rastreamento/pedidos`
);

const pedido = response.data.pedidos[0];
const pedidoId = pedido.id; // 406 ← USE ESTE!
```

---

### Iniciar Rastreamento

**POST** `/api/v1/gerencial/:slug/rastreamento/pedidos/:id/iniciar`

**URL:** Use o `pedido.id` (não rastreamento.id)!

```javascript
const pedidoId = 406; // Do objeto pedido acima

await axios.post(
  `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoId}/iniciar`
);
```

**Erro comum:**
```javascript
// ❌ ERRADO - Usando rastreamento.id
const rastreamentoId = pedido.rastreamento.id; // 2
await axios.post(`.../pedidos/${rastreamentoId}/iniciar`); // Erro!

// ✅ CORRETO - Usando pedido.id
const pedidoId = pedido.id; // 406
await axios.post(`.../pedidos/${pedidoId}/iniciar`); // Funciona!
```

---

### Atualizar Localização

**PUT** `/api/v1/gerencial/:slug/rastreamento/pedidos/:id/localizacao`

**URL:** Use o mesmo `pedido.id`!

```javascript
const pedidoId = 406; // Mesmo ID usado para iniciar

await axios.put(
  `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoId}/localizacao`,
  {
    latitude: -23.5505,
    longitude: -46.6333
  }
);
```

**Importante:**
- Deve ser chamado APÓS iniciar a entrega
- Use o mesmo `pedidoId` usado para iniciar
- Enviar localização a cada 10-30 segundos durante entrega

---

### Marcar como Entregue

**POST** `/api/v1/gerencial/:slug/rastreamento/pedidos/:id/entregue`

**URL:** Use o mesmo `pedido.id`!

```javascript
const pedidoId = 406; // Mesmo ID

await axios.post(
  `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoId}/entregue`,
  {
    observacoes: "Entregue na portaria" // Opcional
  }
);
```

---

## 💻 Implementação Frontend Correta

### Componente Completo

```javascript
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

function RastreamentoPedidoPage() {
  const { slug, pedidoId } = useParams(); // pedidoId vem da URL
  const [pedido, setPedido] = useState(null);
  const [rastreamento, setRastreamento] = useState(null);
  const [status, setStatus] = useState('pendente');
  const [watchId, setWatchId] = useState(null);

  // Carregar dados do pedido e rastreamento
  useEffect(() => {
    carregarPedido();
  }, [slug, pedidoId]);

  const carregarPedido = async () => {
    try {
      const response = await axios.get(
        `/api/v1/gerencial/${slug}/rastreamento/pedidos`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Encontrar o pedido pelo ID
      const pedidoEncontrado = response.data.pedidos.find(
        p => p.id === parseInt(pedidoId)
      );

      if (!pedidoEncontrado) {
        alert('Pedido não encontrado');
        return;
      }

      setPedido(pedidoEncontrado);
      setRastreamento(pedidoEncontrado.rastreamento);
      
      if (pedidoEncontrado.rastreamento) {
        setStatus(pedidoEncontrado.rastreamento.status);
      } else {
        setStatus('pendente');
      }

      console.log('Pedido carregado:', pedidoEncontrado);
      console.log('Pedido ID:', pedidoEncontrado.id); // Deve ser 406 (não 4!)
      console.log('Rastreamento:', pedidoEncontrado.rastreamento);

    } catch (error) {
      console.error('Erro ao carregar pedido:', error);
      alert('Erro ao carregar pedido');
    }
  };

  // Iniciar entrega
  const iniciarEntrega = async () => {
    if (!pedido) return;

    // ⚠️ IMPORTANTE: Usar pedido.id (não rastreamento.id)
    const pedidoIdParaApi = pedido.id; // 406

    try {
      console.log('Iniciando entrega para pedido:', pedidoIdParaApi);

      const response = await axios.post(
        `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoIdParaApi}/iniciar`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log('Entrega iniciada:', response.data);
      setStatus('em_entrega');
      setRastreamento(response.data.rastreamento);

      // Iniciar envio de localização
      iniciarEnvioLocalizacao(pedidoIdParaApi);

      alert('Entrega iniciada com sucesso!');
    } catch (error) {
      console.error('Erro ao iniciar entrega:', error);
      alert('Erro ao iniciar entrega: ' + error.response?.data?.message);
    }
  };

  // Iniciar envio de localização
  const iniciarEnvioLocalizacao = (pedidoIdParaApi) => {
    if (!navigator.geolocation) {
      alert('Geolocalização não suportada');
      return;
    }

    // Solicitar permissão
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Permissão de localização concedida');
        
        // Começar a enviar localização periodicamente
        const id = navigator.geolocation.watchPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            console.log('Enviando localização:', { latitude, longitude, pedidoId: pedidoIdParaApi });

            try {
              // ⚠️ IMPORTANTE: Usar o mesmo pedidoId usado para iniciar
              await axios.put(
                `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoIdParaApi}/localizacao`,
                {
                  latitude: latitude,
                  longitude: longitude
                },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                }
              );

              console.log('Localização atualizada com sucesso');
            } catch (error) {
              console.error('Erro ao atualizar localização:', error);
              
              if (error.response?.status === 404) {
                const erro = error.response.data;
                if (erro.error === 'RASTREAMENTO_NAO_ENCONTRADO') {
                  alert('Rastreamento não encontrado. Verifique se o pedido está "Pronto".');
                } else if (erro.error === 'RASTREAMENTO_NAO_INICIADO') {
                  alert('Rastreamento não iniciado. Status: ' + erro.status_atual);
                }
              }
            }
          },
          (error) => {
            console.error('Erro ao obter localização:', error);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );

        setWatchId(id);
      },
      (error) => {
        alert('Erro ao obter permissão de localização: ' + error.message);
      },
      { enableHighAccuracy: true }
    );
  };

  // Marcar como entregue
  const marcarEntregue = async () => {
    if (!pedido) return;

    // ⚠️ IMPORTANTE: Usar pedido.id (não rastreamento.id)
    const pedidoIdParaApi = pedido.id; // 406

    try {
      // Parar de enviar localização
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }

      console.log('Marcando como entregue:', pedidoIdParaApi);

      const response = await axios.post(
        `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoIdParaApi}/entregue`,
        {
          observacoes: ''
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log('Pedido marcado como entregue:', response.data);
      setStatus('entregue');
      setRastreamento(response.data.rastreamento);

      alert('Pedido marcado como entregue!');
    } catch (error) {
      console.error('Erro ao marcar como entregue:', error);
      alert('Erro: ' + error.response?.data?.message);
    }
  };

  return (
    <div>
      <h1>Rastreamento de Entrega</h1>
      
      {pedido && (
        <>
          <div>
            <p><strong>Pedido ID:</strong> {pedido.id}</p>
            <p><strong>Número:</strong> {pedido.numero_pedido}</p>
            <p><strong>Cliente:</strong> {pedido.cliente}</p>
            <p><strong>Endereço:</strong> {pedido.endereco}</p>
            <p><strong>Status Rastreamento:</strong> {status}</p>
          </div>

          {status === 'pendente' && (
            <button onClick={iniciarEntrega}>
              Iniciar Entrega
            </button>
          )}

          {status === 'em_entrega' && (
            <button onClick={marcarEntregue}>
              Marcar como Entregue
            </button>
          )}

          {status === 'entregue' && (
            <div>
              <p>✅ Pedido entregue com sucesso!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default RastreamentoPedidoPage;
```

---

## 🔍 Debug e Verificações

### 1. Verificar Pedido ID Correto

```javascript
// Quando lista pedidos
const pedidos = await axios.get(`/api/v1/gerencial/${slug}/rastreamento/pedidos`);
console.log('Pedidos:', pedidos.data.pedidos);

// Encontrar pedido específico
const pedido = pedidos.data.pedidos.find(p => p.numero_pedido === 'P001');
console.log('Pedido ID:', pedido.id); // Deve ser 406 (não 4!)

// Verificar rastreamento
console.log('Rastreamento ID:', pedido.rastreamento?.id); // 2 (não use este!)
console.log('Pedido ID (USE ESTE):', pedido.id); // 406 ← USE ESTE!
```

### 2. Verificar Rastreamento no Banco

```sql
-- Ver todos os rastreamentos
SELECT * FROM rastreamento_entrega;

-- Ver rastreamento específico
SELECT * FROM rastreamento_entrega WHERE pedido_id = 406;

-- Ver histórico de localização
SELECT * FROM rastreamento_localizacao 
WHERE rastreamento_id = 2 
ORDER BY timestamp DESC;
```

### 3. Console Logs Úteis

```javascript
// Antes de iniciar
console.log('=== INICIAR ENTREGA ===');
console.log('Pedido ID da lista:', pedido.id);
console.log('Pedido ID da URL:', pedidoId);
console.log('Rastreamento ID:', pedido.rastreamento?.id);
console.log('URL completa:', `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedido.id}/iniciar`);

// Antes de atualizar localização
console.log('=== ATUALIZAR LOCALIZAÇÃO ===');
console.log('Pedido ID:', pedidoIdParaApi); // Deve ser 406!
console.log('URL:', `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoIdParaApi}/localizacao`);
```

---

## ⚠️ Erros Comuns e Soluções

### Erro 1: 404 - Rastreamento não encontrado

**Mensagem:**
```json
{
  "message": "Rastreamento não encontrado para este pedido...",
  "error": "RASTREAMENTO_NAO_ENCONTRADO"
}
```

**Causa:**
- Pedido não está com status "Pronto"
- Rastreamento não foi criado automaticamente
- `pedido_id` errado sendo enviado

**Solução:**
1. Verificar se pedido está "Pronto"
2. Verificar se `pedido_id` está correto (use `pedido.id` da lista)
3. Verificar no banco: `SELECT * FROM rastreamento_entrega WHERE pedido_id = ?`

---

### Erro 2: 400 - Rastreamento não iniciado

**Mensagem:**
```json
{
  "message": "Rastreamento não está em andamento. Status atual: pendente...",
  "error": "RASTREAMENTO_NAO_INICIADO",
  "status_atual": "pendente"
}
```

**Causa:**
- Tentando atualizar localização antes de iniciar entrega

**Solução:**
1. Chamar `/iniciar` primeiro
2. Aguardar resposta de sucesso
3. Depois atualizar localização

---

### Erro 3: Pedido ID incorreto

**Sintoma:**
- Iniciar funciona (pedido_id correto)
- Atualizar localização dá 404 (pedido_id errado)

**Causa:**
- Usando `rastreamento.id` em vez de `pedido.id`
- Perdendo referência do `pedido.id` entre chamadas

**Solução:**
```javascript
// ❌ ERRADO
const rastreamentoId = pedido.rastreamento.id; // 2
await axios.put(`.../pedidos/${rastreamentoId}/localizacao`); // 404!

// ✅ CORRETO
const pedidoId = pedido.id; // 406
await axios.put(`.../pedidos/${pedidoId}/localizacao`); // OK!
```

---

## 📝 Resumo dos IDs

### Estrutura de Dados

```javascript
{
  "id": 406,                    // ← PEDIDO ID - USE ESTE!
  "numero_pedido": "P001",
  "rastreamento": {
    "id": 2,                    // ← RASTREAMENTO ID - NÃO USE!
    "status": "em_entrega"
  }
}
```

### Regra de Ouro

**SEMPRE use `pedido.id` (406) nas rotas:**
- `/pedidos/406/iniciar` ✅
- `/pedidos/406/localizacao` ✅
- `/pedidos/406/entregue` ✅

**NUNCA use `rastreamento.id` (2):**
- `/pedidos/2/iniciar` ❌
- `/pedidos/2/localizacao` ❌

---

## ✅ Checklist de Implementação

### 1. Listar Pedidos
- [ ] Usar `pedido.id` (não rastreamento.id)
- [ ] Mostrar status do rastreamento
- [ ] Verificar se rastreamento existe

### 2. Iniciar Entrega
- [ ] Usar `pedido.id` na URL
- [ ] Aguardar resposta de sucesso
- [ ] Atualizar estado local para `em_entrega`

### 3. Atualizar Localização
- [ ] Usar o MESMO `pedido.id` usado para iniciar
- [ ] Verificar se status é `em_entrega` antes
- [ ] Enviar a cada 10-30 segundos
- [ ] Tratar erros 404/400 adequadamente

### 4. Marcar Entregue
- [ ] Usar o MESMO `pedido.id`
- [ ] Parar envio de localização
- [ ] Atualizar estado para `entregue`

---

## 🧪 Teste Manual

### 1. Listar Pedidos
```bash
GET http://localhost:3001/api/v1/gerencial/demo-restaurante/rastreamento/pedidos
Authorization: Bearer {token}
```

**Verificar:** `pedido.id` retornado (ex: 406)

### 2. Iniciar Entrega
```bash
POST http://localhost:3001/api/v1/gerencial/demo-restaurante/rastreamento/pedidos/406/iniciar
Authorization: Bearer {token}
```

**Verificar:** Status muda para `em_entrega` no banco

### 3. Atualizar Localização
```bash
PUT http://localhost:3001/api/v1/gerencial/demo-restaurante/rastreamento/pedidos/406/localizacao
Authorization: Bearer {token}
Content-Type: application/json

{
  "latitude": -23.5505,
  "longitude": -46.6333
}
```

**Verificar:** Localização é salva no banco

### 4. Marcar Entregue
```bash
POST http://localhost:3001/api/v1/gerencial/demo-restaurante/rastreamento/pedidos/406/entregue
Authorization: Bearer {token}
```

**Verificar:** Status muda para `entregue`

---

## 🎯 Conclusão

O problema do 404 geralmente é:
1. **Pedido ID incorreto** - Usando número errado (4 em vez de 406)
2. **Rastreamento não iniciado** - Tentando atualizar antes de iniciar
3. **Rastreamento não existe** - Pedido não está "Pronto"

**Sempre:**
- ✅ Use `pedido.id` (não `rastreamento.id`)
- ✅ Verifique se rastreamento foi iniciado antes de atualizar
- ✅ Use o mesmo `pedido.id` em todas as rotas do mesmo pedido
- ✅ Adicione logs para debug

Tudo documentado! 🚀

