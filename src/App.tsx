import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { defaultLanguage, isLanguage, strings, type AppStrings, type Language } from './strings.ts';

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

const languageStorageKey = 'flintrGenealogy.language';
const languageOptions: Language[] = ['en', 'de'];
type AppStringKey = {
  [Key in keyof AppStrings]: AppStrings[Key] extends string ? Key : never;
}[keyof AppStrings];

const backendErrorKeys: Record<string, AppStringKey> = {
  'First name or last name is required.': 'errorFirstNameOrLastNameRequired',
  'Birth date must be before or equal to death date.': 'errorBirthDateAfterDeathDate',
  'Invalid person ID.': 'errorInvalidPersonId',
  'Person not found.': 'errorPersonNotFound',
  'Parent and child must be valid IDs.': 'errorParentChildInvalidIds',
  'Parent and child must not be the same person.': 'errorSamePersonRelationship',
  'Cannot create relationship: it would introduce a cycle.': 'errorRelationshipCreatesCycle',
  'This parent-child relationship already exists.': 'errorRelationshipExists',
  'Parent or child was not found.': 'errorParentOrChildNotFound',
  'Invalid relationship ID.': 'errorInvalidRelationshipId',
  'Relationship not found.': 'errorRelationshipNotFound',
  'Invalid JSON payload.': 'errorInvalidJsonPayload',
  'Internal server error.': 'errorInternalServer',
};

