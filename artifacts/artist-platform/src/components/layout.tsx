import { useAuth } from "@/lib/auth-context";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, ListOrdered, Video, User, Star, LogOut, Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ListOrdered },
  { href: "/media", label: "Media Portfolio", icon: Video },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/reviews", label: "Reviews", icon: Star },
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
      <div className="mb-8 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">ArtistFlow</h2>
            <p className="text-xs text-muted-foreground">Creative marketplace</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}>
              <span className={`group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                isActive 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}>
                <item.icon className={`mr-3 flex-shrink-0 h-5 w-5 ${isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"}`} />
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-4 border-t border-sidebar-border">
        {artist && (
          <div className="flex items-center mb-4 rounded-2xl bg-sidebar-accent p-3">
            <Avatar className="h-10 w-10 mr-3">
              <AvatarFallback className="bg-primary/10 text-primary">
                {artist.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{artist.name}</p>
              <p className="text-xs text-muted-foreground truncate">{artist.email}</p>
            </div>
          </div>
        )}
        <Button variant="outline" className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden absolute top-4 left-4 z-50 bg-card/90 backdrop-blur border shadow-sm">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 flex flex-col bg-sidebar border-sidebar-border">
          <div className="flex flex-col h-full py-6">
            <NavLinks />
          </div>
        </SheetContent>
      </Sheet>

      <div className="hidden md:flex w-72 flex-col fixed inset-y-0 border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl shadow-[0_20px_60px_rgba(107,76,230,0.08)]">
        <div className="flex flex-col h-full py-6">
          <NavLinks />
        </div>
      </div>

      <div className="flex-1 flex flex-col md:pl-72 h-full overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
