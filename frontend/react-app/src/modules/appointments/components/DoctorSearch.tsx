import { useState, useEffect, useRef } from 'react';

type Doctor = {
  id: string;
  name: string;
};

type DoctorSearchProps = {
  doctors: Doctor[];
  onDoctorSelect: (doctor: Doctor) => void;
};

export function DoctorSearch({ doctors, onDoctorSelect }: DoctorSearchProps) {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim().length === 0
    ? doctors
    : doctors.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (doctor: Doctor) => {
    setQuery(doctor.name);
    onDoctorSelect(doctor);
    setShowResults(false);
  };

  return (
    <div className="patient-search-container" ref={containerRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
        onFocus={() => setShowResults(true)}
        placeholder="Buscar doctor por nombre..."
        className="elite-input"
        autoComplete="off"
      />
      {showResults && (
        <div className="search-results-wrapper">
          {filtered.length > 0 ? (
            <ul className="search-results">
              {filtered.map((d) => (
                <li key={d.id} onClick={() => handleSelect(d)}>
                  {d.name}
                </li>
              ))}
            </ul>
          ) : (
            <div className="no-results">
              <p>No se encontraron doctores.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
