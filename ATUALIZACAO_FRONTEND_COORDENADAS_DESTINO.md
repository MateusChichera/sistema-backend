# 🗺️ Atualização Frontend - Coordenadas do Destino no Rastreamento

## 📋 Resumo das Mudanças

O backend foi atualizado para incluir e retornar as **coordenadas do destino do pedido** (`latitude_destino` e `longitude_destino`) nas respostas de rastreamento público. Isso permite que o pin do endereço apareça **exatamente** no local correto do mapa, sem precisar usar geocoding.

---

## ✅ O que mudou

### 1. Criar Pedido - Agora aceita coordenadas do destino

Ao criar um pedido via `POST /api/v1/gerencial/{slug}/pedidos`, o backend agora aceita coordenadas do destino no body:

```javascript
{
  // ... outros campos do pedido
  "latitude_destino": "-22.1329732",    // ✅ NOVO: Latitude do endereço de destino
  "longitude_destino": "-51.4054636",   // ✅ NOVO: Longitude do endereço de destino
  // ... outros campos
}
```

**Campos aceitos (em ordem de prioridade):**
- `latitude_destino` / `longitude_destino` (preferenciais)
- `latitude_entrega` / `longitude_entrega` (alternativos)
- `endereco_latitude` / `endereco_longitude` (alternativos)
- `lat_destino` / `lng_destino` (alternativos, formato curto)

**Recomendação:** Use sempre `latitude_destino` e `longitude_destino`.

---

### 2. API de Rastreamento Público - Agora retorna coordenadas do destino

**Rota:** `GET /{slug}/pedidos/{id}/rastreamento/publico`

**Nova resposta:**
```json
{
  "rastreamento": {
    "id": 16,
    "pedido_id": 422,
    "numero_pedido": "PED-001",
    "status": "em_entrega",
    "latitude": "-22.13300102",          // Coordenadas do MOTOBOY (atualiza em tempo real)
    "longitude": "-46.634258",           // Coordenadas do MOTOBOY (atualiza em tempo real)
    "latitude_destino": "-22.1329732",   // ✅ NOVO: Coordenadas do DESTINO (fixo - pin no mapa)
    "longitude_destino": "-51.4054636",  // ✅ NOVO: Coordenadas do DESTINO (fixo - pin no mapa)
    "data_inicio": "2024-01-15T10:30:00",
    "data_entrega": null,
    "endereco_entrega": "Rua Gilberto Janota Mele, 140...",
    "historico": [...]
  }
}
```

---

### 3. Eventos Socket.IO - Agora incluem coordenadas do destino

Todos os eventos Socket.IO agora também incluem as coordenadas do destino:

#### Evento `rastreamento_updated` (Ao iniciar entrega ou marcar como entregue)

```javascript
socket.on('rastreamento_updated', (data) => {
  console.log(data);
  // {
  //   rastreamento: {
  //     id: 16,
  //     status: 'em_entrega',
  //     latitude: "-22.13300102",          // Motoboy
  //     longitude: "-46.634258",           // Motoboy
  //     latitude_destino: "-22.1329732",  // ✅ NOVO: Destino (pin fixo)
  //     longitude_destino: "-51.4054636", // ✅ NOVO: Destino (pin fixo)
  //     data_inicio: "2024-01-15T10:30:00",
  //     numero_pedido: "PED-001"
  //   },
  //   pedidoId: 422
  // }
});
```

#### Evento `localizacao_updated` (Ao atualizar localização do motoboy)

Este evento continua enviando apenas as coordenadas atualizadas do motoboy. As coordenadas do destino devem ser obtidas na primeira carga ou no evento `rastreamento_updated`:

```javascript
socket.on('localizacao_updated', (data) => {
  console.log(data);
  // {
  //   latitude: "-22.13300102",    // Coordenadas do MOTOBOY (atualizada)
  //   longitude: "-46.634258",     // Coordenadas do MOTOBOY (atualizada)
  //   pedidoId: 422,
  //   timestamp: "2024-01-15T10:35:00.000Z"
  // }
});
```

---

## 📝 Implementação no Frontend

### 1. Criar Pedido com Coordenadas

Ao criar um pedido, inclua as coordenadas do destino:

