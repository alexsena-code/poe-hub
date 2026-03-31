"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface RecentSale {
  id: string;
  date: string;
  buyerName: string;
  quantity: number;
  unit: string;
  totalBrl: number | null;
  totalUsd: number | null;
}

export function RecentSales({ sales }: { sales: RecentSale[] }) {
  if (sales.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vendas Recentes</CardTitle>
          <CardDescription>Ultimas 5 vendas registradas</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma venda registrada.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendas Recentes</CardTitle>
        <CardDescription>Ultimas 5 vendas registradas</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 font-medium text-muted-foreground">Data</th>
                <th className="pb-2 font-medium text-muted-foreground">
                  Comprador
                </th>
                <th className="pb-2 font-medium text-muted-foreground text-right">
                  Qtd
                </th>
                <th className="pb-2 font-medium text-muted-foreground text-right">
                  Total (BRL)
                </th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b border-border/50">
                  <td className="py-2 whitespace-nowrap">
                    {new Date(sale.date).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="py-2">{sale.buyerName}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {sale.quantity.toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    <span className="text-muted-foreground text-xs">
                      {sale.unit}
                    </span>
                  </td>
                  <td className="py-2 text-right whitespace-nowrap font-medium">
                    {sale.totalBrl !== null
                      ? `R$ ${sale.totalBrl.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : "--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
