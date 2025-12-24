import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md mx-4 shadow-xl border-none">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 text-destructive justify-center">
            <AlertCircle className="h-12 w-12" />
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
            الصفحة غير موجودة
          </h1>
          
          <p className="text-center text-gray-600 mb-8">
            عذراً، الصفحة التي تحاول الوصول إليها غير موجودة أو تم نقلها.
          </p>

          <div className="flex justify-center">
            <Link href="/">
              <Button size="lg" className="font-bold min-w-[140px]">
                العودة للرئيسية
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