```javascript
// Exemplo: Criar pedido com coordenadas
const criarPedido = async (pedidoData) => {
  const response = await fetch(`/api/v1/gerencial/${slug}/pedidos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      ...pedidoData,
      // Incluir coordenadas do destino quando o usuário selecionar o endereço no mapa
      latitude_destino: enderecoSelecionado.latitude,    // ✅ NOVO
      longitude_destino: enderecoSelecionado.longitude, // ✅ NOVO
    })
  });
  
  return await response.json();
};
```

**Quando obter as coordenadas:**
- Quando o cliente seleciona um endereço no mapa (Google Maps, Leaflet, etc.)
- Ao usar geocoding do endereço
- Quando o cliente marca a localização manualmente

---

### 2. Obter Rastreamento Público

Ao carregar a página de rastreamento público:

```javascript
// Exemplo: Carregar dados iniciais do rastreamento
const carregarRastreamento = async (slug, pedidoId) => {
  const response = await fetch(`/api/v1/${slug}/pedidos/${pedidoId}/rastreamento/publico`);
  const data = await response.json();
  
  const { rastreamento } = data;
  
  // ✅ Coordenadas do destino (fixo - pin no mapa)
  if (rastreamento.latitude_destino && rastreamento.longitude_destino) {
    // Posicionar pin do destino no mapa
    map.setMarker('destino', {
      lat: rastreamento.latitude_destino,
      lng: rastreamento.longitude_destino,
      icon: 'pin-destino', // Ícone diferente para destino
      draggable: false // Pin fixo, não arrasta
    });
  }
  
  // Coordenadas do motoboy (atualiza em tempo real)
  if (rastreamento.latitude && rastreamento.longitude) {
    map.setMarker('motoboy', {
      lat: rastreamento.latitude,
      lng: rastreamento.longitude,
      icon: 'pin-motoboy',
      draggable: false
    });
  }
  
  return rastreamento;
};
```

---

### 3. Atualizar via Socket.IO

Configurar Socket.IO para atualizar o mapa em tempo real:

```javascript
// Exemplo: Configurar Socket.IO para rastreamento
const configurarSocketRastreamento = (slug, pedidoId) => {
  const socket = io('http://seu-servidor.com');
  
  // Entrar na sala do rastreamento
  socket.emit('join_rastreamento_room', { slug, pedidoId });
  
  // Escutar atualizações de localização do motoboy
  socket.on('localizacao_updated', (data) => {
    const { latitude, longitude } = data;
    
    // Atualizar apenas a posição do motoboy
    map.updateMarker('motoboy', {
      lat: latitude,
      lng: longitude
    });
    
    // Desenhar rota/linha do histórico se necessário
    map.drawRoute([...historico, { lat: latitude, lng: longitude }]);
  });
  
  // Escutar atualizações de status (inclui coordenadas do destino)
  socket.on('rastreamento_updated', (data) => {
    const { rastreamento } = data;
    
    // Atualizar posição do motoboy
    if (rastreamento.latitude && rastreamento.longitude) {
      map.updateMarker('motoboy', {
        lat: rastreamento.latitude,
        lng: rastreamento.longitude
      });
    }
    
    // ✅ Atualizar coordenadas do destino (se necessário)
    if (rastreamento.latitude_destino && rastreamento.longitude_destino) {
      map.setMarker('destino', {
        lat: rastreamento.latitude_destino,
        lng: rastreamento.longitude_destino,
        icon: 'pin-destino'
      });
    }
    
    // Atualizar status
    atualizarStatus(rastreamento.status);
  });
  
  // Limpar ao sair
  return () => {
    socket.emit('leave_rastreamento_room', { slug, pedidoId });
    socket.disconnect();
  };
};
```

---

## 🎯 Exemplo Completo - React

```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

