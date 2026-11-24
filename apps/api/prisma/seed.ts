import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { PERMISSION_ACTIONS, SYSTEM_ROLE_KEYS } from '@school-erp/contracts';

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

async function main() {
  await seedPermissions();
  await bootstrapStandalone();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
