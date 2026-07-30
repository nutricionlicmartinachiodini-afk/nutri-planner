import Link from "next/link";

export default function HomePage() {
  return (
    <div className="container">
      <h1>Panel</h1>
      <p>Primer avance de la Etapa 1: importar un Excel y revisarlo antes de continuar.</p>
      <div className="card">
        <h2>Importar paciente</h2>
        <p>Subi el Excel del sistema nutricional para generar el borrador del plan y revisarlo.</p>
        <Link href="/importar">
          <button className="primary">Importar Excel</button>
        </Link>
      </div>
      <div className="card">
        <h3>Todavia no implementado en esta version</h3>
        <p>Ficha del paciente editable, configuracion de comidas, menu semanal, vista previa y exportacion a PDF. Ver README.md.</p>
      </div>
    </div>
  );
}
