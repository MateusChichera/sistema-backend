# Rastreamento de Entrega - Documentação Frontend

## 📋 Visão Geral

Sistema de rastreamento de entrega em tempo real para pedidos. O motoboy acessa uma página web no celular, inicia a entrega e o cliente acompanha em tempo real.

---

## ⚙️ Configuração

### Configuração da Empresa

A empresa precisa ativar a configuração `whatsapp_rastreamento_pedido`:

```json
{
  "whatsapp_rastreamento_pedido": 1  // 1 = Ativado, 0 = Desativado
}
```

**Importante:**
- Se **ATIVADO**: Quando status mudar para "Pronto", NÃO envia WhatsApp de "Saiu para Entrega". Só envia quando motoboy iniciar entrega.
- Se **DESATIVADO**: Quando status mudar para "Pronto", envia WhatsApp normalmente.

---

## 📱 Tela do Motoboy

### URL Base

```
https://athospp.com.br/{slug}/motoboy/pedidos
```

### Fluxo Completo

1. **Lista de Pedidos** → Motoboy vê pedidos prontos para entrega
2. **Selecionar Pedido** → Motoboy clica em um pedido
3. **Página de Rastreamento** → Iniciar entrega + mapa
4. **Em Entrega** → Mapa atualizado em tempo real
5. **Marcar como Entregue** → Finalizar entrega

---

## 🛠️ Rotas da API

### 1. Listar Pedidos para Motoboy

**GET** `/api/v1/gerencial/:slug/rastreamento/pedidos`

**Headers:**
```
Authorization: Bearer {token}
```

**Resposta:**
```json
{
  "pedidos": [
    {
      "id": 123,
      "numero_pedido": "P001",
      "status": "Pronto",
      "tipo_entrega": "Delivery",
      "valor_total": 45.50,
      "cliente": "João Silva",
      "telefone": "11999999999",
      "endereco": "Rua das Flores, 100 - Apto 5",
      "data_pedido": "2024-01-15T14:30:00.000Z",
      "rastreamento": null  // ou { id, status, data_inicio }
    }
  ]
}
```

**Filtros:**
- Mostra apenas pedidos com `status = 'Pronto'`
- Mostra apenas pedidos com `tipo_entrega = 'Delivery'`
- Mostra apenas pedidos com rastreamento `null`, `pendente` ou `em_entrega`

---

### 2. Iniciar Rastreamento

**POST** `/api/v1/gerencial/:slug/rastreamento/pedidos/:id/iniciar`

**Headers:**
```
Authorization: Bearer {token}
```

**Resposta:**
```json
{
  "message": "Rastreamento iniciado com sucesso",
  "rastreamento": {
    "id": 1,
    "pedido_id": 123,
    "status": "em_entrega",
    "data_inicio": "2024-01-15T15:00:00.000Z"
  }
}
```

**O que acontece:**
- Status do rastreamento muda para `em_entrega`
- Sistema envia WhatsApp ao cliente: "Pedido Saiu para Entrega!"
- Cliente recebe link de rastreamento

---

### 3. Atualizar Localização

**PUT** `/api/v1/gerencial/:slug/rastreamento/pedidos/:id/localizacao`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body:**
```json
{
  "latitude": -23.5505,
  "longitude": -46.6333
}
```

**Resposta:**
```json
{
  "message": "Localização atualizada com sucesso",
  "localizacao": {
    "latitude": -23.5505,
    "longitude": -46.6333,
    "timestamp": "2024-01-15T15:05:00.000Z"
  }
}
```

**Recomendação:**
- Enviar localização a cada **10-30 segundos** durante a entrega
- Usar `navigator.geolocation.watchPosition()` no JavaScript

---

### 4. Marcar como Entregue

