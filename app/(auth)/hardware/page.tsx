"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { DealsTab } from "@/components/modules/hardware/deals-tab";
import { ManualPricesTab } from "@/components/modules/hardware/manual-prices-tab";
import { ItemsTab } from "@/components/modules/hardware/items-tab";
import { StorePricesTab } from "@/components/modules/hardware/store-prices-tab";
import type {
  Deal,
  HardwareConfigItem,
  ManualPrice,
  SummaryItem,
} from "@/components/modules/hardware/types";
import type { PrefilledItemValues } from "@/components/modules/hardware/items-tab";

const HARDWARE_API =
  process.env.NEXT_PUBLIC_HARDWARE_API_URL || "http://localhost:8001";

type ActiveTab = "deals" | "manual-prices" | "items" | "store";

const TAB_LABELS: Record<ActiveTab, string> = {
  deals: "Deals",
  "manual-prices": "Manual Prices",
  items: "Items",
  store: "Store Prices",
};

export default function HardwarePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [items, setItems] = useState<HardwareConfigItem[]>([]);
  const [manualPrices, setManualPrices] = useState<ManualPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("deals");
  const [scrapingItemId, setScrapingItemId] = useState<number | null>(null);

  // Ref to allow StorePricesTab to prefill the ItemsTab form cross-tab.
  const itemsPrefillRef = useRef<((values: PrefilledItemValues) => void) | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [dealsRes, summaryRes, itemsRes, pricesRes] = await Promise.all([
        fetch(`${HARDWARE_API}/api/deals`).then((r) => r.json()),
        fetch(`${HARDWARE_API}/api/deals/summary`).then((r) => r.json()),
        fetch(`${HARDWARE_API}/api/items`).then((r) => r.json()),
        fetch(`${HARDWARE_API}/api/manual-prices`)
          .then((r) => r.json())
          .catch(() => []),
      ]);
      setDeals(Array.isArray(dealsRes) ? dealsRes : []);
      setSummary(Array.isArray(summaryRes) ? summaryRes : []);
      setItems(Array.isArray(itemsRes) ? itemsRes : []);
      setManualPrices(Array.isArray(pricesRes) ? pricesRes : []);
    } catch (error) {
      console.error("[hardware] fetchAll failed:", error);
      toast.error("Failed to connect to Hardware API");
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async () => {
    setScraping(true);
    try {
      const res = await fetch(`${HARDWARE_API}/api/scrape`, { method: "POST" });
      if (res.ok) {
        toast.success("Scrape started successfully");
        setTimeout(() => fetchAll(), 5000);
      } else {
        toast.error("Failed to start scrape");
      }
    } catch {
      toast.error("Failed to connect to Hardware API");
    } finally {
      setScraping(false);
    }
  };

  const handleDeleteDeal = async (dealId: number) => {
    try {
      const res = await fetch(`${HARDWARE_API}/api/deals/${dealId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeals((prev) => prev.filter((d) => d.id !== dealId));
        toast.success("Deal removed");
      } else {
        toast.error("Failed to delete deal");
      }
    } catch {
      toast.error("Failed to connect to Hardware API");
    }
  };

  const handleBanDeal = async (dealId: number, title: string) => {
    if (!window.confirm(`Ban "${title}"? It will be deleted and never re-imported.`)) return;
    try {
      const res = await fetch(`${HARDWARE_API}/api/deals/${dealId}/ban`, {
        method: "POST",
      });
      if (res.ok) {
        setDeals((prev) => prev.filter((d) => d.id !== dealId));
        toast.success("Deal banned permanently");
      } else {
        toast.error("Failed to ban deal");
      }
    } catch {
      toast.error("Failed to connect to Hardware API");
    }
  };

  const handleClearAllDeals = async () => {
    if (!window.confirm("Are you sure you want to delete ALL scraped deals? This cannot be undone.")) {
      return;
    }
    try {
      const res = await fetch(`${HARDWARE_API}/api/deals/all`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("All deals cleared");
        fetchAll();
      } else {
        toast.error("Failed to clear deals");
      }
    } catch {
      toast.error("Failed to connect to Hardware API");
    }
  };

  const handleSaveManualPrice = async (
    itemName: string,
    values: Partial<ManualPrice>
  ) => {
    try {
      const res = await fetch(`${HARDWARE_API}/api/manual-prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_name: itemName, ...values }),
      });
      if (res.ok) {
        toast.success(`Price updated for ${itemName}`);
        fetchAll();
      } else {
        toast.error("Failed to save price");
      }
    } catch {
      toast.error("Failed to connect to Hardware API");
    }
  };

  const handleDeleteManualPrice = async (itemName: string) => {
    try {
      const res = await fetch(
        `${HARDWARE_API}/api/manual-prices/${encodeURIComponent(itemName)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success(`Deleted ${itemName}`);
        fetchAll();
      } else {
        toast.error("Failed to delete");
      }
    } catch {
      toast.error("Failed to connect to Hardware API");
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!window.confirm("Delete this item? Its deals will also be removed.")) return;
    try {
      const res = await fetch(`${HARDWARE_API}/api/items/${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Item deleted");
        fetchAll();
      } else {
        toast.error("Failed to delete item");
      }
    } catch {
      toast.error("Failed to connect to Hardware API");
    }
  };

  const handleSaveItem = async (
    payload: Omit<HardwareConfigItem, "id">,
    editingId: number | null
  ) => {
    if (!payload.name.trim()) {
      toast.error("Item name is required");
      return;
    }
    if (isNaN(payload.max_price) || payload.max_price <= 0) {
      toast.error("Valid max price is required");
      return;
    }
    try {
      const url = editingId
        ? `${HARDWARE_API}/api/items/${editingId}`
        : `${HARDWARE_API}/api/items`;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(editingId ? "Item updated" : "Item added");
        fetchAll();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || "Failed to save item");
      }
    } catch {
      toast.error("Failed to connect to Hardware API");
    }
  };

  const handleScrapeItem = async (itemId: number, itemName: string) => {
    setScrapingItemId(itemId);
    try {
      const res = await fetch(`${HARDWARE_API}/api/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId }),
      });
      if (res.ok) {
        toast.success(`Scraping ${itemName}...`);
        setTimeout(() => {
          fetchAll();
          setScrapingItemId(null);
        }, 10000);
      } else {
        toast.error("Failed to start scrape");
        setScrapingItemId(null);
      }
    } catch {
      toast.error("Failed to connect to Hardware API");
      setScrapingItemId(null);
    }
  };

  // Store tab "Add Item" prefills the ItemsTab form and switches tabs.
  const handleLoadIntoItemForm = (values: PrefilledItemValues) => {
    setActiveTab("items");
    // Small delay so the tab renders and mounts the ref before we call it.
    setTimeout(() => {
      itemsPrefillRef.current?.(values);
    }, 50);
    toast.info(`"${values.name}" loaded into item form`);
  };

  const pageActions = (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={fetchAll}
        disabled={loading}
        className="border-border"
      >
        <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
        Refresh
      </Button>
      <Button
        size="sm"
        onClick={handleScrape}
        disabled={scraping}
        className="bg-primary text-primary-foreground"
      >
        {scraping ? (
          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Search className="h-4 w-4 mr-1" />
        )}
        {scraping ? "Scraping..." : "Scrape Now"}
      </Button>
      <Button variant="destructive" size="sm" onClick={handleClearAllDeals}>
        <Trash2 className="h-4 w-4 mr-1" />
        Clear All
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hardware Deals"
        description="Monitor used hardware prices from OLX and eBay."
        actions={pageActions}
      />

      {/* Tab bar */}
      <div className="flex items-center gap-2">
        {(Object.keys(TAB_LABELS) as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "deals" && (
        <DealsTab
          deals={deals}
          onDeleteDeal={handleDeleteDeal}
          onBanDeal={handleBanDeal}
        />
      )}

      {activeTab === "manual-prices" && (
        <ManualPricesTab
          items={items}
          manualPrices={manualPrices}
          onSaveManualPrice={handleSaveManualPrice}
          onDeleteManualPrice={handleDeleteManualPrice}
          onDeleteItem={handleDeleteItem}
        />
      )}

      {activeTab === "items" && (
        <ItemsTab
          items={items}
          scrapingItemId={scrapingItemId}
          onSaveItem={handleSaveItem}
          onDeleteItem={handleDeleteItem}
          onScrapeItem={handleScrapeItem}
          prefillRef={itemsPrefillRef}
        />
      )}

      {activeTab === "store" && (
        <StorePricesTab
          hardwareApiUrl={HARDWARE_API}
          onLoadIntoItemForm={handleLoadIntoItemForm}
          onSyncComplete={fetchAll}
        />
      )}
    </div>
  );
}
