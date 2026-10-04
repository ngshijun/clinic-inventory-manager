// lib/payslip.ts
import { jsPDF } from 'jspdf'

export const EMPLOYER_NAME = 'POLIKLINIK NG PLT'

export const MONTH_NAMES = [
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
const RIGHT = PAGE_WIDTH - MARGIN
const AMOUNT_WIDTH = 25
const ROW_HEIGHT = 8.2

type Colour = [number, number, number]

// One colour, used for the employer name, the section headings and net pay
const TEAL: Colour = [15, 92, 110]
const TINT: Colour = [231, 241, 243]
const INK: Colour = [17, 17, 17]
const MUTED: Colour = [106, 106, 106]
const RULE: Colour = [200, 200, 200]
const HAIRLINE: Colour = [227, 230, 231]

const drawPayslip = (doc: jsPDF, employee: PayslipEmployee, period: PayslipPeriod): void => {
	const write = (
		text: string,
		x: number,
		y: number,
		size: number,
		style: 'normal' | 'bold' | 'italic',
		colour: Colour,
		align: 'left' | 'right' = 'left',
	) => {
		doc.setFont('helvetica', style)
		doc.setFontSize(size)
		doc.setTextColor(...colour)
		doc.text(text, x, y, { align })
	}

	const rule = (y: number, colour: Colour, width: number) => {
		doc.setDrawColor(...colour)
		doc.setLineWidth(width)
		doc.line(MARGIN, y, RIGHT, y)
	}

	// Letterhead
	let y = MARGIN + 5
	write(EMPLOYER_NAME, MARGIN, y, 15, 'bold', TEAL)
	write('Payslip', RIGHT, y - 5.5, 8, 'normal', MUTED, 'right')
	write(formatPeriod(period), RIGHT, y, 12, 'bold', INK, 'right')
	y += 4
	rule(y, TEAL, 0.6)

	// Employee, with net pay beside the name as the first figure read
	const netPay = `RM ${formatAmount(employee.netSalary)}`
	doc.setFont('helvetica', 'bold')
	doc.setFontSize(21)
	const boxWidth = Math.max(53, doc.getTextWidth(netPay) + 10)
	const boxLeft = RIGHT - boxWidth
	const boxTop = y + 5
	const boxHeight = 20
	doc.setFillColor(...TINT)
	doc.roundedRect(boxLeft, boxTop, boxWidth, boxHeight, 1.8, 1.8, 'F')
	write('Net pay', RIGHT - 5, boxTop + 6, 8, 'normal', MUTED, 'right')
	write(netPay, RIGHT - 5, boxTop + 15.5, 21, 'bold', TEAL, 'right')

	doc.setFont('helvetica', 'bold')
	doc.setFontSize(12.5)
	doc.setTextColor(...INK)
	const nameLines: string[] = doc.splitTextToSize(employee.name, boxLeft - MARGIN - 6)
	doc.text(nameLines, MARGIN, boxTop + boxHeight / 2 + 1.5 - (nameLines.length - 1) * 2.6)
	y = boxTop + boxHeight + 6

	// Section helpers -------------------------------------------------------
	const heading = (label: string, unit = false) => {
		write(label, MARGIN, y + 4, 10, 'bold', TEAL)
		if (unit) write('RM', RIGHT, y + 4, 8, 'normal', MUTED, 'right')
		y += 6.5
		rule(y, RULE, 0.2)
	}

	const row = (label: string, amount: number) => {
		write(label, MARGIN, y + 5.4, 10, 'normal', INK)
		write(formatAmount(amount), RIGHT, y + 5.4, 10, 'normal', INK, 'right')
		y += ROW_HEIGHT
		rule(y, HAIRLINE, 0.1)
	}

	// A total sits under a thin dark rule, its label beside the amount
	const total = (label: string, amount: number) => {
		rule(y, INK, 0.2)
		write(label, RIGHT - AMOUNT_WIDTH, y + 5.4, 10, 'bold', INK, 'right')
		write(formatAmount(amount), RIGHT, y + 5.4, 10, 'bold', INK, 'right')
		y += ROW_HEIGHT + 5
	}

	heading('Earnings', true)
	row('Basic salary', employee.basicSalary)
	total('Total earnings', employee.basicSalary)

	heading('Deductions')
	row('Employee EPF', employee.epfEmployee)
	row('Employee SOCSO', employee.socsoEmployee)
	row('Employee EIS', employee.eisEmployee)
	if (employee.lindung24 > 0) row('Lindung 24 Jam (SKBBK)', employee.lindung24)
	if (employee.pcb > 0) row('PCB', employee.pcb)
	if (employee.cp38 > 0) row('CP38', employee.cp38)
	total(
		'Total deductions',
		employee.epfEmployee +
			employee.socsoEmployee +
			employee.eisEmployee +
			employee.lindung24 +
			employee.pcb +
			employee.cp38,
	)

	heading('Employer contributions')
	row('EPF', employee.epfEmployer)
	row('SOCSO', employee.socsoEmployer)
	row('EIS', employee.eisEmployer)
	total(
		'Total employer contributions',
		employee.epfEmployer + employee.socsoEmployer + employee.eisEmployer,
	)

	write('Computer generated. No signature needed.', MARGIN, y + 4, 8, 'italic', MUTED)
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
