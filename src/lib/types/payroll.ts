// Employee interfaces
export interface Employee {
	id: string
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
	/** Null for a saved row tied to no employee */
	employeeId: string | null
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
