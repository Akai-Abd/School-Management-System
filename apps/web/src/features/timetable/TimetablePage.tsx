import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

export function TimetablePage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const periodsQuery = useQuery({
    queryKey: ['timetable', 'periods'],
    queryFn: () => apiFetch<{ items: Array<{ id: string; name: string; periodNumber: number; startTime: string; endTime: string }> }>('/api/v1/timetable/periods'),
  });
  const entriesQuery = useQuery({
    queryKey: ['timetable', 'entries'],
    queryFn: () => apiFetch<{ items: Array<{ id: string; dayOfWeek: number; period: { name: string; startTime: string; endTime: string }; classroom: { name: string } | null }> }>('/api/v1/timetable/entries'),
  });
  const yearsQuery = useQuery({ queryKey: ['academic', 'years'], queryFn: () => apiFetch<{ items: Array<{ id: string; name: string }> }>('/api/v1/academic/years') });
  const classesQuery = useQuery({ queryKey: ['academic', 'classes'], queryFn: () => apiFetch<{ items: Array<{ id: string; name: string; sections: Array<{ id: string; name: string }> }> }>('/api/v1/academic/classes') });
  const subjectsQuery = useQuery({ queryKey: ['academic', 'subjects'], queryFn: () => apiFetch<{ items: Array<{ id: string; name: string }> }>('/api/v1/academic/subjects') });
  const staffQuery = useQuery({ queryKey: ['staff', 'tt'], queryFn: () => apiFetch<{ items: Array<{ id: string; fullName: string }> }>('/api/v1/staff') });

  const addPeriod = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch('/api/v1/timetable/periods', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      setNotice('Period created.');
      await queryClient.invalidateQueries({ queryKey: ['timetable', 'periods'] });
    },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to create period'),
  });

  const addEntry = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch('/api/v1/timetable/entries', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      setNotice('Lesson scheduled.');
      await queryClient.invalidateQueries({ queryKey: ['timetable', 'entries'] });
    },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Conflict or invalid slot'),
  });

  if (periodsQuery.isLoading || entriesQuery.isLoading) return <LoadingState label="Loading timetable..." />;
  if (periodsQuery.isError || entriesQuery.isError) return <ErrorState message="Could not load timetable." />;

  const periods = periodsQuery.data?.items ?? [];

  return (
    <div className="d-flex flex-column gap-4">
      <h1 className="h3 mb-0">Timetable & Periods</h1>
      {notice && <div className="alert alert-info py-2 mb-0">{notice}</div>}

      <form
        className="card border-0 shadow-sm p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          addPeriod.mutate({
            name: String(fd.get('name') ?? ''),
            periodNumber: Number(fd.get('periodNumber') ?? 1),
            startTime: String(fd.get('startTime') ?? '09:00'),
            endTime: String(fd.get('endTime') ?? '09:45'),
          });
          e.currentTarget.reset();
        }}
      >
        <h2 className="h6 mb-2">Configure Period</h2>
        <div className="row g-2">
          <div className="col-md-4"><input name="name" className="form-control form-control-sm" placeholder="Period 1" required /></div>
          <div className="col-md-2"><input name="periodNumber" type="number" min={1} className="form-control form-control-sm" placeholder="#" required /></div>
          <div className="col-md-2"><input name="startTime" type="time" className="form-control form-control-sm" required /></div>
          <div className="col-md-2"><input name="endTime" type="time" className="form-control form-control-sm" required /></div>
          <div className="col-md-2"><button type="submit" className="btn btn-sm btn-primary w-100">Add Period</button></div>
        </div>
      </form>

      <form
        className="card border-0 shadow-sm p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          addEntry.mutate({
            academicYearId: String(fd.get('academicYearId') ?? ''),
            sectionId: String(fd.get('sectionId') ?? ''),
            periodId: String(fd.get('periodId') ?? ''),
            dayOfWeek: Number(fd.get('dayOfWeek') ?? 1),
            subjectId: String(fd.get('subjectId') ?? ''),
            staffId: String(fd.get('staffId') ?? ''),
            effectiveFrom: new Date().toISOString().slice(0, 10),
          });
        }}
      >
        <h2 className="h6 mb-2">Assign Lesson (Conflict-Checked)</h2>
        <div className="row g-2">
          <div className="col-md-2">
            <select name="academicYearId" className="form-select form-select-sm" required>
              <option value="">Year...</option>
              {(yearsQuery.data?.items ?? []).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <select name="sectionId" className="form-select form-select-sm" required>
              <option value="">Section...</option>
              {(classesQuery.data?.items ?? []).flatMap((c) => c.sections.map((s) => <option key={s.id} value={s.id}>{c.name}-{s.name}</option>))}
            </select>
          </div>
          <div className="col-md-2">
            <select name="periodId" className="form-select form-select-sm" required>
              <option value="">Period...</option>
              {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="col-md-1">
            <select name="dayOfWeek" className="form-select form-select-sm">
              {[1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>Day {d}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <select name="subjectId" className="form-select form-select-sm" required>
              <option value="">Subject...</option>
              {(subjectsQuery.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <select name="staffId" className="form-select form-select-sm" required>
              <option value="">Teacher...</option>
              {(staffQuery.data?.items ?? []).map((st) => <option key={st.id} value={st.id}>{st.fullName}</option>)}
            </select>
          </div>
          <div className="col-md-1"><button type="submit" className="btn btn-sm btn-primary w-100">Assign</button></div>
        </div>
      </form>

      <div className="card border-0 shadow-sm p-3">
        <h2 className="h5 mb-3">Scheduled Entries</h2>
        {!(entriesQuery.data?.items.length) ? (
          <EmptyState title="No Timetable Entries" description={`Configured periods: ${periods.length}. Assign lessons above.`} />
        ) : (
          <table className="table table-sm mb-0">
            <thead>
              <tr><th>Day</th><th>Period</th><th>Time</th><th>Room</th></tr>
            </thead>
            <tbody>
              {entriesQuery.data.items.map((row) => (
                <tr key={row.id}>
                  <td>Day {row.dayOfWeek}</td>
                  <td>{row.period.name}</td>
                  <td>{row.period.startTime}–{row.period.endTime}</td>
                  <td>{row.classroom?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
