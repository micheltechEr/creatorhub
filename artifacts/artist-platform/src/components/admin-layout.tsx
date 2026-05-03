import { useClerk, useUser } from "@clerk/react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  ListOrdered,
  LogOut,
  Menu,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const adminNavItems = [
  { href: "/admin", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/admin/artists", label: "Artistas", icon: Users },
  { href: "/admin/orders", label: "Todos os Pedidos", icon: ListOrdered },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  const handleLogout = async () => {
    queryClient.clear();
    await signOut();
  };

  const displayName = currentUser?.name ?? user?.fullName ?? "";
  const displayEmail = currentUser?.email ?? user?.primaryEmailAddress?.emailAddress ?? "";

  const NavLinks = () => (
    <>
      <div className="mb-8 px-5">
        <span className="font-serif text-xl font-semibold tracking-tight text-foreground">
          CREATOR HUB
        </span>
        <div className="mt-0.5 h-px w-8 bg-[#C9A961]" />
        <div className="mt-2 flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-[#C9A961]" />
          <span className="text-[10px] font-semibold text-[#C9A961] uppercase tracking-widest">
            Super Admin
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {adminNavItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? location === "/admin"
              : location.startsWith(item.href);
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
                    isActive
                      ? "text-background"
                      : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-3 pt-4 border-t border-sidebar-border">
        {displayName && (
          <div className="flex items-center gap-3 px-2 py-3 mb-2">
            <Avatar className="h-8 w-8 rounded-full border border-[#C9A961]/30 flex-shrink-0">
              <AvatarFallback className="bg-[#C9A961]/10 text-[#C9A961] text-xs font-semibold rounded-full">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
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
        <SheetContent
          side="left"
          className="w-64 p-0 flex flex-col bg-sidebar border-sidebar-border"
        >
          <div className="flex flex-col h-full py-6">
            <NavLinks />
          </div>
        </SheetContent>
      </Sheet>

      <div
        className="hidden md:flex w-64 flex-col fixed inset-y-0 bg-sidebar border-r border-sidebar-border"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
      >
        <div className="flex flex-col h-full py-6">
          <NavLinks />
        </div>
      </div>

      <div className="flex-1 flex flex-col md:pl-64 h-full overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
