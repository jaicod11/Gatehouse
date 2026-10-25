// Runs the real migrations in supabase/migrations against PGlite (Postgres compiled to WASM), on
// top of supabase-stub.sql, a minimal stand-in for the roles, grants and auth schema a Supabase
// project provides. Run with `npm run test:sql`. No network or Supabase project needed.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';

const migrationsDir = fileURLToPath(new URL('../migrations/', import.meta.url));
const stub = readFileSync(new URL('./supabase-stub.sql', import.meta.url), 'utf8');
const migrations = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => ({ name, sql: readFileSync(migrationsDir + name, 'utf8') }));

const DOMAIN = 'example.com';

/** Runs `sql` as `role` with these JWT claims, in a transaction that is rolled back. */
async function as(db, role, claims, sql, params = [], { commit = false } = {}) {
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.exec(`set local role ${role}`);
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify(claims ?? {}),
      ]);
      const result = await tx.query(sql, params);
      if (!commit) await tx.rollback();
      return result.rows;
    });
    return { rows };
  } catch (error) {
    return { error };
  }
}

function assertDenied(result, what) {
  assert.ok(result.error, `${what}: expected an error, got ${JSON.stringify(result.rows)}`);
  assert.match(result.error.message, /permission denied/i, what);
}

async function freshDatabase(migrationsToRun = migrations) {
  const db = new PGlite();
  await db.exec(stub);
  for (const migration of migrationsToRun) await db.exec(migration.sql);
  return db;
}

describe('migrations', () => {
  it('apply cleanly twice in a row (idempotent)', async () => {
    const db = await freshDatabase();
    for (const migration of migrations) {
      await assert.doesNotReject(db.exec(migration.sql), migration.name);
    }
    const { rows } = await db.query(`select count(*)::int as n from public.allowed_domains`);
    assert.equal(rows[0].n, 1, 'placeholder seeded once');
    await db.close();
  });

  it('backfill profiles for users that existed before the profiles migration', async () => {
    const db = await freshDatabase(migrations.slice(0, 2));
    await db.exec(`
      insert into auth.users (email, raw_user_meta_data)
      values ('early@${DOMAIN}', '{"name": "Early Bird"}'), (null, '{}')
    `);
    for (const migration of migrations.slice(2)) await db.exec(migration.sql);

    const { rows } = await db.query(`select email, full_name, role from public.profiles`);
    assert.deepEqual(rows, [{ email: `early@${DOMAIN}`, full_name: 'Early Bird', role: 'user' }]);
    await db.close();
  });
});

