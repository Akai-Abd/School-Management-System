import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

interface BookItem {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  copies: Array<{ id: string; accessionNumber: string; status: string }>;
}

export function LibraryPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const booksQuery = useQuery({ queryKey: ['library', 'books'], queryFn: () => apiFetch<{ items: BookItem[] }>('/api/v1/library/books') });
  const issuesQuery = useQuery({
    queryKey: ['library', 'issues'],
    queryFn: () => apiFetch<{ items: Array<{ id: string; dueDate: string; returnedAt: string | null; fineAmount: string; copy: { accessionNumber: string; book: { title: string } } }> }>('/api/v1/library/issues'),
  });

  const addBook = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch('/api/v1/library/books', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => { setNotice('Book and copy added.'); await queryClient.invalidateQueries({ queryKey: ['library'] }); },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to add book'),
  });

  const returnCopy = useMutation({
    mutationFn: (id: string) => apiFetch<{ fineAmount: number }>(`/api/v1/library/issues/${id}/return`, { method: 'POST' }),
    onSuccess: async (r) => { setNotice(`Book returned. Overdue fine: ${r.fineAmount}`); await queryClient.invalidateQueries({ queryKey: ['library'] }); },
  });

  if (booksQuery.isLoading) return <LoadingState label="Loading library..." />;
  if (booksQuery.isError) return <ErrorState message="Could not load library catalogue." />;

  return (
    <div className="d-flex flex-column gap-4">
      <h1 className="h3 mb-0">Library Management</h1>
      {notice && <div className="alert alert-info py-2 mb-0">{notice}</div>}

      <form className="card border-0 shadow-sm p-3" onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        addBook.mutate({
          title: String(fd.get('title') ?? ''),
          author: String(fd.get('author') ?? ''),
          isbn: String(fd.get('isbn') ?? '') || undefined,
          accessionNumbers: [String(fd.get('accession') ?? '')],
        });
        e.currentTarget.reset();
      }}>
        <h2 className="h6 mb-2">Add Book & Accession Copy</h2>
        <div className="row g-2">
          <div className="col-md-4"><input name="title" className="form-control form-control-sm" placeholder="Book Title" required /></div>
          <div className="col-md-3"><input name="author" className="form-control form-control-sm" placeholder="Author" required /></div>
          <div className="col-md-2"><input name="isbn" className="form-control form-control-sm" placeholder="ISBN" /></div>
          <div className="col-md-2"><input name="accession" className="form-control form-control-sm" placeholder="ACC-001" required /></div>
          <div className="col-md-1"><button type="submit" className="btn btn-sm btn-primary w-100">Add</button></div>
        </div>
      </form>

      <div className="card border-0 shadow-sm p-3">
        <h2 className="h5 mb-3">Catalogue</h2>
        {!(booksQuery.data?.items.length) ? (
          <EmptyState title="No Books" description="Add books to the library catalogue above." />
        ) : (
          <table className="table table-sm mb-0">
            <thead><tr><th>Title</th><th>Author</th><th>Copies</th></tr></thead>
            <tbody>
              {booksQuery.data.items.map((b) => (
                <tr key={b.id}>
                  <td>{b.title}</td>
                  <td>{b.author}</td>
                  <td>{b.copies.map((c) => `${c.accessionNumber} (${c.status})`).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(issuesQuery.data?.items.length ?? 0) > 0 && (
        <div className="card border-0 shadow-sm p-3">
          <h2 className="h5 mb-3">Issues</h2>
          <table className="table table-sm mb-0">
            <thead><tr><th>Book</th><th>Copy</th><th>Due Date</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {issuesQuery.data!.items.map((iss) => (
                <tr key={iss.id}>
                  <td>{iss.copy.book.title}</td>
                  <td><code>{iss.copy.accessionNumber}</code></td>
                  <td>{iss.dueDate.slice(0, 10)}</td>
                  <td>{iss.returnedAt ? `Returned (Fine: ${iss.fineAmount})` : 'Issued'}</td>
                  <td>{!iss.returnedAt && <button type="button" className="btn btn-sm btn-outline-primary py-0" onClick={() => returnCopy.mutate(iss.id)}>Return</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
