import { PageTitle, EndpointGroup, Endpoint, H2 } from '../../components';

export default function SeoApiPage() {
  return (
    <>
      <PageTitle description="Keywords, Reddit, YouTube, competidores, GSC, e pipeline completo.">
        SEO & Keywords API
      </PageTitle>

      <EndpointGroup title="Keywords">
        <Endpoint method="GET" path="/seo/keywords" description="Lista keywords com filtros. Query: ?sort, limit, offset, source, minVice, maxVice" />
        <Endpoint method="GET" path="/seo/dashboard" description="Stats do dashboard SEO" />
        <Endpoint method="POST" path="/seo/keywords/recalculate" description="Recalcular todos os VICE scores" />
        <Endpoint method="POST" path="/seo/keywords/snapshot" description="Salvar snapshot diario de VICE scores" />
        <Endpoint method="GET" path="/seo/keywords/ramping" description="Keywords trending. Query: ?days, minDelta" />
        <Endpoint method="POST" path="/seo/keywords/import-extracted" description="Importar keywords extraidas do Python" />
        <Endpoint method="POST" path="/seo/keywords/llm-validate" description="Rodar validacao LLM em keywords" />
        <Endpoint method="POST" path="/seo/keywords/semantic-cross-ref" description="Cross-reference via Qdrant embeddings" />
        <Endpoint method="POST" path="/seo/keywords/dedup" description="Deduplicar keywords (cosine 0.92)" />
      </EndpointGroup>

      <EndpointGroup title="Reddit">
        <Endpoint method="GET" path="/seo/reddit/posts" description="Lista posts. Query: ?page, limit, sort, period, subreddit" />
        <Endpoint method="GET" path="/seo/reddit/posts/count" description="Contagem com filtros" />
        <Endpoint method="GET" path="/seo/reddit/stats" description="Stats (total, builds, avg score)" />
        <Endpoint method="POST" path="/seo/reddit/crawl" description="Trigger crawl. Body: {method: python|auto|seed}" />
        <Endpoint method="POST" path="/seo/scan/reddit" description="Extrair keywords de posts via LLM" />
      </EndpointGroup>

      <EndpointGroup title="YouTube">
        <Endpoint method="POST" path="/seo/youtube/scan" description="Quick scan (RSS only)" />
        <Endpoint method="POST" path="/seo/youtube/smart-scan" description="Smart scan (transcripts + LLM classify)" />
        <Endpoint method="POST" path="/seo/youtube/smart-scan-stream" description="Smart scan com SSE streaming" />
        <Endpoint method="POST" path="/seo/youtube/monitor" description="RSS monitor (deteccao de novos videos)" />
        <Endpoint method="GET" path="/seo/youtube/latest" description="Resultados do ultimo scan" />
      </EndpointGroup>

      <EndpointGroup title="Competidores">
        <Endpoint method="POST" path="/seo/competitors/crawl" description="Crawl sitemaps de competidores" />
        <Endpoint method="POST" path="/seo/competitors/gap-analysis" description="Gap analysis AI (Qdrant + GSC + LLM)" />
      </EndpointGroup>

      <EndpointGroup title="Google Search Console">
        <Endpoint method="GET" path="/seo/gsc/status" description="Status da conexao" />
        <Endpoint method="GET" path="/seo/gsc/auth-url" description="URL de consentimento OAuth" />
        <Endpoint method="GET" path="/seo/gsc/callback" description="Callback OAuth (retorna refresh token)" />
        <Endpoint method="POST" path="/seo/gsc/sync" description="Importar dados GSC. Body: {days?: 28}" />
      </EndpointGroup>

      <EndpointGroup title="Pipeline & Automacao">
        <Endpoint method="POST" path="/seo/cron/daily" description="Trigger manual do cron diario" />
        <Endpoint method="POST" path="/seo/pipeline/full" description="Pipeline completo (9 etapas)" />
        <Endpoint method="GET" path="/seo/pipeline/costs" description="Custos LLM. Query: ?days" />
      </EndpointGroup>

      <H2>KeyBERT</H2>
      <EndpointGroup title="KeyBERT Worker">
        <Endpoint method="GET" path="/seo/keybert/status" description="Status do worker remoto" />
        <Endpoint method="POST" path="/seo/keybert/run" description="Disparar KeyBERT no worker GPU" />
      </EndpointGroup>
    </>
  );
}
