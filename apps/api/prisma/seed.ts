import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { CONFIGURABLE_MODULE_KEYS, PERMISSION_ACTIONS, SYSTEM_ROLE_KEYS } from '@school-erp/contracts';
import { nextDocumentNumber } from '../src/lib/prisma.js';

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
  { roleKey: 'hostel_warden', email: 'warden@school.local', fullName: 'Demo Hostel Warden', permissionPrefixes: ['students.view', 'hostel.'] },
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

export async function seedDemoShowcaseData() {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEMO_QUICK_SIGNIN !== 'true') {
    return;
  }

  const school = await prisma.school.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } });
  if (!school) return;

  await prisma.websiteSetting.upsert({
    where: { schoolId: school.id },
    update: {},
    create: {
      schoolId: school.id,
      tagline: 'A nurturing environment where curiosity meets excellence.',
      principalMessage: `${school.name} provides a nurturing, technology-enabled learning environment for students from Class 6 to Class 10. Our experienced faculty, modern laboratories and student-centred approach help every learner reach their potential.`,
      address: '12 Knowledge Avenue, Kathmandu',
      contactPhone: '+977-1-5551234',
      contactEmail: 'info@educore.com',
      seoDescription: 'A modern school management system and public school website.',
    },
  });

  if ((await prisma.websiteAnnouncement.count({ where: { schoolId: school.id } })) === 0) {
    await prisma.websiteAnnouncement.createMany({
      data: [
        {
          schoolId: school.id,
          title: 'Staff Development Workshop',
          body: 'All teaching staff are invited to a pedagogy workshop next Monday at 2:00 PM in the conference room.',
          isPublished: true,
          publishedAt: new Date('2026-11-20T09:00:00.000Z'),
          createdAt: new Date('2026-11-20T09:00:00.000Z'),
        },
        {
          schoolId: school.id,
          title: 'Parent-Teacher Meeting',
          body: 'A parent-teacher meeting will be held this Friday from 10:00 AM to 1:00 PM in the main hall. All parents are encouraged to attend.',
          isPublished: true,
          publishedAt: new Date('2026-11-18T09:00:00.000Z'),
          createdAt: new Date('2026-11-18T09:00:00.000Z'),
        },
        {
          schoolId: school.id,
          title: 'Term Examination Schedule Published',
          body: 'The schedule for the first terminal examination is now available. Students should download the timetable from their dashboard.',
          isPublished: true,
          publishedAt: new Date('2026-11-14T09:00:00.000Z'),
          createdAt: new Date('2026-11-14T09:00:00.000Z'),
        },
      ],
    });
  }

  if ((await prisma.websiteEvent.count({ where: { schoolId: school.id } })) === 0) {
    await prisma.websiteEvent.createMany({
      data: [
        {
          schoolId: school.id,
          title: 'Annual Sports Day',
          eventDate: new Date('2026-12-02T00:00:00.000Z'),
          description: 'Inter-house athletics and team sports for all classes — School Ground.',
          isPublished: true,
        },
        {
          schoolId: school.id,
          title: 'Science Exhibition',
          eventDate: new Date('2026-12-15T00:00:00.000Z'),
          description: 'Students present science projects and experiments — Main Hall.',
          isPublished: true,
        },
        {
          schoolId: school.id,
          title: 'Independence Day Celebration',
          eventDate: new Date('2026-12-30T00:00:00.000Z'),
          description: 'Cultural programme and flag ceremony — Assembly Ground.',
          isPublished: true,
        },
      ],
    });
  }

  if ((await prisma.staff.count({ where: { schoolId: school.id, isTeacher: true, deletedAt: null } })) === 0) {
    const ensureDesignation = async (name: string) => {
      const existing = await prisma.designation.findFirst({ where: { schoolId: school.id, name, deletedAt: null } });
      return existing ?? prisma.designation.create({ data: { schoolId: school.id, name } });
    };
    const seniorDesig = await ensureDesignation('Senior Teacher');
    const teacherDesig = await ensureDesignation('Teacher');

    const teachers = [
      { name: 'David Miller', designationId: seniorDesig.id, spec: 'Science', qual: 'M.Sc. Physics', exp: 8 },
      { name: 'John Carter', designationId: teacherDesig.id, spec: 'English', qual: 'M.A. English', exp: 5 },
      { name: 'Priya Sharma', designationId: teacherDesig.id, spec: 'Mathematics', qual: 'M.Sc. Mathematics', exp: 6 },
    ];
    for (const t of teachers) {
      const employeeCode = await prisma.$transaction((tx) => nextDocumentNumber(tx, school.id, 'employee'));
      const staff = await prisma.staff.create({
        data: {
          schoolId: school.id,
          employeeCode,
          fullName: t.name,
          designationId: t.designationId,
          joiningDate: new Date('2022-04-01T00:00:00.000Z'),
          isTeacher: true,
        },
      });
      await prisma.teacherProfile.create({
        data: {
          schoolId: school.id,
          staffId: staff.id,
          specialization: t.spec,
          qualifications: t.qual,
          experienceYears: t.exp,
        },
      });
    }
  }

  if ((await prisma.schoolClass.count({ where: { schoolId: school.id, deletedAt: null } })) === 0) {
    let year = await prisma.academicYear.findFirst({ where: { schoolId: school.id, deletedAt: null } });
    if (!year) {
      year = await prisma.academicYear.create({
        data: {
          schoolId: school.id,
          name: '2026-2027',
          startDate: new Date('2026-04-01T00:00:00.000Z'),
          endDate: new Date('2027-03-31T00:00:00.000Z'),
          isCurrent: true,
        },
      });
    }

    const subjectDefs = [
      { name: 'Mathematics', code: 'MATH' },
      { name: 'English', code: 'ENG' },
      { name: 'Science', code: 'SCI' },
      { name: 'Social Studies', code: 'SOC' },
      { name: 'Computer Science', code: 'CS' },
      { name: 'Physical Education', code: 'PE' },
    ];
    const subjectsByCode: Record<string, string> = {};
    for (const s of subjectDefs) {
      const existing = await prisma.subject.findFirst({ where: { schoolId: school.id, code: s.code, deletedAt: null } });
      const sub = existing ?? (await prisma.subject.create({ data: { schoolId: school.id, name: s.name, code: s.code } }));
      subjectsByCode[s.code] = sub.id;
    }

    const classDefs = [
      { name: 'Grade 11', code: 'G11', order: 1, sections: ['B'], subjectCodes: ['CS'] },
      { name: 'Class 6', code: 'C6', order: 2, sections: ['A', 'B'], subjectCodes: ['MATH', 'ENG', 'SCI', 'SOC', 'CS', 'PE'] },
      { name: 'Class 7', code: 'C7', order: 3, sections: ['A', 'B'], subjectCodes: ['MATH', 'ENG', 'SCI', 'SOC', 'CS', 'PE'] },
      { name: 'Class 8', code: 'C8', order: 4, sections: ['A', 'B'], subjectCodes: ['MATH', 'ENG', 'SCI', 'SOC', 'CS', 'PE'] },
      { name: 'Class 9', code: 'C9', order: 5, sections: ['A', 'B'], subjectCodes: ['MATH', 'ENG', 'SCI', 'SOC', 'CS', 'PE'], students: 2 },
      { name: 'Class 10', code: 'C10', order: 6, sections: ['A', 'B'], subjectCodes: ['MATH', 'ENG', 'SCI', 'SOC', 'CS', 'PE'], students: 6 },
    ];

    let admSeq = 1;
    for (const c of classDefs) {
      const cls = await prisma.schoolClass.create({
        data: { schoolId: school.id, name: c.name, code: c.code, displayOrder: c.order },
      });
      const createdSections = [];
      for (const secName of c.sections) {
        createdSections.push(await prisma.section.create({ data: { schoolId: school.id, classId: cls.id, name: secName } }));
      }
      for (const subCode of c.subjectCodes) {
        await prisma.classSubject.create({
          data: { schoolId: school.id, academicYearId: year.id, classId: cls.id, subjectId: subjectsByCode[subCode]! },
        });
      }
      if (c.students && (await prisma.student.count({ where: { schoolId: school.id } })) < 8) {
        for (let idx = 0; idx < c.students; idx++) {
          const num = admSeq++;
          const admissionNumber = await prisma.$transaction((tx) => nextDocumentNumber(tx, school.id, 'admission'));
          const st = await prisma.student.create({
            data: {
              schoolId: school.id,
              admissionNumber,
              firstName: 'Student',
              lastName: String(num),
              dateOfBirth: new Date('2011-05-15T00:00:00.000Z'),
              gender: num % 2 === 0 ? 'female' : 'male',
            },
          });
          await prisma.studentEnrollment.create({
            data: {
              schoolId: school.id,
              studentId: st.id,
              academicYearId: year.id,
              classId: cls.id,
              sectionId: createdSections[idx % createdSections.length]!.id,
            },
          });
        }
      }
    }
  }

  if ((await prisma.book.count({ where: { schoolId: school.id } })) === 0) {
    await prisma.book.createMany({
      data: [
        { schoolId: school.id, title: 'Conceptual Physics', author: 'Paul G. Hewitt' },
        { schoolId: school.id, title: 'Higher Algebra', author: 'H. S. Hall' },
        { schoolId: school.id, title: 'Modern English Grammar', author: 'Raymond Murphy' },
        { schoolId: school.id, title: 'Introduction to Computing', author: 'Peter Norton' },
      ],
    });
  }

  console.log(`Seeded EduCore showcase content for school (${school.slug}).`);
}

async function main() {
  await seedPermissions();
  await bootstrapStandalone();
  await seedDemoRoleUsers();
  await seedDemoShowcaseData();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
