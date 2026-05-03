import { useEffect, useRef } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useClerk,
  useUser,
} from "@clerk/react";
import { dark } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { ClerkTokenBridge } from "./lib/auth-context";
import { Layout } from "@/components/layout";
import { AdminLayout } from "@/components/admin-layout";
import Dashboard from "@/pages/dashboard";
import Orders from "@/pages/orders";
import OrderDetail from "@/pages/order-detail";
import Media from "@/pages/media";
import Profile from "@/pages/profile";
import Reviews from "@/pages/reviews";
import ArtistPublic from "@/pages/artist-public";
import Onboarding from "@/pages/onboarding";
import Clients from "@/pages/clients";
import Contracts from "@/pages/contracts";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminArtists from "@/pages/admin/artists";
import AdminOrders from "@/pages/admin/orders";
import { Toaster } from "@/components/ui/sonner";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  baseTheme: dark,
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#C9A961",
    colorForeground: "#F8F8F8",
    colorMutedForeground: "#8A8A8A",
    colorDanger: "#E05252",
    colorBackground: "#111111",
    colorInput: "#1E1E1E",
    colorInputForeground: "#F8F8F8",
    colorNeutral: "#3A3A3A",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    borderRadius: "2px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "bg-[#111111] rounded-none w-full max-w-sm overflow-hidden border border-[#2A2A2A]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#F8F8F8] font-serif",
    headerSubtitle: "text-[#8A8A8A]",
    socialButtonsBlockButton: "border border-[#2A2A2A] bg-[#1A1A1A] hover:bg-[#222222] hover:border-[#C9A961]",
    socialButtonsBlockButtonText: "text-[#F8F8F8]",
    formFieldLabel: "text-[#C0C0C0]",
    formFieldInput: "bg-[#1E1E1E] border-[#2A2A2A] text-[#F8F8F8] focus:border-[#C9A961]",
    formButtonPrimary: "bg-[#C9A961] text-[#0A0A0A] hover:bg-[#B8964F] font-semibold",
    footerActionLink: "text-[#C9A961] hover:text-[#B8964F]",
    footerActionText: "text-[#6D6D6D]",
    dividerText: "text-[#4A4A4A]",
    dividerLine: "bg-[#2A2A2A]",
    identityPreviewEditButton: "text-[#C9A961]",
    formFieldSuccessText: "text-[#4CAF50]",
    alertText: "text-[#F8F8F8]",
    alert: "bg-[#1A1A1A] border-[#2A2A2A]",
    otpCodeFieldInput: "bg-[#1E1E1E] border-[#2A2A2A] text-[#F8F8F8]",
    logoBox: "hidden",
    logoImage: "hidden",
    footerAction: "border-t border-[#2A2A2A]",
    main: "p-6",
    formFieldRow: "gap-3",
  },
};

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-[#C9A961] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

/** Handles the root path — redirects based on auth + role. */
function HomeRedirect() {
  const { isSignedIn, isLoaded } = useUser();
  const { data: user, isLoading: userLoading } = useCurrentUser();

  if (!isLoaded || (isSignedIn && userLoading)) return <Spinner />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (user?.role === "superadmin") return <Redirect to="/admin" />;
  return <Redirect to="/dashboard" />;
}

/**
 * Guards artist-only pages.
 * - Unauthenticated → /sign-in
 * - No profile → /onboarding
 * - SuperAdmin → /admin (they have no artist workspace)
 */
function ProfileGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const { data: user, isLoading, error } = useCurrentUser();

  if (!isLoaded || (isSignedIn && isLoading)) return <Spinner />;

  if (!isSignedIn) return <Redirect to="/sign-in" />;

  if (error) {
    const status = (error as any)?.status;
    if (status === 403 || status === 404) return <Redirect to="/onboarding" />;
  }

  // Superadmin doesn't have an artist workspace — send to admin panel
  if (user?.role === "superadmin") return <Redirect to="/admin" />;

  return <Layout>{children}</Layout>;
}

/**
 * Guards superadmin-only pages.
 * - Unauthenticated → /sign-in
 * - Non-superadmin → /dashboard
 */
function AdminGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const { data: user, isLoading, error } = useCurrentUser();

  if (!isLoaded || (isSignedIn && isLoading)) return <Spinner />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;

  if (error) {
    const status = (error as any)?.status;
    if (status === 403 || status === 404) return <Redirect to="/onboarding" />;
  }

  if (user && user.role !== "superadmin") return <Redirect to="/dashboard" />;

  return <AdminLayout>{children}</AdminLayout>;
}

