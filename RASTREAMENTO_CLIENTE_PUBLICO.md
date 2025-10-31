# Rastreamento de Entrega - Página Pública do Cliente

## 📋 Visão Geral

Página pública onde o cliente acompanha o rastreamento do pedido em tempo real. A página é acessível sem autenticação e mostra a localização do motoboy em tempo real no mapa.

---

## 🔗 Link de Acesso

### Formato do Link

```
https://athospp.com.br/{slug}/rastrear/{pedido_id}
```

### Exemplo

```
https://athospp.com.br/demo-restaurante/rastrear/123
```

### Como o Cliente Recebe o Link

O cliente recebe o link via WhatsApp quando:
- **Motoboy inicia entrega** (se rastreamento ativado)
- **Pedido sai para entrega** (se rastreamento desativado)

**Mensagem WhatsApp:**
```
🛵 *Pedido Saiu para Entrega!*

📋 Pedido #123
👤 Cliente: João Silva

📍 Endereço: Rua das Flores, 100 - Apto 5

🛵 Nosso motoboy está a caminho! Em breve você receberá seu pedido.

💰 Valor: R$ 50.00
   (Pedido: R$ 45.00 + Taxa de entrega: R$ 5.00)

🔗 Rastreie seu pedido em tempo real:
https://athospp.com.br/demo-restaurante/rastrear/123

Mantenha seu telefone por perto para facilitar a entrega! 📱
```

---

## 🛠️ Rotas da API