describe('a migrated project', () => {
  let db;
  const users = {};
  const jwt = (key) => ({ sub: users[key].id, email: users[key].email, role: 'authenticated' });

  before(async () => {
    db = await freshDatabase();
    await db.exec(`insert into public.allowed_domains (domain) values ('${DOMAIN}')`);

    // Users are created the way Supabase Auth creates them: as supabase_auth_admin.
    for (const [key, email, metadata] of [
      ['alice', `alice@${DOMAIN}`, { full_name: 'Alice Admin', avatar_url: 'https://img/a.png' }],
      ['bob', `bob@${DOMAIN}`, { name: 'Bob User', picture: 'https://img/b.png' }],
      // Signed up before the hook existed; must still be locked out.
      ['mallory', 'mallory@gmail.com', { full_name: 'Mallory' }],
    ]) {
      const result = await as(
        db,
        'supabase_auth_admin',
        null,
        `insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id`,
        [email, JSON.stringify(metadata)],
        { commit: true },
      );
      assert.ifError(result.error);
      users[key] = { id: result.rows[0].id, email };
    }
    // The first admin, promoted from the SQL Editor (postgres) as docs/SUPABASE_SETUP.md says.
    await db.query(`update public.profiles set role = 'admin' where lower(email) = lower($1)`, [
      `ALICE@${DOMAIN}`,
    ]);
  });

  after(async () => {
    await db.close();
  });

  describe('allowed_domains', () => {
    for (const bad of ['Example.com', '@example.com', 'mail .example.com', 'example']) {
      it(`rejects the malformed domain ${JSON.stringify(bad)}`, async () => {
        await assert.rejects(
          db.query(`insert into public.allowed_domains (domain) values ($1)`, [bad]),
        );
      });
    }

    for (const role of ['anon', 'authenticated', 'supabase_auth_admin']) {
      it(`can't be read by ${role}`, async () => {
        assertDenied(await as(db, role, {}, `select * from public.allowed_domains`), role);
      });
    }

    for (const role of ['anon', 'authenticated']) {
      it(`can't be changed by ${role}`, async () => {
        assertDenied(
          await as(db, role, {}, `insert into public.allowed_domains (domain) values ('evil.com')`),
          role,
        );
      });
    }
  });

  describe('email_domain_allowed (same cases as src/utils/__tests__/domain.test.ts)', () => {
    const check = (email) =>
      as(db, 'authenticated', {}, `select public.email_domain_allowed($1) as ok`, [email]);

    for (const email of [`user@${DOMAIN}`, `USER@${DOMAIN.toUpperCase()}`, `  user@${DOMAIN}  `]) {
      it(`allows ${JSON.stringify(email)}`, async () => {
        const { rows, error } = await check(email);
        assert.ifError(error);
        assert.equal(rows[0].ok, true);
      });
    }

    for (const email of [
      'user@gmail.com',
      `user@x${DOMAIN}`,
      `user@${DOMAIN}.evil.com`,
      `user@mail.${DOMAIN}`,
      `user@evil.com@${DOMAIN}`,
      `@${DOMAIN}`,
      'user@',
      `user ${DOMAIN}`,
      `us er@${DOMAIN}`,
      `user@${DOMAIN.slice(0, -1)}`,
      DOMAIN,
      '',
      null,
    ]) {
      it(`rejects ${JSON.stringify(email)}`, async () => {
        const { rows, error } = await check(email);
        assert.ifError(error);
        assert.equal(rows[0].ok, false);
      });
    }
  });

  describe('Before User Created hook', () => {
    const callHook = (user) =>
      as(
        db,
        'supabase_auth_admin',
        null,
        `select public.hook_before_user_created($1::jsonb) as out`,
        [JSON.stringify({ metadata: { name: 'before-user-created' }, user })],
      );

    it('allows the allowed domain with an empty object', async () => {
      const { rows, error } = await callHook({ email: `new.person@${DOMAIN}` });
      assert.ifError(error);
      assert.deepEqual(rows[0].out, {});
    });

    for (const user of [{ email: 'someone@gmail.com' }, { email: `someone@mail.${DOMAIN}` }, {}]) {
      it(`rejects ${JSON.stringify(user)} with 403 and DOMAIN_NOT_ALLOWED`, async () => {
        const { rows, error } = await callHook(user);
        assert.ifError(error);
        assert.equal(rows[0].out.error.http_code, 403);
        assert.match(rows[0].out.error.message, /DOMAIN_NOT_ALLOWED/);
      });
    }

    for (const role of ['anon', 'authenticated']) {
      it(`can't be executed by ${role}`, async () => {
        assertDenied(
          await as(db, role, {}, `select public.hook_before_user_created('{}'::jsonb)`),
          role,
        );
      });
    }
  });

  describe('profile triggers', () => {
    it('create a profile per user from Google metadata, role user', async () => {
      const { rows } = await db.query(`select * from public.profiles order by email`);
      const byEmail = Object.fromEntries(rows.map((row) => [row.email, row]));
      assert.equal(rows.length, 3);
      assert.equal(byEmail[`alice@${DOMAIN}`].full_name, 'Alice Admin');
      assert.equal(byEmail[`alice@${DOMAIN}`].avatar_url, 'https://img/a.png');
      assert.equal(byEmail[`bob@${DOMAIN}`].full_name, 'Bob User', 'falls back to name');
      assert.equal(
        byEmail[`bob@${DOMAIN}`].avatar_url,
        'https://img/b.png',
        'falls back to picture',
      );
      assert.equal(byEmail[`bob@${DOMAIN}`].role, 'user');
      assert.ok(rows.every((row) => row.created_at instanceof Date));
    });

    it('sync last_sign_in_at on sign-in', async () => {
      const result = await as(
        db,
        'supabase_auth_admin',
        null,
        `update auth.users set last_sign_in_at = '2026-10-25T10:00:00Z' where id = $1`,
        [users.bob.id],
        { commit: true },
      );
      assert.ifError(result.error);
      const { rows } = await db.query(`select last_sign_in_at from public.profiles where id = $1`, [
        users.bob.id,
      ]);
      assert.equal(rows[0].last_sign_in_at.toISOString(), '2026-10-25T10:00:00.000Z');
    });
  });

  describe('reading profiles (RLS)', () => {
    const read = (claims) => as(db, 'authenticated', claims, `select id from public.profiles`);

    it('a user reads only their own row', async () => {
      const { rows, error } = await read(jwt('bob'));
      assert.ifError(error);
      assert.deepEqual(
        rows.map((row) => row.id),
        [users.bob.id],
      );
    });

    it('an admin reads every row', async () => {
      const { rows, error } = await read(jwt('alice'));
      assert.ifError(error);
      assert.equal(rows.length, 3);
    });

    it('an existing user from another domain reads nothing, not even their own row', async () => {
      const { rows, error } = await read(jwt('mallory'));
      assert.ifError(error);
      assert.equal(rows.length, 0);
    });

    it('an admin whose JWT email is off-domain reads nothing', async () => {
      const { rows, error } = await read({ ...jwt('alice'), email: 'alice@gmail.com' });
      assert.ifError(error);
      assert.equal(rows.length, 0);
    });

    it('anon is refused', async () => {
      assertDenied(await as(db, 'anon', {}, `select * from public.profiles`), 'anon');
    });
  });

  describe('writing profiles', () => {
    const statements = {
      'change a role': () =>
        `update public.profiles set role = 'admin' where id = '${users.bob.id}'`,
      'insert a profile': () =>
        `insert into public.profiles (id, email) values ('${users.bob.id}', 'x@${DOMAIN}')`,
      'delete a profile': () => `delete from public.profiles where id = '${users.bob.id}'`,
    };
    const callers = {
      user: () => ['authenticated', jwt('bob')],
      admin: () => ['authenticated', jwt('alice')],
      anon: () => ['anon', {}],
    };

    for (const [action, sql] of Object.entries(statements)) {
      for (const [who, caller] of Object.entries(callers)) {
        it(`${who} can't ${action} directly`, async () => {
          const [role, claims] = caller();
          assertDenied(await as(db, role, claims, sql()), `${who} ${action}`);
        });
      }
    }
  });

  describe('is_admin', () => {
    it('is false for a user and true for an admin', async () => {
      const user = await as(db, 'authenticated', jwt('bob'), `select public.is_admin() as v`);
      const admin = await as(db, 'authenticated', jwt('alice'), `select public.is_admin() as v`);
      assert.equal(user.rows[0].v, false);
      assert.equal(admin.rows[0].v, true);
    });

    it('is not callable by anon', async () => {
      assertDenied(await as(db, 'anon', {}, `select public.is_admin()`), 'anon');
    });
  });

  describe('set_user_role', () => {
    const setRole = (claims, target, role, options) =>
      as(
        db,
        'authenticated',
        claims,
        `select (public.set_user_role($1::uuid, $2)).role as role`,
        [target, role],
        options,
      );

    it('refuses a user, even for their own role', async () => {
      const { error } = await setRole(jwt('bob'), users.bob.id, 'admin');
      assert.equal(error?.code, '42501');
    });

    it('lets an admin promote a user', async () => {
      const { rows, error } = await setRole(jwt('alice'), users.bob.id, 'admin');
      assert.ifError(error);
      assert.equal(rows[0].role, 'admin');
    });

    it('refuses an admin demoting themselves', async () => {
      const { error } = await setRole(jwt('alice'), users.alice.id, 'user');
      assert.equal(error?.code, '42501');
    });

    it('rejects an invalid role', async () => {
      const { error } = await setRole(jwt('alice'), users.bob.id, 'owner');
      assert.equal(error?.code, '22023');
    });

    it('reports an unknown target', async () => {
      const { error } = await setRole(jwt('alice'), '00000000-0000-0000-0000-000000000000', 'user');
      assert.equal(error?.code, 'P0002');
    });

    it('is not callable by anon', async () => {
      assertDenied(
        await as(db, 'anon', {}, `select public.set_user_role($1::uuid, 'admin')`, [users.bob.id]),
        'anon',
      );
    });

    it('refuses an admin from another domain', async () => {
      await db.query(`update public.profiles set role = 'admin' where id = $1`, [users.mallory.id]);
      const { error } = await setRole(jwt('mallory'), users.bob.id, 'admin');
      await db.query(`update public.profiles set role = 'user' where id = $1`, [users.mallory.id]);
      assert.equal(error?.code, '42501');
    });

    it('lets admins demote each other but always leaves one', async () => {
      const promote = await setRole(jwt('alice'), users.bob.id, 'admin', { commit: true });
      assert.ifError(promote.error);
      const demote = await setRole(jwt('bob'), users.alice.id, 'user', { commit: true });
      assert.ifError(demote.error);
      assert.equal(demote.rows[0].role, 'user');
      const lastAdmin = await setRole(jwt('bob'), users.bob.id, 'user');
      assert.equal(lastAdmin.error?.code, '42501');
    });
  });

  describe('privileges', () => {
    const value = async (sql) => (await db.query(sql)).rows[0].v;

    for (const privilege of ['select', 'insert', 'update', 'delete']) {
      it(`anon has no ${privilege} on profiles`, async () => {
        assert.equal(
          await value(`select has_table_privilege('anon', 'public.profiles', '${privilege}') as v`),
          false,
        );
      });
      it(`authenticated ${privilege === 'select' ? 'has' : 'has no'} ${privilege} on profiles`, async () => {
        assert.equal(
          await value(
            `select has_table_privilege('authenticated', 'public.profiles', '${privilege}') as v`,
          ),
          privilege === 'select',
        );
      });
    }

    for (const [fn, role, expected] of [
      ['public.hook_before_user_created(jsonb)', 'supabase_auth_admin', true],
      ['public.hook_before_user_created(jsonb)', 'authenticated', false],
      ['public.hook_before_user_created(jsonb)', 'anon', false],
      ['public.email_domain_allowed(text)', 'supabase_auth_admin', true],
      ['public.email_domain_allowed(text)', 'authenticated', true],
      ['public.email_domain_allowed(text)', 'anon', false],
      ['public.is_admin()', 'anon', false],
      ['public.set_user_role(uuid, text)', 'anon', false],
      ['public.set_user_role(uuid, text)', 'authenticated', true],
      ['public.create_profile_for_new_user()', 'authenticated', false],
      ['public.sync_profile_last_sign_in()', 'authenticated', false],
    ]) {
      it(`${role} ${expected ? 'can' : "can't"} execute ${fn}`, async () => {
        assert.equal(
          await value(`select has_function_privilege('${role}', '${fn}', 'execute') as v`),
          expected,
        );
      });
    }

    it('supabase_auth_admin has no direct access to allowed_domains', async () => {
      assert.equal(
        await value(
          `select has_table_privilege('supabase_auth_admin', 'public.allowed_domains', 'select') as v`,
        ),
        false,
      );
    });
  });

  describe('deleting a user', () => {
    it('removes their profile', async () => {
      const result = await as(
        db,
        'supabase_auth_admin',
        null,
        `delete from auth.users where id = $1`,
        [users.mallory.id],
        { commit: true },
      );
      assert.ifError(result.error);
      const { rows } = await db.query(`select 1 from public.profiles where id = $1`, [
        users.mallory.id,
      ]);
      assert.equal(rows.length, 0);
    });
  });
});
