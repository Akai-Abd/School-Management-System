import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { CONFIGURABLE_MODULE_KEYS, PERMISSION_ACTIONS, SYSTEM_ROLE_KEYS } from '@school-erp/contracts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const prisma = new PrismaClient();

const MODULES = [
  'schools',
  'users',
  'roles',
  'students',
  'staff',
  'academic',
  'attendance',
  'timetable',
  'exams',
  'homework',
  'fees',
  'accounting',
  'library',
  'transport',
  'hostel',
  'communications',
  'reports',
  'files',
  'audit_logs',
  'website',
  'imports',
] as const;

export async function seedPermissions() {
  for (const mod of MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      const code = `${mod}.${action}`;
      await prisma.permission.upsert({
        where: { code },
        update: {},
        create: {
          module: mod,
          action,
          code,
          description: `${action} access for ${mod}`,
        },
      });
    }
  }
}

export async function bootstrapStandalone() {
  const existingSchools = await prisma.school.count();
  if (existingSchools > 0) {
    console.log('Schools already exist; skipping standalone bootstrap.');
    return;
  }

  const adminEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@school.local').toLowerCase();
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const schoolName = process.env.BOOTSTRAP_SCHOOL_NAME ?? 'Demo Public School';
  const schoolSlug = process.env.BOOTSTRAP_SCHOOL_SLUG ?? 'demo-school';

  const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
  const allPermissions = await prisma.permission.findMany();

  await prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: { name: schoolName, slug: schoolSlug },
    });

    await tx.schoolSetting.create({
      data: { schoolId: school.id },
    });

    await tx.schoolModule.createMany({
      data: CONFIGURABLE_MODULE_KEYS.map((moduleKey) => ({
        schoolId: school.id,
        moduleKey,
        isEnabled: true,
      })),
    });

    const user = await tx.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        fullName: 'School Administrator',
        isPlatformAdmin: process.env.APP_MODE === 'saas',
      },
    });

    const membership = await tx.schoolMembership.create({
      data: { schoolId: school.id, userId: user.id },
    });

    const createdRoles: Record<string, string> = {};
    for (const roleKey of SYSTEM_ROLE_KEYS) {
      if (roleKey === 'super_admin') continue;
      const role = await tx.role.create({
        data: {
          schoolId: school.id,
          key: roleKey,
          name: roleKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          isSystem: true,
        },
      });
      createdRoles[roleKey] = role.id;
    }

    const schoolAdminRoleId = createdRoles['school_admin'];
    if (schoolAdminRoleId) {
      await tx.rolePermission.createMany({
        data: allPermissions.map((p) => ({
          roleId: schoolAdminRoleId,
          schoolId: school.id,
          permissionId: p.id,
        })),
      });

      await tx.userRole.create({
        data: {
          schoolMembershipId: membership.id,
          schoolId: school.id,
          roleId: schoolAdminRoleId,
        },
      });
    }

    for (const [docType, prefix] of [
      ['admission', 'ADM-'],
      ['employee', 'EMP-'],
      ['invoice', 'INV-'],
      ['receipt', 'RCP-'],
      ['journal', 'JRN-'],
    ]) {
      await tx.documentSequence.create({
        data: { schoolId: school.id, docType, scopeKey: 'default', prefix, nextNumber: 1 },
      });
    }
  });

  console.log(`Bootstrapped standalone school (${schoolSlug}) and admin (${adminEmail}).`);
}

const DEMO_USERS: Array<{
  roleKey: (typeof SYSTEM_ROLE_KEYS)[number];
  email: string;
  fullName: string;
  isPlatformAdmin?: boolean;
  permissionPrefixes: string[];
}> = [
  { roleKey: 'super_admin', email: 'superadmin@school.local', fullName: 'Platform Superadmin', isPlatformAdmin: true, permissionPrefixes: [] },
  { roleKey: 'teacher', email: 'teacher@school.local', fullName: 'Demo Teacher', permissionPrefixes: ['students.view', 'academic.view', 'attendance.', 'timetable.view', 'exams.', 'homework.'] },
  { roleKey: 'parent', email: 'parent@school.local', fullName: 'Demo Parent', permissionPrefixes: ['students.view', 'attendance.view', 'timetable.view', 'exams.view', 'homework.view', 'fees.view', 'communications.view'] },
  { roleKey: 'student', email: 'student@school.local', fullName: 'Demo Student', permissionPrefixes: ['academic.view', 'attendance.view', 'timetable.view', 'exams.view', 'homework.view', 'library.view'] },
  { roleKey: 'accountant', email: 'accountant@school.local', fullName: 'Demo Accountant', permissionPrefixes: ['students.view', 'fees.', 'accounting.', 'reports.view'] },
  { roleKey: 'librarian', email: 'librarian@school.local', fullName: 'Demo Librarian', permissionPrefixes: ['students.view', 'library.'] },
  { roleKey: 'driver', email: 'driver@school.local', fullName: 'Demo Driver', permissionPrefixes: ['transport.'] },
];

export async function seedDemoRoleUsers() {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEMO_QUICK_SIGNIN !== 'true') {
    return;
  }

  const school = await prisma.school.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } });
  if (!school) return;

  const demoPassword = process.env.DEMO_USER_PASSWORD ?? process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await argon2.hash(demoPassword, { type: argon2.argon2id });
  const allPermissions = await prisma.permission.findMany();

  for (const spec of DEMO_USERS) {
    let user = await prisma.user.findFirst({ where: { email: spec.email, deletedAt: null } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: spec.email,
          passwordHash,
          fullName: spec.fullName,
          isPlatformAdmin: Boolean(spec.isPlatformAdmin),
        },
      });
    } else if (spec.isPlatformAdmin && !user.isPlatformAdmin) {
      user = await prisma.user.update({ where: { id: user.id }, data: { isPlatformAdmin: true } });
    }

    const membership = await prisma.schoolMembership.upsert({
      where: { schoolId_userId: { schoolId: school.id, userId: user.id } },
      update: { status: 'active' },
      create: { schoolId: school.id, userId: user.id },
    });

    const roleKey = spec.roleKey === 'super_admin' ? 'school_admin' : spec.roleKey;
    let role = await prisma.role.findFirst({ where: { schoolId: school.id, key: roleKey, deletedAt: null } });
    if (!role) {
      role = await prisma.role.create({
        data: {
          schoolId: school.id,
          key: roleKey,
          name: roleKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          isSystem: true,
        },
      });
    }

    if (spec.permissionPrefixes.length > 0) {
      const matching = allPermissions.filter((p) =>
        spec.permissionPrefixes.some((prefix) => p.code.startsWith(prefix)),
      );
      if (matching.length > 0) {
        await prisma.rolePermission.createMany({
          data: matching.map((p) => ({ roleId: role.id, schoolId: school.id, permissionId: p.id })),
          skipDuplicates: true,
        });
      }
    }

    await prisma.userRole.upsert({
      where: { schoolMembershipId_roleId: { schoolMembershipId: membership.id, roleId: role.id } },
      update: {},
      create: { schoolMembershipId: membership.id, schoolId: school.id, roleId: role.id },
    });
  }

  console.log(`Seeded ${DEMO_USERS.length} demo quick-signin accounts for school (${school.slug}).`);
}

async function main() {
  await seedPermissions();
  await bootstrapStandalone();
  await seedDemoRoleUsers();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
