import type { Borders, Fill, Font, Workbook, Worksheet } from 'exceljs'
import {
	EMPLOYER_NAME,
	MONTH_NAMES,
	formatPeriod,
	type PayslipEmployee,
	type PayslipPeriod,
} from '$lib/payslip'

/*
 * The payroll summary: a month as a table, one row per employee and a total
 * row, styled to read like the payslip. The amounts are numbers, so the sheet
 * can be summed and filtered. The accountant's journal is in payrollExcel.ts
 * and is left plain, since it is copied into the accounting software.
 */

/** The amount columns, in the order Payroll History shows them. `group` puts a pair under one heading. */
const COLUMNS: {
	group?: string
	label: string
	amountOf: (employee: PayslipEmployee) => number
}[] = [
	{ label: 'Basic salary', amountOf: (employee) => employee.basicSalary },
	{ group: 'EPF', label: 'Employer', amountOf: (employee) => employee.epfEmployer },
	{ group: 'EPF', label: 'Employee', amountOf: (employee) => employee.epfEmployee },
	{ group: 'SOCSO', label: 'Employer', amountOf: (employee) => employee.socsoEmployer },
	{ group: 'SOCSO', label: 'Employee', amountOf: (employee) => employee.socsoEmployee },
	{ group: 'EIS', label: 'Employer', amountOf: (employee) => employee.eisEmployer },
	{ group: 'EIS', label: 'Employee', amountOf: (employee) => employee.eisEmployee },
	{ label: 'Lindung 24 Jam', amountOf: (employee) => employee.lindung24 },
	{ label: 'PCB', amountOf: (employee) => employee.pcb },
	{ label: 'CP38', amountOf: (employee) => employee.cp38 },
	{ label: 'Net pay', amountOf: (employee) => employee.netSalary },
]

// The payslip's colours, as Excel writes them
const TEAL = 'FF0F5C6E'
const TINT = 'FFE7F1F3'
const INK = 'FF111111'
const MUTED = 'FF6A6A6A'
const HAIRLINE = 'FFE3E6E7'
const DIVIDER = 'FFC3CFD2'
const TOTAL_FILL = 'FFF6F9FA'

/** Two decimals, and a dash for zero so the figures that apply stand out; the cell still holds 0 */
const AMOUNT_FORMAT = '#,##0.00;-#,##0.00;"–"'

const GROUP_ROW = 4
const HEAD_ROW = 5
const FIRST_COLUMN = 2
const LAST_COLUMN = COLUMNS.length + 1

const fill = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

/** Excel needs the face and size on every font it is given, or the cell falls back to another */
const font = (style: Partial<Font> = {}): Partial<Font> => ({ name: 'Calibri', size: 11, ...style })

