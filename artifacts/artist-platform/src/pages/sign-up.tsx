import { SignUp } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex bg-[#0A0A0A]">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12">
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
            Crie seu perfil<br />de artista.
          </h1>
          <p className="text-[#6D6D6D] text-base leading-relaxed max-w-sm">
            Comece sua jornada na plataforma premium de criadores de conteúdo personalizado.
          </p>
        </div>
        <p className="text-[#3D3D3D] text-sm">
          © {new Date().getFullYear()} CREATOR HUB. Todos os direitos reservados.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#F8F8F8]">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="font-serif text-2xl font-semibold text-[#0A0A0A]">CREATOR HUB</span>
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
