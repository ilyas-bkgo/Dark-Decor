import type { DbOrder } from './orders';
import { formatCasablancaDateTimeForExport } from './dateTime.ts';

const spreadsheetTextPrefix = /^[=+\-@\t\r]/;
const statusLabels: Record<DbOrder['status'], string> = {
  new: 'جديد',
  confirmed: 'مؤكد',
  shipped: 'تم الشحن',
  delivered: 'تم التوصيل',
  canceled: 'ملغي',
};

export function safeSpreadsheetText(value: string | null): string {
  if (value === null) return '';
  return spreadsheetTextPrefix.test(value) ? `'${value}` : value;
}

export async function createOrdersWorkbook(orders: readonly DbOrder[]) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dark Decor';

  const worksheet = workbook.addWorksheet('الطلبات', {
    views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }],
  });
  worksheet.columns = [
    { header: 'رقم الطلب', key: 'id', width: 38, style: { numFmt: '@' } },
    { header: 'الاسم الكامل', key: 'full_name', width: 24, style: { numFmt: '@' } },
    { header: 'رقم الهاتف', key: 'phone', width: 18, style: { numFmt: '@' } },
    { header: 'المدينة', key: 'city', width: 18, style: { numFmt: '@' } },
    { header: 'العنوان', key: 'address', width: 36, style: { numFmt: '@' } },
    { header: 'الكمية', key: 'quantity', width: 10 },
    { header: 'الإجمالي (درهم)', key: 'total_dh', width: 18 },
    { header: 'الحالة', key: 'status', width: 14, style: { numFmt: '@' } },
    { header: 'ملاحظة العميل', key: 'note', width: 32, style: { numFmt: '@' } },
    { header: 'ملاحظة الإدارة', key: 'admin_note', width: 32, style: { numFmt: '@' } },
    { header: 'تاريخ الطلب', key: 'created_at', width: 25, style: { numFmt: '@' } },
  ];

  const header = worksheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 30;

  for (const order of orders) {
    worksheet.addRow({
      id: safeSpreadsheetText(order.id),
      full_name: safeSpreadsheetText(order.full_name),
      phone: safeSpreadsheetText(order.phone),
      city: safeSpreadsheetText(order.city),
      address: safeSpreadsheetText(order.address),
      quantity: order.quantity,
      total_dh: order.total_dh,
      status: safeSpreadsheetText(statusLabels[order.status]),
      note: safeSpreadsheetText(order.note),
      admin_note: safeSpreadsheetText(order.admin_note),
      created_at: safeSpreadsheetText(formatCasablancaDateTimeForExport(order.created_at)),
    });
  }

  return workbook;
}

export async function downloadOrdersWorkbook(orders: readonly DbOrder[], filename: string): Promise<void> {
  const workbook = await createOrdersWorkbook(orders);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
