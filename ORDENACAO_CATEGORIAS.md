# Implementação de Ordenação de Categorias no Cardápio

## Resumo das Alterações

Este documento descreve as alterações implementadas para permitir a ordenação das categorias no cardápio do sistema.

## 1. Alterações no Banco de Dados

### Tabela `categorias`
- **Adicionado campo `ordem`**: Campo do tipo INT com valor padrão 0
- **Script SQL**: `add_ordem_categoria.sql` foi criado e executado
- **Atualização automática**: Registros existentes receberam ordem baseada no ID

```sql
ALTER TABLE `categorias` 
ADD COLUMN `ordem` INT DEFAULT 0 AFTER `ativo`;

UPDATE `categorias` 
SET `ordem` = `id` 
WHERE `ordem` = 0;
```

## 2. Alterações nos Controllers

### `categoriaController.js`

#### Novas Funcionalidades:
- **Campo `ordem`** incluído em todas as operações CRUD
- **Auto-ordenação**: Ao criar categoria sem ordem especificada, usa próxima ordem disponível
- **Nova função `updateOrdemCategorias`**: Permite atualizar ordem de múltiplas categorias em lote

#### Consultas Atualizadas:
- `getAllCategoriasByEmpresa`: Ordena por `ordem ASC, descricao ASC`
- `getPublicCategoriasByEmpresa`: Ordena por `ordem ASC, descricao ASC`
- `getCategoriaById`: Inclui campo `ordem` na resposta
- `createCategoria`: Aceita parâmetro `ordem` opcional
- `updateCategoria`: Permite atualizar campo `ordem`

### `produtoController.js`

#### Consultas Atualizadas:
- **`getAllProdutosByEmpresa`**: Ordena produtos por `categoria_ordem ASC, categoria_nome ASC, produto_nome ASC`
- **`getProdutoById`**: Inclui campo `categoria_ordem` na resposta
- **`getPublicProdutosByEmpresa`**: Ordena produtos públicos por categoria ordenada

### `configEmpresaController.js`

#### Nova Funcionalidade:
- **`getConfigBySlug`**: Agora inclui array `categorias` ordenadas na resposta das configurações

## 3. Alterações nas Rotas

### `categoriaRoutes.js`

#### Nova Rota:
```javascript
// Atualizar ordem das categorias: PUT /api/v1/gerencial/:slug/categorias/ordem
router.put(
  '/gerencial/:slug/categorias/ordem',
  extractEmpresaId,
  authenticateToken,
  authorizeRole(['Proprietario', 'Gerente']),
  categoriaController.updateOrdemCategorias
);
```

## 4. Como Usar

### Criar Categoria com Ordem Específica
```javascript
POST /api/v1/gerencial/:slug/categorias
{
  "descricao": "Bebidas",
  "ordem": 1
}
```

### Atualizar Ordem de Múltiplas Categorias
```javascript
PUT /api/v1/gerencial/:slug/categorias/ordem
{
  "categorias": [
    { "id": 1, "ordem": 1 },
    { "id": 2, "ordem": 2 },
    { "id": 3, "ordem": 3 }
  ]
}
```

### Obter Configurações com Categorias Ordenadas
```javascript
GET /api/v1/:slug/config
// Resposta incluirá:
{
  // ... outras configurações
  "categorias": [
    { "id": 1, "descricao": "Bebidas", "ativo": true, "ordem": 1 },
    { "id": 2, "descricao": "Pratos", "ativo": true, "ordem": 2 }
  ]
}
```

## 5. Benefícios

1. **Flexibilidade**: Permite ordenar categorias conforme necessário
2. **Consistência**: Todas as consultas respeitam a ordem definida
3. **Performance**: Ordenação feita no banco de dados
4. **Compatibilidade**: Mantém funcionalidade existente
5. **Configuração Centralizada**: Ordem das categorias incluída nas configurações da empresa

## 6. Permissões

- **Criar/Editar categorias**: Proprietário e Gerente
- **Atualizar ordem**: Proprietário e Gerente
- **Visualizar**: Todos os funcionários autorizados
- **Cardápio público**: Sem autenticação necessária

## 7. Observações Técnicas

- Campo `ordem` é opcional na criação (usa auto-incremento)
- Ordenação é feita por `ordem ASC, descricao ASC` como fallback
- Transações são usadas para atualizações em lote
- Validação de permissões mantida em todas as operações
