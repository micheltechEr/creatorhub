import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus,
  Upload,
  FileText,
  Trash2,
  Download,
  Save,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  FileSignature,
  ExternalLink,
  ChevronLeft,
  CheckCircle,
  Clock,
  MoreVertical,
  Eye,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Contract {
  id: string;
  title: string;
  contentHtml: string;
  fileUrl: string | null;
  fileName: string | null;
  type: "created" | "uploaded";
  status: "draft" | "finalized";
  createdAt: string;
  updatedAt: string;
}

// ── Templates ─────────────────────────────────────────────────────────────────
const CONTRACT_TEMPLATES = [
  {
    label: "Prestação de Serviços",
    html: `<h1 style="text-align:center;font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;">CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>
<p style="text-align:center;margin-bottom:2rem;color:#555;">Serviços de Produção de Vídeo Personalizado</p>

<p><strong>CONTRATANTE:</strong> [Nome completo / Razão social], inscrito(a) no CPF/CNPJ sob o nº [número], residente/sediado(a) à [endereço], doravante denominado(a) simplesmente <em>CONTRATANTE</em>.</p>

<p><strong>CONTRATADO(A):</strong> [Nome do Artista], inscrito(a) no CPF/CNPJ sob o nº [número], doravante denominado(a) simplesmente <em>CONTRATADO(A)</em>.</p>

<p>As partes acima identificadas têm entre si justo e contratado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas e condições seguintes.</p>

<h2 style="margin-top:2rem;font-size:1.1rem;font-weight:700;">CLÁUSULA 1ª – DO OBJETO</h2>
<p>O presente contrato tem por objeto a criação e entrega de vídeo(s) personalizado(s) conforme briefing acordado entre as partes, incluindo roteiro, gravação, edição e entrega do arquivo final.</p>

<h2 style="margin-top:1.5rem;font-size:1.1rem;font-weight:700;">CLÁUSULA 2ª – DO PRAZO</h2>
<p>O(A) CONTRATADO(A) se compromete a entregar o produto final no prazo de [X] dias úteis contados da confirmação do pagamento e recebimento do briefing completo.</p>

<h2 style="margin-top:1.5rem;font-size:1.1rem;font-weight:700;">CLÁUSULA 3ª – DO VALOR E PAGAMENTO</h2>
<p>Pela execução dos serviços descritos, o(a) CONTRATANTE pagará ao(à) CONTRATADO(A) o valor de R$ [valor] ([valor por extenso]), a ser pago via [forma de pagamento] até [data].</p>

<h2 style="margin-top:1.5rem;font-size:1.1rem;font-weight:700;">CLÁUSULA 4ª – DAS REVISÕES</h2>
<p>Estão incluídas no valor [X] revisão(ões) do conteúdo. Revisões adicionais serão cobradas à parte, conforme tabela do(a) CONTRATADO(A).</p>

<h2 style="margin-top:1.5rem;font-size:1.1rem;font-weight:700;">CLÁUSULA 5ª – DOS DIREITOS AUTORAIS</h2>
<p>Os direitos de uso do vídeo produzido serão cedidos ao(à) CONTRATANTE para [fins específicos de uso], após a quitação integral do valor acordado.</p>

<h2 style="margin-top:1.5rem;font-size:1.1rem;font-weight:700;">CLÁUSULA 6ª – DAS DISPOSIÇÕES GERAIS</h2>
<p>O presente contrato obriga as partes e seus sucessores, sendo regido pelas leis da República Federativa do Brasil, elegendo as partes o Foro da comarca de [cidade] para dirimir quaisquer dúvidas.</p>

<p style="margin-top:2rem;">Local e data: ___________________________, _____ de __________________ de 20______.</p>`,
  },
  {
    label: "NDA / Confidencialidade",
    html: `<h1 style="text-align:center;font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;">ACORDO DE CONFIDENCIALIDADE</h1>
<p style="text-align:center;margin-bottom:2rem;color:#555;">Non-Disclosure Agreement (NDA)</p>

<p><strong>DIVULGADOR:</strong> [Nome / Razão social], CPF/CNPJ nº [número].</p>
<p><strong>RECEPTOR:</strong> [Nome do Artista], CPF/CNPJ nº [número].</p>

<h2 style="margin-top:2rem;font-size:1.1rem;font-weight:700;">1. INFORMAÇÕES CONFIDENCIAIS</h2>
<p>São consideradas confidenciais todas as informações técnicas, comerciais, criativas ou estratégicas compartilhadas entre as partes para fins de elaboração do vídeo personalizado.</p>

<h2 style="margin-top:1.5rem;font-size:1.1rem;font-weight:700;">2. OBRIGAÇÕES</h2>
<p>O RECEPTOR concorda em não divulgar, reproduzir ou utilizar as informações confidenciais para qualquer finalidade diversa da execução deste projeto, sem autorização prévia e escrita do DIVULGADOR.</p>

<h2 style="margin-top:1.5rem;font-size:1.1rem;font-weight:700;">3. VIGÊNCIA</h2>
<p>Este acordo vigorará por [X] anos a partir da data de assinatura.</p>

<p style="margin-top:2rem;">Local e data: ___________________________, _____ de __________________ de 20______.</p>`,
  },
];

