// lib/payslip.ts
import { jsPDF } from 'jspdf'

const EMPLOYER_NAME = 'POLIKLINIK NG PLT'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/**
 * A single employee's figures for one month. Both the live payroll table and a
 * saved payroll record map onto this shape so payslips look identical either way.
 */
export interface PayslipEmployee {
  name: string
  basicSalary: number
  epfEmployee: number
  epfEmployer: number
  socsoEmployee: number
  socsoEmployer: number
  eisEmployee: number
  eisEmployer: number
  lindung24: number
  pcb: number
  cp38: number
  netSalary: number
}

export interface PayslipPeriod {
  month: number
  year: number
}

const formatAmount = (amount: number): string =>
  amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export const formatPeriod = ({ month, year }: PayslipPeriod): string =>
  `${MONTH_NAMES[month - 1]} ${year}`

const slugify = (value: string): string =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

// A4 in millimetres
const PAGE_WIDTH = 210
const MARGIN = 18
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const RIGHT = PAGE_WIDTH - MARGIN

const drawPayslip = (doc: jsPDF, employee: PayslipEmployee, period: PayslipPeriod): void => {
  let y = MARGIN

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(EMPLOYER_NAME, PAGE_WIDTH / 2, y, { align: 'center' })

  y += 7
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Payslip', PAGE_WIDTH / 2, y, { align: 'center' })

  y += 6
  doc.setFontSize(10)
  doc.text(`For the month of ${formatPeriod(period)}`, PAGE_WIDTH / 2, y, { align: 'center' })

  y += 6
  doc.setDrawColor(150, 150, 150)
  doc.line(MARGIN, y, RIGHT, y)

  // Employee
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Employee', MARGIN, y)
  doc.setFont('helvetica', 'normal')
  doc.text(employee.name, MARGIN + 32, y)

  y += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Pay period', MARGIN, y)
  doc.setFont('helvetica', 'normal')
  doc.text(formatPeriod(period), MARGIN + 32, y)

  // Section helpers -------------------------------------------------------
  const sectionHeading = (label: string) => {
    y += 10
    doc.setFillColor(240, 240, 240)
    doc.rect(MARGIN, y - 4.5, CONTENT_WIDTH, 6.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(label, MARGIN + 2, y)
    doc.text('Amount (RM)', RIGHT - 2, y, { align: 'right' })
    y += 3
  }

  const row = (label: string, amount: number, bold = false) => {
    y += 6
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(10)
    doc.text(label, MARGIN + 2, y)
    doc.text(formatAmount(amount), RIGHT - 2, y, { align: 'right' })
  }

  const rule = () => {
    y += 2.5
    doc.setDrawColor(200, 200, 200)
    doc.line(MARGIN, y, RIGHT, y)
  }

  // Earnings
  sectionHeading('Earnings')
  row('Basic Salary', employee.basicSalary)
  rule()
  row('Gross Pay', employee.basicSalary, true)

  // Deductions
  const totalDeductions =
    employee.epfEmployee +
    employee.socsoEmployee +
    employee.eisEmployee +
    employee.lindung24 +
    employee.pcb +
    employee.cp38

  sectionHeading('Deductions')
  row('EPF (Employee)', employee.epfEmployee)
  row('SOCSO (Employee)', employee.socsoEmployee)
  row('EIS (Employee)', employee.eisEmployee)
  if (employee.lindung24 > 0) row('Lindung 24 Jam (SKBBK)', employee.lindung24)
  if (employee.pcb > 0) row('PCB', employee.pcb)
  if (employee.cp38 > 0) row('CP38', employee.cp38)
  rule()
  row('Total Deductions', totalDeductions, true)

  // Net pay
  y += 10
  doc.setFillColor(232, 240, 254)
  doc.rect(MARGIN, y - 5, CONTENT_WIDTH, 9, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Net Pay', MARGIN + 2, y + 1)
  doc.text(`RM ${formatAmount(employee.netSalary)}`, RIGHT - 2, y + 1, { align: 'right' })
  y += 4

  // Employer contributions, shown for information only
  sectionHeading('Employer Contributions (not deducted from employee)')
  row('EPF (Employer)', employee.epfEmployer)
  row('SOCSO (Employer)', employee.socsoEmployer)
  row('EIS (Employer)', employee.eisEmployer)
  rule()
  row(
    'Total Employer Contributions',
    employee.epfEmployer + employee.socsoEmployer + employee.eisEmployer,
    true,
  )

  // Footer
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(110, 110, 110)
  doc.text(
    'This is a computer generated payslip and does not require a signature.',
    PAGE_WIDTH / 2,
    280,
    { align: 'center' },
  )
  doc.setTextColor(0, 0, 0)
}

/**
 * Build a payslip PDF. Multiple employees are emitted as one page each, so the
 * same routine backs both the single-employee download and "download all".
 */
export const generatePayslipPdf = (
  employees: PayslipEmployee[],
  period: PayslipPeriod,
  filename: string,
): void => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  employees.forEach((employee, index) => {
    if (index > 0) doc.addPage()
    drawPayslip(doc, employee, period)
  })

  doc.save(filename)
}

export const payslipFilename = (employeeName: string, period: PayslipPeriod): string =>
  `Payslip_${slugify(employeeName)}_${MONTH_NAMES[period.month - 1].toUpperCase()}_${period.year}.pdf`

export const allPayslipsFilename = (period: PayslipPeriod): string =>
  `Payslips_${MONTH_NAMES[period.month - 1].toUpperCase()}_${period.year}.pdf`