const addSummarySheet = (
	workbook: Workbook,
	name: string,
	period: PayslipPeriod,
	employees: PayslipEmployee[],
): Worksheet => {
	const sheet = workbook.addWorksheet(name, {
		// The headings and the names stay in view while scrolling
		views: [{ state: 'frozen', xSplit: 1, ySplit: HEAD_ROW }],
		pageSetup: {
			paperSize: 9,
			orientation: 'landscape',
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			printTitlesRow: `${GROUP_ROW}:${HEAD_ROW}`,
		},
	})
	sheet.columns = [{ width: 34 }, ...COLUMNS.map(() => ({ width: 15 }))]

	sheet.getCell(1, 1).value = EMPLOYER_NAME
	sheet.getCell(1, 1).font = font({ bold: true, size: 14, color: { argb: TEAL } })
	sheet.getRow(1).height = 22
	sheet.getCell(2, 1).value = `Payroll summary, ${formatPeriod(period)}`
	sheet.getCell(2, 1).font = font({ color: { argb: MUTED } })

	// Heading rows: a group name over each employer and employee pair, then the column names
	sheet.getCell(HEAD_ROW, 1).value = 'Employee'
	COLUMNS.forEach((column, i) => {
		const col = FIRST_COLUMN + i
		sheet.getCell(HEAD_ROW, col).value = column.label
		if (column.group && COLUMNS[i - 1]?.group !== column.group) {
			sheet.mergeCells(GROUP_ROW, col, GROUP_ROW, col + 1)
			sheet.getCell(GROUP_ROW, col).value = column.group
		}
	})
	for (let col = 1; col <= LAST_COLUMN; col++) {
		const group = sheet.getCell(GROUP_ROW, col)
		group.fill = fill(TINT)
		group.font = font({ bold: true, color: { argb: TEAL } })
		group.alignment = { horizontal: 'center' }
		const head = sheet.getCell(HEAD_ROW, col)
		head.fill = fill(TINT)
		head.font = font({ bold: true, color: { argb: INK } })
		head.alignment = { horizontal: col === 1 ? 'left' : 'right' }
		head.border = { bottom: { style: 'medium', color: { argb: TEAL } } }
	}

	/** One line of the table: an employee, or the total. */
	const addRow = (label: string, amounts: number[], total: boolean): void => {
		const row = sheet.addRow([label, ...amounts])
		row.eachCell((cell, col) => {
			const border: Partial<Borders> = total
				? { top: { style: 'thin', color: { argb: INK } } }
				: { bottom: { style: 'hair', color: { argb: HAIRLINE } } }
			// A light rule before each pair, and before the figures that follow them
			const column = COLUMNS[col - FIRST_COLUMN]
			const previous = COLUMNS[col - FIRST_COLUMN - 1]
			if (column && previous && column.group !== previous.group) {
				border.left = { style: 'thin', color: { argb: DIVIDER } }
			}
			cell.border = border
			if (col > 1) cell.numFmt = AMOUNT_FORMAT
			if (total) {
				cell.font = font({ bold: true })
				cell.fill = fill(TOTAL_FILL)
			}
			if (col === LAST_COLUMN) {
				cell.font = font({ bold: true })
				cell.fill = fill(TINT)
			}
		})
	}

	for (const employee of employees) {
		addRow(
			employee.name,
			COLUMNS.map((column) => column.amountOf(employee)),
			false,
		)
	}
	addRow(
		'Total',
		COLUMNS.map((column) => {
			const sum = employees.reduce((running, employee) => running + column.amountOf(employee), 0)
			return Math.round(sum * 100) / 100
		}),
		true,
	)
	return sheet
}

const upperMonth = (month: number): string => MONTH_NAMES[month - 1].toUpperCase()

/** The library is large, so it is fetched when a summary is first downloaded */
const newWorkbook = async (): Promise<Workbook> => new (await import('exceljs')).default.Workbook()

const save = async (workbook: Workbook, filename: string): Promise<void> => {
	const buffer = await workbook.xlsx.writeBuffer()
	const url = URL.createObjectURL(
		new Blob([buffer], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		}),
	)
	const link = document.createElement('a')
	link.href = url
	link.download = filename
	link.click()
	URL.revokeObjectURL(url)
}

export const exportPayrollSummary = async (
	employees: PayslipEmployee[],
	period: PayslipPeriod,
): Promise<void> => {
	const workbook = await newWorkbook()
	const name = `${upperMonth(period.month)} ${period.year}`
	addSummarySheet(workbook, name, period, employees)
	await save(workbook, `Payroll_Summary_${upperMonth(period.month)}_${period.year}.xlsx`)
}

/** A year's saved months in one file: a summary sheet for each, January first. */
export const exportPayrollYearSummary = async (
	months: { month: number; employees: PayslipEmployee[] }[],
	year: number,
): Promise<void> => {
	const workbook = await newWorkbook()
	for (const { month, employees } of [...months].sort((a, b) => a.month - b.month)) {
		addSummarySheet(workbook, upperMonth(month), { month, year }, employees)
	}
	await save(workbook, `Payroll_Summary_${year}.xlsx`)
}