**POST** `/api/v1/gerencial/:slug/rastreamento/pedidos/:id/entregue`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

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
    "id": 1,
    "pedido_id": 123,
    "status": "entregue",
    "data_entrega": "2024-01-15T15:30:00.000Z"
  }
}
```

**O que acontece:**
- Status do rastreamento muda para `entregue`
- Sistema envia WhatsApp ao cliente: "Pedido Entregue! ✅"
- **IMPORTANTE**: Status do pedido NÃO muda (continua "Pronto")

---

### 5. Status do Rastreamento (Público - Cliente)

**GET** `/api/v1/:slug/pedidos/:id/rastreamento/publico`

**Sem autenticação necessária**

**Resposta:**
```json
{
  "rastreamento": {
    "id": 1,
    "pedido_id": 123,
    "numero_pedido": "P001",
    "status": "em_entrega",
    "latitude": -23.5505,
    "longitude": -46.6333,
    "data_inicio": "2024-01-15T15:00:00.000Z",
    "data_entrega": null,
    "endereco_entrega": "Rua das Flores, 100",
    "historico": [
      {
        "latitude": -23.5500,
        "longitude": -46.6330,
        "timestamp": "2024-01-15T15:00:00.000Z"
      },
      {
        "latitude": -23.5505,
        "longitude": -46.6333,
        "timestamp": "2024-01-15T15:05:00.000Z"
      }
    ]
  }
}
```

---

## 🎨 Estrutura da Tela do Motoboy

### 1. Lista de Pedidos

**Página:** `/{slug}/motoboy/pedidos`

**Componentes:**
- Header com título "Pedidos para Entrega"
- Lista de cards com pedidos
- Cada card mostra:
  - Número do pedido
  - Nome do cliente
  - Endereço
  - Valor total
  - Status do rastreamento (se já iniciado)

**Exemplo de Card:**
```
┌─────────────────────────────┐
│ 📋 Pedido #123              │
│ 👤 João Silva                │
│ 📍 Rua das Flores, 100       │
│ 💰 R$ 45.50                  │
│ [Iniciar Entrega]           │
└─────────────────────────────┘
```

**Ação:**
- Clicar no card abre página de rastreamento

---

### 2. Página de Rastreamento

**Página:** `/{slug}/motoboy/pedido/:id`

**Layout:**

```
┌─────────────────────────────────┐
│  ← Voltar                       │
│                                  │
│  📋 Pedido #123                 │
│  👤 João Silva                   │
│  📍 Rua das Flores, 100         │
│  💰 R$ 45.50                    │
│                                  │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  │      MAPA               │   │
│  │   (Google Maps/         │   │
│  │    Mapbox/Leaflet)      │   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                  │
│  [Iniciar Entrega]              │
│                                  │
└─────────────────────────────────┘
```

**Estados:**

#### Estado 1: Aguardando Início
- Mapa mostra apenas endereço de entrega
- Botão: "Iniciar Entrega"
- Solicitar permissão de localização ao carregar

#### Estado 2: Em Entrega
- Mapa mostra posição atual do motoboy (marcador)
- Mapa mostra endereço de entrega (marcador)
- Mapa mostra rota (opcional)
- Localização atualizada automaticamente a cada 10-30 segundos
- Botão: "Marcar como Entregue"
- Indicador: "🛵 Em entrega..."

#### Estado 3: Entregue
- Mapa mostra posição final
- Mensagem: "✅ Pedido entregue com sucesso!"
- Botão: "Voltar para Lista"

---

## 💻 Implementação JavaScript

### Exemplo Completo de Rastreamento

```javascript
// Componente React/Vue/React Native
import { useState, useEffect } from 'react';
import axios from 'axios';