const SIGNATURE_BLOCK_HTML = `<div style="margin-top:60px;page-break-inside:avoid;">
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="width:48%;padding-right:2%;">
        <div style="border-top:1.5px solid #000;padding-top:10px;">
          <p style="margin:0;font-size:0.9rem;">Nome: ___________________________________</p>
          <p style="margin:6px 0 0 0;font-size:0.9rem;">Cargo / Qualificação: _____________________</p>
          <p style="margin:6px 0 0 0;font-size:0.9rem;">CPF/CNPJ: ______________________________</p>
          <p style="margin:6px 0 0 0;font-size:0.9rem;">Data: ___________________________________</p>
        </div>
      </td>
      <td style="width:4%;"></td>
      <td style="width:48%;">
        <div style="border-top:1.5px solid #000;padding-top:10px;">
          <p style="margin:0;font-size:0.9rem;">Nome: ___________________________________</p>
          <p style="margin:6px 0 0 0;font-size:0.9rem;">Cargo / Qualificação: _____________________</p>
          <p style="margin:6px 0 0 0;font-size:0.9rem;">CPF/CNPJ: ______________________________</p>
          <p style="margin:6px 0 0 0;font-size:0.9rem;">Data: ___________________________________</p>
        </div>
      </td>
    </tr>
  </table>
  <p style="margin-top:30px;font-size:0.85rem;color:#555;">Testemunhas:</p>
  <table style="width:100%;border-collapse:collapse;margin-top:8px;">
    <tr>
      <td style="width:48%;padding-right:2%;">
        <div style="border-top:1px solid #666;padding-top:8px;">
          <p style="margin:0;font-size:0.85rem;color:#555;">Nome: _______________________________</p>
          <p style="margin:4px 0 0 0;font-size:0.85rem;color:#555;">CPF: ________________________________</p>
        </div>
      </td>
      <td style="width:4%;"></td>
      <td style="width:48%;">
        <div style="border-top:1px solid #666;padding-top:8px;">
          <p style="margin:0;font-size:0.85rem;color:#555;">Nome: _______________________________</p>
          <p style="margin:4px 0 0 0;font-size:0.85rem;color:#555;">CPF: ________________________________</p>
        </div>
      </td>
    </tr>
  </table>
</div>`;

