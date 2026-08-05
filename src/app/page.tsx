import Link from "next/link";

export default function HomePage() {
  return (
    <div className="container">
      <h1>Panel</h1>
      <p>Importar un Excel, revisarlo y guardar pacientes con persistencia real en base de datos.</p>
      <div className="card">
        <h2>Importar paciente</h2>
        <p>Subi el Excel del sistema nutricional para generar el borrador del plan y revisarlo.</p>
        <Link href="/importar">
          <button className="primary">Importar Excel</button>
        </Link>
      </div>
      <div className="card">
        <h2>Pacientes</h2>
        <p>Ver y editar la ficha de pacientes ya guardados.</p>
        <Link href="/pacientes">
          <button className="secondary">Ver pacientes</button>
        </Link>
      </div>
      <div className="card">
        <h2>Recetas</h2>
        <p>Biblioteca de recetas reutilizable entre pacientes, para Almuerzo y Cena.</p>
        <Link href="/recetas">
          <button className="secondary">Ver recetas</button>
        </Link>
      </div>
      <div className="card">
        <h3>Todavia no implementado en esta version</h3>
        <p>Vista previa y exportacion a PDF. Ver README.md.</p>
      </div>
    </div>
  );
}
