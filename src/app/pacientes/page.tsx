import Link from "next/link";
import { listPatients } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function PacientesPage() {
  let patients: Awaited<ReturnType<typeof listPatients>> = [];
  let error: string | null = null;
  try {
    patients = await listPatients();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="container">
      <h1>Pacientes</h1>
      <p>Pacientes cuya importacion ya fue confirmada y guardada.</p>

      {error && (
        <div className="card">
          <p style={{ color: "var(--error)" }}>No se pudo cargar la lista: {error}</p>
        </div>
      )}

      {!error && patients.length === 0 && (
        <div className="card">
          <p>Todavia no hay pacientes guardados. Importa un Excel y confirma la importacion.</p>
          <Link href="/importar">
            <button className="primary">Importar Excel</button>
          </Link>
        </div>
      )}

      {patients.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          {patients.map((p) => (
            <div className="patient-list-item" key={p.id}>
              <span>
                <strong>{p.firstName} {p.lastName}</strong>{" "}
                <span style={{ color: "#666", fontSize: 13 }}>
                  &middot; consulta {p.consultDate || "sin fecha"}
                </span>
              </span>
              <Link href={`/pacientes/${p.id}`}>
                <button className="secondary">Ver ficha</button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