// ── PDF Export ────────────────────────────────────────────────────────────────
function exportToPDF(title: string, html: string) {
  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Permita pop-ups para exportar o PDF");
    return;
  }
  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      margin: 0;
      padding: 0;
    }
    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 25mm 20mm 25mm 25mm;
    }
    h1 { font-size: 14pt; }
    h2 { font-size: 12pt; }
    p { margin: 0 0 0.8em 0; text-align: justify; }
    table { width: 100%; border-collapse: collapse; }
    @media print {
      body { margin: 0; }
      .page { padding: 0; max-width: none; }
      @page { margin: 25mm 20mm 25mm 25mm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="page">${html}</div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`);
  win.document.close();
}

// ── Toolbar Button ─────────────────────────────────────────────────────────────
function ToolbarBtn({
  onClick,
  title,
  active,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`p-1.5 rounded hover:bg-muted transition-colors text-sm ${
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// ── Rich Text Editor ───────────────────────────────────────────────────────────
function RichEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isInitialized.current) {
      editorRef.current.innerHTML = value;
      isInitialized.current = true;
    }
  }, [value]);

  const exec = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const insertHTML = useCallback((html: string) => {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const applyTemplate = useCallback((html: string) => {
    if (editorRef.current) {
      editorRef.current.innerHTML = html;
      onChange(html);
      isInitialized.current = true;
    }
  }, [onChange]);

  return (
    <div className="flex flex-col border border-border rounded" style={{ borderRadius: "2px" }}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-border bg-sidebar">
        <ToolbarBtn onClick={() => exec("bold")} title="Negrito (Ctrl+B)"><Bold className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("italic")} title="Itálico (Ctrl+I)"><Italic className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("underline")} title="Sublinhado (Ctrl+U)"><Underline className="h-3.5 w-3.5" /></ToolbarBtn>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarBtn onClick={() => exec("formatBlock", "h1")} title="Título 1"><Heading1 className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("formatBlock", "h2")} title="Título 2"><Heading2 className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("formatBlock", "p")} title="Parágrafo"><AlignLeft className="h-3.5 w-3.5" /></ToolbarBtn>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarBtn onClick={() => exec("insertUnorderedList")} title="Lista com marcadores"><List className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("insertOrderedList")} title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></ToolbarBtn>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarBtn onClick={() => exec("justifyLeft")} title="Alinhar à esquerda"><AlignLeft className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("justifyCenter")} title="Centralizar"><AlignCenter className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("justifyRight")} title="Alinhar à direita"><AlignRight className="h-3.5 w-3.5" /></ToolbarBtn>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Templates dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <FileText className="h-3 w-3" /> Modelos
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {CONTRACT_TEMPLATES.map((t) => (
              <DropdownMenuItem key={t.label} onClick={() => applyTemplate(t.html)}>
                {t.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Signature insert */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            insertHTML(SIGNATURE_BLOCK_HTML);
          }}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-[#C9A961]/40 text-[#C9A961] hover:bg-[#C9A961]/10 transition-colors"
        >
          <FileSignature className="h-3 w-3" /> Inserir Assinaturas
        </button>
      </div>

      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        className="min-h-[520px] p-6 focus:outline-none text-foreground"
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "14px",
          lineHeight: "1.7",
        }}
        data-placeholder="Comece a escrever o contrato ou escolha um modelo acima..."
      />
    </div>
  );
}

