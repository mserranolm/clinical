import { useState, useEffect, useRef } from 'react';
import { clinicalApi } from '../../../api/clinical';
import { useDebounce } from '../../../lib/hooks/useDebounce';

type Patient = {
  id: string;
  firstName: string;
  lastName: string;
};

type PatientSearchProps = {
  doctorId: string;
  token: string;
  onPatientSelect: (patient: Patient) => void;
};

export function PatientSearch({ doctorId, token, onPatientSelect }: PatientSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [searchContainerRef]);

  useEffect(() => {
    if (debouncedQuery.length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    setShowResults(true);
    clinicalApi.searchPatients(debouncedQuery, doctorId, token)
      .then(response => {
        setResults(response.items || []);
      })
      .catch(() => {
        setResults([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [debouncedQuery, doctorId, token]);

  const handleSelectPatient = (patient: Patient) => {
    setQuery(`${patient.firstName} ${patient.lastName}`);
    onPatientSelect(patient);
    setShowResults(false);
  };

  return (
    <div className="patient-search-container" ref={searchContainerRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setShowResults(true)}
        placeholder="Buscar paciente por nombre o cédula..."
        className="elite-input"
      />
      {showResults && (
        <div className="search-results-wrapper">
          {loading && <div className="spinner">Buscando...</div>}
          {!loading && debouncedQuery.length >= 3 && results.length > 0 && (
            <ul className="search-results">
              {results.map(patient => (
                <li key={patient.id} onClick={() => handleSelectPatient(patient)}>
                  {patient.firstName} {patient.lastName}
                </li>
              ))}
            </ul>
          )}
          {!loading && debouncedQuery.length >= 3 && results.length === 0 && (
            <div className="no-results">
              <p>No se encontraron pacientes.</p>
              <button type="button" className="secondary-btn">Crear Nuevo Paciente</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
