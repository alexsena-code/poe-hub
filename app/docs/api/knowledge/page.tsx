import { PageTitle, H2, P, EndpointGroup, Endpoint, CodeBlock, Callout } from '../../components';

export default function KnowledgeApiPage() {
  return (
    <>
      <PageTitle description="RAG, Q&A, Qdrant search, poe.ninja, e ingestao de dados.">
        Knowledge API
      </PageTitle>

      <EndpointGroup title="Q&A">
        <Endpoint method="POST" path="/knowledge/answer" description="Pergunta completa: context assembly + LLM answer. Body: {question, lang?}" />
        <Endpoint method="POST" path="/knowledge/query" description="Apenas context assembly (sem LLM) — para debug. Body: {question}" />
      </EndpointGroup>

      <EndpointGroup title="Search">
        <Endpoint method="POST" path="/knowledge/search" description="Busca raw no Qdrant. Body: {query, collection, limit?}" />
        <Endpoint method="GET" path="/knowledge/token-usage" description="Stats de uso de tokens (in-memory)" />
        <Endpoint method="GET" path="/knowledge/collections/stats" description="Contagem de points por collection" />
      </EndpointGroup>

      <EndpointGroup title="poe.ninja">
        <Endpoint method="POST" path="/knowledge/poeninja" description="Query poe.ninja (DB cache first, live fallback). Body: {type, name?}" />
        <Endpoint method="POST" path="/knowledge/poeninja/snapshot" description="Trigger snapshot diario (pre-populate cache)" />
        <Endpoint method="GET" path="/knowledge/poeninja/stats" description="Cache stats (hit rate, entries)" />
      </EndpointGroup>

      <EndpointGroup title="Ingestao">
        <Endpoint method="POST" path="/knowledge/reddit/ingest" description="Ingerir posts do Reddit no Qdrant" />
        <Endpoint method="POST" path="/knowledge/youtube/ingest" description="Ingerir dados do YouTube no Qdrant" />
      </EndpointGroup>

      <H2>Exemplo: Q&A</H2>
      <CodeBlock title="POST /knowledge/answer">{`// Request
{
  "question": "Como o Righteous Fire escala?",
  "lang": "pt-br"
}

// Response
{
  "answer": "O Righteous Fire escala com...",
  "context": {
    "queryType": "mechanic_question",
    "collections": ["poe_wiki", "poe_transcripts"],
    "layers": ["exact_data", "chunks", "summary"],
    "tokensUsed": 847
  },
  "sources": [
    { "collection": "poe_wiki", "title": "Righteous Fire", "score": 0.89 },
    { "collection": "poe_transcripts", "title": "RF Build Guide", "score": 0.76 }
  ]
}`}</CodeBlock>

      <Callout type="tip" title="Debug">
        Use POST /knowledge/query para ver o contexto montado sem gastar tokens LLM.
        Util para verificar se o context assembly esta trazendo os dados certos.
      </Callout>
    </>
  );
}
