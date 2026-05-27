import express from 'express';
import type Database from 'better-sqlite3';
import { openDatabase, type PersonRow, type RelationshipRow } from './database.ts';

type PersonPayload = {
  first_name?: unknown;
  last_name?: unknown;
  birth_date?: unknown;
  death_date?: unknown;
  notes?: unknown;
};

type RelationshipPayload = {
  parent_id?: unknown;
  child_id?: unknown;
};

type ChildIdRow = {
  child_id: number;
};

export function createApp(db: Database.Database = openDatabase()) {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/persons', (_req, res) => {
    const persons = db.prepare('SELECT * FROM persons ORDER BY last_name, first_name, id').all() as PersonRow[];
    res.json(persons);
  });

  app.post('/api/persons', (req, res) => {
    const payload = normalizePerson(req.body);
    if (!payload) {
      res.status(400).json({ error: 'First name or last name is required.' });
      return;
    }

    if (hasInvalidLifeDates(payload)) {
      res.status(400).json({ error: 'Birth date must be before or equal to death date.' });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO persons (first_name, last_name, birth_date, death_date, notes)
         VALUES (@first_name, @last_name, @birth_date, @death_date, @notes)`,
      )
      .run(payload);

    const person = getPerson(db, Number(result.lastInsertRowid));
    res.status(201).json(person);
  });

  app.patch('/api/persons/:id', (req, res) => {
    const id = asPositiveInteger(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid person ID.' });
      return;
    }

    const existing = getPerson(db, id);
    if (!existing) {
      res.status(404).json({ error: 'Person not found.' });
      return;
    }

    const payload = normalizePerson({ ...existing, ...req.body });
    if (!payload) {
      res.status(400).json({ error: 'First name or last name is required.' });
      return;
    }

    if (hasInvalidLifeDates(payload)) {
      res.status(400).json({ error: 'Birth date must be before or equal to death date.' });
      return;
    }

    db.prepare(
      `UPDATE persons
       SET first_name = @first_name,
           last_name = @last_name,
           birth_date = @birth_date,
           death_date = @death_date,
           notes = @notes,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = @id`,
    ).run({ ...payload, id });

    res.json(getPerson(db, id));
  });

  app.delete('/api/persons/:id', (req, res) => {
    const id = asPositiveInteger(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid person ID.' });
      return;
    }

    const result = db.prepare('DELETE FROM persons WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Person not found.' });
      return;
    }

    res.status(204).send();
  });

  app.get('/api/relationships', (_req, res) => {
    const relationships = db.prepare('SELECT * FROM relationships ORDER BY id').all() as RelationshipRow[];
    res.json(relationships);
  });

  app.post('/api/relationships', (req, res) => {
    const payload = normalizeRelationship(req.body);
    if (!payload) {
      res.status(400).json({ error: 'Parent and child must be valid IDs.' });
      return;
    }

    if (payload.parent_id === payload.child_id) {
      res.status(400).json({ error: 'Parent and child must not be the same person.' });
      return;
    }

    if (hasRelationshipPath(db, payload.child_id, payload.parent_id)) {
      res.status(400).json({ error: 'Cannot create relationship: it would introduce a cycle.' });
      return;
    }

    try {
      const result = db
        .prepare('INSERT INTO relationships (parent_id, child_id, type) VALUES (?, ?, ?)')
        .run(payload.parent_id, payload.child_id, 'parent');
      const relationship = getRelationship(db, Number(result.lastInsertRowid));
      res.status(201).json(relationship);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('UNIQUE')) {
        res.status(409).json({ error: 'This parent-child relationship already exists.' });
        return;
      }

      if (message.includes('FOREIGN KEY')) {
        res.status(400).json({ error: 'Parent or child was not found.' });
        return;
      }

      throw error;
    }
  });

  app.delete('/api/relationships/:id', (req, res) => {
    const id = asPositiveInteger(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid relationship ID.' });
      return;
    }

    const result = db.prepare('DELETE FROM relationships WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Relationship not found.' });
      return;
    }

    res.status(204).send();
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

function normalizePerson(payload: PersonPayload) {
  const first_name = asText(payload.first_name);
  const last_name = asText(payload.last_name);

  if (!first_name && !last_name) {
    return null;
  }

  return {
    first_name,
    last_name,
    birth_date: asOptionalText(payload.birth_date),
    death_date: asOptionalText(payload.death_date),
    notes: asText(payload.notes),
  };
}

function normalizeRelationship(payload: RelationshipPayload) {
  const parent_id = asPositiveInteger(payload.parent_id);
  const child_id = asPositiveInteger(payload.child_id);

  if (!parent_id || !child_id) {
    return null;
  }

  return { parent_id, child_id };
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asOptionalText(value: unknown) {
  const text = asText(value);
  return text.length > 0 ? text : null;
}

function asPositiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function hasInvalidLifeDates(person: { birth_date: string | null; death_date: string | null }) {
  return Boolean(person.birth_date && person.death_date && person.birth_date > person.death_date);
}

function hasRelationshipPath(db: Database.Database, startId: number, targetId: number) {
  const queuedIds = [startId];
  const visitedIds = new Set<number>();
  const selectChildren = db.prepare('SELECT child_id FROM relationships WHERE parent_id = ?');

  for (let index = 0; index < queuedIds.length; index += 1) {
    const currentId = queuedIds[index];
    if (currentId === targetId) {
      return true;
    }

    if (visitedIds.has(currentId)) {
      continue;
    }

    visitedIds.add(currentId);
    const children = selectChildren.all(currentId) as ChildIdRow[];
    for (const child of children) {
      if (!visitedIds.has(child.child_id)) {
        queuedIds.push(child.child_id);
      }
    }
  }

  return false;
}

function getPerson(db: Database.Database, id: number) {
  return db.prepare('SELECT * FROM persons WHERE id = ?').get(id) as PersonRow | undefined;
}

function getRelationship(db: Database.Database, id: number) {
  return db.prepare('SELECT * FROM relationships WHERE id = ?').get(id) as RelationshipRow | undefined;
}