### 1. Status do Rastreamento (Público)

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
    "endereco_entrega": "Rua das Flores, 100 - Apto 5",
    "historico": [
      {
        "latitude": -23.5500,
        "longitude": -46.6330,
        "timestamp": "2024-01-15T15:00:00.000Z"
      },
      {
        "latitude": -23.5502,
        "longitude": -46.6332,
        "timestamp": "2024-01-15T15:02:00.000Z"
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

**Status Possíveis:**
- `pendente` - Aguardando motoboy iniciar entrega
- `em_entrega` - Motoboy está a caminho
- `entregue` - Pedido foi entregue
- `cancelado` - Rastreamento cancelado

---

## 🎨 Estrutura da Página

### Layout

```
┌─────────────────────────────────────┐
│  🍽️ Rastreamento de Entrega        │
│                                     │
│  📋 Pedido #123                     │
│  👤 João Silva                      │
│                                     │
│  ┌─────────────────────────────┐  │
│  │                             │  │
│  │      MAPA                    │  │
│  │   (Google Maps/Mapbox)       │  │
│  │                             │  │
│  │   🛵 Motoboy                 │  │
│  │   📍 Endereço                │  │
│  │   ── Rota ──                 │  │
│  │                             │  │
│  └─────────────────────────────┘  │
│                                     │
│  📍 Endereço de Entrega             │
│  Rua das Flores, 100 - Apto 5      │
│                                     │
│  ⏱️ Tempo Estimado: 5 minutos      │
│                                     │
│  Status: 🛵 Em trânsito            │
│                                     │
└─────────────────────────────────────┘
```

---

## 📱 Estados da Página

### Estado 1: Aguardando Início

**Quando:** Status do rastreamento = `pendente`

**O que mostra:**
- Informações do pedido (número, cliente)
- Endereço de entrega marcado no mapa
- Mensagem: "⏳ Aguardando motoboy iniciar entrega..."
- Status: "Pendente"

**Exemplo:**
```
📋 Pedido #123
👤 João Silva

📍 Endereço: Rua das Flores, 100 - Apto 5

⏳ Aguardando motoboy iniciar entrega...
```

---

### Estado 2: Em Trânsito

**Quando:** Status do rastreamento = `em_entrega`

**O que mostra:**
- Mapa com posição atual do motoboy (marcador 🛵)
- Endereço de entrega marcado (marcador 📍)
- Rota estimada entre motoboy e destino
- Histórico de posições (traço no mapa)
- Tempo estimado de chegada
- Status: "🛵 Em trânsito"
- Atualização automática a cada 5-10 segundos

**Exemplo:**
```
📋 Pedido #123
👤 João Silva

📍 Endereço: Rua das Flores, 100 - Apto 5

🛵 Em trânsito
⏱️ Chegando em: 5 minutos
📍 Distância: 1.2 km

[MAPA MOSTRANDO MOTOBOY SE MOVENDO]
```

---

### Estado 3: Chegando Próximo

**Quando:** Status = `em_entrega` E distância < 500m

**O que mostra:**
- Alerta visual: "🚚 Chegando próximo!"
- Mapa com zoom aumentado
- Contador regressivo: "Chegando em: 2 minutos"
- Status: "🚚 Quase chegando!"

**Exemplo:**
```
📋 Pedido #123

🚚 SEU PEDIDO ESTÁ CHEGANDO!

⏱️ Chegando em: 2 minutos
📍 Distância: 300 m

Mantenha seu telefone por perto!
```

---

### Estado 4: Entregue

**Quando:** Status do rastreamento = `entregue`

**O que mostra:**
- Mensagem de sucesso: "✅ Pedido entregue!"
- Mapa mostra posição final
- Data e hora da entrega
- Botão: "Fechar" ou "Fazer novo pedido"

**Exemplo:**
```
📋 Pedido #123

✅ PEDIDO ENTREGUE COM SUCESSO!

📅 Entregue em: 15/01/2024 às 15:30

Aproveite sua refeição! 🍽️

[Fechar]
```

---

### Estado 5: Cancelado

**Quando:** Status do rastreamento = `cancelado`

**O que mostra:**
- Mensagem: "❌ Rastreamento cancelado"
- Status: "Cancelado"

---

## 💻 Implementação JavaScript

### Exemplo Completo (React/Vue/React Native)

```javascript
import { useState, useEffect } from 'react';
import axios from 'axios';

function RastreamentoPublico({ slug, pedidoId }) {
  const [rastreamento, setRastreamento] = useState(null);
  const [mapa, setMapa] = useState(null);
  const [marcadorMotoboy, setMarcadorMotoboy] = useState(null);
  const [marcadorEndereco, setMarcadorEndereco] = useState(null);
  const [distancia, setDistancia] = useState(null);
  const [tempoEstimado, setTempoEstimado] = useState(null);

  // Buscar status do rastreamento
  useEffect(() => {
    const buscarStatus = async () => {
      try {
        const response = await axios.get(
          `/api/v1/${slug}/pedidos/${pedidoId}/rastreamento/publico`
        );
        setRastreamento(response.data.rastreamento);
        atualizarMapa(response.data.rastreamento);
        calcularDistancia(response.data.rastreamento);
      } catch (error) {
        console.error('Erro ao buscar rastreamento:', error);
      }
    };

    // Buscar inicialmente
    buscarStatus();

    // Atualizar a cada 5 segundos se estiver em entrega
    const intervalo = setInterval(() => {
      if (rastreamento?.status === 'em_entrega') {
        buscarStatus();
      }
    }, 5000);

    return () => clearInterval(intervalo);
  }, [slug, pedidoId, rastreamento?.status]);

  // Inicializar mapa
  useEffect(() => {
    if (typeof window !== 'undefined' && window.google) {
      const mapa = new google.maps.Map(document.getElementById('mapa'), {
        zoom: 15,
        center: { lat: -23.5505, lng: -46.6333 },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });

      setMapa(mapa);
    }
  }, []);

  // Atualizar mapa com posições
  const atualizarMapa = (rastreamento) => {
    if (!mapa || !rastreamento) return;

    // Limpar marcadores anteriores
    if (marcadorMotoboy) marcadorMotoboy.setMap(null);
    if (marcadorEndereco) marcadorEndereco.setMap(null);

    // Adicionar marcador de endereço (fixo)
    if (rastreamento.endereco_entrega) {
      // Geocodificar endereço (ou usar coordenadas se disponíveis)
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { address: rastreamento.endereco_entrega },
        (results, status) => {
          if (status === 'OK' && results[0]) {
            const enderecoPos = results[0].geometry.location;
            
            const marcador = new google.maps.Marker({
              position: enderecoPos,
              map: mapa,
              title: 'Endereço de Entrega',
              icon: {
                url: '📍',
                scaledSize: new google.maps.Size(40, 40)
              }
            });
            
            setMarcadorEndereco(marcador);
          }
        }
      );
    }

    // Adicionar marcador do motoboy (se em entrega)
    if (rastreamento.status === 'em_entrega' && rastreamento.latitude && rastreamento.longitude) {
      const motoboyPos = {
        lat: parseFloat(rastreamento.latitude),
        lng: parseFloat(rastreamento.longitude)
      };

      const marcador = new google.maps.Marker({
        position: motoboyPos,
        map: mapa,
        title: 'Motoboy',
        icon: {
          url: '🛵',
          scaledSize: new google.maps.Size(40, 40)
        },
        animation: google.maps.Animation.DROP
      });

      setMarcadorMotoboy(marcador);

      // Centralizar mapa no motoboy
      mapa.setCenter(motoboyPos);
      mapa.setZoom(15);

      // Desenhar rota (se ambos marcadores existirem)
      if (marcadorEndereco) {
        desenharRota(motoboyPos, marcadorEndereco.getPosition());
      }
    }

    // Desenhar histórico de posições
    if (rastreamento.historico && rastreamento.historico.length > 1) {
      desenharHistorico(rastreamento.historico);
    }
  };

  // Desenhar rota entre motoboy e endereço
  const desenharRota = (origem, destino) => {
    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
      map: mapa,
      suppressMarkers: true, // Não mostrar marcadores padrão
      polylineOptions: {
        strokeColor: '#007bff',
        strokeWeight: 4,
        strokeOpacity: 0.7
      }
    });

    directionsService.route(
      {
        origin: origem,
        destination: destino,
        travelMode: google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === 'OK') {
          directionsRenderer.setDirections(result);
          
          // Calcular tempo e distância
          const rota = result.routes[0];
          const leg = rota.legs[0];
          setDistancia(leg.distance.text);
          setTempoEstimado(leg.duration.text);
        }
      }
    );
  };

  // Desenhar histórico de posições (linha)
  const desenharHistorico = (historico) => {
    const path = historico.map(pos => ({
      lat: parseFloat(pos.latitude),
      lng: parseFloat(pos.longitude)
    }));

    const linha = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: '#FF0000',
      strokeOpacity: 0.5,
      strokeWeight: 3
    });

    linha.setMap(mapa);
  };

  // Calcular distância (se não tiver rota)
  const calcularDistancia = (rastreamento) => {
    if (rastreamento.status === 'em_entrega' && rastreamento.latitude && rastreamento.longitude && rastreamento.endereco_entrega) {
      // Usar Haversine para calcular distância aproximada
      // Ou usar API de geocodificação
    }
  };

  // Renderizar baseado no status
  const renderizarStatus = () => {
    if (!rastreamento) {
      return <div>Carregando...</div>;
    }

    switch (rastreamento.status) {
      case 'pendente':
        return (
          <div className="status-pendente">
            <h2>⏳ Aguardando motoboy iniciar entrega...</h2>
            <p>📋 Pedido #{rastreamento.numero_pedido}</p>
            <p>📍 {rastreamento.endereco_entrega}</p>
          </div>
        );

      case 'em_entrega':
        return (
          <div className="status-em-entrega">
            <h2>🛵 Pedido em trânsito!</h2>
            <p>📋 Pedido #{rastreamento.numero_pedido}</p>
            <p>📍 {rastreamento.endereco_entrega}</p>
            {distancia && (
              <>
                <p>📍 Distância: {distancia}</p>
                <p>⏱️ Tempo estimado: {tempoEstimado}</p>
              </>
            )}
            {parseFloat(distancia?.replace(/[^\d.]/g, '')) < 0.5 && (
              <div className="alerta-proximo">
                <h3>🚚 SEU PEDIDO ESTÁ CHEGANDO!</h3>
                <p>Mantenha seu telefone por perto!</p>
              </div>
            )}
          </div>
        );

      case 'entregue':
        return (
          <div className="status-entregue">
            <h2>✅ Pedido entregue com sucesso!</h2>
            <p>📋 Pedido #{rastreamento.numero_pedido}</p>
            <p>📅 Entregue em: {new Date(rastreamento.data_entrega).toLocaleString('pt-BR')}</p>
            <p>Aproveite sua refeição! 🍽️</p>
          </div>
        );

      case 'cancelado':
        return (
          <div className="status-cancelado">
            <h2>❌ Rastreamento cancelado</h2>
          </div>
        );

      default:
        return <div>Status desconhecido</div>;
    }
  };

  return (
    <div className="rastreamento-publico">
      <div className="header">
        <h1>🍽️ Rastreamento de Entrega</h1>
      </div>

      <div className="info-pedido">
        {renderizarStatus()}
      </div>

      <div id="mapa" style={{ width: '100%', height: '400px' }}></div>

      {rastreamento?.status === 'em_entrega' && (
        <div className="atualizacao-auto">
          <p>🔄 Atualizando automaticamente...</p>
        </div>
      )}
    </div>
  );
}

export default RastreamentoPublico;
```

---

## 🗺️ Integração com Mapas

### Google Maps

```javascript
// HTML
<script src="https://maps.googleapis.com/maps/api/js?key=SUA_API_KEY"></script>

// JavaScript
const mapa = new google.maps.Map(document.getElementById('mapa'), {
  zoom: 15,
  center: { lat: -23.5505, lng: -46.6333 }
});

// Marcador do motoboy
const marcadorMotoboy = new google.maps.Marker({
  position: { lat: latitude, lng: longitude },
  map: mapa,
  title: 'Motoboy',
  icon: {
    url: 'data:image/svg+xml;base64,...', // Ícone personalizado
    scaledSize: new google.maps.Size(40, 40)
  },
  animation: google.maps.Animation.DROP
});

// Atualizar posição
marcadorMotoboy.setPosition({ lat: novaLatitude, lng: novaLongitude });
```

### Mapbox

```javascript
// HTML
<link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet" />
<script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>

// JavaScript
mapboxgl.accessToken = 'SUA_ACCESS_TOKEN';
const mapa = new mapboxgl.Map({
  container: 'mapa',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-46.6333, -23.5505],
  zoom: 15
});

// Marcador do motoboy
const marcador = new mapboxgl.Marker()
  .setLngLat([longitude, latitude])
  .addTo(mapa);

// Atualizar posição
marcador.setLngLat([novaLongitude, novaLatitude]);
```

### Leaflet (OpenStreetMap)

```javascript
// HTML
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

// JavaScript
const mapa = L.map('mapa').setView([-23.5505, -46.6333], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(mapa);

// Marcador do motoboy
const marcadorMotoboy = L.marker([latitude, longitude])
  .addTo(mapa)
  .bindPopup('Motoboy');

// Atualizar posição
marcadorMotoboy.setLatLng([novaLatitude, novaLongitude]);
```

---

## 📱 Responsividade Mobile

### CSS Mobile-First

```css
.rastreamento-publico {
  width: 100%;
  padding: 16px;
  box-sizing: border-box;
}

.header h1 {
  font-size: 24px;
  text-align: center;
  margin-bottom: 16px;
}

.info-pedido {
  background: white;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

#mapa {
  width: 100%;
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 16px;
}

.status-em-entrega {
  text-align: center;
}

.status-em-entrega h2 {
  color: #007bff;
  font-size: 20px;
  margin-bottom: 8px;
}

.alerta-proximo {
  background: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
  text-align: center;
}

.alerta-proximo h3 {
  color: #856404;
  font-size: 18px;
  margin-bottom: 8px;
}

.status-entregue {
  text-align: center;
}

.status-entregue h2 {
  color: #28a745;
  font-size: 20px;
  margin-bottom: 8px;
}

.status-pendente {
  text-align: center;
}

.status-pendente h2 {
  color: #6c757d;
  font-size: 20px;
  margin-bottom: 8px;
}

.atualizacao-auto {
  text-align: center;
  color: #6c757d;
  font-size: 14px;
  margin-top: 16px;
}

@media (min-width: 768px) {
  .rastreamento-publico {
    max-width: 600px;
    margin: 0 auto;
  }
}
```

---

## 🔄 Atualização Automática

### Polling (Recomendado)

```javascript
// Atualizar a cada 5 segundos se estiver em entrega
useEffect(() => {
  if (rastreamento?.status === 'em_entrega') {
    const intervalo = setInterval(() => {
      buscarStatus();
    }, 5000); // 5 segundos

    return () => clearInterval(intervalo);
  }
}, [rastreamento?.status]);
```

### WebSocket (Opcional)

```javascript
// Conectar ao WebSocket para atualização em tempo real
useEffect(() => {
  const socket = io('https://athospp.com.br');
  
  socket.on(`rastreamento_${pedidoId}`, (data) => {
    setRastreamento(data.rastreamento);
    atualizarMapa(data.rastreamento);
  });

  return () => socket.disconnect();
}, [pedidoId]);
```

---

## ✅ Checklist de Implementação

### Estrutura
- [ ] Criar rota `/{slug}/rastrear/:id`
- [ ] Componente de rastreamento
- [ ] Integração com API pública

### Mapa
- [ ] Escolher biblioteca (Google Maps/Mapbox/Leaflet)
- [ ] Configurar API key (se necessário)
- [ ] Inicializar mapa
- [ ] Adicionar marcador de endereço
- [ ] Adicionar marcador do motoboy (quando disponível)
- [ ] Desenhar rota (opcional)
- [ ] Desenhar histórico de posições

### Estados
- [ ] Estado "Aguardando" (pendente)
- [ ] Estado "Em trânsito" (em_entrega)
- [ ] Estado "Chegando próximo" (distância < 500m)
- [ ] Estado "Entregue" (entregue)
- [ ] Estado "Cancelado" (cancelado)

### Atualização
- [ ] Polling a cada 5 segundos (quando em entrega)
- [ ] Atualizar marcador do motoboy
- [ ] Atualizar rota
- [ ] Calcular distância e tempo

### Responsividade
- [ ] Layout mobile-first
- [ ] Mapa responsivo
- [ ] Teste em diferentes tamanhos de tela
- [ ] Touch-friendly

---

## 🎯 Funcionalidades Opcionais

### 1. Notificação Push (Quando Próximo)

```javascript
// Solicitar permissão de notificação
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Enviar notificação quando próximo
if (distancia < 0.5) { // 500m
  new Notification('Seu pedido está chegando! 🚚', {
    body: 'O motoboy está a menos de 500m!',
    icon: '/icon.png'
  });
}
```

### 2. Compartilhar Localização

```javascript
const compartilhar = async () => {
  if (navigator.share) {
    await navigator.share({
      title: 'Rastreamento do meu pedido',
      text: 'Acompanhe meu pedido em tempo real!',
      url: window.location.href
    });
  }
};
```

### 3. Som de Notificação

```javascript
// Tocar som quando próximo
if (distancia < 0.5) {
  const audio = new Audio('/notification.mp3');
  audio.play();
}
```

---

## 📋 Resumo

### Página Pública de Rastreamento

1. **Acesso**: Link público `/{slug}/rastrear/{pedido_id}`
2. **API**: `GET /api/v1/:slug/pedidos/:id/rastreamento/publico`
3. **Mapa**: Google Maps/Mapbox/Leaflet
4. **Atualização**: Polling a cada 5 segundos
5. **Estados**: Pendente, Em trânsito, Entregue, Cancelado

### Funcionalidades

- ✅ Mapa em tempo real
- ✅ Posição do motoboy
- ✅ Endereço de entrega
- ✅ Rota estimada
- ✅ Tempo e distância
- ✅ Histórico de posições
- ✅ Atualização automática

---

## 🚀 Próximos Passos

1. Implementar página pública
2. Integrar com mapa escolhido
3. Testar atualização em tempo real
4. Testar em diferentes dispositivos
5. Adicionar funcionalidades opcionais

Tudo pronto para implementar! 🎉

