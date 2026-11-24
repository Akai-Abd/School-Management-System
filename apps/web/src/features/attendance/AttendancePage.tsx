import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

interface LeaveItem {
  id: string;
  applicantType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
}

interface SummaryItem {
  studentId: string;
  totalDays: number;
  presentDays: number;
  percentage: number;
}

export function AttendancePage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState('');
  const [yearId, setYearId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const studentsQuery = useQuery({
    queryKey: ['students', 'att'],
    queryFn: () =>
      apiFetch<{ items: Array<{ id: string; admissionNumber: string; firstName: string; lastName: string; enrollments: Array<{ section: { id: string }; academicYear: { id: string } }> }> }>(
        '/api/v1/students',
      ),
  });
  const classesQuery = useQuery({
    queryKey: ['academic', 'classes'],
    queryFn: () => apiFetch<{ items: Array<{ id: string; name: string; sections: Array<{ id: string; name: string }> }> }>('/api/v1/academic/classes'),
  });
  const yearsQuery = useQuery({
    queryKey: ['academic', 'years'],
    queryFn: () => apiFetch<{ items: Array<{ id: string; name: string }> }>('/api/v1/academic/years'),
  });
  const summaryQuery = useQuery({
    queryKey: ['attendance', 'summary'],
    queryFn: () => apiFetch<{ items: SummaryItem[] }>('/api/v1/attendance/summary'),
  });
  const leavesQuery = useQuery({
    queryKey: ['attendance', 'leaves'],
    queryFn: () => apiFetch<{ items: LeaveItem[] }>('/api/v1/attendance/leaves'),
  });

  const markBulk = useMutation({
    mutationFn: (entries: Array<{ studentId: string; status: 'present' | 'absent' | 'late' }>) =>
      apiFetch('/api/v1/attendance/student-bulk', {
        method: 'POST',
        body: JSON.stringify({ academicYearId: yearId, sectionId, attendanceDate: date, entries }),
      }),
    onSuccess: async () => {
      setNotice('Attendance saved.');
      await queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to save attendance'),
  });

  const reviewLeave = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approved' | 'rejected' }) =>
      apiFetch(`/api/v1/attendance/leaves/${id}/review`, { method: 'PATCH', body: JSON.stringify({ decision }) }),
    onSuccess: async () => {
      setNotice('Leave decision recorded.');
      await queryClient.invalidateQueries({ queryKey: ['attendance', 'leaves'] });
    },
  });

  if (studentsQuery.isLoading || classesQuery.isLoading) return <LoadingState label="Loading attendance..." />;
  if (studentsQuery.isError) return <ErrorState message="Could not load attendance data." />;

  const students = (studentsQuery.data?.items ?? []).filter(
    (s) => !sectionId || s.enrollments.some((e) => e.section.id === sectionId),
  );
  const summaryMap = new Map((summaryQuery.data?.items ?? []).map((s) => [s.studentId, s]));

  return (
    <div className="d-flex flex-column gap-4">
      <h1 className="h3 mb-0">Attendance & Leave</h1>
      {notice && <div className="alert alert-info py-2 mb-0">{notice}</div>}

      <div className="card border-0 shadow-sm p-3">
        <div className="row g-2 mb-3">
          <div className="col-md-3">
            <select className="form-select form-select-sm" value={yearId} onChange={(e) => setYearId(e.target.value)}>
              <option value="">Academic Year...</option>
              {(yearsQuery.data?.items ?? []).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div className="col-md-4">
            <select className="form-select form-select-sm" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">Select Class / Section...</option>
              {(classesQuery.data?.items ?? []).flatMap((c) =>
                c.sections.map((s) => <option key={s.id} value={s.id}>{c.name} - {s.name}</option>),
              )}
            </select>
          </div>
          <div className="col-md-3">
            <input type="date" className="form-control form-control-sm" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="col-md-2">
            <button
              type="button"
              className="btn btn-sm btn-primary w-100"
              disabled={!yearId || !sectionId || students.length === 0 || markBulk.isPending}
              onClick={() => markBulk.mutate(students.map((s) => ({ studentId: s.id, status: 'present' })))}
            >
              Mark All Present
            </button>
          </div>
        </div>

        {students.length === 0 ? (
          <EmptyState title="No Students" description="Enroll students in a section to record attendance." />
        ) : (
          <table className="table table-sm mb-0">
            <thead>
              <tr><th>Admission #</th><th>Student</th><th>Attendance %</th><th>Quick Action</th></tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const stat = summaryMap.get(s.id);
                return (
                  <tr key={s.id}>
                    <td><code>{s.admissionNumber}</code></td>
                    <td>{s.firstName} {s.lastName}</td>
                    <td>{stat ? `${stat.percentage}% (${stat.presentDays}/${stat.totalDays})` : '—'}</td>
                    <td className="d-flex gap-1">
                      <button
                        type="button"
                        className="btn btn-xs btn-outline-success btn-sm py-0"
                        disabled={!yearId || !sectionId}
                        onClick={() => markBulk.mutate([{ studentId: s.id, status: 'present' }])}
                      >
                        Present
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline-danger btn-sm py-0"
                        disabled={!yearId || !sectionId}
                        onClick={() => markBulk.mutate([{ studentId: s.id, status: 'absent' }])}
                      >
                        Absent
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card border-0 shadow-sm p-3">
        <h2 className="h5 mb-3">Leave Requests</h2>
        {!(leavesQuery.data?.items.length) ? (
          <EmptyState title="No Leave Requests" description="Submitted leave requests appear here." />
        ) : (
          <table className="table table-sm mb-0">
            <thead>
              <tr><th>Type</th><th>Dates</th><th>Reason</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {leavesQuery.data.items.map((l) => (
                <tr key={l.id}>
                  <td className="text-capitalize">{l.applicantType}</td>
                  <td>{l.startDate.slice(0, 10)} → {l.endDate.slice(0, 10)}</td>
                  <td>{l.reason}</td>
                  <td><span className="badge text-bg-secondary">{l.status}</span></td>
                  <td>
                    {l.status === 'pending' && (
                      <div className="d-flex gap-1">
                        <button type="button" className="btn btn-sm btn-outline-success py-0" onClick={() => reviewLeave.mutate({ id: l.id, decision: 'approved' })}>Approve</button>
                        <button type="button" className="btn btn-sm btn-outline-danger py-0" onClick={() => reviewLeave.mutate({ id: l.id, decision: 'rejected' })}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
