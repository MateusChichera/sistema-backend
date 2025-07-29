# Documentação - Sistema de Avisos

## Visão Geral

O sistema de avisos permite que o **administrador do sistema** crie avisos globais que são exibidos para todos os funcionários de todas as empresas. Estes avisos são usados para comunicar atualizações do sistema, manutenções, novas funcionalidades, etc. Cada funcionário pode marcar avisos como "Lido" ou "Não Lido", e o frontend pode verificar se há avisos não lidos para exibir notificações.

## Estrutura do Banco de Dados

### Tabela `avisos`
- `id` - ID único do aviso
- `titulo` - Título do aviso
- `mensagem` - Conteúdo do aviso
- `data_criacao` - Data/hora de criação

### Tabela `avisos_status`
- `id` - ID único do registro de status
- `aviso_id` - Referência ao aviso
- `funcionario_id` - Referência ao funcionário
- `status` - Status do aviso ('Lido' ou 'Não Lido')
- `data_alteracao` - Data/hora da última alteração do status

## Endpoints da API

### 1. Criar Aviso
**POST** `/api/v1/admin/avisos`

**Permissão:** Apenas Admin do Sistema

**Body:**
```json
{
  "titulo": "Manutenção do Sistema",
  "mensagem": "O sistema estará em manutenção hoje às 22h. Por favor, finalizem todos os pedidos até 21h30."
}
```

