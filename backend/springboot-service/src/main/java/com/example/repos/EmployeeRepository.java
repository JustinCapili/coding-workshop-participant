package com.example.repos;

import com.example.classes.Employee;

/**
 * Storage for plain employees: staff who file reports and are neither engineers nor faculty admins.
 *
 * Holds only rows whose role is EMPLOYEE. Engineers and faculty admins are also {@link Employee}s in
 * the Java model, but each has a repository of its own, and this one never returns them.
 */
public interface EmployeeRepository extends Repository<Employee> {
}
