import { useState } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_OPTIONS = [
  "Pagode", "Samba", "Axé", "Funk", "Sertanejo",
  "MPB", "Bossa Nova", "Forró", "Rock", "Pop",
  "Gospel", "Infantil", "Animação", "Ator/Atriz", "Outro",
];

const onboardSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  basePrice: z
    .string()
    .min(1, "Preço base é obrigatório")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Preço deve ser maior que 0"),
  deliveryDays: z
    .string()
    .min(1, "Prazo é obrigatório")
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 1, "Prazo mínimo é 1 dia"),
  bio: z.string().optional(),
});

type OnboardForm = z.infer<typeof onboardSchema>;

export default function Onboarding() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardForm>({
    resolver: zodResolver(onboardSchema),
    defaultValues: {
      name: user?.fullName ?? "",
      email: user?.primaryEmailAddress?.emailAddress ?? "",
    },
  });

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
    }
    setTagInput("");
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const onSubmit = async (data: OnboardForm) => {
    if (categories.length === 0) {
      toast.error("Selecione pelo menos uma categoria");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${basePath}/api/artists/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          categories,
          tags,
          basePrice: Number(data.basePrice),
          deliveryDays: Number(data.deliveryDays),
          bio: data.bio || undefined,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao criar perfil");
      }

      toast.success("Perfil criado com sucesso!");
      setLocation("/dashboard");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-10">
          <span className="font-serif text-xl font-semibold text-white">CREATOR HUB</span>
          <div className="mt-1 h-px w-8 bg-[#C9A961]" />
          <h1 className="font-serif text-3xl font-semibold text-white mt-8 mb-2">
            Complete seu perfil
          </h1>
          <p className="text-[#6D6D6D] text-sm">
            Preencha as informações abaixo para começar a receber pedidos.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
          {/* Name */}
          <div className="space-y-2">
            <Label className="text-[#F8F8F8] text-sm font-medium">Nome artístico</Label>
            <Input
              {...register("name")}
              placeholder="Seu nome artístico"
              className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-[#3D3D3D] focus:border-[#C9A961] focus:ring-0"
              style={{ borderRadius: "2px" }}
            />
            {errors.name && (
              <p className="text-red-400 text-xs">{errors.name.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className="text-[#F8F8F8] text-sm font-medium">Email de contato</Label>
            <Input
              {...register("email")}
              type="email"
              placeholder="seu@email.com"
              className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-[#3D3D3D] focus:border-[#C9A961] focus:ring-0"
              style={{ borderRadius: "2px" }}
            />
            {errors.email && (
              <p className="text-red-400 text-xs">{errors.email.message}</p>
            )}
          </div>

          {/* Categories */}
          <div className="space-y-3">
            <Label className="text-[#F8F8F8] text-sm font-medium">
              Categorias <span className="text-[#C9A961]">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium border transition-all duration-150 ${
                    categories.includes(cat)
                      ? "bg-[#C9A961] border-[#C9A961] text-[#0A0A0A]"
                      : "bg-transparent border-[#2A2A2A] text-[#6D6D6D] hover:border-[#C9A961] hover:text-[#C9A961]"
                  }`}
                  style={{ borderRadius: "2px" }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-[#F8F8F8] text-sm font-medium">
              Tags <span className="text-[#6D6D6D] font-normal">(opcional)</span>
            </Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Ex: casamento, aniversário..."
                className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-[#3D3D3D] focus:border-[#C9A961] focus:ring-0"
                style={{ borderRadius: "2px" }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addTag}
                className="border-[#2A2A2A] bg-transparent text-[#6D6D6D] hover:border-[#C9A961] hover:text-[#C9A961]"
                style={{ borderRadius: "2px" }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((t) => (
                  <Badge
                    key={t}
                    variant="secondary"
                    className="bg-[#1A1A1A] text-[#C9A961] border border-[#2A2A2A] gap-1"
                    style={{ borderRadius: "2px" }}
                  >
                    {t}
                    <button type="button" onClick={() => removeTag(t)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Price + Delivery */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#F8F8F8] text-sm font-medium">Preço base (R$)</Label>
              <Input
                {...register("basePrice")}
                type="number"
                min="0"
                step="0.01"
                placeholder="250"
                className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-[#3D3D3D] focus:border-[#C9A961] focus:ring-0"
                style={{ borderRadius: "2px" }}
              />
              {errors.basePrice && (
                <p className="text-red-400 text-xs">{errors.basePrice.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[#F8F8F8] text-sm font-medium">Prazo (dias)</Label>
              <Input
                {...register("deliveryDays")}
                type="number"
                min="1"
                placeholder="7"
                className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-[#3D3D3D] focus:border-[#C9A961] focus:ring-0"
                style={{ borderRadius: "2px" }}
              />
              {errors.deliveryDays && (
                <p className="text-red-400 text-xs">{errors.deliveryDays.message}</p>
              )}
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label className="text-[#F8F8F8] text-sm font-medium">
              Bio <span className="text-[#6D6D6D] font-normal">(opcional)</span>
            </Label>
            <Textarea
              {...register("bio")}
              placeholder="Conte um pouco sobre você e seu trabalho..."
              rows={4}
              className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-[#3D3D3D] focus:border-[#C9A961] focus:ring-0 resize-none"
              style={{ borderRadius: "2px" }}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C9A961] text-[#0A0A0A] hover:bg-[#B8964F] font-semibold py-3"
            style={{ borderRadius: "2px" }}
          >
            {loading ? "Criando perfil..." : "Começar a criar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
