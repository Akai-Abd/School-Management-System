import PDFDocument from 'pdfkit';

function renderPdf(draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    draw(doc);
    doc.end();
  });
}

export function buildReceiptPdf(input: {
  schoolName: string;
  receiptNumber: string;
  paymentDate: string;
  studentName: string;
  admissionNumber: string;
  amount: string;
  mode: string;
  allocations: Array<{ invoiceNumber: string; amount: string }>;
}): Promise<Buffer> {
  return renderPdf((doc) => {
    doc.fontSize(18).text(input.schoolName, { align: 'center' });
    doc.fontSize(12).text('Fee Payment Receipt', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Receipt No: ${input.receiptNumber}`);
    doc.text(`Payment Date: ${input.paymentDate}`);
    doc.text(`Student: ${input.studentName} (${input.admissionNumber})`);
    doc.text(`Payment Mode: ${input.mode.toUpperCase()}`);
    doc.text(`Total Paid: ${input.amount}`);
    doc.moveDown();
    doc.fontSize(11).text('Invoice Allocations');
    doc.fontSize(10);
    if (input.allocations.length === 0) {
      doc.text('Held as unallocated student credit');
    } else {
      for (const alloc of input.allocations) {
        doc.text(`- ${alloc.invoiceNumber}: ${alloc.amount}`);
      }
    }
  });
}

export function buildReportCardPdf(input: {
  schoolName: string;
  studentName: string;
  admissionNumber: string;
  results: Array<{
    examName: string;
    subjectName: string;
    status: string;
    marksObtained: string | null;
    maxMarks: string;
    passingMarks: string;
  }>;
}): Promise<Buffer> {
  return renderPdf((doc) => {
    doc.fontSize(18).text(input.schoolName, { align: 'center' });
    doc.fontSize(12).text('Student Report Card (Published Results)', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Student: ${input.studentName}`);
    doc.text(`Admission No: ${input.admissionNumber}`);
    doc.moveDown();
    if (input.results.length === 0) {
      doc.text('No published results available.');
    } else {
      for (const r of input.results) {
        const score = r.status === 'present' ? `${r.marksObtained ?? 0} / ${r.maxMarks}` : r.status.toUpperCase();
        doc.text(`${r.examName} — ${r.subjectName}: ${score} (Pass: ${r.passingMarks})`);
      }
    }
  });
}
