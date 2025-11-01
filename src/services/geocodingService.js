// Serviço para fazer geocoding de endereços (converter endereço em coordenadas)
const https = require('https');

/**
 * Faz geocoding de um endereço completo usando Nominatim (OpenStreetMap)
 * Gratuito, não requer API key
 * 
 * @param {string} endereco - Endereço completo (ex: "Rua Exemplo, 123, Bairro, Cidade - Estado, CEP")
 * @returns {Promise<{latitude: number|null, longitude: number|null}>}
 */
async function geocodeEndereco(endereco) {
  try {
    if (!endereco || endereco.trim() === '') {
      console.log('[Geocoding] Endereço vazio, retornando null');
      return { latitude: null, longitude: null };
    }

    // Montar endereço completo para busca
    const enderecoFormatado = endereco.trim().replace(/\s+/g, ' ');
    
    // URL da API Nominatim (OpenStreetMap) - Gratuita
    const encodedAddress = encodeURIComponent(enderecoFormatado);
    // Adicionar país (Brasil) e melhorar a query
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1&addressdetails=1&countrycodes=br`;
    
    console.log(`[Geocoding] Buscando coordenadas para: ${enderecoFormatado}`);
    
    // Fazer requisição HTTPS
    const coordenadas = await new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': 'Sistema-Restaurante-Backend/1.0' // Nominatim requer User-Agent
        }
      }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const results = JSON.parse(data);
            
            if (results && results.length > 0) {
              const result = results[0];
              const latitude = parseFloat(result.lat);
              const longitude = parseFloat(result.lon);
              
              console.log(`[Geocoding] ✅ Coordenadas encontradas: ${latitude}, ${longitude}`);
              resolve({ latitude, longitude });
            } else {
              console.log(`[Geocoding] ⚠️ Nenhum resultado encontrado para: ${enderecoFormatado}`);
              resolve({ latitude: null, longitude: null });
            }
          } catch (error) {
            console.error('[Geocoding] Erro ao processar resposta:', error);
            resolve({ latitude: null, longitude: null });
          }
        });
      }).on('error', (error) => {
        console.error('[Geocoding] Erro na requisição:', error);
        resolve({ latitude: null, longitude: null });
      });
      
      // Timeout de 5 segundos
      setTimeout(() => {
        reject(new Error('Timeout na requisição de geocoding'));
      }, 5000);
    });
    
    return coordenadas;
    
  } catch (error) {
    console.error('[Geocoding] Erro ao fazer geocoding:', error);
    return { latitude: null, longitude: null };
  }
}

/**
 * Faz parse do endereço completo por vírgula
 * Formato esperado: "Rua, Numero, Bairro, CEP: 12345678, Cidade - Estado"
 * Ordem: rua, numero, bairro, cep, cidade, estado
 * 
 * @param {string} enderecoCompleto - Endereço completo no formato padrão
 * @returns {object} Objeto com as partes do endereço parseadas
 */
function parsearEnderecoCompleto(enderecoCompleto) {
  if (!enderecoCompleto) {
    return { rua: null, numero: null, bairro: null, cep: null, cidade: null, estado: null };
  }

  // Dividir por vírgula
  const partes = enderecoCompleto.split(',').map(p => p.trim()).filter(p => p);
  
  // Inicializar variáveis
  let rua = null;
  let numero = null;
  let bairro = null;
  let cep = null;
  let cidade = null;
  let estado = null;
  
  // Ordem: rua, numero, bairro, cep, cidade, estado
  // Exemplo: "Rua Gilberto Janota Mele, 140, Humberto Salvador, CEP: 19100110, Presidente Prudente - SP"
  
  if (partes.length >= 1) {
    rua = partes[0]; // 1. Rua
  }
  
  if (partes.length >= 2) {
    numero = partes[1]; // 2. Número
  }
  
  if (partes.length >= 3) {
    bairro = partes[2]; // 3. Bairro
  }
  
  if (partes.length >= 4) {
    // 4. CEP (pode vir como "CEP: 19100110")
    const cepParte = partes[3];
    if (cepParte.includes('CEP') || /^\d{5}-?\d{3}$/.test(cepParte) || /^\d{8}$/.test(cepParte)) {
      // Extrair apenas números do CEP
      cep = cepParte.replace(/CEP:\s*/gi, '').replace(/[^\d]/g, '');
    }
  }
  
  if (partes.length >= 5) {
    // 5. Cidade - Estado (pode vir como "Presidente Prudente - SP")
    const cidadeEstado = partes[4];
    const match = cidadeEstado.match(/^(.+?)\s*-\s*([A-Z]{2})$/);
    if (match) {
      cidade = match[1].trim();
      estado = match[2].trim();
    } else {
      // Se não tiver padrão, assume que é só a cidade
      cidade = cidadeEstado;
    }
  }
  
  return { rua, numero, bairro, cep, cidade, estado };
}

/**
 * Faz geocoding montando endereço completo a partir dos campos do pedido
 * Se endereco_entrega vier completo, faz parse por vírgula
 * 
 * @param {object} dadosEndereco - Objeto com campos do endereço
 * @param {string} dadosEndereco.endereco_entrega - Endereço completo ou apenas rua
 * @param {string} dadosEndereco.numero_entrega - Número (opcional, pode estar no endereco_entrega)
 * @param {string} dadosEndereco.bairro_entrega - Bairro (opcional, pode estar no endereco_entrega)
 * @param {string} dadosEndereco.cidade_entrega - Cidade (opcional, pode estar no endereco_entrega)
 * @param {string} dadosEndereco.estado_entrega - Estado (opcional, pode estar no endereco_entrega)
 * @param {string} dadosEndereco.cep_entrega - CEP (opcional, pode estar no endereco_entrega)
 * @returns {Promise<{latitude: number|null, longitude: number|null}>}
 */
async function geocodeEnderecoCompleto(dadosEndereco) {
  try {
    const {
      endereco_entrega,
      numero_entrega,
      complemento_entrega,
      bairro_entrega,
      cidade_entrega,
      estado_entrega,
      cep_entrega
    } = dadosEndereco;

    // Normalizar valores 'null' (string) para null
    const enderecoCompleto = endereco_entrega && endereco_entrega !== 'null' ? endereco_entrega : null;
    const numeroSeparado = numero_entrega && numero_entrega !== 'null' ? numero_entrega : null;
    const bairroSeparado = bairro_entrega && bairro_entrega !== 'null' ? bairro_entrega : null;
    const cidadeSeparada = cidade_entrega && cidade_entrega !== 'null' ? cidade_entrega : null;
    const estadoSeparado = estado_entrega && estado_entrega !== 'null' ? estado_entrega : null;
    const cepSeparado = cep_entrega && cep_entrega !== 'null' ? cep_entrega : null;
    
    // Log para debug
    console.log('[Geocoding] 📍 Dados recebidos:', {
      endereco_entrega: enderecoCompleto || 'null',
      numero_entrega: numeroSeparado || 'null',
      bairro_entrega: bairroSeparado || 'null',
      cidade_entrega: cidadeSeparada || 'null',
      estado_entrega: estadoSeparado || 'null',
      cep_entrega: cepSeparado || 'null'
    });
    
    if (!enderecoCompleto) {
      console.log('[Geocoding] ⚠️ Endereço não informado');
      return { latitude: null, longitude: null };
    }

    // Verificar se endereco_entrega está completo (tem múltiplas vírgulas e padrão de cidade-estado)
    const temPadraoCompleto = enderecoCompleto.includes(',') && 
                               (enderecoCompleto.includes(' - ') || enderecoCompleto.includes('-')) &&
                               (enderecoCompleto.includes('CEP') || /\d{5}-?\d{3}/.test(enderecoCompleto));
    
    let rua, numero, bairro, cep, cidade, estado;
    
    if (temPadraoCompleto && (!cidadeSeparada || !estadoSeparado)) {
      // Fazer parse do endereço completo
      console.log('[Geocoding] ℹ️ Endereço completo detectado, fazendo parse...');
      const enderecoParseado = parsearEnderecoCompleto(enderecoCompleto);
      
      rua = enderecoParseado.rua;
      numero = enderecoParseado.numero || numeroSeparado;
      bairro = enderecoParseado.bairro || bairroSeparado;
      cep = enderecoParseado.cep || (cepSeparado ? cepSeparado.replace(/[^\d]/g, '') : null);
      cidade = enderecoParseado.cidade || cidadeSeparada;
      estado = enderecoParseado.estado || estadoSeparado;
      
      console.log('[Geocoding] ✅ Endereço parseado:', { rua, numero, bairro, cep, cidade, estado });
    } else {
      // Usar campos separados ou endereço simples
      rua = enderecoCompleto;
      numero = numeroSeparado;
      bairro = bairroSeparado;
      cep = cepSeparado ? cepSeparado.replace(/[^\d]/g, '') : null;
      cidade = cidadeSeparada;
      estado = estadoSeparado;
    }
    
    // Normalizar estado (SP -> São Paulo, RJ -> Rio de Janeiro, etc)
    const estadosMap = {
      'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas',
      'BA': 'Bahia', 'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo',
      'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul',
      'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná',
      'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte',
      'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina',
      'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins'
    };
    
    const estadoCompleto = estado ? (estadosMap[estado.toUpperCase()] || estado) : null;
    
    // Montar endereço na ordem correta: rua, numero, bairro, cep, cidade, estado, brasil
    const partes = [];
    
    if (rua) partes.push(rua);
    if (numero) partes.push(numero);
    if (bairro) partes.push(bairro);
    if (cep) partes.push(cep);
    if (cidade) partes.push(cidade);
    if (estadoCompleto) partes.push(estadoCompleto);
    partes.push('Brasil');
    
    // Tentar múltiplos formatos de endereço
    const formatos = [];
    
    // Formato 1: Endereço completo na ordem correta (rua, numero, bairro, cep, cidade, estado, brasil)
    if (partes.length >= 4) { // Tem pelo menos rua, cidade, estado e brasil
      formatos.push(partes.join(', '));
    }
    
    // Formato 2: Sem CEP (alguns sistemas não gostam de CEP na busca)
    const partesSemCep = partes.filter(p => !/^\d{8}$/.test(p));
    if (partesSemCep.length >= 4) {
      formatos.push(partesSemCep.join(', '));
    }
    
    // Formato 3: Rua + Número + Bairro + Cidade + Estado + Brasil (sem CEP)
    if (rua && numero && bairro && cidade && estadoCompleto) {
      formatos.push(`${rua} ${numero}, ${bairro}, ${cidade}, ${estadoCompleto}, Brasil`);
    }
    
    // Formato 4: Rua + Número + Cidade + Estado + Brasil (sem bairro e CEP)
    if (rua && numero && cidade && estadoCompleto) {
      formatos.push(`${rua} ${numero}, ${cidade}, ${estadoCompleto}, Brasil`);
    }
    
    // Formato 5: Rua + Cidade + Estado + Brasil (sem número)
    if (rua && cidade && estadoCompleto) {
      formatos.push(`${rua}, ${cidade}, ${estadoCompleto}, Brasil`);
    }
    
    // Formato 6: Cidade + Estado + Brasil (como fallback)
    if (cidade && estadoCompleto) {
      formatos.push(`${cidade}, ${estadoCompleto}, Brasil`);
    }
    
    // Remover duplicatas
    const formatosUnicos = [...new Set(formatos)];
    
    // Tentar cada formato até encontrar resultado
    for (let i = 0; i < formatosUnicos.length; i++) {
      const formato = formatosUnicos[i];
      console.log(`[Geocoding] Tentativa ${i + 1}/${formatosUnicos.length}: ${formato}`);
      
      const resultado = await geocodeEndereco(formato);
      
      if (resultado.latitude && resultado.longitude) {
        console.log(`[Geocoding] ✅ Coordenadas encontradas no formato ${i + 1}`);
        return resultado;
      }
      
      // Aguardar um pouco entre tentativas (Nominatim tem rate limit)
      if (i < formatos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log('[Geocoding] ⚠️ Nenhum formato retornou coordenadas');
    return { latitude: null, longitude: null };
    
  } catch (error) {
    console.error('[Geocoding] Erro ao montar endereço completo:', error);
    return { latitude: null, longitude: null };
  }
}

module.exports = {
  geocodeEndereco,
  geocodeEnderecoCompleto,
  parsearEnderecoCompleto
};