function RastreamentoPublico({ slug, pedidoId }) {
  const [rastreamento, setRastreamento] = useState(null);
  const [mapa, setMapa] = useState(null);
  
  useEffect(() => {
    // Carregar dados iniciais
    fetch(`/api/v1/${slug}/pedidos/${pedidoId}/rastreamento/publico`)
      .then(res => res.json())
      .then(data => {
        setRastreamento(data.rastreamento);
        
        // ✅ Posicionar pin do destino
        if (data.rastreamento.latitude_destino && data.rastreamento.longitude_destino) {
          mapa?.setMarker('destino', {
            lat: parseFloat(data.rastreamento.latitude_destino),
            lng: parseFloat(data.rastreamento.longitude_destino),
            icon: 'pin-destino',
            label: 'Destino'
          });
        }
        
        // Posicionar motoboy
        if (data.rastreamento.latitude && data.rastreamento.longitude) {
          mapa?.setMarker('motoboy', {
            lat: parseFloat(data.rastreamento.latitude),
            lng: parseFloat(data.rastreamento.longitude),
            icon: 'pin-motoboy',
            label: 'Motoboy'
          });
        }
      });
    
    // Configurar Socket.IO
    const socket = io('http://seu-servidor.com');
    socket.emit('join_rastreamento_room', { slug, pedidoId });
    
    socket.on('localizacao_updated', (data) => {
      const { latitude, longitude } = data;
      
      // Atualizar apenas motoboy
      mapa?.updateMarker('motoboy', {
        lat: parseFloat(latitude),
        lng: parseFloat(longitude)
      });
      
      // Atualizar histórico
      setRastreamento(prev => ({
        ...prev,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      }));
    });
    
    socket.on('rastreamento_updated', (data) => {
      setRastreamento(prev => ({
        ...prev,
        ...data.rastreamento
      }));
      
      // Atualizar motoboy
      if (data.rastreamento.latitude && data.rastreamento.longitude) {
        mapa?.updateMarker('motoboy', {
          lat: parseFloat(data.rastreamento.latitude),
          lng: parseFloat(data.rastreamento.longitude)
        });
      }
      
      // ✅ Atualizar destino se necessário
      if (data.rastreamento.latitude_destino && data.rastreamento.longitude_destino) {
        mapa?.setMarker('destino', {
          lat: parseFloat(data.rastreamento.latitude_destino),
          lng: parseFloat(data.rastreamento.longitude_destino),
          icon: 'pin-destino'
        });
      }
    });
    
    return () => {
      socket.emit('leave_rastreamento_room', { slug, pedidoId });
      socket.disconnect();
    };
  }, [slug, pedidoId]);
  
  return (
    <div>
      <Mapa ref={setMapa} />
      {rastreamento && (
        <div>
          <p>Status: {rastreamento.status}</p>
          <p>Motoboy: {rastreamento.latitude}, {rastreamento.longitude}</p>
          {rastreamento.latitude_destino && (
            <p>Destino: {rastreamento.latitude_destino}, {rastreamento.longitude_destino}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 📋 Checklist de Implementação

### ✅ Criar Pedido
- [ ] Incluir `latitude_destino` e `longitude_destino` no body ao criar pedido
- [ ] Obter coordenadas quando cliente seleciona endereço no mapa
- [ ] Enviar coordenadas como `number` (não string)

### ✅ Rastreamento Público
- [ ] Usar `latitude_destino` e `longitude_destino` para posicionar pin do destino
- [ ] Usar `latitude` e `longitude` para posicionar pin do motoboy
- [ ] Verificar se coordenadas existem antes de criar marker (podem ser `null`)

### ✅ Socket.IO
- [ ] Atualizar posição do motoboy quando receber `localizacao_updated`
- [ ] Atualizar coordenadas do destino quando receber `rastreamento_updated`
- [ ] Entrar na sala com `join_rastreamento_room` ao carregar página
- [ ] Sair da sala com `leave_rastreamento_room` ao sair da página

---

## ⚠️ Observações Importantes

1. **Campos Opcionais**: `latitude_destino` e `longitude_destino` podem ser `null` se o pedido não tiver coordenadas salvas (pedidos antigos).

2. **Formato**: As coordenadas são enviadas como `number` (não string). Use `parseFloat()` se necessário.

3. **Prioridade**: O backend usa a seguinte prioridade ao buscar coordenadas:
   - `latitude_destino` / `longitude_destino` (preferencial)
   - `latitude_entrega` / `longitude_entrega`
   - `endereco_latitude` / `endereco_longitude`
   - `lat_destino` / `lng_destino`

4. **Compatibilidade**: Se enviar coordenadas em campos alternativos (`latitude_entrega`, etc.), o backend ainda conseguirá usá-las, mas recomenda-se usar sempre `latitude_destino` e `longitude_destino`.

---

## 🎯 Resultado Esperado

Com essas mudanças:

- ✅ O pin do destino aparecerá **exatamente** no local correto do mapa
- ✅ Não precisará usar geocoding do endereço (tem erro de ~2 quarteirões)
- ✅ Funcionará corretamente mesmo com pedidos antigos sem coordenadas (será `null`)
- ✅ Atualizações em tempo real incluirão as coordenadas do destino quando necessário

---

## 📚 Referências

- **API Criar Pedido**: `POST /api/v1/gerencial/{slug}/pedidos`
- **API Rastreamento Público**: `GET /{slug}/pedidos/{id}/rastreamento/publico`
- **Eventos Socket.IO**: `localizacao_updated`, `rastreamento_updated`
- **Handlers Socket.IO**: `join_rastreamento_room`, `leave_rastreamento_room`

---

**Data de Atualização**: Janeiro 2025  
**Versão Backend**: Atualizada com suporte a coordenadas do destino

