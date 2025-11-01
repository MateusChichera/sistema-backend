# 🗺️ Coordenadas do Destino no Rastreamento Público - Implementação Backend

## 📋 Resumo

O backend foi atualizado para incluir as **coordenadas do destino do pedido** (`latitude_destino` e `longitude_destino`) na resposta da API de rastreamento público e nos eventos Socket.IO em tempo real.

---

## ✅ O que foi implementado

### 1. API de Rastreamento Público Atualizada

**Rota:** `GET /{slug}/pedidos/{id}/rastreamento/publico`

A resposta agora inclui as coordenadas do destino do pedido:

```json
{
  "rastreamento": {
    "id": 16,
    "pedido_id": 422,
    "numero_pedido": "PED-001",
    "status": "em_entrega",
    "latitude": "-22.13300102",          // ✅ Coordenadas do MOTOBOY
    "longitude": "-46.634258",           // ✅ Coordenadas do MOTOBOY
    "latitude_destino": "-22.1329732",    // ✅ NOVO: Coordenadas do DESTINO (PEDIDO)
    "longitude_destino": "-51.4054636",   // ✅ NOVO: Coordenadas do DESTINO (PEDIDO)
    "data_inicio": "2024-01-15T10:30:00",
    "data_entrega": null,
    "endereco_entrega": "Rua Gilberto Janota Mele, 140, humberto salvador, CEP: 19100-110, Presidente Prudente - SP",
    "historico": [
      {
        "latitude": "-22.13300102",
        "longitude": "-46.634258",
        "timestamp": "2024-01-15T10:35:00"
      }
    ]
  }
}
```

### 2. Eventos Socket.IO Atualizados

Todos os eventos Socket.IO agora também incluem as coordenadas do destino:

#### A. Evento `rastreamento_updated` (Ao iniciar entrega)

```javascript
socket.on('rastreamento_updated', (data) => {
  console.log(data);
  // {
  //   rastreamento: {
  //     id: 16,
  //     status: 'em_entrega',
  //     latitude: "-22.13300102",          // Coordenadas do MOTOBOY
  //     longitude: "-46.634258",           // Coordenadas do MOTOBOY
  //     latitude_destino: "-22.1329732",    // ✅ NOVO: Coordenadas do DESTINO
  //     longitude_destino: "-51.4054636",  // ✅ NOVO: Coordenadas do DESTINO
  //     data_inicio: "2024-01-15T10:30:00",
  //     numero_pedido: "PED-001"
  //   },
  //   pedidoId: 422
  // }
});
```

#### B. Evento `rastreamento_updated` (Ao marcar como entregue)

```javascript
socket.on('rastreamento_updated', (data) => {
  console.log(data);
  // {
  //   rastreamento: {
  //     id: 16,
  //     status: 'entregue',
  //     latitude: "-22.13300102",
  //     longitude: "-46.634258",
  //     latitude_destino: "-22.1329732",    // ✅ NOVO: Coordenadas do DESTINO
  //     longitude_destino: "-51.4054636",  // ✅ NOVO: Coordenadas do DESTINO
  //     data_inicio: "2024-01-15T10:30:00",
  //     data_entrega: "2024-01-15T11:00:00",
  //     numero_pedido: "PED-001"
  //   },
  //   pedidoId: 422
  // }
});
```

#### C. Evento `localizacao_updated` (Ao atualizar localização do motoboy)

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

## 🔍 Prioridade dos Campos de Coordenadas

O backend busca as coordenadas do destino na seguinte ordem de prioridade:

1. **`latitude_destino` / `longitude_destino`** (preferencial)
2. **`latitude_entrega` / `longitude_entrega`** (fallback)
3. **`endereco_latitude` / `endereco_longitude`** (fallback)
4. **`lat_destino` / `lng_destino`** (fallback)

Se nenhum campo for encontrado, os valores serão `null`.

---

## 📝 Estrutura da Resposta

