import { Router } from 'express';
import { requireAuth, requireSchoolContext } from '../../middleware/auth.js';

export const dashboardsRouter = Router();
dashboardsRouter.use(requireAuth, requireSchoolContext);

dashboardsRouter.get('/summary', async (req, res, next) => {
  try {
    const db = req.tenantPrisma!;
    const [
      totalStudents,
      totalStaff,
      pendingLeaves,
      invoices,
      payments,
      totalBooks,
      availableBookCopies,
      activeRoutes,
      occupiedBeds,
      totalBeds,
    ] = await Promise.all([
      db.student.count({ where: { deletedAt: null, status: 'active' } }),
      db.staff.count({ where: { deletedAt: null, status: 'active' } }),
      db.leaveRequest.count({ where: { status: 'pending' } }),
      db.invoice.findMany({ where: { status: { not: 'cancelled' } }, select: { totalAmount: true, discountAmount: true, paidAmount: true } }),
      db.payment.findMany({ where: { instrumentStatus: { not: 'bounced' } }, select: { amount: true } }),
      db.book.count({}),
      db.bookCopy.count({ where: { status: 'available' } }),
      db.transportRoute.count({}),
      db.hostelBed.count({ where: { isOccupied: true } }),
      db.hostelBed.count({}),
    ]);

    const feeCollected = payments.reduce((s, p) => s + Number(p.amount), 0);
    const feeOutstanding = invoices.reduce(
      (s, i) => s + Math.max(0, Number(i.totalAmount) - Number(i.discountAmount) - Number(i.paidAmount)),
      0,
    );

    res.json({
      roles: req.auth!.roles,
      metrics: {
        totalStudents,
        totalStaff,
        pendingLeaves,
        feeCollected,
        feeOutstanding,
        totalBooks,
        availableBookCopies,
        activeRoutes,
        occupiedBeds,
        totalBeds,
      },
    });
  } catch (err) {
    next(err);
  }
});
