import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight, Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Loader2, Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Wallet as WalletType, WalletTransaction } from "@shared/schema";

function goBackSafe(setLocation: (p: string) => void) {
  try {
    const last = sessionStorage.getItem("lastSafePath");
    if (last && last !== "/wallet") return setLocation(last);
  } catch {}
  setLocation("/account");
}

export default function WalletPage() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const { data: wallet, isLoading: walletLoading } = useQuery<WalletType>({
    queryKey: ["/api/wallet"],
    enabled: isAuthenticated,
  });
  const { data: txs = [], isLoading: txLoading } = useQuery<WalletTransaction[]>({
    queryKey: ["/api/wallet/transactions"],
    enabled: isAuthenticated,
  });

  const balanceYer = parseFloat((wallet?.balanceYer as any) || "0");
  const balanceSar = parseFloat((wallet?.balanceSar as any) || "0");
  const last10 = txs.slice(0, 10);

  const formatDate = (d: string | Date | null) =>
    d ? new Date(d).toLocaleDateString("ar-YE", { year: "numeric", month: "short", day: "numeric" }) : "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-24" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-green-500 text-white">
        <div className="container max-w-2xl mx-auto px-4 pt-4 pb-12 relative">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost" size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => goBackSafe(setLocation)}
              data-testid="button-back-wallet"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">محفظتي</h1>
            <div className="w-9" />
          </div>

          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
              <WalletIcon className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-white/80 text-xs">الرصيد الحالي</p>
              <p className="text-3xl font-extrabold" data-testid="text-balance-yer">
                {walletLoading ? "—" : balanceYer.toLocaleString("ar-YE")} <span className="text-base font-bold">ر.ي</span>
              </p>
              {balanceSar > 0 && (
                <p className="text-white/80 text-xs mt-0.5" data-testid="text-balance-sar">
                  ≈ {balanceSar.toLocaleString("ar-YE")} ر.س
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 -mt-8 relative z-10">
        {/* Withdraw button */}
        <Card className="mb-4">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">طلب سحب رصيد</p>
              <p className="text-xs text-muted-foreground">يحوَّل خلال 24-48 ساعة عبر التواصل مع الإدارة</p>
            </div>
            <a
              href={`https://wa.me/967774997589?text=${encodeURIComponent("مرحباً، أريد سحب رصيد محفظتي")}`}
              target="_blank" rel="noopener noreferrer"
              data-testid="button-request-withdraw"
            >
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" size="sm">
                <ArrowUpRight className="h-4 w-4 ml-1" />
                طلب سحب
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">آخر الحركات</h3>
              <Badge variant="secondary" className="text-xs">{txs.length}</Badge>
            </div>
            {txLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
              </div>
            ) : last10.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">لا توجد حركات بعد</p>
              </div>
            ) : (
              <div className="space-y-2">
                {last10.map((tx: any) => {
                  const amount = parseFloat(tx.amount || "0");
                  const isCredit = tx.type === "credit" || amount > 0;
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/50"
                      data-testid={`tx-${tx.id}`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        isCredit ? "bg-emerald-100 dark:bg-emerald-950/40" : "bg-red-100 dark:bg-red-950/40"
                      }`}>
                        {isCredit ? (
                          <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{tx.description || (isCredit ? "إيداع" : "سحب")}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDate(tx.createdAt)}</p>
                      </div>
                      <p className={`text-sm font-bold shrink-0 ${isCredit ? "text-emerald-600" : "text-red-600"}`}>
                        {isCredit ? "+" : "-"}{Math.abs(amount).toLocaleString("ar-YE")} ر.ي
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {!isAuthenticated && (
          <div className="text-center mt-6">
            <Link href="/auth"><Button>تسجيل الدخول للوصول للمحفظة</Button></Link>
          </div>
        )}
      </div>
    </div>
  );
}
