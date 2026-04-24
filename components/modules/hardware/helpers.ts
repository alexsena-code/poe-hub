// Shared formatting + lookup helpers for the hardware module.

export function formatPriceBrl(price: number): string {
  if (price === 0) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
}

/** Formats a deal found_at timestamp in pt-BR dd/mm/yy HH:MM format. */
export function formatDealDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function categoryLabel(cat: string): string {
  switch (cat) {
    case "gpu":
      return "GPU";
    case "cpu-kit":
      return "CPU Kit";
    case "ram":
      return "RAM";
    default:
      return cat.toUpperCase();
  }
}

/** Auto-generates search keywords from an item name. */
export function generateKeywords(name: string): string[] {
  const lower = name.toLowerCase();
  const keywords = [lower];
  const noSpaces = lower.replace(/\s+/g, "");
  if (noSpaces !== lower) keywords.push(noSpaces);
  const parts = lower.split(" ");
  if (parts.length > 1) {
    keywords.push(parts.slice(1).join(" "));
  }
  return [...new Set(keywords)];
}

// Spec field labels used in the Items form across both deal config items and builder items.
export const SPEC_LABELS: Record<string, string> = {
  vram_gb: "VRAM (GB)",
  tdp_w: "TDP (W)",
  cuda_cores: "CUDA Cores",
  memory_type: "Memory Type",
  pcie_gen: "PCIe Gen",
  pcie_lanes: "PCIe Lanes",
  lhr: "LHR",
  cores: "Cores",
  threads: "Threads",
  p_cores: "P-Cores",
  e_cores: "E-Cores",
  base_clock_ghz: "Base Clock (GHz)",
  boost_clock_ghz: "Boost Clock (GHz)",
  socket: "Socket",
  hyperthreading: "Hyperthreading",
  smt: "SMT",
  capacity_gb: "Capacity (GB)",
  type: "Type",
  speed_mhz: "Speed (MHz)",
  cas_latency: "CAS Latency",
  color: "Color",
  rgb: "RGB",
  form_factor: "Form Factor",
  interface: "Interface",
  wattage: "Wattage (W)",
  efficiency: "Efficiency",
  modular: "Modular",
  atx_version: "ATX Version",
  gpu_connector: "GPU Connector",
  size_inches: "Size (inches)",
  resolution: "Resolution",
  panel: "Panel",
  refresh_rate: "Refresh Rate (Hz)",
  refresh_rate_oc: "OC Refresh (Hz)",
};

/** Returns spec field definitions for a given hardware category. */
export function specsFieldsForCategory(
  cat: string,
  currentSpecKeys: string[] = []
): { key: string; label: string }[] {
  const base: Record<string, string[]> = {
    gpu: ["vram_gb", "memory_type", "pcie_gen", "tdp_w", "cuda_cores"],
    "cpu-kit": [
      "cores",
      "p_cores",
      "e_cores",
      "threads",
      "socket",
      "base_clock_ghz",
      "boost_clock_ghz",
    ],
    cpu: [
      "cores",
      "p_cores",
      "e_cores",
      "threads",
      "socket",
      "base_clock_ghz",
      "boost_clock_ghz",
    ],
    ram: ["capacity_gb", "type", "speed_mhz", "cas_latency"],
    motherboard: ["socket", "form_factor", "memory_type", "pcie_gen"],
    ssd: ["capacity_gb", "form_factor", "interface", "pcie_gen"],
    psu: ["wattage", "efficiency", "modular", "gpu_connector"],
    monitor: ["size_inches", "resolution", "panel", "refresh_rate"],
  };
  const keys = base[cat] || [];
  // Also include any extra keys already in the form that have known labels.
  const extra = currentSpecKeys.filter(
    (k) => !keys.includes(k) && k in SPEC_LABELS
  );
  return [...keys, ...extra].map((k) => ({ key: k, label: SPEC_LABELS[k] || k }));
}
