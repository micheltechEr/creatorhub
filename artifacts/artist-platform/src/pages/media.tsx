import { useRef, useState } from "react";
import {
  useListMedia,
  getListMediaQueryKey,
  useUploadMedia,
  useDeleteMedia,
  useGetMe,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Video, FileVideo, Copy, ExternalLink } from "lucide-react";
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

const MAX_SIZE_MB = 50;
const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo"];

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Media() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const { data: artist } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data, isLoading } = useListMedia({
    query: { queryKey: getListMediaQueryKey() },
  });
  const uploadMutation = useUploadMedia();
  const deleteMutation = useDeleteMedia();

  const handleUpload = async (file: File) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande. Máximo: ${MAX_SIZE_MB}MB`);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Tipo não suportado. Use MP4, MOV ou AVI.");
      return;
    }
    try {
      await uploadMutation.mutateAsync({ data: { file } });
      queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
      toast.success("Vídeo enviado com sucesso!");
    } catch {
      toast.error("Erro ao enviar vídeo. Tente novamente.");
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

  const copyPublicLink = () => {
    if (!artist) return;
    const url = `${window.location.origin}/p/${artist.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link do portfólio copiado!");
  };

  const media = data?.media ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-foreground">Portfólio de Mídia</h1>
          <p className="text-sm text-muted-foreground mt-1 uppercase tracking-[0.3px]">
            {data?.total ?? 0} vídeo{(data?.total ?? 0) !== 1 ? "s" : ""} publicado{(data?.total ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {artist && (
            <Button
              variant="outline"
              onClick={copyPublicLink}
              className="text-sm border-border font-semibold"
              style={{ borderRadius: "2px" }}
            >
              <Copy className="mr-2 h-3.5 w-3.5" /> Copiar Link Público
            </Button>
          )}
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="bg-foreground text-background hover:opacity-90 text-sm font-semibold"
            style={{ borderRadius: "2px" }}
          >
            <Upload className="mr-2 h-3.5 w-3.5" />
            {uploadMutation.isPending ? "Enviando..." : "Enviar Vídeo"}
          </Button>
        </div>
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
        className={`border-2 border-dashed p-10 text-center transition-all cursor-pointer ${
          dragOver
            ? "border-[#C9A961] bg-[#C9A961]/5"
            : "border-border hover:border-[#C9A961]/50 hover:bg-muted"
        }`}
        style={{ borderRadius: "4px" }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <FileVideo className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          Arraste um vídeo aqui ou <span className="text-[#C9A961] font-semibold">clique para selecionar</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          MP4, MOV, AVI · Máximo {MAX_SIZE_MB}MB
        </p>
        {uploadMutation.isPending && (
          <div className="mt-3 flex items-center justify-center gap-2 text-[#C9A961]">
            <div className="h-4 w-4 border-2 border-[#C9A961] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Enviando...</span>
          </div>
        )}
      </div>

      {/* Media grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse" style={{ borderRadius: "4px" }} />
          ))}
        </div>
      ) : media.length === 0 ? (
        <div
          className="bg-card border border-border p-16 text-center"
          style={{ borderRadius: "4px" }}
        >
          <Video className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum vídeo publicado ainda</p>
          <p className="text-xs text-muted-foreground mt-1">Envie vídeos para exibir no seu portfólio público</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {media.map((item) => (
            <div
              key={item.id}
              className="bg-card border border-border overflow-hidden group"
              style={{ borderRadius: "4px" }}
            >
              <div className="relative bg-[#0A0A0A] h-44 flex items-center justify-center">
                <video
                  src={item.fileUrl}
                  className="h-full w-full object-cover"
                  controls={false}
                  preload="metadata"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <a
                    href={item.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold px-3 py-2 transition-colors flex items-center gap-1.5"
                    style={{ borderRadius: "2px" }}
                  >
                    <ExternalLink className="h-3 w-3" /> Ver
                  </a>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="bg-red-500/80 hover:bg-red-500 text-white text-xs font-semibold px-3 py-2 transition-colors flex items-center gap-1.5"
                        style={{ borderRadius: "2px" }}
                      >
                        <Trash2 className="h-3 w-3" /> Remover
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent style={{ borderRadius: "4px" }}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover vídeo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. O arquivo será removido permanentemente do seu portfólio.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel style={{ borderRadius: "2px" }}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(item.id)}
                          className="bg-foreground text-background hover:opacity-90"
                          style={{ borderRadius: "2px" }}
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="p-3 border-t border-border">
                <p className="text-xs font-medium text-foreground truncate">{item.fileName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatFileSize(item.fileSize)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