export default function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const storedLanguage = window.localStorage.getItem(languageStorageKey);
    return isLanguage(storedLanguage) ? storedLanguage : defaultLanguage;
  });
  const [persons, setPersons] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [personForm, setPersonForm] = useState<PersonFormState>(emptyPersonForm);
  const [editingPersonId, setEditingPersonId] = useState<number | null>(null);
  const [parentId, setParentId] = useState('');
  const [childId, setChildId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appStrings = strings[language];
  const personsById = useMemo(() => new Map(persons.map((person) => [person.id, person])), [persons]);

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
      setError(getErrorMessage(requestError, appStrings));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = appStrings.appTitle;
    window.localStorage.setItem(languageStorageKey, language);
  }, [appStrings.appTitle, language]);

  const selectedPerson = editingPersonId ? personsById.get(editingPersonId) : null;
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
      setError(getErrorMessage(requestError, appStrings));
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
      setError(getErrorMessage(requestError, appStrings));
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
      setError(getErrorMessage(requestError, appStrings));
    }
  }

  async function deleteRelationship(id: number) {
    setError(null);

    try {
      await request(`/api/relationships/${id}`, { method: 'DELETE' });
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError, appStrings));
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

  function handleLanguageChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLanguage = event.target.value;
    if (isLanguage(nextLanguage)) {
      setLanguage(nextLanguage);
    }
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <h1>{appStrings.appTitle}</h1>
          <p>{appStrings.pageIntro}</p>
        </div>
        <div className="header-actions">
          <label className="language-switcher">
            <span>{appStrings.languageLabel}</span>
            <select value={language} onChange={handleLanguageChange} aria-label={appStrings.languageLabel}>
              {languageOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'en' ? appStrings.englishLanguage : appStrings.germanLanguage}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="secondary-button" onClick={() => void loadData()}>
            {appStrings.refresh}
          </button>
        </div>
      </header>

      {error ? <p className="error-message">{error}</p> : null}

      <section className="workspace" aria-busy={isLoading}>
        <div className="panel">
          <h2>{selectedPerson ? appStrings.editPersonTitle : appStrings.createPersonTitle}</h2>
          <form className="stack" onSubmit={handlePersonSubmit}>
            <label>
              {appStrings.firstName}
              <input
                value={personForm.first_name}
                onChange={(event) => setPersonForm({ ...personForm, first_name: event.target.value })}
                autoComplete="given-name"
              />
            </label>
            <label>
              {appStrings.lastName}
              <input
                value={personForm.last_name}
                onChange={(event) => setPersonForm({ ...personForm, last_name: event.target.value })}
                autoComplete="family-name"
              />
            </label>
            <div className="form-grid">
              <label>
                {appStrings.birthDate}
                <input
                  type="date"
                  value={personForm.birth_date}
                  onChange={(event) => setPersonForm({ ...personForm, birth_date: event.target.value })}
                />
              </label>
              <label>
                {appStrings.deathDate}
                <input
                  type="date"
                  value={personForm.death_date}
                  onChange={(event) => setPersonForm({ ...personForm, death_date: event.target.value })}
                />
              </label>
            </div>
            <label>
              {appStrings.notes}
              <textarea
                rows={4}
                value={personForm.notes}
                onChange={(event) => setPersonForm({ ...personForm, notes: event.target.value })}
              />
            </label>
            <div className="button-row">
              <button type="submit">{selectedPerson ? appStrings.save : appStrings.create}</button>
              {selectedPerson ? (
                <button type="button" className="secondary-button" onClick={resetPersonForm}>
                  {appStrings.cancel}
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="panel">
          <h2>{appStrings.createRelationshipTitle}</h2>
          <form className="stack" onSubmit={handleRelationshipSubmit}>
            <label>
              {appStrings.parent}
              <select value={parentId} onChange={(event) => setParentId(event.target.value)} required>
                <option value="">{appStrings.selectPlaceholder}</option>
                {persons.map((person) => (
                  <option key={person.id} value={person.id}>
                    {formatPerson(person)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {appStrings.child}
              <select value={childId} onChange={(event) => setChildId(event.target.value)} required>
                <option value="">{appStrings.selectPlaceholder}</option>
                {persons.map((person) => (
                  <option key={person.id} value={person.id}>
                    {formatPerson(person)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">{appStrings.link}</button>
          </form>

          <div className="relationship-list">
            {relationships.length === 0 ? (
              <p className="empty-state">{appStrings.noRelationships}</p>
            ) : (
              relationships.map((relationship) => (
                <div className="relationship-row" key={relationship.id}>
                  <span>
                    {formatPersonById(personsById, relationship.parent_id, appStrings)} {'->'}{' '}
                    {formatPersonById(personsById, relationship.child_id, appStrings)}
                  </span>
                  <button type="button" className="link-button" onClick={() => void deleteRelationship(relationship.id)}>
                    {appStrings.delete}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel wide-panel">
          <h2>{appStrings.personsTitle}</h2>
          {persons.length === 0 ? (
            <p className="empty-state">{appStrings.noPersons}</p>
          ) : (
            <div className="person-list">
              {persons.map((person) => (
                <article className="person-row" key={person.id}>
                  <div>
                    <strong>{formatPerson(person)}</strong>
                    <p>{formatLifeDates(person, appStrings)}</p>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="secondary-button" onClick={() => editPerson(person)}>
                      {appStrings.edit}
                    </button>
                    <button type="button" className="danger-button" onClick={() => void deletePerson(person.id)}>
                      {appStrings.delete}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="panel wide-panel">
          <h2>{appStrings.treeTitle}</h2>
          {persons.length === 0 ? (
            <p className="empty-state">{appStrings.emptyTree}</p>
          ) : treeRoots.length === 0 ? (
            <p className="empty-state">{appStrings.noRootPerson}</p>
          ) : (
            <div className="tree-list">
              {treeRoots.map((person) => (
                <TreeNode
                  key={person.id}
                  person={person}
                  personsById={personsById}
                  childrenByParent={childrenByParent}
                  appStrings={appStrings}
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
  personsById,
  childrenByParent,
  appStrings,
  visited,
}: {
  person: Person;
  personsById: Map<number, Person>;
  childrenByParent: Map<number, number[]>;
  appStrings: AppStrings;
  visited: Set<number>;
}) {
  const nextVisited = new Set(visited);
  nextVisited.add(person.id);
  const childIds = childrenByParent.get(person.id) ?? [];
  const children = childIds
    .map((id) => personsById.get(id))
    .filter((candidate): candidate is Person => Boolean(candidate));

  return (
    <div className="tree-node">
      <div className="tree-person">{formatPerson(person)}</div>
      {children.length > 0 ? (
        <div className="tree-children">
          {children.map((child) =>
            nextVisited.has(child.id) ? (
              <div className="tree-node" key={child.id}>
                <div className="tree-person warning">
                  {formatPerson(child)} ({appStrings.cycleDetected})
                </div>
              </div>
            ) : (
              <TreeNode
                key={child.id}
                person={child}
                personsById={personsById}
                childrenByParent={childrenByParent}
                appStrings={appStrings}
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

function formatPersonById(personsById: Map<number, Person>, id: number, appStrings: AppStrings) {
  return formatPerson(personsById.get(id) ?? fallbackPerson(id, appStrings));
}

function fallbackPerson(id: number, appStrings: AppStrings): Person {
  return {
    id,
    first_name: appStrings.fallbackPersonName(id),
    last_name: '',
    birth_date: null,
    death_date: null,
    notes: '',
    created_at: '',
    updated_at: '',
  };
}

function formatLifeDates(person: Person, appStrings: AppStrings) {
  if (!person.birth_date && !person.death_date) {
    return appStrings.noLifeDates;
  }

  return `${person.birth_date ?? '?'} - ${person.death_date ?? '?'}`;
}

function getErrorMessage(error: unknown, appStrings: AppStrings) {
  if (!(error instanceof Error)) {
    return appStrings.unknownError;
  }

  const errorKey = backendErrorKeys[error.message];
  return errorKey ? appStrings[errorKey] : error.message;
}
