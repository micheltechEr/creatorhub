import { useAuth } from "@/lib/auth-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useState } from "react";
import { X } from "lucide-react";

const CATEGORIES = ["Música", "Dança", "Comédia", "Motivação", "Aniversário", "Casamento", "Outro"];

const registerSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  categories: z.array(z.string()).min(1, "Selecione ao menos uma categoria"),
  tags: z.array(z.string()).optional(),
  basePrice: z.coerce.number().min(1, "Preço deve ser maior que zero"),
  deliveryDays: z.coerce.number().int().min(1, "Mínimo 1 dia").max(180, "Máximo 180 dias"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const inputCls = "h-12 border-border bg-white focus-visible:ring-0 focus-visible:border-foreground text-sm";
const inputStyle = { borderRadius: "2px" };
const labelCls = "text-xs font-medium uppercase tracking-[0.5px] text-[#1F1F1F]";

export default function Register() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const registerMutation = useRegister();
  const [tagInput, setTagInput] = useState("");

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      categories: [],
      tags: [],
      basePrice: 50,
      deliveryDays: 7,
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      const response = await registerMutation.mutateAsync({ data });
      login(response.accessToken, response.refreshToken);
      toast.success("Bem-vindo ao CREATOR HUB!");
      setLocation("/dashboard");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Erro no cadastro. Tente novamente.");
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const current = form.getValues("tags") || [];
      if (!current.includes(tagInput.trim())) {
        form.setValue("tags", [...current, tagInput.trim()]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    form.setValue("tags", (form.getValues("tags") || []).filter((t) => t !== tag));
  };

  const cats = form.watch("categories");

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-[#0A0A0A] flex-col justify-between p-12 shrink-0">
        <div>
          <span className="font-serif text-2xl font-semibold text-white tracking-tight">CREATOR HUB</span>
          <div className="mt-1 h-px w-10 bg-[#C9A961]" />
        </div>
        <div>
          <h1
            className="font-serif text-5xl font-semibold text-white leading-tight mb-6"
            style={{ letterSpacing: "-1px" }}
          >
            Crie seu perfil<br />de artista.
          </h1>
          <p className="text-[#6D6D6D] text-base leading-relaxed max-w-sm">
            Configure seu portfólio, defina preços e comece a receber pedidos de clientes corporativos e personalidades.
          </p>
        </div>
        <p className="text-[#3D3D3D] text-sm">
          © {new Date().getFullYear()} CREATOR HUB. Todos os direitos reservados.
        </p>
      </div>

      {/* Right panel — scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex items-start justify-center p-8 lg:p-14">
          <div className="w-full max-w-xl">
            {/* Mobile logo */}
            <div className="mb-8 lg:hidden">
              <span className="font-serif text-2xl font-semibold text-foreground">CREATOR HUB</span>
              <div className="mt-1 h-px w-8 bg-[#C9A961]" />
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-1">Criar conta</h2>
              <p className="text-sm text-muted-foreground">Preencha os dados para começar</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {/* Name + Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelCls}>Nome artístico</FormLabel>
                        <FormControl>
                          <Input className={inputCls} style={inputStyle} placeholder="Seu nome artístico" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelCls}>E-mail</FormLabel>
                        <FormControl>
                          <Input type="email" className={inputCls} style={inputStyle} placeholder="artista@exemplo.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelCls}>Senha</FormLabel>
                      <FormControl>
                        <Input type="password" className={inputCls} style={inputStyle} placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4 border-t border-border">
                  <p className="text-xs font-medium uppercase tracking-[0.5px] text-[#1F1F1F] mb-4">
                    Serviço oferecido
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <FormField
                      control={form.control}
                      name="basePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelCls}>Preço Base (BRL)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-3.5 text-muted-foreground text-sm">R$</span>
                              <Input type="number" className={`${inputCls} pl-9`} style={inputStyle} {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="deliveryDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelCls}>Prazo (dias)</FormLabel>
                          <FormControl>
                            <Input type="number" className={inputCls} style={inputStyle} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="categories"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelCls}>Categorias</FormLabel>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                          {CATEGORIES.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                const cur = field.value ?? [];
                                field.onChange(
                                  cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat]
                                );
                              }}
                              className={`p-2.5 border text-xs font-medium transition-colors duration-150 ${
                                cats?.includes(cat)
                                  ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
                                  : "border-border text-muted-foreground hover:bg-[#F8F8F8] hover:text-foreground"
                              }`}
                              style={{ borderRadius: "2px" }}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem className="mt-4">
                        <FormLabel className={labelCls}>Tags (opcional)</FormLabel>
                        <FormControl>
                          <Input
                            className={inputCls}
                            style={inputStyle}
                            placeholder="Pressione Enter para adicionar..."
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleAddTag}
                          />
                        </FormControl>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(field.value ?? []).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0A0A0A] text-white"
                              style={{ borderRadius: "2px" }}
                            >
                              {tag}
                              <button type="button" onClick={() => removeTag(tag)} className="hover:opacity-70">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-sm font-semibold bg-[#0A0A0A] text-white hover:bg-[#1F1F1F] transition-all duration-200 mt-2"
                  style={{ borderRadius: "2px" }}
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? "Criando perfil..." : "Criar Perfil de Artista"}
                </Button>
              </form>
            </Form>

            <div className="mt-6 pt-6 border-t border-border text-center">
              <p className="text-sm text-muted-foreground">
                Já tem uma conta?{" "}
                <Link href="/login">
                  <span className="text-[#C9A961] font-semibold hover:underline cursor-pointer">
                    Entrar
                  </span>
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
