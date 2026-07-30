import "./globals.css";

export const metadata = {
  title: "Nutri Planner - Etapa 1",
  description: "Automatizacion de planes nutricionales",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="appbar">NUTRI PLANNER · Etapa 1</div>
        {children}
      </body>
    </html>
  );
}
