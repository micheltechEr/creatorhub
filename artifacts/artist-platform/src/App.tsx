import { useAuth } from "@/lib/auth-context";
import { Route, Switch, useLocation } from "wouter";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Orders from "@/pages/orders";
import OrderDetail from "@/pages/order-detail";
import Media from "@/pages/media";
import Profile from "@/pages/profile";
import Reviews from "@/pages/reviews";
import ArtistPublic from "@/pages/artist-public";
import { Layout } from "@/components/layout";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <Component {...rest} />
    </Layout>
  );
}

function RedirectRoot() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (isAuthenticated) setLocation("/dashboard");
    else setLocation("/login");
  }, [isAuthenticated, setLocation]);
  return null;
}

export default function App() {
  return (
    <>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />

        <Route path="/dashboard">
          {() => <ProtectedRoute component={Dashboard} />}
        </Route>

        <Route path="/orders/:id">
          {(params) => <ProtectedRoute component={OrderDetail} params={params} />}
        </Route>

        <Route path="/orders">
          {() => <ProtectedRoute component={Orders} />}
        </Route>

        <Route path="/media">
          {() => <ProtectedRoute component={Media} />}
        </Route>

        <Route path="/profile">
          {() => <ProtectedRoute component={Profile} />}
        </Route>

        <Route path="/reviews">
          {() => <ProtectedRoute component={Reviews} />}
        </Route>

        <Route path="/p/:artistId" component={ArtistPublic} />

        <Route path="/" component={RedirectRoot} />
      </Switch>
      <Toaster />
    </>
  );
}
