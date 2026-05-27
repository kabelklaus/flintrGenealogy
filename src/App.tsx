import { FormEvent, useEffect, useMemo, useState } from 'react';

type Person = {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  death_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

type Relationship = {
  id: number;
  parent_id: number;
  child_id: number;
  type: string;
  created_at: string;
};

type PersonFormState = {
  first_name: string;
  last_name: string;
  birth_date: string;
  death_date: string;
  notes: string;
};

const emptyPersonForm: PersonFormState = {
  first_name: '',
  last_name: '',
  birth_date: '',
  death_date: '',
  notes: '',
};

export default function App() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [personForm, setPersonForm] = useState<PersonFormState>(emptyPersonForm);
  const [editingPersonId, setEditingPersonId] = useState<number | null>(null);
  const [parentId, setParentId] = useState('');
  const [childId, setChildId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadData() {
    setIsLoading(true);
    setError(null);

    try {
      const [loadedPersons, loadedRelationships] = await Promise.all([
        request<Person[]>('/api/persons'),
        request<Relationship[]>('/api/relationships'),
      ]);
      setPersons(loadedPersons);
      setRelationships(loadedRelationships);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const selectedPerson = editingPersonId ? persons.find((person) => person.id === editingPersonId) : null;
  const treeRoots = useMemo(() => getTreeRoots(persons, relationships), [persons, relationships]);
  const childrenByParent = useMemo(() => groupChildrenByParent(relationships), [relationships]);

  async function handlePersonSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const endpoint = editingPersonId ? `/api/persons/${editingPersonId}` : '/api/persons';
      const method = editingPersonId ? 'PATCH' : 'POST';
      await request<Person>(endpoint, { method, body: personForm });
      resetPersonForm();
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function handleRelationshipSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await request<Relationship>('/api/relationships', {
        method: 'POST',
        body: {
          parent_id: Number(parentId),
          child_id: Number(childId),
        },
      });
      setParentId('');
      setChildId('');
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function deletePerson(id: number) {
    setError(null);

    try {
      await request(`/api/persons/${id}`, { method: 'DELETE' });
      if (editingPersonId === id) {
        resetPersonForm();
      }
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function deleteRelationship(id: number) {
    setError(null);

    try {
      await request(`/api/relationships/${id}`, { method: 'DELETE' });
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  function editPerson(person: Person) {
    setEditingPersonId(person.id);
    setPersonForm({
      first_name: person.first_name,
      last_name: person.last_name,
      birth_date: person.birth_date ?? '',
      death_date: person.death_date ?? '',
      notes: person.notes,
    });
  }

  function resetPersonForm() {
    setEditingPersonId(null);
    setPersonForm(emptyPersonForm);
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <h1>Stammbaum</h1>
          <p>Personen und Eltern-Kind-Beziehungen lokal verwalten.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => void loadData()}>
          Aktualisieren
        </button>
      </header>

      {error ? <p className="error-message">{error}</p> : null}

      <section className="workspace" aria-busy={isLoading}>
        <div className="panel">
          <h2>{selectedPerson ? 'Person bearbeiten' : 'Person anlegen'}</h2>
          <form className="stack" onSubmit={handlePersonSubmit}>
            <label>
              Vorname
              <input
                value={personForm.first_name}
                onChange={(event) => setPersonForm({ ...personForm, first_name: event.target.value })}
                autoComplete="given-name"
              />
            </label>
            <label>
              Nachname
              <input
                value={personForm.last_name}
                onChange={(event) => setPersonForm({ ...personForm, last_name: event.target.value })}
                autoComplete="family-name"
              />
            </label>
            <div className="form-grid">
              <label>
                Geburt
                <input
                  type="date"
                  value={personForm.birth_date}
                  onChange={(event) => setPersonForm({ ...personForm, birth_date: event.target.value })}
                />
              </label>
              <label>
                Tod
                <input
                  type="date"
                  value={personForm.death_date}
                  onChange={(event) => setPersonForm({ ...personForm, death_date: event.target.value })}
                />
              </label>
            </div>
            <label>
              Notizen
              <textarea
                rows={4}
                value={personForm.notes}
                onChange={(event) => setPersonForm({ ...personForm, notes: event.target.value })}
              />
            </label>
            <div className="button-row">
              <button type="submit">{selectedPerson ? 'Speichern' : 'Anlegen'}</button>
              {selectedPerson ? (
                <button type="button" className="secondary-button" onClick={resetPersonForm}>
                  Abbrechen
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="panel">
          <h2>Beziehung anlegen</h2>
          <form className="stack" onSubmit={handleRelationshipSubmit}>
            <label>
              Elternteil
              <select value={parentId} onChange={(event) => setParentId(event.target.value)} required>
                <option value="">Auswaehlen</option>
                {persons.map((person) => (
                  <option key={person.id} value={person.id}>
                    {formatPerson(person)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kind
              <select value={childId} onChange={(event) => setChildId(event.target.value)} required>
                <option value="">Auswaehlen</option>
                {persons.map((person) => (
                  <option key={person.id} value={person.id}>
                    {formatPerson(person)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Verknuepfen</button>
          </form>

          <div className="relationship-list">
            {relationships.length === 0 ? (
              <p className="empty-state">Noch keine Beziehungen.</p>
            ) : (
              relationships.map((relationship) => (
                <div className="relationship-row" key={relationship.id}>
                  <span>
                    {formatPersonById(persons, relationship.parent_id)} {'->'}{' '}
                    {formatPersonById(persons, relationship.child_id)}
                  </span>
                  <button type="button" className="link-button" onClick={() => void deleteRelationship(relationship.id)}>
                    Loeschen
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel wide-panel">
          <h2>Personen</h2>
          {persons.length === 0 ? (
            <p className="empty-state">Noch keine Personen angelegt.</p>
          ) : (
            <div className="person-list">
              {persons.map((person) => (
                <article className="person-row" key={person.id}>
                  <div>
                    <strong>{formatPerson(person)}</strong>
                    <p>{formatLifeDates(person)}</p>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="secondary-button" onClick={() => editPerson(person)}>
                      Bearbeiten
                    </button>
                    <button type="button" className="danger-button" onClick={() => void deletePerson(person.id)}>
                      Loeschen
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="panel wide-panel">
          <h2>Stammbaum</h2>
          {persons.length === 0 ? (
            <p className="empty-state">Lege Personen an, um den Stammbaum aufzubauen.</p>
          ) : treeRoots.length === 0 ? (
            <p className="empty-state">Keine Wurzelperson gefunden. Pruefe, ob Beziehungen einen Kreis bilden.</p>
          ) : (
            <div className="tree-list">
              {treeRoots.map((person) => (
                <TreeNode
                  key={person.id}
                  person={person}
                  persons={persons}
                  childrenByParent={childrenByParent}
                  visited={new Set()}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function TreeNode({
  person,
  persons,
  childrenByParent,
  visited,
}: {
  person: Person;
  persons: Person[];
  childrenByParent: Map<number, number[]>;
  visited: Set<number>;
}) {
  const nextVisited = new Set(visited);
  nextVisited.add(person.id);
  const childIds = childrenByParent.get(person.id) ?? [];
  const children = childIds
    .map((id) => persons.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is Person => Boolean(candidate));

  return (
    <div className="tree-node">
      <div className="tree-person">{formatPerson(person)}</div>
      {children.length > 0 ? (
        <div className="tree-children">
          {children.map((child) =>
            nextVisited.has(child.id) ? (
              <div className="tree-node" key={child.id}>
                <div className="tree-person warning">{formatPerson(child)} (Kreis erkannt)</div>
              </div>
            ) : (
              <TreeNode
                key={child.id}
                person={child}
                persons={persons}
                childrenByParent={childrenByParent}
                visited={nextVisited}
              />
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

async function request<T>(endpoint: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(endpoint, {
    method: options.method ?? 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorBody?.error ?? `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function getTreeRoots(persons: Person[], relationships: Relationship[]) {
  const childIds = new Set(relationships.map((relationship) => relationship.child_id));
  return persons.filter((person) => !childIds.has(person.id));
}

function groupChildrenByParent(relationships: Relationship[]) {
  const childrenByParent = new Map<number, number[]>();

  for (const relationship of relationships) {
    const children = childrenByParent.get(relationship.parent_id) ?? [];
    children.push(relationship.child_id);
    childrenByParent.set(relationship.parent_id, children);
  }

  return childrenByParent;
}

function formatPerson(person: Person) {
  return [person.first_name, person.last_name].filter(Boolean).join(' ');
}

function formatPersonById(persons: Person[], id: number) {
  return formatPerson(persons.find((person) => person.id === id) ?? fallbackPerson(id));
}

function fallbackPerson(id: number): Person {
  return {
    id,
    first_name: `Person ${id}`,
    last_name: '',
    birth_date: null,
    death_date: null,
    notes: '',
    created_at: '',
    updated_at: '',
  };
}

function formatLifeDates(person: Person) {
  if (!person.birth_date && !person.death_date) {
    return 'Keine Lebensdaten';
  }

  return `${person.birth_date ?? '?'} - ${person.death_date ?? '?'}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unbekannter Fehler.';
}
