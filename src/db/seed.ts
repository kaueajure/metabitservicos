import { readFile } from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { createPool } from './index.ts';

type SeederRole = {
  name: string;
  slug: string;
  description: string;
  permissions: '*' | string[];
};

type SeederPermission = {
  name: string;
  slug: string;
  description: string;
};

type SeederMunicipality = {
  name: string;
  state: string;
  responsible: string;
  phone: string;
  email: string;
  observations: string;
};

type SeederData = {
  roles: SeederRole[];
  permissions: SeederPermission[];
  admin: {
    email: string;
    password: string;
    name: string;
    employeeName: string;
    role: string;
  };
  municipalities: SeederMunicipality[];
};

const seedFile = path.resolve(process.cwd(), 'database', 'seeders', 'core-data.json');

function buildResponsiblePayload(responsible: string) {
  return JSON.stringify({
    MSC: responsible,
    RREO: responsible,
    RGF: responsible,
    DCA: responsible,
    SIOPE: responsible,
    SIOPS: responsible,
    _activeServices: {
      MSC: true,
      RREO: true,
      RGF: true,
      DCA: true,
      SIOPE: true,
      SIOPS: true,
    },
  });
}

export async function seed() {
  console.log('Starting MySQL seeders...');
  const pool = createPool();

  try {
    const data = JSON.parse(await readFile(seedFile, 'utf8')) as SeederData;

    console.log('Seeding access profiles...');
    for (const role of data.roles) {
      await pool.query(
        `INSERT INTO roles (name, slug, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           description = VALUES(description),
           deleted_at = NULL`,
        [role.name, role.slug, role.description]
      );
    }

    console.log('Seeding permissions...');
    for (const permission of data.permissions) {
      await pool.query(
        `INSERT INTO permissions (name, slug, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           description = VALUES(description),
           deleted_at = NULL`,
        [permission.name, permission.slug, permission.description]
      );
    }

    console.log('Linking role permissions...');
    const allPermissionSlugs = data.permissions.map((permission) => permission.slug);
    for (const role of data.roles) {
      const permissionSlugs = role.permissions === '*' ? allPermissionSlugs : role.permissions;
      for (const permissionSlug of permissionSlugs) {
        await pool.query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id)
           SELECT r.id, p.id
           FROM roles r
           INNER JOIN permissions p ON p.slug = ?
           WHERE r.slug = ?`,
          [permissionSlug, role.slug]
        );
      }
    }

    console.log('Seeding administrator user...');
    const adminEmail = (process.env.ADMIN_EMAIL || data.admin.email).trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || data.admin.password;
    const [existingAdmins] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [adminEmail]);

    let adminId: number;
    if ((existingAdmins as Array<{ id: number }>).length === 0) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const [result] = await pool.query(
        `INSERT INTO users (uid, email, password, name, employee_name)
         VALUES (?, ?, ?, ?, ?)`,
        [randomUUID(), adminEmail, hashedPassword, data.admin.name, data.admin.employeeName]
      );
      adminId = (result as { insertId: number }).insertId;
      console.log(`Administrator user created: ${adminEmail}`);
    } else {
      adminId = (existingAdmins as Array<{ id: number }>)[0].id;
      await pool.query(
        `UPDATE users
         SET name = ?, employee_name = ?, deleted_at = NULL
         WHERE id = ?`,
        [data.admin.name, data.admin.employeeName, adminId]
      );
      console.log(`Administrator user already exists: ${adminEmail}`);
    }

    await pool.query(
      `INSERT IGNORE INTO user_roles (user_id, role_id)
       SELECT ?, id FROM roles WHERE slug = ? LIMIT 1`,
      [adminId, data.admin.role]
    );

    console.log('Seeding required municipalities if table is empty...');
    const [existingMunicipalities] = await pool.query('SELECT id FROM municipalities LIMIT 1');
    if ((existingMunicipalities as Array<{ id: number }>).length === 0) {
      for (const municipality of data.municipalities) {
        await pool.query(
          `INSERT INTO municipalities (name, state, responsible, phone, email, observations)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            municipality.name,
            municipality.state,
            buildResponsiblePayload(municipality.responsible),
            municipality.phone,
            municipality.email,
            municipality.observations,
          ]
        );
      }
      console.log(`Seeded ${data.municipalities.length} municipalities.`);
    } else {
      console.log('Municipalities table already has data.');
    }

    console.log('MySQL seeders completed successfully.');
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === import.meta.filename || process.argv[1]?.endsWith('seed.ts')) {
  seed().catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
}