### Campos Disponíveis

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `latitude` | `number \| null` | Coordenada de latitude atual do **motoboy** |
| `longitude` | `number \| null` | Coordenada de longitude atual do **motoboy** |
| `latitude_destino` | `number \| null` | ✅ **NOVO** - Coordenada de latitude do **destino do pedido** |
| `longitude_destino` | `number \| null` | ✅ **NOVO** - Coordenada de longitude do **destino do pedido** |

### Exemplo Completo

```json
{
  "rastreamento": {
    "id": 16,
    "pedido_id": 422,
    "numero_pedido": "PED-001",
    "status": "em_entrega",
    "latitude": "-22.13300102",          // Motoboy
    "longitude": "-46.634258",           // Motoboy
    "latitude_destino": "-22.1329732",   // Destino (PIN NO MAPA)
    "longitude_destino": "-51.4054636",  // Destino (PIN NO MAPA)
    "data_inicio": "2024-01-15T10:30:00",
    "data_entrega": null,
    "endereco_entrega": "Rua Gilberto Janota Mele, 140...",
    "historico": [...]
  }
}
```

---

## 🎯 Como Usar no Frontend

### 1. Obter Coordenadas na Primeira Carga

```javascript
// Ao carregar a página de rastreamento
const response = await fetch(`/api/v1/${slug}/pedidos/${pedidoId}/rastreamento/publico`);
const data = await response.json();

const { rastreamento } = data;

// Coordenadas do motoboy (atualiza em tempo real)
const motoboyLat = rastreamento.latitude;
const motoboyLng = rastreamento.longitude;

// ✅ Coordenadas do destino (fixo - pin no mapa)
const destinoLat = rastreamento.latitude_destino;
const destinoLng = rastreamento.longitude_destino;

// Posicionar pin do destino no mapa
if (destinoLat && destinoLng) {
  map.setMarker('destino', {
    lat: destinoLat,
    lng: destinoLng
  });
}
```

### 2. Atualizar Coordenadas via Socket.IO

```javascript
// Entrar na sala do rastreamento
socket.emit('join_rastreamento_room', { slug, pedidoId });

// Escutar atualizações de localização do motoboy
socket.on('localizacao_updated', (data) => {
  // Atualizar apenas a posição do motoboy
  const { latitude, longitude } = data;
  updateMotoboyPosition(latitude, longitude);
});

// Escutar atualizações de status (inclui coordenadas do destino)
socket.on('rastreamento_updated', (data) => {
  const { rastreamento } = data;
  
  // Atualizar posição do motoboy
  if (rastreamento.latitude && rastreamento.longitude) {
    updateMotoboyPosition(rastreamento.latitude, rastreamento.longitude);
  }
  
  // ✅ Atualizar coordenadas do destino (se necessário)
  if (rastreamento.latitude_destino && rastreamento.longitude_destino) {
    map.setMarker('destino', {
      lat: rastreamento.latitude_destino,
      lng: rastreamento.longitude_destino
    });
  }
  
  // Atualizar status
  updateStatus(rastreamento.status);
});
```

### 3. Exemplo Completo com React/Mapa

