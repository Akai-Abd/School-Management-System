import { Router } from 'express';
import { allocateHostelBedSchema, createHostelRoomSchema, createHostelSchema } from '@school-erp/contracts';
import { Errors } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

export const hostelRouter = Router();
hostelRouter.use(requireAuth, requireSchoolContext, requireModule('hostel'));

hostelRouter.get('/', requirePermission('hostel.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.hostel.findMany({
      include: {
        rooms: { include: { beds: { orderBy: { bedCode: 'asc' } } }, orderBy: { roomNumber: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

hostelRouter.post('/', requireCsrf, requirePermission('hostel.create'), validateBody(createHostelSchema), async (req, res, next) => {
  try {
    const created = await req.tenantPrisma!.hostel.create({
      data: { schoolId: req.auth!.activeSchoolId!, ...req.body },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

hostelRouter.post('/rooms', requireCsrf, requirePermission('hostel.create'), validateBody(createHostelRoomSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    if (req.body.bedCodes.length > req.body.capacity) {
      throw Errors.badRequest('Number of beds cannot exceed room capacity');
    }
    const created = await prisma.hostelRoom.create({
      data: {
        schoolId,
        hostelId: req.body.hostelId,
        roomNumber: req.body.roomNumber,
        capacity: req.body.capacity,
        beds: {
          create: req.body.bedCodes.map((bedCode: string) => ({ bedCode })),
        },
      },
      include: { beds: true },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

hostelRouter.post('/allocations', requireCsrf, requirePermission('hostel.create'), validateBody(allocateHostelBedSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const allocation = await prisma.$transaction(async (tx) => {
      const [bed, existingStudentAlloc] = await Promise.all([
        tx.hostelBed.findFirst({ where: { id: req.body.bedId, schoolId } }),
        tx.hostelAllocation.findFirst({ where: { schoolId, studentId: req.body.studentId, vacatedAt: null } }),
      ]);
      if (!bed) throw Errors.notFound('Bed not found');
      if (bed.isOccupied) throw Errors.conflict('Bed is already occupied');
      if (existingStudentAlloc) throw Errors.conflict('Student already holds an active hostel allocation');

      await tx.hostelBed.update({ where: { id: bed.id }, data: { isOccupied: true } });
      return tx.hostelAllocation.create({
        data: { schoolId, studentId: req.body.studentId, bedId: bed.id },
      });
    });
    res.status(201).json(allocation);
  } catch (err) {
    next(err);
  }
});

hostelRouter.post('/allocations/:id/vacate', requireCsrf, requirePermission('hostel.update'), async (req, res, next) => {
  try {
    const allocId = req.params.id;
    if (!allocId) throw Errors.badRequest('Allocation ID is required');
    const alloc = await req.tenantPrisma!.hostelAllocation.findFirst({ where: { id: allocId } });
    if (!alloc) throw Errors.notFound('Allocation not found');
    if (alloc.vacatedAt) throw Errors.badRequest('Allocation is already vacated');

    await prisma.$transaction([
      prisma.hostelAllocation.update({ where: { id: alloc.id }, data: { vacatedAt: new Date() } }),
      prisma.hostelBed.update({ where: { id: alloc.bedId }, data: { isOccupied: false } }),
    ]);

    res.json({ vacated: true });
  } catch (err) {
    next(err);
  }
});
