import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

interface StudentItem {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  status: string;
  enrollments: Array<{ schoolClass: { name: string }; section: { name: string } }>;
  guardians: Array<{ guardian: { fullName: string; phone: string } }>;
}

interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface SchoolClass {
  id: string;
  name: string;
  sections: Array<{ id: string; name: string }>;
}

export function StudentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [classId, setClassId] = useState('');
  const [csvText, setCsvText] = useState('');

  const studentsQuery = useQuery({
    queryKey: ['students', search],
    queryFn: () => apiFetch<{ items: StudentItem[] }>(`/api/v1/students?search=${encodeURIComponent(search)}`),
  });
  const yearsQuery = useQuery({
    queryKey: ['academic', 'years'],
    queryFn: () => apiFetch<{ items: AcademicYear[] }>('/api/v1/academic/years'),
  });
  const classesQuery = useQuery({
    queryKey: ['academic', 'classes'],
    queryFn: () => apiFetch<{ items: SchoolClass[] }>('/api/v1/academic/classes'),
  });

  const admitStudent = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch('/api/v1/students', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      setNotice('Student admitted.');
      await queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to admit student'),
  });

  const previewImport = useMutation({
    mutationFn: () =>
      apiFetch<{ totalRows: number; validRows: number; errorRows: number; errors: Array<{ row: number; message: string }> }>(
        '/api/v1/imports/preview',
        { method: 'POST', body: JSON.stringify({ entityType: 'students', csvText }) },
      ),
    onSuccess: (res) =>
      setNotice(`Dry-run: ${res.validRows}/${res.totalRows} valid rows, ${res.errorRows} errors.`),
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'CSV preview failed'),
  });

  if (studentsQuery.isLoading) return <LoadingState label="Loading students..." />;
  if (studentsQuery.isError) return <ErrorState message="Could not load students." onRetry={() => void studentsQuery.refetch()} />;

  const items = studentsQuery.data?.items ?? [];
  const years = yearsQuery.data?.items ?? [];
  const classes = classesQuery.data?.items ?? [];
  const sections = classes.find((c) => c.id === classId)?.sections ?? [];

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center">
        <h1 className="h3 mb-0">Students & Admissions</h1>
        <div className="d-flex gap-2">
          <a href="/api/v1/reports/students.xlsx" className="btn btn-sm btn-outline-primary text-nowrap">
            Export Excel
          </a>
          <input
            className="form-control form-control-sm"
            style={{ maxWidth: 260 }}
            placeholder="Search name or admission #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {notice && <div className="alert alert-info py-2 mb-0">{notice}</div>}

      <form
        className="card border-0 shadow-sm p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          admitStudent.mutate({
            firstName: String(fd.get('firstName') ?? ''),
            lastName: String(fd.get('lastName') ?? ''),
            dateOfBirth: String(fd.get('dateOfBirth') ?? ''),
            gender: String(fd.get('gender') ?? 'male'),
            academicYearId: String(fd.get('academicYearId') ?? ''),
            classId,
            sectionId: String(fd.get('sectionId') ?? ''),
            guardians: [
              {
                fullName: String(fd.get('guardianName') ?? ''),
                phone: String(fd.get('guardianPhone') ?? ''),
                relationship: String(fd.get('relationship') ?? 'Parent'),
              },
            ],
          });
          e.currentTarget.reset();
        }}
      >
        <h2 className="h6 mb-3">Admit New Student</h2>
        <div className="row g-2">
          <div className="col-md-2"><input name="firstName" className="form-control form-control-sm" placeholder="First Name" required /></div>
          <div className="col-md-2"><input name="lastName" className="form-control form-control-sm" placeholder="Last Name" required /></div>
          <div className="col-md-2"><input name="dateOfBirth" type="date" className="form-control form-control-sm" required /></div>
          <div className="col-md-2">
            <select name="gender" className="form-select form-select-sm" required>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="col-md-2">
            <select name="academicYearId" className="form-select form-select-sm" required>
              <option value="">Year...</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <select className="form-select form-select-sm" value={classId} onChange={(e) => setClassId(e.target.value)} required>
              <option value="">Class...</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <select name="sectionId" className="form-select form-select-sm" required>
              <option value="">Section...</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-md-3"><input name="guardianName" className="form-control form-control-sm" placeholder="Guardian Full Name" required /></div>
          <div className="col-md-3"><input name="guardianPhone" className="form-control form-control-sm" placeholder="Guardian Phone" required /></div>
          <div className="col-md-2"><input name="relationship" className="form-control form-control-sm" defaultValue="Parent" required /></div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-sm btn-primary w-100" disabled={admitStudent.isPending}>Admit</button>
          </div>
        </div>
      </form>

      <div className="card border-0 shadow-sm p-3">
        <h2 className="h6 mb-2">Bulk Student CSV Dry-Run Validator</h2>
        <textarea
          className="form-control form-control-sm mb-2"
          rows={3}
          placeholder="first_name,last_name,date_of_birth,gender,guardian_name,guardian_phone"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />
        <div>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={!csvText.trim() || previewImport.isPending}
            onClick={() => previewImport.mutate()}
          >
            Validate CSV
          </button>
        </div>
      </div>

      <div className="card border-0 shadow-sm p-3">
        {items.length === 0 ? (
          <EmptyState title="No Students" description="Admit a student above to create the first record." />
        ) : (
          <table className="table table-sm mb-0">
            <thead>
              <tr><th>Admission #</th><th>Name</th><th>Class / Section</th><th>Guardian</th><th>Status</th></tr>
            </thead>
            <tbody>
              {items.map((st) => (
                <tr key={st.id}>
                  <td><code>{st.admissionNumber}</code></td>
                  <td>{st.firstName} {st.lastName}</td>
                  <td>{st.enrollments[0] ? `${st.enrollments[0].schoolClass.name} - ${st.enrollments[0].section.name}` : '—'}</td>
                  <td>{st.guardians[0]?.guardian.fullName ?? '—'}</td>
                  <td><span className="badge text-bg-secondary">{st.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
