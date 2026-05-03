import { useAuth } from "@/lib/auth-context";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  ListOrdered, 
  Video, 
  User, 
  Star, 
  LogOut,
  Menu
} from "lucide-react";
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

  const { data: artist } = useGetMe(undefined, {
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false
    }
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
        <h2 className="text-2xl font-bold tracking-tight text-primary">ArtistFlow</h2>
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}>
              <span className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive 
                  ? "bg-primary text-primary-foreground" 
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
          <div className="flex items-center mb-4">
            <Avatar className="h-8 w-8 mr-2">
              <AvatarFallback className="bg-primary/10 text-primary">
                {artist.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{artist.name}</p>
              <p className="text-xs text-muted-foreground truncate">{artist.email}</p>
            </div>
          </div>
        )}
        <Button variant="outline" className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden absolute top-4 left-4 z-50">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 flex flex-col bg-sidebar border-sidebar-border">
          <div className="flex flex-col h-full py-6">
            <NavLinks />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden md:flex w-64 flex-col fixed inset-y-0 border-r border-sidebar-border bg-sidebar">
        <div className="flex flex-col h-full py-6">
          <NavLinks />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:pl-64 h-full overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
