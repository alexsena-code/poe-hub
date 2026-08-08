-- Remove o pipeline de preço do Discord (ago/2026).
--
-- DESTRUTIVO: `price_entries` guarda ~31.830 mensagens cruas capturadas do
-- Discord. Elas não são recuperáveis depois deste DROP. O agregado que tinha
-- valor analítico já foi consolidado em `daily_prices`, que é PRESERVADA de
-- propósito — as simulações (`import-prices`, `create-projected` e o overlay do
-- comparador de cenários) leem os ~926 dias de histórico de ligas passadas.
--
-- `daily_prices` fica sem produtor a partir daqui: vira arquivo read-only. O
-- preço novo passa a viver em `g2g_price_snapshots`, que mede outra coisa
-- (concorrência em USD, não venda própria em BRL).
--
-- Nenhuma FK aponta para estas tabelas, então a ordem do DROP é indiferente e
-- não é preciso CASCADE.

-- DropTable
DROP TABLE "discord_sources";

-- DropTable
DROP TABLE "price_entries";

-- DropEnum
DROP TYPE "Currency";