**Resposta (201):**
```json
{
  "message": "Aviso criado com sucesso!",
  "aviso": {
    "id": 1,
    "titulo": "Manutenção do Sistema",
    "mensagem": "O sistema estará em manutenção hoje às 22h. Por favor, finalizem todos os pedidos até 21h30.",
    "data_criacao": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Listar Todos os Avisos
**GET** `/api/v1/gerencial/:slug/avisos`

**Permissão:** Todos os funcionários

**Resposta (200):**
```json
{
  "message": "Avisos listados com sucesso!",
  "avisos": [
    {
      "id": 1,
      "titulo": "Manutenção do Sistema",
      "mensagem": "O sistema estará em manutenção hoje às 22h...",
      "data_criacao": "2024-01-15T10:30:00.000Z",
      "status": "Não Lido",
      "data_alteracao": null
    },
    {
      "id": 2,
      "titulo": "Novo Funcionário",
      "mensagem": "João Silva iniciou hoje como garçom...",
      "data_criacao": "2024-01-14T09:00:00.000Z",
      "status": "Lido",
      "data_alteracao": "2024-01-14T15:30:00.000Z"
    }
  ]
}
```

### 3. Obter Aviso por ID
**GET** `/api/v1/gerencial/:slug/avisos/:id`

**Permissão:** Todos os funcionários

**Resposta (200):**
```json
{
  "message": "Aviso encontrado com sucesso!",
  "aviso": {
    "id": 1,
    "titulo": "Manutenção do Sistema",
    "mensagem": "O sistema estará em manutenção hoje às 22h...",
    "data_criacao": "2024-01-15T10:30:00.000Z",
    "status": "Não Lido",
    "data_alteracao": null
  }
}
```

### 4. Atualizar Aviso
**PUT** `/api/v1/admin/avisos/:id`

**Permissão:** Apenas Admin do Sistema

**Body:**
```json
{
  "titulo": "Manutenção do Sistema - ATUALIZADO",
  "mensagem": "A manutenção foi adiada para amanhã às 22h. Hoje o sistema funcionará normalmente."
}
```

**Resposta (200):**
```json
{
  "message": "Aviso atualizado com sucesso!",
  "aviso": {
    "id": 1,
    "titulo": "Manutenção do Sistema - ATUALIZADO",
    "mensagem": "A manutenção foi adiada para amanhã às 22h. Hoje o sistema funcionará normalmente."
  }
}
```

### 5. Excluir Aviso
**DELETE** `/api/v1/admin/avisos/:id`

**Permissão:** Apenas Admin do Sistema

**Resposta (200):**
```json
{
  "message": "Aviso excluído com sucesso!"
}
```

### 6. Atualizar Status do Aviso
**PATCH** `/api/v1/gerencial/:slug/avisos/:id/status`

**Permissão:** Todos os funcionários

**Body:**
```json
{
  "status": "Lido"
}
```

**Status Disponíveis:**
- `"Lido"` - Aviso foi lido
- `"Não Lido"` - Aviso não foi lido
- `"Visualizar Depois"` - Aviso marcado para visualizar depois

**Resposta (200):**
```json
{
  "message": "Status do aviso atualizado com sucesso!",
  "status": "Lido"
}
```

### 7. Verificar e Obter Avisos Não Lidos
**GET** `/api/v1/gerencial/:slug/avisos/check/nao-lidos`

**Permissão:** Todos os funcionários

**Resposta (200):**
```json
{
  "message": "Verificação de avisos realizada com sucesso!",
  "tem_avisos_nao_lidos": true,
  "total_nao_lidos": 2,
  "avisos": [
    {
      "id": 1,
      "titulo": "Nova Atualização do Sistema",
      "mensagem": "Implementamos novas funcionalidades no painel de pedidos. Verifique as novidades!",
      "data_criacao": "2024-01-15T10:30:00.000Z",
      "status": "Não Lido",
      "data_alteracao": null
    },
    {
      "id": 2,
      "titulo": "Manutenção Programada",
      "mensagem": "O sistema estará em manutenção hoje às 22h. Por favor, finalizem todos os pedidos até 21h30.",
      "data_criacao": "2024-01-14T15:00:00.000Z",
      "status": "Não Lido",
      "data_alteracao": null
    }
  ]
}
```

### 9. Listar Avisos com Detalhes por Empresa (Admin)
**GET** `/api/v1/admin/avisos/detalhes`

**Permissão:** Apenas Admin do Sistema

**Resposta (200):**
```json
{
  "message": "Avisos com detalhes listados com sucesso!",
  "avisos": [
    {
      "id": 1,
      "titulo": "Nova Atualização do Sistema",
      "mensagem": "Implementamos novas funcionalidades no painel de pedidos...",
      "data_criacao": "2024-01-15T10:30:00.000Z",
      "empresas": [
        {
          "id": 1,
          "nome": "Restaurante ABC",
          "slug": "restaurante-abc",
          "funcionarios": [
            {
              "id": 1,
              "nome": "João Silva",
              "email": "joao@restaurante.com",
              "role": "Proprietario",
              "status": "Lido",
              "data_alteracao": "2024-01-15T15:30:00.000Z"
            },
            {
              "id": 2,
              "nome": "Maria Santos",
              "email": "maria@restaurante.com",
              "role": "Funcionario",
              "status": "Não Lido",
              "data_alteracao": null
            }
          ],
          "estatisticas": {
            "total_funcionarios": 2,
            "lidos": 1,
            "nao_lidos": 1,
            "percentual_lidos": 50
          }
        },
        {
          "id": 2,
          "nome": "Restaurante XYZ",
          "slug": "restaurante-xyz",
          "funcionarios": [
            {
              "id": 3,
              "nome": "Pedro Costa",
              "email": "pedro@xyz.com",
              "role": "Gerente",
              "status": "Lido",
              "data_alteracao": "2024-01-15T16:45:00.000Z"
            }
          ],
          "estatisticas": {
            "total_funcionarios": 1,
            "lidos": 1,
            "nao_lidos": 0,
            "percentual_lidos": 100
          }
        }
      ],
      "estatisticas_gerais": {
        "total_empresas": 2,
        "total_funcionarios": 3,
        "total_lidos": 2,
        "total_nao_lidos": 1,
        "percentual_lidos": 67
      }
    }
  ],
  "total_avisos": 1
}
```

## Códigos de Erro

- **400** - Dados inválidos (título/mensagem obrigatórios)
- **403** - Acesso negado (sem permissão)
- **404** - Aviso não encontrado
- **500** - Erro interno do servidor

## Observações Importantes

1. **Criação automática de status**: Quando um aviso é criado, automaticamente são criados registros de status "Não Lido" para todos os funcionários ativos de todas as empresas.

2. **Permissões**: 
   - Criar/Editar/Excluir: Apenas Admin do Sistema
   - Visualizar/Marcar status: Todos os funcionários

3. **Status padrão**: Se um funcionário não tem registro de status para um aviso, ele é considerado "Não Lido".

4. **Exclusão em cascata**: Quando um aviso é excluído, todos os registros de status relacionados são automaticamente removidos.

5. **Ordenação**: Os avisos são ordenados por data de criação (mais recentes primeiro).

6. **Escopo global**: Os avisos são visíveis para funcionários de todas as empresas, não apenas de uma empresa específica.

## Exemplos de Uso no Frontend

### 1. Verificar e exibir avisos não lidos
```javascript
const checkAvisos = async () => {
  try {
    const response = await fetch('/api/v1/gerencial/demo-restaurante/avisos/check/nao-lidos', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.tem_avisos_nao_lidos) {
      // Mostrar badge com número de avisos
      mostrarBadge(data.total_nao_lidos);
      
      // Exibir modal com os avisos
      exibirModalAvisos(data.avisos);
    }
  } catch (error) {
    console.error('Erro ao verificar avisos:', error);
  }
};
```

### 2. Atualizar status do aviso
```javascript
// Marcar como lido
const marcarComoLido = async (avisoId) => {
  try {
    const response = await fetch(`/api/v1/gerencial/demo-restaurante/avisos/${avisoId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'Lido' })
    });
    
    if (response.ok) {
      // Remover aviso da lista
      removerAvisoDaLista(avisoId);
    }
  } catch (error) {
    console.error('Erro ao marcar aviso como lido:', error);
  }
};

// Marcar para visualizar depois
const marcarVisualizarDepois = async (avisoId) => {
  try {
    const response = await fetch(`/api/v1/gerencial/demo-restaurante/avisos/${avisoId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'Visualizar Depois' })
    });
    
    if (response.ok) {
      // Atualizar interface - aviso continua visível mas com status diferente
      atualizarStatusAviso(avisoId, 'Visualizar Depois');
    }
  } catch (error) {
    console.error('Erro ao marcar aviso para visualizar depois:', error);
  }
};
```

### 3. Interface de usuário sugerida
```javascript
// Componente de aviso com botões de ação
const AvisoItem = ({ aviso }) => {
  return (
    <div className="aviso-item">
      <h3>{aviso.titulo}</h3>
      <p>{aviso.mensagem}</p>
      <small>{new Date(aviso.data_criacao).toLocaleString()}</small>
      
      <div className="aviso-actions">
        <button onClick={() => marcarComoLido(aviso.id)}>
          Marcar como Lido
        </button>
        <button onClick={() => marcarVisualizarDepois(aviso.id)}>
          Visualizar Depois
        </button>
      </div>
    </div>
  );
};
``` 