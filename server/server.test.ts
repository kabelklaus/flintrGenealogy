import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from './app.ts';
import { openDatabase, type PersonRow, type RelationshipRow } from './database.ts';

type TestResponse<T> = {
  status: number;
  body: T;
};

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'genealogy-test-'));
const db = openDatabase(path.join(tmpDir, 'test.sqlite'));
const app = createApp(db);

let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('legt Personen und eine Eltern-Kind-Beziehung an', async () => {
  const parent = await post<PersonRow>('/api/persons', { first_name: 'Ada', last_name: 'Beispiel' });
  const child = await post<PersonRow>('/api/persons', { first_name: 'Ben', last_name: 'Beispiel' });

  assert.equal(parent.status, 201);
  assert.equal(child.status, 201);
  assert.equal(parent.body.first_name, 'Ada');

  const persons = await get<PersonRow[]>('/api/persons');
  assert.equal(persons.status, 200);
  assert.equal(persons.body.length, 2);

  const relationship = await post<RelationshipRow>('/api/relationships', {
    parent_id: parent.body.id,
    child_id: child.body.id,
  });

  assert.equal(relationship.status, 201);
  assert.equal(relationship.body.parent_id, parent.body.id);
  assert.equal(relationship.body.child_id, child.body.id);

  const relationships = await get<RelationshipRow[]>('/api/relationships');
  assert.equal(relationships.status, 200);
  assert.equal(relationships.body.length, 1);
});

test('verhindert ungueltige und doppelte Beziehungen', async () => {
  const person = await post<PersonRow>('/api/persons', { first_name: 'Clara' });

  const selfRelationship = await post('/api/relationships', {
    parent_id: person.body.id,
    child_id: person.body.id,
  });
  assert.equal(selfRelationship.status, 400);

  const child = await post<PersonRow>('/api/persons', { first_name: 'Dana' });
  assert.equal((await post('/api/relationships', { parent_id: person.body.id, child_id: child.body.id })).status, 201);
  assert.equal((await post('/api/relationships', { parent_id: person.body.id, child_id: child.body.id })).status, 409);
});

test('validiert Lebensdaten und positive IDs', async () => {
  assert.equal((await post('/api/persons', null)).status, 400);

  const invalidDates = await post('/api/persons', {
    first_name: 'Erika',
    birth_date: '2020-01-02',
    death_date: '2020-01-01',
  });
  assert.equal(invalidDates.status, 400);

  const person = await post<PersonRow>('/api/persons', {
    first_name: 'Finn',
    birth_date: '2000-01-01',
    death_date: '2020-01-01',
  });
  assert.equal(person.status, 201);

  assert.equal((await patch(`/api/persons/${person.body.id}`, null)).status, 400);

  const invalidUpdate = await patch(`/api/persons/${person.body.id}`, { death_date: '1999-12-31' });
  assert.equal(invalidUpdate.status, 400);

  assert.equal((await patch('/api/persons/0', { first_name: 'Zero' })).status, 400);
  assert.equal((await post('/api/relationships', { parent_id: 0, child_id: person.body.id })).status, 400);
  assert.equal((await deleteRequest('/api/persons/0')).status, 400);
  assert.equal((await deleteRequest('/api/relationships/0')).status, 400);
});

test('verhindert Kreisbeziehungen im Stammbaum', async () => {
  assert.equal((await post('/api/relationships', null)).status, 400);

  const grandparent = await post<PersonRow>('/api/persons', { first_name: 'Gina' });
  const parent = await post<PersonRow>('/api/persons', { first_name: 'Hannes' });
  const child = await post<PersonRow>('/api/persons', { first_name: 'Ida' });

  assert.equal(
    (await post('/api/relationships', { parent_id: grandparent.body.id, child_id: parent.body.id })).status,
    201,
  );
  assert.equal((await post('/api/relationships', { parent_id: parent.body.id, child_id: child.body.id })).status, 201);

  const cycle = await post('/api/relationships', { parent_id: child.body.id, child_id: grandparent.body.id });
  assert.equal(cycle.status, 400);
});

async function get<T>(endpoint: string): Promise<TestResponse<T>> {
  const response = await fetch(`${baseUrl}${endpoint}`);
  return { status: response.status, body: (await response.json()) as T };
}

async function post<T>(endpoint: string, body: unknown): Promise<TestResponse<T>> {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return { status: response.status, body: (await response.json()) as T };
}

async function patch<T>(endpoint: string, body: unknown): Promise<TestResponse<T>> {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return { status: response.status, body: (await response.json()) as T };
}

async function deleteRequest<T>(endpoint: string): Promise<TestResponse<T>> {
  const response = await fetch(`${baseUrl}${endpoint}`, { method: 'DELETE' });
  return { status: response.status, body: (await response.json()) as T };
}
