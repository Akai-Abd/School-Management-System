import { Router } from 'express';
import { assignTransportSchema, createRouteSchema, createVehicleSchema } from '@school-erp/contracts';
import { Errors } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

export function assertVehicleCapacity(capacity: number, activeAssignments: number): void {
  if (activeAssignments >= capacity) {
    throw Errors.conflict(`Vehicle capacity (${capacity}) reached`);
  }
}

export const transportRouter = Router();
transportRouter.use(requireAuth, requireSchoolContext, requireModule('transport'));

transportRouter.get('/vehicles', requirePermission('transport.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.vehicle.findMany({ orderBy: { registrationNumber: 'asc' } });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

transportRouter.post('/vehicles', requireCsrf, requirePermission('transport.create'), validateBody(createVehicleSchema), async (req, res, next) => {
  try {
    const created = await req.tenantPrisma!.vehicle.create({
      data: {
        schoolId: req.auth!.activeSchoolId!,
        registrationNumber: req.body.registrationNumber,
        capacity: req.body.capacity,
        driverStaffId: req.body.driverStaffId,
        insuranceExpiry: req.body.insuranceExpiry ? new Date(req.body.insuranceExpiry) : undefined,
        fitnessExpiry: req.body.fitnessExpiry ? new Date(req.body.fitnessExpiry) : undefined,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

transportRouter.get('/routes', requirePermission('transport.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.transportRoute.findMany({
      include: { vehicle: true, stops: { orderBy: { stopOrder: 'asc' } }, assignments: { where: { isActive: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

transportRouter.post('/routes', requireCsrf, requirePermission('transport.create'), validateBody(createRouteSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const created = await prisma.transportRoute.create({
      data: {
        schoolId,
        name: req.body.name,
        vehicleId: req.body.vehicleId,
        stops: {
          create: req.body.stops,
        },
      },
      include: { stops: true },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

transportRouter.post('/assignments', requireCsrf, requirePermission('transport.create'), validateBody(assignTransportSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const route = await req.tenantPrisma!.transportRoute.findFirst({
      where: { id: req.body.routeId },
      include: {
        vehicle: true,
        stops: { where: { id: req.body.stopId } },
        assignments: { where: { isActive: true } },
      },
    });
    if (!route) throw Errors.notFound('Route not found');
    if (route.stops.length === 0) throw Errors.badRequest('Stop does not belong to selected route');
    if (route.vehicle) assertVehicleCapacity(route.vehicle.capacity, route.assignments.length);

    const assignment = await prisma.transportAssignment.upsert({
      where: { schoolId_studentId: { schoolId, studentId: req.body.studentId } },
      update: { routeId: route.id, stopId: req.body.stopId, isActive: true },
      create: { schoolId, studentId: req.body.studentId, routeId: route.id, stopId: req.body.stopId },
    });
    res.status(201).json(assignment);
  } catch (err) {
    next(err);
  }
});
