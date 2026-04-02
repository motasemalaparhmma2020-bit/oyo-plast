import { useState } from "react";
import { useImageDimensions, useUpdateImageDimension } from "@/hooks/use-image-dimensions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2 } from "lucide-react";

interface EditingDimension {
  id: number;
  imageType: string;
  width: number;
  height: number;
  description: string;
}

export function ImageDimensionsManager({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const { data: dimensions = [], isLoading } = useImageDimensions();
  const updateMutation = useUpdateImageDimension(adminToken);
  
  const [editing, setEditing] = useState<Record<number, EditingDimension>>({});

  const handleStartEdit = (dim: any) => {
    setEditing({
      ...editing,
      [dim.id]: {
        id: dim.id,
        imageType: dim.imageType,
        width: dim.width,
        height: dim.height,
        description: dim.description || "",
      },
    });
  };

  const handleCancel = (id: number) => {
    const newEditing = { ...editing };
    delete newEditing[id];
    setEditing(newEditing);
  };

  const handleSave = async (id: number) => {
    const data = editing[id];
    if (!data || !data.width || !data.height) {
      toast({ title: "❌ الرجاء ملء جميع الحقول", variant: "destructive" });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: data.id,
        width: parseInt(String(data.width)),
        height: parseInt(String(data.height)),
        description: data.description,
      });
      toast({ title: "✅ تم حفظ المقاس" });
      handleCancel(id);
    } catch (err) {
      toast({ title: "❌ خطأ في الحفظ", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📐 معلومات مهمة</h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• غيّر مقاسات الصور من هنا باستخدام الأزرار اليدوية</li>
          <li>• المقاسات تُطبق تلقائياً على جميع الصور الجديدة</li>
          <li>• الصور الموجودة لن تتأثر بالتغييرات الجديدة</li>
        </ul>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>مقاسات الصور</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">نوع الصورة</TableHead>
                  <TableHead className="text-right">العرض (px)</TableHead>
                  <TableHead className="text-right">الارتفاع (px)</TableHead>
                  <TableHead className="text-right">الوصف</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dimensions.map((dim) => {
                  const isEditing = editing[dim.id];
                  return (
                    <TableRow key={dim.id}>
                      <TableCell className="font-semibold">{dim.imageType}</TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="number"
                            min="1"
                            value={isEditing.width}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                [dim.id]: { ...isEditing, width: parseInt(e.target.value) || 0 },
                              })
                            }
                            className="w-24"
                          />
                        ) : (
                          <span className="font-mono">{dim.width}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="number"
                            min="1"
                            value={isEditing.height}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                [dim.id]: { ...isEditing, height: parseInt(e.target.value) || 0 },
                              })
                            }
                            className="w-24"
                          />
                        ) : (
                          <span className="font-mono">{dim.height}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {isEditing ? (
                          <Input
                            value={isEditing.description}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                [dim.id]: { ...isEditing, description: e.target.value },
                              })
                            }
                            className="w-48"
                          />
                        ) : (
                          <span>{dim.description}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSave(dim.id)}
                              disabled={updateMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {updateMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancel(dim.id)}
                            >
                              إلغاء
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartEdit(dim)}
                          >
                            تعديل
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Preview Info */}
      <Card>
        <CardHeader>
          <CardTitle>📋 نسب العرض للارتفاع</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {dimensions.map((dim) => {
              const ratio = (dim.width / dim.height).toFixed(2);
              return (
                <div key={dim.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="font-semibold text-sm">{dim.imageType}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {dim.width} × {dim.height}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    نسبة: {ratio}:1
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