// ── Upload Zone ───────────────────────────────────────────────────────────────
function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecione um arquivo");
      return;
    }
    if (!title.trim()) {
      toast.error("Informe o título do contrato");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title.trim());

      const res = await fetch("/api/contracts/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${(window as any).__clerkToken ?? ""}`,
        },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message ?? "Erro no upload");
      }

      toast.success("Contrato enviado com sucesso");
      setFile(null);
      setTitle("");
      onUploaded();
    } catch (err: any) {
      toast.error(err.message ?? "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5 text-foreground">Título do contrato</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Contrato - Cliente ABC"
          className="bg-sidebar border-border"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-foreground">Arquivo</label>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = e.dataTransfer.files[0];
            if (dropped) setFile(dropped);
          }}
          className="border-2 border-dashed border-border rounded p-8 text-center cursor-pointer hover:border-[#C9A961]/50 hover:bg-[#C9A961]/5 transition-colors"
        >
          {file ? (
            <div className="space-y-1">
              <FileText className="h-8 w-8 mx-auto text-[#C9A961]" />
              <p className="font-medium text-sm text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <button
                type="button"
                className="text-xs text-muted-foreground underline mt-1"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
              >
                Trocar arquivo
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Arraste ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground">PDF, DOC, DOCX · Máx. 20MB</p>
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
        />
      </div>

      <Button
        onClick={handleUpload}
        disabled={!file || !title.trim() || uploading}
        className="w-full bg-[#C9A961] hover:bg-[#B8964F] text-[#0A0A0A] font-semibold"
        style={{ borderRadius: "2px" }}
      >
        {uploading ? "Enviando..." : "Enviar Contrato"}
      </Button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Contracts() {
  const qc = useQueryClient();
  const [view, setView] = useState<"list" | "editor" | "upload">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorHtml, setEditorHtml] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch contracts
  const { data, isLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: () => api.get<{ contracts: Contract[] }>("/contracts").then((r) => r.contracts),
  });
  const contracts = data ?? [];

  // Save / update mutation
  const saveMutation = useMutation({
    mutationFn: async ({ status }: { status: "draft" | "finalized" }) => {
      if (selectedId) {
        return api.put(`/contracts/${selectedId}`, { title: editorTitle, contentHtml: editorHtml, status });
      }
      return api.post("/contracts", { title: editorTitle, contentHtml: editorHtml, status });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success(vars.status === "finalized" ? "Contrato finalizado!" : "Rascunho salvo");
      if (!selectedId) setView("list");
    },
    onError: () => toast.error("Erro ao salvar contrato"),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contracts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrato removido");
      setDeleteId(null);
      if (selectedId === deleteId) {
        setSelectedId(null);
        setView("list");
      }
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const openContract = (c: Contract) => {
    setSelectedId(c.id);
    setEditorTitle(c.title);
    setEditorHtml(c.contentHtml);
    setPreviewMode(false);
    setView("editor");
  };

  const newContract = () => {
    setSelectedId(null);
    setEditorTitle("");
    setEditorHtml("");
    setPreviewMode(false);
    setView("editor");
  };

  const currentContract = contracts.find((c) => c.id === selectedId);
  const isFinalized = currentContract?.status === "finalized";

  // ── List View ─────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-foreground tracking-tight">Contratos</h1>
            <p className="text-muted-foreground mt-1 text-sm">Crie, gerencie e exporte contratos em PDF</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setView("upload")}
              className="border-border text-foreground"
              style={{ borderRadius: "2px" }}
            >
              <Upload className="h-4 w-4 mr-2" /> Upload
            </Button>
            <Button
              onClick={newContract}
              className="bg-[#C9A961] hover:bg-[#B8964F] text-[#0A0A0A] font-semibold"
              style={{ borderRadius: "2px" }}
            >
              <Plus className="h-4 w-4 mr-2" /> Novo Contrato
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-[#C9A961] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-center py-24">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="font-serif text-lg font-semibold text-foreground mb-2">Nenhum contrato ainda</h3>
            <p className="text-muted-foreground text-sm mb-6">Crie um novo contrato ou faça upload de um existente.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setView("upload")} style={{ borderRadius: "2px" }}>
                <Upload className="h-4 w-4 mr-2" /> Fazer Upload
              </Button>
              <Button
                onClick={newContract}
                className="bg-[#C9A961] hover:bg-[#B8964F] text-[#0A0A0A] font-semibold"
                style={{ borderRadius: "2px" }}
              >
                <Plus className="h-4 w-4 mr-2" /> Novo Contrato
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {contracts.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-4 p-4 bg-card border border-border hover:border-[#C9A961]/30 rounded transition-colors cursor-pointer"
                style={{ borderRadius: "2px" }}
                onClick={() => openContract(c)}
              >
                <div className="flex-shrink-0 w-10 h-10 bg-sidebar flex items-center justify-center rounded" style={{ borderRadius: "2px" }}>
                  {c.type === "uploaded" ? (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <FileText className="h-5 w-5 text-[#C9A961]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.type === "uploaded" ? c.fileName ?? "Arquivo enviado" : "Criado no editor"} ·{" "}
                    {new Date(c.updatedAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge
                  className={
                    c.status === "finalized"
                      ? "bg-green-500/15 text-green-400 border-green-500/30"
                      : "bg-muted text-muted-foreground border-border"
                  }
                >
                  {c.status === "finalized" ? (
                    <><CheckCircle className="h-3 w-3 mr-1" /> Finalizado</>
                  ) : (
                    <><Clock className="h-3 w-3 mr-1" /> Rascunho</>
                  )}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openContract(c); }}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    {c.type === "created" && c.contentHtml && (
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); exportToPDF(c.title, c.contentHtml); }}>
                        <Download className="h-4 w-4 mr-2" /> Exportar PDF
                      </DropdownMenuItem>
                    )}
                    {c.type === "uploaded" && c.fileUrl && (
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(`/api${c.fileUrl?.replace(/^\/api/, "")}`, "_blank"); }}>
                        <ExternalLink className="h-4 w-4 mr-2" /> Abrir arquivo
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}

        {/* Delete confirm */}
        <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <DialogContent style={{ borderRadius: "2px" }}>
            <DialogHeader>
              <DialogTitle className="font-serif">Remover contrato</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">Essa ação não pode ser desfeita. O contrato será excluído permanentemente.</p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteId(null)} style={{ borderRadius: "2px" }}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                style={{ borderRadius: "2px" }}
              >
                {deleteMutation.isPending ? "Removendo..." : "Remover"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Upload View ───────────────────────────────────────────────────────────
  if (view === "upload") {
    return (
      <div className="max-w-lg">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => setView("list")} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-serif text-3xl font-semibold text-foreground tracking-tight">Upload de Contrato</h1>
            <p className="text-muted-foreground mt-1 text-sm">Envie um arquivo PDF, DOC ou DOCX</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded p-6" style={{ borderRadius: "2px" }}>
          <UploadZone onUploaded={() => { qc.invalidateQueries({ queryKey: ["contracts"] }); setView("list"); }} />
        </div>
      </div>
    );
  }

  // ── Editor View ───────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={() => setView("list")} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <Input
            value={editorTitle}
            onChange={(e) => setEditorTitle(e.target.value)}
            placeholder="Título do contrato..."
            className="text-lg font-semibold bg-transparent border-0 border-b border-border rounded-none px-0 h-auto py-1 focus-visible:ring-0 focus-visible:border-[#C9A961] text-foreground"
            style={{ fontSize: "1.25rem" }}
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setPreviewMode((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Eye className="h-4 w-4" /> {previewMode ? "Editar" : "Visualizar"}
          </button>
          {!isFinalized && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveMutation.mutate({ status: "draft" })}
              disabled={saveMutation.isPending || !editorTitle.trim()}
              className="border-border"
              style={{ borderRadius: "2px" }}
            >
              <Save className="h-4 w-4 mr-1.5" />
              {saveMutation.isPending ? "Salvando..." : "Salvar rascunho"}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => exportToPDF(editorTitle, editorHtml)}
            variant="outline"
            className="border-[#C9A961]/40 text-[#C9A961] hover:bg-[#C9A961]/10"
            style={{ borderRadius: "2px" }}
          >
            <Download className="h-4 w-4 mr-1.5" /> Exportar PDF
          </Button>
          {!isFinalized && (
            <Button
              size="sm"
              onClick={() => saveMutation.mutate({ status: "finalized" })}
              disabled={saveMutation.isPending || !editorTitle.trim() || !editorHtml.trim()}
              className="bg-[#C9A961] hover:bg-[#B8964F] text-[#0A0A0A] font-semibold"
              style={{ borderRadius: "2px" }}
            >
              <CheckCircle className="h-4 w-4 mr-1.5" /> Finalizar
            </Button>
          )}
        </div>
      </div>

      {isFinalized && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-sm">
          <CheckCircle className="h-4 w-4" />
          Contrato finalizado — edição desativada. Exporte como PDF ou crie uma cópia.
        </div>
      )}

      {previewMode ? (
        /* Preview mode: render HTML as document */
        <div
          className="bg-white text-black p-12 shadow-lg min-h-[600px]"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "14px", lineHeight: "1.7" }}
          dangerouslySetInnerHTML={{ __html: editorHtml || "<p style='color:#999'>Sem conteúdo ainda.</p>" }}
        />
      ) : (
        <RichEditor
          key={selectedId ?? "new"}
          value={editorHtml}
          onChange={setEditorHtml}
        />
      )}
    </div>
  );
}