function RastreamentoPedido({ pedidoId, slug, token }) {
  const [status, setStatus] = useState('pendente'); // pendente, em_entrega, entregue
  const [localizacaoAtual, setLocalizacaoAtual] = useState(null);
  const [watchId, setWatchId] = useState(null);

  // Iniciar entrega
  const iniciarEntrega = async () => {
    try {
      // Solicitar permissão de localização
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            // Iniciar rastreamento no backend
            await axios.post(
              `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoId}/iniciar`,
              {},
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            );

            setStatus('em_entrega');
            
            // Começar a enviar localização a cada 10 segundos
            iniciarEnvioLocalizacao(pedidoId, slug, token);
          },
          (error) => {
            alert('Erro ao obter localização. Verifique as permissões.');
          },
          { enableHighAccuracy: true }
        );
      }
    } catch (error) {
      console.error('Erro ao iniciar entrega:', error);
    }
  };

  // Enviar localização periodicamente
  const iniciarEnvioLocalizacao = (pedidoId, slug, token) => {
    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        setLocalizacaoAtual({ latitude, longitude });

        try {
          await axios.put(
            `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoId}/localizacao`,
            { latitude, longitude },
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );
        } catch (error) {
          console.error('Erro ao atualizar localização:', error);
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
  };

  // Marcar como entregue
  const marcarEntregue = async () => {
    try {
      // Parar de enviar localização
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }

      await axios.post(
        `/api/v1/gerencial/${slug}/rastreamento/pedidos/${pedidoId}/entregue`,
        { observacoes: '' },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setStatus('entregue');
      alert('Pedido marcado como entregue!');
    } catch (error) {
      console.error('Erro ao marcar como entregue:', error);
    }
  };

  return (
    <div>
      {/* Mapa */}
      <div id="mapa" style={{ width: '100%', height: '400px' }}></div>

      {/* Botões */}
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
          <button onClick={() => window.location.href = `/${slug}/motoboy/pedidos`}>
            Voltar para Lista
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 🗺️ Integração com Mapas

### Google Maps

```javascript
// Inicializar mapa
const mapa = new google.maps.Map(document.getElementById('mapa'), {
  zoom: 15,
  center: { lat: -23.5505, lng: -46.6333 }
});

// Adicionar marcador de endereço
const marcadorEndereco = new google.maps.Marker({
  position: { lat: enderecoLat, lng: enderecoLng },
  map: mapa,
  title: 'Endereço de Entrega',
  icon: '📍'
});

// Adicionar marcador do motoboy (atualizar)
const marcadorMotoboy = new google.maps.Marker({
  position: { lat: localizacaoAtual.latitude, lng: localizacaoAtual.longitude },
  map: mapa,
  title: 'Motoboy',
  icon: '🛵'
});

// Atualizar posição do motoboy
marcadorMotoboy.setPosition({
  lat: localizacaoAtual.latitude,
  lng: localizacaoAtual.longitude
});

// Desenhar rota (opcional)
const directionsService = new google.maps.DirectionsService();
const directionsRenderer = new google.maps.DirectionsRenderer();
directionsRenderer.setMap(mapa);

directionsService.route({
  origin: { lat: localizacaoAtual.latitude, lng: localizacaoAtual.longitude },
  destination: { lat: enderecoLat, lng: enderecoLng },
  travelMode: 'DRIVING'
}, (result, status) => {
  if (status === 'OK') {
    directionsRenderer.setDirections(result);
  }
});
```

---

## 📱 Responsividade Mobile

### CSS Mobile-First

```css
.motoboy-container {
  width: 100%;
  padding: 16px;
  box-sizing: border-box;
}

.mapa-container {
  width: 100%;
  height: 400px;
  margin: 16px 0;
  border-radius: 8px;
  overflow: hidden;
}

.botao-primario {
  width: 100%;
  padding: 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 16px;
}

.card-pedido {
  background: white;
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

@media (min-width: 768px) {
  .motoboy-container {
    max-width: 600px;
    margin: 0 auto;
  }
}
```

---

## ✅ Checklist de Implementação

### Backend
- [x] SQL criado
- [x] Controller criado
- [x] Rotas criadas
- [x] Lógica WhatsApp ajustada

### Frontend

#### Lista de Pedidos
- [ ] Criar página `/{slug}/motoboy/pedidos`
- [ ] Listar pedidos via API
- [ ] Mostrar cards com informações
- [ ] Navegação para página de rastreamento

#### Página de Rastreamento
- [ ] Solicitar permissão de localização
- [ ] Integrar mapa (Google Maps/Mapbox/Leaflet)
- [ ] Botão "Iniciar Entrega"
- [ ] Enviar localização periodicamente (10-30s)
- [ ] Atualizar mapa em tempo real
- [ ] Botão "Marcar como Entregue"
- [ ] Feedback visual de status

#### Responsividade
- [ ] Layout mobile-first
- [ ] Teste em diferentes tamanhos de tela
- [ ] Touch-friendly (botões grandes)
- [ ] Indicadores visuais claros

---

## 🎯 Resumo

1. **Configuração**: Empresa ativa/desativa rastreamento
2. **Lista de Pedidos**: Motoboy vê pedidos prontos
3. **Iniciar Entrega**: Motoboy clica e sistema envia WhatsApp
4. **Durante Entrega**: Localização atualizada automaticamente
5. **Marcar Entregue**: Motoboy finaliza e cliente recebe aviso

Tudo funcionando! 🚀