```javascript
import { useEffect, useState } from 'react';
import { useSocket } from './socket';

function RastreamentoPage({ slug, pedidoId }) {
  const [rastreamento, setRastreamento] = useState(null);
  const socket = useSocket();

  useEffect(() => {
    // Carregar dados iniciais
    fetch(`/api/v1/${slug}/pedidos/${pedidoId}/rastreamento/publico`)
      .then(res => res.json())
      .then(data => {
        setRastreamento(data.rastreamento);
        
        // ✅ Posicionar pin do destino
        if (data.rastreamento.latitude_destino && data.rastreamento.longitude_destino) {
          map.setMarker('destino', {
            lat: data.rastreamento.latitude_destino,
            lng: data.rastreamento.longitude_destino
          });
        }
        
        // Posicionar motoboy
        if (data.rastreamento.latitude && data.rastreamento.longitude) {
          map.setMarker('motoboy', {
            lat: data.rastreamento.latitude,
            lng: data.rastreamento.longitude
          });
        }
      });

    // Entrar na sala do rastreamento
    socket.emit('join_rastreamento_room', { slug, pedidoId });

    // Escutar atualizações de localização
    socket.on('localizacao_updated', (data) => {
      setRastreamento(prev => ({
        ...prev,
        latitude: data.latitude,
        longitude: data.longitude
      }));
      map.updateMarker('motoboy', {
        lat: data.latitude,
        lng: data.longitude
      });
    });

    // Escutar atualizações de status
    socket.on('rastreamento_updated', (data) => {
      setRastreamento(prev => ({
        ...prev,
        ...data.rastreamento
      }));
      
      // Atualizar pin do destino se necessário
      if (data.rastreamento.latitude_destino && data.rastreamento.longitude_destino) {
        map.setMarker('destino', {
          lat: data.rastreamento.latitude_destino,
          lng: data.rastreamento.longitude_destino
        });
      }
    });

    return () => {
      socket.emit('leave_rastreamento_room', { slug, pedidoId });
    };
  }, [slug, pedidoId]);

  return (
    <div>
      <Map />
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

## 🔧 Mudanças Técnicas no Backend

### 1. Função Auxiliar Criada

```javascript
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
```

### 2. Query SQL Atualizada

A query agora busca todos os campos possíveis de coordenadas do pedido:

```sql
SELECT r.*, 
       p.numero_pedido, 
       p.endereco_entrega, 
       p.complemento_entrega, 
       p.numero_entrega,
       p.latitude_destino,
       p.longitude_destino,
       p.latitude_entrega,
       p.longitude_entrega,
       p.endereco_latitude,
       p.endereco_longitude,
       p.lat_destino,
       p.lng_destino
FROM rastreamento_entrega r
JOIN pedidos p ON r.pedido_id = p.id
WHERE r.pedido_id = ? AND r.empresa_id = ?
```

---

## ⚠️ Observações Importantes

1. **Campos Opcionais**: `latitude_destino` e `longitude_destino` podem ser `null` se o pedido não tiver coordenadas salvas.

2. **Prioridade de Campos**: O backend tenta vários nomes de campos para garantir compatibilidade com diferentes versões do banco de dados.

3. **Formato**: As coordenadas são enviadas como `number` (não string), ou `null` se não disponíveis.

4. **Uso no Mapa**: 
   - `latitude` / `longitude`: Posição do **motoboy** (atualiza em tempo real)
   - `latitude_destino` / `longitude_destino`: Posição do **destino** (fixo, não muda)

---

## ✅ Checklist para o Frontend

- [ ] Atualizar interface para receber `latitude_destino` e `longitude_destino`
- [ ] Usar coordenadas do destino para posicionar pin fixo no mapa
- [ ] Verificar se coordenadas existem antes de criar marker
- [ ] Atualizar handlers Socket.IO para processar coordenadas do destino
- [ ] Remover uso de geocoding do endereço (agora tem coordenadas exatas)

---

## 🎯 Resultado Esperado

Com essas mudanças:

- ✅ O pin do destino aparecerá **exatamente** no local correto do endereço
- ✅ Não precisará usar geocoding (que tem erro de ~2 quarteirões)
- ✅ Funcionará corretamente mesmo com diferentes nomes de campos no banco
- ✅ Atualizações em tempo real incluirão as coordenadas do destino quando necessário

---

## 📚 Referências

- **Rota API**: `GET /{slug}/pedidos/{id}/rastreamento/publico`
- **Eventos Socket.IO**: `localizacao_updated`, `rastreamento_updated`
- **Handler Socket.IO**: `join_rastreamento_room`

---

**Data de Implementação**: Janeiro 2025  
**Versão Backend**: Atualizada com suporte a coordenadas do destino

