import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  terms: Array<{ id: string; name: string; startDate: string; endDate: string }>;
}

interface SchoolClass {
  id: string;
  name: string;
  code: string | null;
  sections: Array<{ id: string; name: string; capacity: number | null }>;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  isElective: boolean;
}

export function AcademicPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState('');

  const yearsQuery = useQuery({
    queryKey: ['academic', 'years'],
    queryFn: () => apiFetch<{ items: AcademicYear[] }>('/api/v1/academic/years'),
  });
  const classesQuery = useQuery({
    queryKey: ['academic', 'classes'],
    queryFn: () => apiFetch<{ items: SchoolClass[] }>('/api/v1/academic/classes'),
  });
  const subjectsQuery = useQuery({
    queryKey: ['academic', 'subjects'],
    queryFn: () => apiFetch<{ items: Subject[] }>('/api/v1/academic/subjects'),
  });

  const createYear = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch('/api/v1/academic/years', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      setNotice('Academic year created.');
      await queryClient.invalidateQueries({ queryKey: ['academic', 'years'] });
    },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to create year'),
  });

  const createClass = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch('/api/v1/academic/classes', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      setNotice('Class created.');
      await queryClient.invalidateQueries({ queryKey: ['academic', 'classes'] });
    },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to create class'),
  });

  const createSection = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch('/api/v1/academic/sections', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      setNotice('Section added.');
      await queryClient.invalidateQueries({ queryKey: ['academic', 'classes'] });
    },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to add section'),
  });

  const createSubject = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch('/api/v1/academic/subjects', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      setNotice('Subject created.');
      await queryClient.invalidateQueries({ queryKey: ['academic', 'subjects'] });
    },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to create subject'),
  });

  if (yearsQuery.isLoading || classesQuery.isLoading || subjectsQuery.isLoading) {
    return <LoadingState label="Loading academic configuration..." />;
  }
  if (yearsQuery.isError || classesQuery.isError || subjectsQuery.isError) {
    return <ErrorState message="Could not load academic data." />;
  }

  const years = yearsQuery.data?.items ?? [];
  const classes = classesQuery.data?.items ?? [];
  const subjects = subjectsQuery.data?.items ?? [];

  return (
    <div className="d-flex flex-column gap-4">
      <h1 className="h3 mb-0">Academic Structure</h1>
      {notice && <div className="alert alert-info py-2 mb-0">{notice}</div>}

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm p-3 h-100">
            <h2 className="h5 mb-3">Academic Years</h2>
            <form
              className="row g-2 mb-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createYear.mutate({
                  name: String(fd.get('name') ?? ''),
                  startDate: String(fd.get('startDate') ?? ''),
                  endDate: String(fd.get('endDate') ?? ''),
                  isCurrent: fd.get('isCurrent') === 'on',
                });
                e.currentTarget.reset();
              }}
            >
              <div className="col-sm-4"><input name="name" className="form-control form-control-sm" placeholder="2026-2027" required /></div>
              <div className="col-sm-3"><input name="startDate" type="date" className="form-control form-control-sm" required /></div>
              <div className="col-sm-3"><input name="endDate" type="date" className="form-control form-control-sm" required /></div>
              <div className="col-sm-2"><button type="submit" className="btn btn-sm btn-primary w-100">Add</button></div>
              <div className="col-12">
                <label className="form-check-label small">
                  <input type="checkbox" name="isCurrent" className="form-check-input me-1" /> Set as current year
                </label>
              </div>
            </form>
            {years.length === 0 ? (
              <EmptyState title="No Academic Years" description="Create your first academic year." />
            ) : (
              <ul className="list-group list-group-flush">
                {years.map((y) => (
                  <li key={y.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                    <span>{y.name}</span>
                    {y.isCurrent && <span className="badge bg-success">Current</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card border-0 shadow-sm p-3 h-100">
            <h2 className="h5 mb-3">Subjects</h2>
            <form
              className="row g-2 mb-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createSubject.mutate({
                  name: String(fd.get('name') ?? ''),
                  code: String(fd.get('code') ?? ''),
                  isElective: fd.get('isElective') === 'on',
                });
                e.currentTarget.reset();
              }}
            >
              <div className="col-sm-5"><input name="name" className="form-control form-control-sm" placeholder="Mathematics" required /></div>
              <div className="col-sm-4"><input name="code" className="form-control form-control-sm" placeholder="MATH-101" required /></div>
              <div className="col-sm-3"><button type="submit" className="btn btn-sm btn-primary w-100">Add</button></div>
              <div className="col-12">
                <label className="form-check-label small">
                  <input type="checkbox" name="isElective" className="form-check-input me-1" /> Elective subject
                </label>
              </div>
            </form>
            <div className="d-flex flex-wrap gap-2">
              {subjects.map((s) => (
                <span key={s.id} className="badge text-bg-light border">
                  {s.name} ({s.code}){s.isElective ? ' · Elective' : ''}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card border-0 shadow-sm p-3">
            <h2 className="h5 mb-3">Classes & Sections</h2>
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <form
                  className="d-flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    createClass.mutate({ name: String(fd.get('name') ?? ''), code: String(fd.get('code') ?? '') || undefined });
                    e.currentTarget.reset();
                  }}
                >
                  <input name="name" className="form-control form-control-sm" placeholder="Class name (e.g. Grade 1)" required />
                  <input name="code" className="form-control form-control-sm" placeholder="Code (G1)" />
                  <button type="submit" className="btn btn-sm btn-primary text-nowrap">Add Class</button>
                </form>
              </div>
              <div className="col-md-6">
                <form
                  className="d-flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    createSection.mutate({ classId: selectedClassId, name: String(fd.get('sectionName') ?? '') });
                    e.currentTarget.reset();
                  }}
                >
                  <select className="form-select form-select-sm" value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} required>
                    <option value="">Select class...</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input name="sectionName" className="form-control form-control-sm" placeholder="Section (A)" required />
                  <button type="submit" className="btn btn-sm btn-outline-primary text-nowrap">Add Section</button>
                </form>
              </div>
            </div>
            <table className="table table-sm mb-0">
              <thead>
                <tr><th>Class</th><th>Sections</th></tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.sections.map((s) => s.name).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
