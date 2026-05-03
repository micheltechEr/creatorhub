import { useAuth } from "@/lib/auth-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
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

const loginSchema = z.object({
  email: z.string().email("Endereço de e-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const response = await loginMutation.mutateAsync({ data });
      login(response.accessToken, response.refreshToken);
      toast.success("Bem-vindo ao CREATOR HUB");
      setLocation("/dashboard");
    } catch {
      toast.error("Credenciais inválidas. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0A0A0A] flex-col justify-between p-12">
        <div>
          <span className="font-serif text-2xl font-semibold text-white tracking-tight">
            CREATOR HUB
          </span>
          <div className="mt-1 h-px w-10 bg-[#C9A961]" />
        </div>
        <div>
          <h1
            className="font-serif text-5xl font-semibold text-white leading-tight mb-6"
            style={{ letterSpacing: "-1px" }}
          >
            Vídeos personalizados<br />de elite.
          </h1>
          <p className="text-[#6D6D6D] text-base leading-relaxed max-w-sm">
            Conectamos artistas de excelência com clientes corporativos e personalidades que exigem o melhor.
          </p>
        </div>
        <p className="text-[#3D3D3D] text-sm">
          © {new Date().getFullYear()} CREATOR HUB. Todos os direitos reservados.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-10 lg:hidden">
            <span className="font-serif text-2xl font-semibold text-foreground">CREATOR HUB</span>
            <div className="mt-1 h-px w-8 bg-[#C9A961]" />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-1">Entrar</h2>
            <p className="text-sm text-muted-foreground">
              Acesse seu painel de artista
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium uppercase tracking-[0.5px] text-[#1F1F1F]">
                      E-mail
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="artista@exemplo.com"
                        className="h-12 border-border bg-white focus-visible:ring-0 focus-visible:border-foreground text-sm"
                        style={{ borderRadius: "2px" }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium uppercase tracking-[0.5px] text-[#1F1F1F]">
                      Senha
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="h-12 border-border bg-white focus-visible:ring-0 focus-visible:border-foreground text-sm"
                        style={{ borderRadius: "2px" }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-12 text-sm font-semibold bg-[#0A0A0A] text-white hover:bg-[#1F1F1F] transition-all duration-200"
                style={{ borderRadius: "2px" }}
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              Não tem conta?{" "}
              <Link href="/register">
                <span className="text-[#C9A961] font-semibold hover:underline cursor-pointer">
                  Cadastre-se como Artista
                </span>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