function SignInPage() {
  return (
    <div className="min-h-screen flex bg-[#0A0A0A]">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12">
        <div>
          <span className="font-serif text-2xl font-semibold text-white tracking-tight">CREATOR HUB</span>
          <div className="mt-1 h-px w-10 bg-[#C9A961]" />
        </div>
        <div>
          <h1 className="font-serif text-5xl font-semibold text-white leading-tight mb-6" style={{ letterSpacing: "-1px" }}>
            Vídeos personalizados<br />de elite.
          </h1>
          <p className="text-[#6D6D6D] text-base leading-relaxed max-w-sm">
            Conectamos artistas de excelência com clientes corporativos que exigem o melhor.
          </p>
        </div>
        <p className="text-[#3D3D3D] text-sm">© {new Date().getFullYear()} CREATOR HUB</p>
      </div>
      <div className="flex-1 flex items-center justify-center p-8 bg-[#0A0A0A]">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="font-serif text-2xl font-semibold text-white">CREATOR HUB</span>
            <div className="mt-1 h-px w-8 bg-[#C9A961]" />
          </div>
          <SignIn
            routing="path"
            path={`${basePath}/sign-in`}
            signUpUrl={`${basePath}/sign-up`}
            fallbackRedirectUrl={`${basePath}/`}
          />
        </div>
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-screen flex bg-[#0A0A0A]">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12">
        <div>
          <span className="font-serif text-2xl font-semibold text-white tracking-tight">CREATOR HUB</span>
          <div className="mt-1 h-px w-10 bg-[#C9A961]" />
        </div>
        <div>
          <h1 className="font-serif text-5xl font-semibold text-white leading-tight mb-6" style={{ letterSpacing: "-1px" }}>
            Crie seu perfil<br />de artista.
          </h1>
          <p className="text-[#6D6D6D] text-base leading-relaxed max-w-sm">
            Comece sua jornada na plataforma premium de vídeos personalizados.
          </p>
        </div>
        <p className="text-[#3D3D3D] text-sm">© {new Date().getFullYear()} CREATOR HUB</p>
      </div>
      <div className="flex-1 flex items-center justify-center p-8 bg-[#0A0A0A]">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="font-serif text-2xl font-semibold text-white">CREATOR HUB</span>
            <div className="mt-1 h-px w-8 bg-[#C9A961]" />
          </div>
          <SignUp
            routing="path"
            path={`${basePath}/sign-up`}
            signInUrl={`${basePath}/sign-in`}
            fallbackRedirectUrl={`${basePath}/onboarding`}
          />
        </div>
      </div>
    </div>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl || undefined}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Bem-vindo de volta", subtitle: "Entre na sua conta" } },
        signUp: { start: { title: "Criar conta", subtitle: "Comece sua jornada como artista" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <ClerkTokenBridge />
        <Switch>
          {/* Public */}
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/onboarding" component={Onboarding} />
          <Route path="/p/:artistId" component={ArtistPublic} />

          {/* ── SuperAdmin Routes ────────────────────────────────── */}
          <Route path="/admin">
            {() => <AdminGate><AdminDashboard /></AdminGate>}
          </Route>
          <Route path="/admin/artists">
            {() => <AdminGate><AdminArtists /></AdminGate>}
          </Route>
          <Route path="/admin/orders">
            {() => <AdminGate><AdminOrders /></AdminGate>}
          </Route>

          {/* ── Artist Routes ────────────────────────────────────── */}
          <Route path="/dashboard">
            {() => <ProfileGate><Dashboard /></ProfileGate>}
          </Route>
          <Route path="/orders/:id">
            {(params) => <ProfileGate><OrderDetail params={params} /></ProfileGate>}
          </Route>
          <Route path="/orders">
            {() => <ProfileGate><Orders /></ProfileGate>}
          </Route>
          <Route path="/media">
            {() => <ProfileGate><Media /></ProfileGate>}
          </Route>
          <Route path="/profile">
            {() => <ProfileGate><Profile /></ProfileGate>}
          </Route>
          <Route path="/reviews">
            {() => <ProfileGate><Reviews /></ProfileGate>}
          </Route>
          <Route path="/clients">
            {() => <ProfileGate><Clients /></ProfileGate>}
          </Route>
          <Route path="/contracts">
            {() => <ProfileGate><Contracts /></ProfileGate>}
          </Route>
        </Switch>
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}
