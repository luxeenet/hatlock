// PDF Document Generator
// Handles:
// 1. Hire Purchase Agreement Contract (with transfer clause)
// 2. Rental Agreement Contract (with ownership retention clause)
// 3. Official Certificate of Ownership Transfer (Hire Purchase completion)
// 4. Payment Receipts

import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma.js';

export async function generateOwnershipCertificate(agreementId: string): Promise<Buffer> {
  const agreement = await prisma.financingAgreement.findUnique({
    where: { id: agreementId },
    include: {
      business: true,
      customer: true,
      device: true
    }
  });

  if (!agreement) {
    throw new Error('Financing agreement not found');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header styling
    doc.rect(0, 0, doc.page.width, 100).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
      .text('CERTIFICATE OF OWNERSHIP TRANSFER', 50, 35, { align: 'center' });
    doc.fontSize(11).font('Helvetica')
      .text('HatLock by Luxeenet — Official Financial Discharge', { align: 'center' });

    doc.moveDown(4);
    doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold')
      .text('THIS IS TO CERTIFY THAT:', 50, 140);

    doc.moveDown();
    doc.fontSize(11).font('Helvetica')
      .text(`Agreement Number: ${agreement.agreementNumber}`)
      .text(`Issued by: ${agreement.business.name}`)
      .text(`Date of Transfer: ${new Date().toLocaleDateString()}`)
      .moveDown()
      .text(`Customer Name: ${agreement.customer.firstName} ${agreement.customer.lastName}`)
      .text(`Customer ID Number: ${agreement.customer.nationalId || 'N/A'}`)
      .text(`Contact: ${agreement.customer.email} | ${agreement.customer.phone}`)
      .moveDown()
      .font('Helvetica-Bold')
      .text('DEVICE DETAILS:')
      .font('Helvetica')
      .text(`Manufacturer: ${agreement.device.manufacturer}`)
      .text(`Model: ${agreement.device.model}`)
      .text(`Serial Number: ${agreement.device.serialNumber}`)
      .moveDown(2);

    // Boxed Declaration
    doc.rect(50, doc.y, 495, 120).strokeColor('#22c55e').lineWidth(2).stroke();
    doc.fillColor('#15803d').fontSize(12).font('Helvetica-Bold')
      .text('FULL OWNERSHIP DISCHARGE & DEVICE UNLOCK', 65, doc.y + 15);
    doc.fillColor('#334155').fontSize(10).font('Helvetica')
      .text(
        'All contractual financial obligations, instalments, and fees associated with this laptop ' +
        'have been verified and fully settled in accordance with the Hire Purchase Agreement terms. ' +
        'Title, legal ownership, and unrestricted usage rights of the aforementioned device are hereby ' +
        'permanently transferred to the customer. All financing locks and restrictions are permanently revoked.',
        65, doc.y + 10, { width: 465 }
      );

    doc.moveDown(5);
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#64748b')
      .text('Authorized Digital Signature — HatLock Platform Automated Ledger', 50, doc.y + 40);

    doc.end();
  });
}

export async function generateRentalContractPdf(agreementId: string): Promise<Buffer> {
  const agreement = await prisma.rentalAgreement.findUnique({
    where: { id: agreementId },
    include: {
      business: true,
      customer: true,
      device: true
    }
  });

  if (!agreement) throw new Error('Rental agreement not found');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.rect(0, 0, doc.page.width, 80).fill('#1e1b4b');
    doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
      .text('EQUIPMENT RENTAL AGREEMENT', 50, 30, { align: 'center' });

    doc.moveDown(3);
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica')
      .text(`Agreement Number: ${agreement.agreementNumber}`, 50, 110)
      .text(`Lessor (Business): ${agreement.business.name}`)
      .text(`Lessee (Customer): ${agreement.customer.firstName} ${agreement.customer.lastName}`)
      .text(`Device: ${agreement.device.manufacturer} ${agreement.device.model} (S/N: ${agreement.device.serialNumber})`)
      .moveDown();

    // Critical Ownership Retention Notice
    doc.rect(50, doc.y, 495, 70).fillAndStroke('#fef2f2', '#ef4444');
    doc.fillColor('#b91c1c').fontSize(11).font('Helvetica-Bold')
      .text('IMPORTANT: OWNERSHIP RETENTION NOTICE', 60, doc.y + 10);
    doc.fontSize(9).font('Helvetica')
      .text(
        'This is a rental contract. Ownership of the laptop remains strictly with the Lessor at all times. ' +
        'Completion of rental payments does NOT convey ownership to the Lessee. Upon expiration or termination, ' +
        'the laptop and all accessories must be returned in good working order.',
        60, doc.y + 5, { width: 475 }
      );

    doc.end();
  });
}
