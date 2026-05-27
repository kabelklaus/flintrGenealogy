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
