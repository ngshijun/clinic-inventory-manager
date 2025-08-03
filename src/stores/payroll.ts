// stores/payroll.ts
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { PayrollData } from '@/types/payroll'
import { defineStore } from 'pinia'
import { computed, onUnmounted, ref } from 'vue'

type Employee = Database['public']['Tables']['payroll']['Row']
type EmployeeInsert = Database['public']['Tables']['payroll']['Insert']
type EmployeeUpdate = Database['public']['Tables']['payroll']['Update']

export const usePayrollStore = defineStore('payroll', () => {
  // State
  const employees = ref<Employee[]>([])
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)

  // Getters (computed)
  const totalEmployees = computed((): number => {
    return employees.value.length
  })

  const totalBasicSalary = computed((): number => {
    return employees.value.reduce((sum, employee) => sum + employee.basic_salary, 0)
  })

  // Actions
  const fetchEmployees = async (): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const { data, error: supabaseError } = await supabase
        .from('payroll')
        .select('*')
        .order('name', { ascending: true })

      if (supabaseError) throw supabaseError
      employees.value = data || []
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'An error occurred while fetching employees'
      console.error('Error fetching employees:', err)
    } finally {
      loading.value = false
    }
  }

  const addEmployee = async (newEmployee: EmployeeInsert): Promise<Employee | null> => {
    loading.value = true
    error.value = null
    try {
      const { data, error: supabaseError } = await supabase
        .from('payroll')
        .insert([newEmployee])
        .select()
        .single()

      if (supabaseError) throw supabaseError
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while adding employee'
      console.error('Error adding employee:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  const updateEmployee = async (
    employeeId: string,
    updates: EmployeeUpdate,
  ): Promise<Employee | null> => {
    loading.value = true
    error.value = null
    try {
      const { data, error: supabaseError } = await supabase
        .from('payroll')
        .update(updates)
        .eq('id', employeeId)
        .select()
        .single()

      if (supabaseError) throw supabaseError
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while updating employee'
      console.error('Error updating employee:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  const deleteEmployee = async (employeeId: string): Promise<boolean> => {
    loading.value = true
    error.value = null
    try {
      const { error: supabaseError } = await supabase.from('payroll').delete().eq('id', employeeId)

      if (supabaseError) throw supabaseError
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while deleting employee'
      console.error('Error deleting employee:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  const getEmployeeById = (employeeId: string): Employee | undefined => {
    return employees.value.find((employee) => employee.id === employeeId)
  }

  const searchEmployees = (query: string): Employee[] => {
    if (!query) return employees.value
    return employees.value.filter((employee) =>
      employee.name.toLowerCase().includes(query.toLowerCase()),
    )
  }

  // Malaysian contribution calculation functions
  const calculateEPF = (salary: number) => {
    // EPF contribution rates: Employee 11%, Employer 12% for salary > RM5000
    // For salary <= RM5000: Employee 11%, Employer 13%
    const employeeRate = 0.11
    const employerRate = salary > 5000 ? 0.12 : 0.13

    return {
      employee: Math.round(salary * employeeRate * 100) / 100,
      employer: Math.round(salary * employerRate * 100) / 100,
    }
  }

  const calculateSOCSO = (salary: number) => {
    // SOCSO rates based on official PERKESO table (2024) - Act 4
    // Updated ceiling: RM6000 (effective Oct 1, 2024)

    // Cap salary at RM6000
    const cappedSalary = Math.min(salary, 6000)

    let employeeContribution = 0
    let employerContribution = 0

    if (cappedSalary <= 30) {
      employeeContribution = 0.1
      employerContribution = 0.4
    } else if (cappedSalary <= 50) {
      employeeContribution = 0.2
      employerContribution = 0.7
    } else if (cappedSalary <= 70) {
      employeeContribution = 0.3
      employerContribution = 1.1
    } else if (cappedSalary <= 100) {
      employeeContribution = 0.4
      employerContribution = 1.5
    } else if (cappedSalary <= 140) {
      employeeContribution = 0.6
      employerContribution = 2.1
    } else if (cappedSalary <= 200) {
      employeeContribution = 0.85
      employerContribution = 2.95
    } else if (cappedSalary <= 300) {
      employeeContribution = 1.25
      employerContribution = 4.35
    } else {
      // For salaries above RM200, SOCSO follows a pattern:
      // Employee: RM0.50 per RM100 bracket
      // Employer: RM1.80, RM1.70 cycle per RM100 bracket
      const brackets = Math.min(Math.ceil(cappedSalary / 100), 60)
      employeeContribution = 1.25 + (brackets - 3) * 0.5
      let addOn = Math.floor((brackets - 3) / 2) * 3.5
      if ((brackets - 3) % 2 !== 0) {
        addOn += 1.8
      }
      employerContribution = 4.35 + addOn
    }

    return {
      employee: employeeContribution,
      employer: employerContribution,
    }
  }

  const calculateEIS = (salary: number) => {
    // EIS rates based on official PERKESO table (2024) - Act 800
    // Updated ceiling: RM6000 (effective Oct 1, 2024)

    // Cap salary at RM6000
    const cappedSalary = Math.min(salary, 6000)

    let contribution = 0

    if (cappedSalary <= 30) {
      contribution = 0.05
    } else if (cappedSalary <= 50) {
      contribution = 0.1
    } else if (cappedSalary <= 70) {
      contribution = 0.15
    } else if (cappedSalary <= 100) {
      contribution = 0.2
    } else if (cappedSalary <= 140) {
      contribution = 0.25
    } else if (cappedSalary <= 200) {
      contribution = 0.35
    } else {
      // For salaries above RM200, EIS follows a clear pattern:
      // RM0.20 per RM100 salary bracket
      // Formula: Math.ceil(salary / 100) * 0.20
      contribution = Math.ceil(cappedSalary / 100) * 0.2 - 0.1
    }

    return {
      employee: contribution,
      employer: contribution,
    }
  }

  const generatePayrollData = (): PayrollData[] => {
    return employees.value.map((employee) => {
      const epf = calculateEPF(employee.basic_salary)
      const socso = calculateSOCSO(employee.basic_salary)
      const eis = calculateEIS(employee.basic_salary)

      return {
        employeeId: employee.id,
        employeeName: employee.name,
        basicSalary: employee.basic_salary,
        pcb: 0,
        cp38: 0,
        epfEmployee: epf.employee,
        epfEmployer: employee.epf_employer, // Use database value instead of calculated
        socsoEmployee: socso.employee,
        socsoEmployer: socso.employer,
        eisEmployee: eis.employee,
        eisEmployer: eis.employer,
      }
    })
  }

  const calculateNetSalary = (payrollItem: PayrollData): number => {
    const totalDeductions =
      (payrollItem.pcb || 0) +
      (payrollItem.cp38 || 0) +
      (payrollItem.epfEmployee || 0) +
      (payrollItem.socsoEmployee || 0) +
      (payrollItem.eisEmployee || 0)

    return payrollItem.basicSalary - totalDeductions
  }

  // Initialize store by fetching employees
  const initializeStore = async (): Promise<void> => {
    await fetchEmployees()
  }

  // Event listener for real-time updates
  const channel = supabase
    .channel('update-payroll')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll' }, (payload) => {
      if (payload.eventType === 'INSERT') {
        employees.value.unshift(payload.new as Employee)
      } else if (payload.eventType === 'UPDATE') {
        const index = employees.value.findIndex((employee) => employee.id === payload.new.id)
        if (index !== -1) employees.value[index] = payload.new as Employee
      } else if (payload.eventType === 'DELETE') {
        const index = employees.value.findIndex((employee) => employee.id === payload.old.id)
        if (index !== -1) employees.value.splice(index, 1)
      }

      // Sort by name ascending
      employees.value.sort((a, b) => a.name.localeCompare(b.name))
    })
    .subscribe()

  onUnmounted(() => {
    channel.unsubscribe()
  })

  return {
    // State
    employees,
    loading,
    error,

    // Getters
    totalEmployees,
    totalBasicSalary,

    // Actions
    fetchEmployees,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    getEmployeeById,
    searchEmployees,
    generatePayrollData,
    calculateEPF,
    calculateNetSalary,
    initializeStore,
  }
})

// Re-export types for convenience
export type { PayrollData } from '@/types/payroll'
export type { Employee, EmployeeInsert, EmployeeUpdate }
