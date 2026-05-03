import { useAuth } from "@/lib/auth-context";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, ListOrdered, Video, User, Star, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Pedidos", icon: ListOrdered },
  { href: "/media", label: "Portfólio", icon: Video },
  { href: "/profile", label: "Perfil", icon: User },
  { href: "/reviews", label: "Avaliações", icon: Star },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const { data: artist } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
  });

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (e) {
      console.error(e);
    } finally {
      logout();
      queryClient.clear();
    }
  };

  const NavLinks = () => (
    <>
      {/* Logo */}
      <div className="mb-8 px-5">
        <span className="font-serif text-xl font-semibold tracking-tight text-foreground">
          ArtistFlow
        </span>
        <div className="mt-0.5 h-px w-8 bg-[#C9A961]" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}>
              <span
                className={`group flex items-center px-3 py-2.5 text-sm transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground font-medium"
                }`}
                style={{ borderRadius: "2px" }}
              >
                <item.icon
                  className={`mr-3 flex-shrink-0 h-4 w-4 ${
                    isActive ? "text-background" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto px-3 pt-4 border-t border-sidebar-border">
        {artist && (
          <div className="flex items-center gap-3 px-2 py-3 mb-2">
            <Avatar className="h-8 w-8 rounded-full border border-border flex-shrink-0">
              <AvatarFallback className="bg-muted text-foreground text-xs font-semibold rounded-full">
                {artist.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-foreground">{artist.name}</p>
              <p className="text-xs text-muted-foreground truncate">{artist.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors duration-150"
          style={{ borderRadius: "2px" }}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden absolute top-4 left-4 z-50 bg-card border border-border shadow-sm"
            style={{ borderRadius: "2px" }}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 flex flex-col bg-sidebar border-sidebar-border">
          <div className="flex flex-col h-full py-6">
            <NavLinks />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div
        className="hidden md:flex w-64 flex-col fixed inset-y-0 bg-sidebar border-r border-sidebar-border"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
      >
        <div className="flex flex-col h-full py-6">
          <NavLinks />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:pl-64 h-full overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
