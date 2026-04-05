import { PageTitle, H2, P, Table, CodeBlock, Callout, Steps, Step } from '../../components';

export default function BotsPage() {
  return (
    <>
      <PageTitle description="Gerenciamento completo de bots de farming: CRUD, criptografia AES-256-GCM, status tracking, proxy config.">
        Bots
      </PageTitle>

      <H2>Modelo de Dados</H2>
      <Table
        headers={['Campo', 'Tipo', 'Descricao']}
        rows={[
          ['id', 'UUID', 'Identificador unico'],
          ['nick', 'String', 'Nome do bot in-game'],
          ['email', 'String', 'Email da conta'],
          ['password', 'String (encrypted)', 'Senha criptografada AES-256-GCM'],
          ['status', 'Enum', 'active | inactive | banned | maintenance'],
          ['proxy_host', 'String?', 'Host do proxy'],
          ['proxy_port', 'Int?', 'Porta do proxy'],
          ['proxy_username', 'String? (encrypted)', 'User do proxy (criptografado)'],
          ['proxy_password', 'String? (encrypted)', 'Senha do proxy (criptografada)'],
          ['notes', 'String?', 'Observacoes'],
          ['league_id', 'UUID?', 'FK para League'],
        ]}
      />

      <H2>Criptografia</H2>
      <P>
        Campos sensiveis (password, proxy_username, proxy_password) sao criptografados na camada de aplicacao
        usando AES-256-GCM. A chave fica na variavel ENCRYPTION_KEY.
      </P>
      <CodeBlock title="Formato armazenado">{`hex_iv:hex_tag:hex_ciphertext

Exemplo: a1b2c3...:d4e5f6...:789abc...`}</CodeBlock>

      <Callout type="warning" title="Reveal">
        Senhas so sao descriptografadas quando explicitamente solicitado via ?reveal=true na API.
        No dashboard, campos sensiveis ficam mascarados por padrao.
      </Callout>

      <H2>Status Flow</H2>
      <Table
        headers={['Status', 'Cor', 'Significado']}
        rows={[
          ['active', 'Verde', 'Bot operando normalmente'],
          ['inactive', 'Cinza', 'Bot pausado pelo operador'],
          ['banned', 'Vermelho', 'Conta banida pelo GGG'],
          ['maintenance', 'Amarelo', 'Em manutencao (proxy, config, etc)'],
        ]}
      />

      <H2>API Endpoints</H2>
      <Table
        headers={['Metodo', 'Path', 'Descricao']}
        rows={[
          ['GET', '/api/bots', 'Lista com paginacao, busca, filtro por status'],
          ['POST', '/api/bots', 'Criar bot (password auto-encrypted)'],
          ['GET', '/api/bots/[id]', 'Detalhes (?reveal=true para senhas)'],
          ['PUT', '/api/bots/[id]', 'Atualizar bot'],
          ['DELETE', '/api/bots/[id]', 'Deletar bot'],
          ['PATCH', '/api/bots/[id]/status', 'Toggle status'],
        ]}
      />

      <H2>Como Usar</H2>
      <Steps>
        <Step number={1} title="Criar bot">
          Dashboard &rarr; /bots &rarr; &quot;Novo Bot&quot;. Preencha nick, email, senha, proxy (opcional).
        </Step>
        <Step number={2} title="Configurar proxy">
          Se o bot usa proxy, preencha host, porta, username e password. Tudo criptografado.
        </Step>
        <Step number={3} title="Monitorar status">
          Use /monitor para alertas em tempo real. Status muda automaticamente ou manual via PATCH.
        </Step>
      </Steps>
    </>
  );
}
