import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import TeamManagement from "@/components/TeamManagement";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminStaff() {
  const [, setLocation] = useLocation();
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("admin_token");
    if (!t) {
      setLocation("/admin");
      return;
    }
    setAdminToken(t);
    setChecked(true);
  }, [setLocation]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-300">جارٍ التحقق…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/admin")}
              data-testid="button-back-admin"
            >
              <ArrowRight className="w-4 h-4 ml-1" />
              العودة للوحة الأدمن
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">
                  إدارة الموظفين البشريين
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  إضافة/تعديل/تعطيل أعضاء الفريق وصلاحياتهم
                </p>
              </div>
            </div>
          </div>
          <a
            href="/staff"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
            data-testid="link-staff-portal"
          >
            <ExternalLink className="w-4 h-4" />
            بوابة دخول الموظفين
          </a>
        </div>

        {/* Quick reference card */}
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
          <CardContent className="pt-4 text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
            <div className="font-bold mb-1">📋 كيف يدخل الموظف؟</div>
            <ol className="list-decimal pr-5 space-y-0.5">
              <li>أضِفه من زر "إضافة موظف جديد" أدناه — حدّد الدور وكلمة المرور.</li>
              <li>أرسل له الرابط <code className="bg-white dark:bg-gray-800 px-1 rounded">/staff</code> + البريد + كلمة المرور (عبر رسالة آمنة، ليس واتساب).</li>
              <li>يدخل تلقائياً للوحة المخصّصة لدوره.</li>
              <li>لتعطيله: اضغط "تعطيل" — يبقى في DB لكن يفقد الوصول. المرجع الكامل في <code>docs/STAFF_PERMISSIONS.md</code>.</li>
            </ol>
          </CardContent>
        </Card>

        {/* TeamManagement component (full CRUD UI already implemented) */}
        <TeamManagement adminToken={adminToken} />
      </div>
    </div>
  );
}
