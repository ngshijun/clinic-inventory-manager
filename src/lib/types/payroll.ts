// Employee interfaces
export interface Employee {
	id: string
	name: string
	basic_salary: number
	lindung_24_jam: boolean
}

export interface NewEmployee {
	name: string
	basic_salary: number
	lindung_24_jam: boolean
}

export interface EmployeeUpdate {
	id?: string
	name?: string
	basic_salary?: number
	lindung_24_jam?: boolean
}

// Payroll processing types
export interface PayrollData {
	employeeId: string
	employeeName: string
	basicSalary: number
	pcb: number
	cp38: number
	epfEmployee: number
	epfEmployer: number
	socsoEmployee: number
	socsoEmployer: number
	eisEmployee: number
	eisEmployer: number
	lindung24: number
}

export interface PayrollSummary {
	totalEmployees: number
	totalBasicSalary: number
	totalPcb: number
	totalCp38: number
	totalEpfEmployee: number
	totalEpfEmployer: number
	totalSocsoEmployee: number
	totalSocsoEmployer: number
	totalEisEmployee: number
	totalEisEmployer: number
	totalLindung24: number
	totalNetSalary: number
}

export interface MonthlyPayroll {
	month: string
	year: number
	employees: PayrollData[]
	summary: PayrollSummary
}

export interface PayrollExportData {
	month: string
	year: number
	employees: Array<{
		name: string
		basicSalary: number
		pcb: number
		cp38: number
		epfEmployee: number
		epfEmployer: number
		socsoEmployee: number
		socsoEmployer: number
		eisEmployee: number
		eisEmployer: number
		lindung24: number
		netSalary: number
	}>
	summary: PayrollSummary
}

// Utility types for forms
export interface PayrollFormData {
	employeeId: string
	pcb: number
	cp38: number
	epfEmployee: number
	epfEmployer: number
	socsoEmployee: number
	socsoEmployer: number
	eisEmployee: number
	eisEmployer: number
	lindung24: number
}

// Enums for salary status
export enum SalaryVisibility {
	HIDDEN = 'hidden',
	VISIBLE = 'visible',
}

export enum PayrollStatus {
	DRAFT = 'draft',
	PROCESSED = 'processed',
	EXPORTED = 'exported',
}

// Saved monthly payroll records
export interface PayrollRunItem {
	employeeId: string | null
	employeeName: string
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

export interface PayrollRun {
	id: string
	year: number
	month: number
	finalizedAt: string
	items: PayrollRunItem[]
}

// Everything a payslip needs that is not on the line item itself
export interface PayslipContext {
	month: number
	year: number
	employerName: string
}
