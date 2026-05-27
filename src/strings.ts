export type Language = 'en' | 'de';

export type AppStrings = {
  appTitle: string;
  pageIntro: string;
  languageLabel: string;
  englishLanguage: string;
  germanLanguage: string;
  refresh: string;
  editPersonTitle: string;
  createPersonTitle: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  deathDate: string;
  notes: string;
  save: string;
  create: string;
  cancel: string;
  createRelationshipTitle: string;
  parent: string;
  child: string;
  selectPlaceholder: string;
  link: string;
  noRelationships: string;
  delete: string;
  personsTitle: string;
  noPersons: string;
  edit: string;
  treeTitle: string;
  emptyTree: string;
  noRootPerson: string;
  cycleDetected: string;
  noLifeDates: string;
  unknownError: string;
  fallbackPersonName: (id: number) => string;
};

export const defaultLanguage: Language = 'en';

export const strings: Record<Language, AppStrings> = {
  en: {
    appTitle: 'Family Tree',
    pageIntro: 'Manage people and parent-child relationships locally.',
    languageLabel: 'Language',
    englishLanguage: 'English',
    germanLanguage: 'German',
    refresh: 'Refresh',
    editPersonTitle: 'Edit person',
    createPersonTitle: 'Add person',
    firstName: 'First name',
    lastName: 'Last name',
    birthDate: 'Birth',
    deathDate: 'Death',
    notes: 'Notes',
    save: 'Save',
    create: 'Add',
    cancel: 'Cancel',
    createRelationshipTitle: 'Add relationship',
    parent: 'Parent',
    child: 'Child',
    selectPlaceholder: 'Select',
    link: 'Link',
    noRelationships: 'No relationships yet.',
    delete: 'Delete',
    personsTitle: 'People',
    noPersons: 'No people added yet.',
    edit: 'Edit',
    treeTitle: 'Family tree',
    emptyTree: 'Add people to build the family tree.',
    noRootPerson: 'No root person found. Check whether relationships form a cycle.',
    cycleDetected: 'cycle detected',
    noLifeDates: 'No life dates',
    unknownError: 'Unknown error.',
    fallbackPersonName: (id: number) => `Person ${id}`,
  },
  de: {
    appTitle: 'Stammbaum',
    pageIntro: 'Personen und Eltern-Kind-Beziehungen lokal verwalten.',
    languageLabel: 'Sprache',
    englishLanguage: 'Englisch',
    germanLanguage: 'Deutsch',
    refresh: 'Aktualisieren',
    editPersonTitle: 'Person bearbeiten',
    createPersonTitle: 'Person anlegen',
    firstName: 'Vorname',
    lastName: 'Nachname',
    birthDate: 'Geburt',
    deathDate: 'Tod',
    notes: 'Notizen',
    save: 'Speichern',
    create: 'Anlegen',
    cancel: 'Abbrechen',
    createRelationshipTitle: 'Beziehung anlegen',
    parent: 'Elternteil',
    child: 'Kind',
    selectPlaceholder: 'Auswaehlen',
    link: 'Verknuepfen',
    noRelationships: 'Noch keine Beziehungen.',
    delete: 'Loeschen',
    personsTitle: 'Personen',
    noPersons: 'Noch keine Personen angelegt.',
    edit: 'Bearbeiten',
    treeTitle: 'Stammbaum',
    emptyTree: 'Lege Personen an, um den Stammbaum aufzubauen.',
    noRootPerson: 'Keine Wurzelperson gefunden. Pruefe, ob Beziehungen einen Kreis bilden.',
    cycleDetected: 'Kreis erkannt',
    noLifeDates: 'Keine Lebensdaten',
    unknownError: 'Unbekannter Fehler.',
    fallbackPersonName: (id: number) => `Person ${id}`,
  },
};

export function isLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'de';
}
