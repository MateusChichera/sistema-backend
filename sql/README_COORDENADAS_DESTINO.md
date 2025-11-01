# 📋 Instruções - Adicionar Coordenadas do Destino

## ⚠️ IMPORTANTE

Execute o script SQL `add_coordenadas_destino_pedidos.sql` **ANTES** de usar a funcionalidade de rastreamento com coordenadas.

## 📝 Como Executar

### Opção 1: Executar via MySQL Workbench / phpMyAdmin

1. Abra o MySQL Workbench ou phpMyAdmin
2. Selecione o banco de dados do sistema
3. Abra o arquivo `sql/add_coordenadas_destino_pedidos.sql`
4. Execute o script completo

### Opção 2: Executar via linha de comando

```bash
mysql -u seu_usuario -p nome_do_banco < sql/add_coordenadas_destino_pedidos.sql
```

### Opção 3: Executar comando por comando (Recomendado)

Se o MySQL der erro porque os campos já existem, você pode executar cada comando separadamente e ignorar os erros de campos já existentes.

## ✅ O que o Script Faz

O script adiciona os seguintes campos na tabela `pedidos`:

- `latitude_destino` / `longitude_destino` (preferenciais)
- `latitude_entrega` / `longitude_entrega` (alternativos)
- `endereco_latitude` / `endereco_longitude` (alternativos)
- `lat_destino` / `lng_destino` (alternativos, formato curto)

## 🔍 Verificar se Funcionou

Execute este comando SQL para verificar se os campos foram criados:

```sql
DESCRIBE pedidos;
```

Ou:

```sql
SHOW COLUMNS FROM pedidos LIKE '%latitude%';
SHOW COLUMNS FROM pedidos LIKE '%longitude%';
```

Você deve ver os campos listados acima.

## ⚠️ Notas Importantes

1. **Se os campos já existirem**: O MySQL pode gerar um erro ao tentar adicionar campos que já existem. Isso é normal e seguro - apenas significa que os campos já foram criados anteriormente.

2. **Campos Opcionais**: Todos os campos são `NULL` por padrão, então pedidos antigos não terão coordenadas, mas novos pedidos poderão ter.

3. **Prioridade**: O backend usa a seguinte prioridade ao buscar coordenadas:
   - `latitude_destino` / `longitude_destino` (preferencial)
   - `latitude_entrega` / `longitude_entrega`
   - `endereco_latitude` / `endereco_longitude`
   - `lat_destino` / `lng_destino`

## 🎯 Próximos Passos

Após executar o script:

1. ✅ Os campos estarão disponíveis na tabela `pedidos`
2. ✅ O backend salvará coordenadas quando criar novos pedidos
3. ✅ O rastreamento público mostrará o pin exato no mapa

---

**Data de Criação**: Janeiro 2025  
**Versão**: 1.0

