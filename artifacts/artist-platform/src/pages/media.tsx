import { useRef, useState } from "react";
import {
  useListMedia,
  getListMediaQueryKey,
  useUploadMedia,
  useDeleteMedia,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { Upload, Trash2, Video, FileVideo, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MAX_SIZE_MB = 25;
const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo"];

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Media() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const { data, isLoading } = useListMedia(undefined, {
    query: { queryKey: getListMediaQueryKey() },
  });
  const uploadMutation = useUploadMedia();
  const deleteMutation = useDeleteMedia();

  const handleUpload = async (file: File) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande. Maximo: ${MAX_SIZE_MB}MB`);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Tipo nao suportado. Use MP4, MOV ou AVI.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      await uploadMutation.mutateAsync({ data: formData as any });
      queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
      toast.success("Video enviado com sucesso!");
    } catch {
      toast.error("Erro ao enviar video. Tente novamente.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
      toast.success("Arquivo removido");
    } catch {
      toast.error("Erro ao remover arquivo");
    }
  };

  const media = data?.media ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio de Midia</h1>
          <p className="text-muted-foreground mt-1">
            {data?.total ?? 0} arquivo{(data?.total ?? 0) !== 1 ? "s" : ""} enviados
          </p>
        </div>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploadMutation.isPending ? "Enviando..." : "Enviar Video"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-msvideo"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/20"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <FileVideo className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium text-muted-foreground">
          Arraste um video aqui ou clique para selecionar
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          MP4, MOV, AVI · Maximo {MAX_SIZE_MB}MB
        </p>
        {uploadMutation.isPending && (
          <div className="mt-3 flex items-center justify-center gap-2 text-primary">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Enviando...</span>
          </div>
        )}
      </div>

      {/* Media grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : media.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum video enviado ainda</p>
          <p className="text-sm mt-1">Envie videos para mostrar seu trabalho</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {media.map((item) => (
            <Card key={item.id} className="overflow-hidden group hover:shadow-md transition-all">
              <div className="relative bg-muted h-40 flex items-center justify-center">
                {item.mimeType === "video/mp4" ? (
                  <video
                    src={item.fileUrl}
                    className="h-full w-full object-cover"
                    controls={false}
                    preload="metadata"
                  />
                ) : (
                  <Video className="h-12 w-12 text-muted-foreground opacity-40" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Remover
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover video?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acao nao pode ser desfeita. O arquivo sera removido permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(item.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <CardContent className="p-3">
                <p className="font-medium text-sm truncate">{item.fileName}</p>
                <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
                  <span>{formatFileSize(item.fileSize)}</span>
                  <span>{formatDateTime(item.uploadedAt as unknown as string)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
