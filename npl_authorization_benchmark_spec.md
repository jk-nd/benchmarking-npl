# NPL Authorization Benchmark Specification

**Project**: Enterprise Authorization Framework Comparison  
**Goal**: Demonstrate NPL's authorization-native advantages over traditional RBAC/ABAC frameworks  
**Date**: September 2025

---

## Executive Summary

This benchmark compares NPL (Noumena Protocol Language) against traditional authorization frameworks by implementing the same complex enterprise system across multiple technology stacks. The benchmark showcases NPL's unique ability to unify business logic with authorization rules, eliminating the security vulnerabilities and code complexity inherent in traditional approaches.

**Key Hypothesis**: NPL's compiler-enforced, data-dependent authorization will result in:
- 90%+ reduction in authorization-related code
- Zero authorization bypass vulnerabilities
- 10x faster development for complex business rules
- Automatic compliance documentation generation

---

## Use Case: Enterprise Expense Approval & Reimbursement System

### Why This Use Case?

1. **Universal Understanding**: Every enterprise has expense systems
2. **Complex Authorization**: Multi-role, state-dependent, data-dependent rules
3. **Real Business Value**: Actual ROI measurable in reduced compliance risk
4. **Scalable Complexity**: Can start simple, add sophisticated rules
5. **Natural Business Logic**: Rules feel natural, not artificial

### System Overview

An expense approval system where employees submit expenses that flow through approval workflows based on complex business rules involving amounts, categories, budgets, vendor relationships, and compliance requirements.

#### Core Entities
- **Employee**: Submits expenses
- **Manager**: Approves within limits and business rules
- **Finance**: Processes payments after validation
- **Compliance**: Audits transactions and ensures regulatory compliance
- **VP/CFO**: High-value approvals

#### State Flow
```
draft → submitted → approved → paid
        ↓           ↓
    rejected ← compliance_hold
```

---

## Detailed Business Requirements

### 1. Basic Expense Submission Rules

#### Employee Permissions
```npl
permission [employee] submit() | draft → submitted {
    require(amount > 0, "Amount must be positive");
    require(amount <= getMonthlySubmissionLimit(employeeId) - 
            getMonthToDateSubmitted(employeeId),
            "Monthly submission limit exceeded");
    require(expenseDate <= today() && expenseDate >= today() - 90.days,
            "Expenses must be within 90 days");
    require(receipts.length > 0 || amount < 25.00,
            "Receipts required for amounts over $25");
    require(!isDuplicateExpense(vendorId, amount, expenseDate),
            "Potential duplicate expense detected");
}
```

#### Historical Pattern Validation
```npl
permission [employee] submitTravel() | draft → submitted 
    where expenseCategory == "TRAVEL" {
    require(getDaysSinceLastExpense(employeeId, "TRAVEL") >= 7,
            "Travel expenses can only be submitted weekly");
    require(getTravelPreApproval(employeeId, expenseDate).exists,
            "Travel must be pre-approved");
}
```

### 2. Manager Approval Rules (Data-Dependent Authorization)

#### Budget-Aware Approvals
```npl
permission [manager] approve() | submitted → approved 
    where managerId == getDirectManager(expense.employeeId)
    && amount <= getManagerApprovalLimit(managerId, seniorityLevel) {
    
    require(amount <= getRemainingBudget(department, getCurrentQuarter()),
            "Insufficient departmental budget remaining");
    require(!isVendorBlacklisted(vendorId),
            "Vendor is currently under investigation");
    require(expenseCategory != "ENTERTAINMENT" || amount <= 200,
            "Entertainment expenses over $200 require VP approval");
    require(isWorkingDay(today()),
            "Approvals can only be processed on business days");
}
```

#### Cross-Department Charging
```npl
permission [manager] chargeOtherDepartment(targetDept: String) | submitted 
    where targetDept != department {
    require(getInterDepartmentAgreement(department, targetDept).isActive(),
            "No active cost-sharing agreement exists");
    require(amount <= getAgreementLimit(department, targetDept),
            "Exceeds inter-department agreement limit");
    require(getDepartmentManager(targetDept).hasApproved(expenseId) || amount < 1000,
            "Target department manager approval required for amounts over $1000");
}
```

#### Risk-Based Approvals
```npl
permission [manager] approveHighRisk() | submitted → approved
    where amount > 5000 || getVendorRiskScore(vendorId) > 7 {
    require(hasCompletedComplianceTraining(managerId, getCurrentYear()),
            "Manager must complete annual compliance training");
    require(getManagerTenure(managerId) > 12.months,
            "High-risk approvals require manager tenure > 1 year");
    require(getQuarterlyHighRiskApprovals(managerId) < getQuarterlyLimit(managerId),
            "Manager has exceeded quarterly high-risk approval limit");
}
```

### 3. Finance Processing Rules

#### Payment Validation
```npl
permission [finance] processPayment() | approved → paid {
    require(getVendorTaxStatus(vendorId) == "VALID",
            "Vendor tax documentation expired or invalid");
    require(amount < 10000 || hasComplianceApproval(expenseId),
            "Compliance approval required for payments over $10,000");
    require(getExchangeRate(currency, expenseDate) == providedExchangeRate,
            "Exchange rate verification failed");
    require(getVendorPaymentTerms(vendorId).allowsCategory(expenseCategory),
            "Vendor contract doesn't cover this expense category");
    require(getBankHolidayStatus(targetCountry, today()) == false,
            "Cannot process payments on target country bank holidays");
}
```

#### Multi-Currency Processing
```npl
permission [finance] processInternationalPayment() | approved → paid
    where currency != "USD" {
    require(getOFACStatus(vendorId, vendorCountry) == "CLEAR",
            "Vendor requires OFAC sanctions screening clearance");
    require(getWithholdingTaxRate(vendorCountry) == calculatedTaxRate,
            "Withholding tax calculation mismatch");
    require(hasInternationalWireApproval(amount, vendorCountry),
            "International wire transfer approval required");
}
```

### 4. Compliance and Audit Rules

#### Audit Access
```npl
permission [compliance] auditReview() | any {
    require(hasValidAuditCertification(complianceOfficerId),
            "Auditor certification expired");
    return generateComplianceReport(expenseId);
}

permission [compliance] flagSuspicious(reason: String) | any → compliance_hold {
    require(getSuspiciousActivityScore(expenseId) > threshold ||
            manualReview == true,
            "Insufficient basis for suspicious activity flag");
    notify regulatoryReporting(expenseId, reason);
    become compliance_hold;
}
```

#### Regulatory Reporting
```npl
permission [compliance] generateSARReport() | compliance_hold {
    require(getSuspiciousActivityDays(expenseId) >= 30,
            "SAR reporting requires 30-day investigation period");
    require(hasManagerialApproval(SARReportId),
            "SAR reports require compliance manager approval");
    return generateSuspiciousActivityReport(expenseId);
}
```

### 5. Executive Override Rules

#### VP/CFO High-Value Approvals
```npl
permission [vp, cfo] highValueApproval() | submitted → approved
    where amount > 10000 || expenseCategory == "CAPITAL" {
    require(getExecutiveApprovalQuota(executiveId, getCurrentQuarter()) > 0,
            "Executive has exceeded quarterly approval quota");
    require(hasConflictOfInterestClearance(executiveId, vendorId),
            "Conflict of interest screening required");
    require(getBoardApprovalStatus(amount) || amount < 50000,
            "Board approval required for expenditures over $50,000");
}
```

---

## Benchmark Framework Comparison

### Frameworks to Implement

#### 1. **NPL (Baseline)**
- Authorization and business logic unified in protocol definitions
- Compile-time authorization verification
- Automatic audit trail generation
- State-based access control with data validation

#### 2. **Node.js + Express + Passport**
- Most common web application stack
- Role-based middleware with custom business rule validation
- Manual audit logging and state management
- PostgreSQL/MongoDB for data persistence

#### 3. **Ruby on Rails + Devise + Pundit**
- Popular web framework with strong conventions
- Devise for authentication, Pundit for authorization policies
- ActiveRecord ORM with AASM for state machines
- Emphasis on "Rails Way" conventions vs authorization complexity

#### 4. **Python Django + Django REST Framework**
- Popular enterprise Python stack
- Permission classes with custom business logic
- Manual state transition management
- Django ORM with custom audit middleware

#### 5. **Spring Boot + Spring Security** *(Optional - Extended Analysis)*
- Enterprise Java standard for business applications
- Annotation-based authorization with custom voters
- Aspect-oriented business rule enforcement
- JPA/Hibernate with audit trail implementation

#### 6. **C# .NET + ASP.NET Core + Identity** *(Optional - Extended Analysis)*
- Microsoft enterprise application standard
- Policy-based authorization with custom requirements
- Custom business rule validation
- Entity Framework with audit trail implementation

---

## Evaluation Metrics

### 1. Code Complexity Metrics

#### Lines of Code (LOC)
- **Authorization Logic**: Code specifically handling permissions and access control
- **Business Rule Logic**: Code implementing business constraints and validations
- **State Management**: Code handling workflow state transitions
- **Audit Trail**: Code for logging and compliance reporting
- **Total Implementation**: Complete system implementation

#### Cyclomatic Complexity
- Complexity of authorization decision paths
- Number of conditional branches in permission logic
- Maintainability index of authorization code

### 2. Security Vulnerability Assessment

#### Static Analysis
- Run security scanners (Snyk, SonarQube, Bandit) on each implementation
- Count potential authorization bypass vulnerabilities
- Identify privilege escalation opportunities
- Detect missing authorization checks

#### Dynamic Security Testing
- Authorization bypass attempts
- State manipulation attacks
- Role elevation exploits
- SQL injection in authorization logic (where applicable)
- Cross-user data access attempts

#### Security Test Scenarios
```javascript
// Example test cases each framework must pass
const securityTests = [
    {
        name: "Manager approves beyond budget limit",
        expected: "REJECT",
        test: () => attemptApprovalOverBudget()
    },
    {
        name: "Employee submits duplicate expense",
        expected: "REJECT", 
        test: () => submitDuplicateExpense()
    },
    {
        name: "Privilege escalation via state manipulation",
        expected: "REJECT",
        test: () => manipulateExpenseState()
    },
    {
        name: "Cross-user expense access",
        expected: "REJECT",
        test: () => accessOtherUserExpense()
    }
];
```

### 3. Development Velocity Metrics

#### Time-to-Implementation
- **Initial Working System**: Time to get basic functionality working
- **Add New Role**: Time to add "External Auditor" role with specific permissions
- **Modify Business Rules**: Time to change approval limits or add new constraints
- **Add Compliance Report**: Time to implement new regulatory reporting requirement

#### Developer Experience
- Setup complexity (dependencies, configuration)
- Documentation clarity and completeness
- Debugging ease when authorization fails
- IDE support and error messages

### 4. Runtime Performance Metrics

#### Authorization Performance
- Authorization check latency (p50, p95, p99)
- Requests per second with complex authorization rules
- Memory usage during authorization evaluation
- Database query count for permission checks

#### System Performance
- End-to-end transaction processing time
- State transition performance
- Audit log generation performance
- Compliance report generation time

### 5. Compliance and Audit Metrics

#### Audit Trail Completeness
- Percentage of user actions logged
- Time to generate compliance reports
- Audit trail query performance
- Data integrity verification

#### Regulatory Compliance
- Time to implement new compliance rules
- Completeness of automatically generated reports
- Human review time required for compliance validation

---

## Implementation Guidelines

### Phase 1: Core System Implementation

#### Basic Infrastructure
1. **User Management**: Authentication and role assignment
2. **Expense Entity**: Core data model with required fields
3. **State Machine**: Draft → Submitted → Approved → Paid workflow
4. **Basic Authorization**: Simple role-based permissions

#### Success Criteria
- Users can submit, approve, and process expenses
- Basic authorization prevents cross-user access
- Audit trail captures major actions

### Phase 2: Business Rule Implementation

#### Complex Authorization Rules
1. **Budget-Dependent Approvals**: Real-time budget checking
2. **Vendor Risk Assessment**: Integration with vendor scoring
3. **Cross-Department Charging**: Inter-department agreement validation
4. **Historical Pattern Rules**: Duplicate detection and frequency limits

#### Success Criteria
- All business rules from requirements implemented
- Authorization decisions based on real-time data
- Complex scenarios properly handled

### Phase 3: Advanced Features

#### Compliance and Reporting
1. **Suspicious Activity Detection**: Pattern-based flagging
2. **Regulatory Reporting**: SAR and other compliance reports
3. **Executive Overrides**: High-level approval workflows
4. **Multi-Currency Support**: International payment processing

#### Success Criteria
- Complete compliance reporting capability
- Advanced authorization scenarios working
- Performance benchmarks achieved

### Phase 4: Security and Performance Testing

#### Security Assessment
1. **Vulnerability Scanning**: Automated security analysis
2. **Penetration Testing**: Manual authorization bypass attempts
3. **Code Review**: Security-focused peer review
4. **Compliance Validation**: Regulatory requirement verification

#### Performance Optimization
1. **Load Testing**: High-volume transaction processing
2. **Authorization Performance**: Permission check optimization
3. **Database Optimization**: Query performance tuning
4. **Monitoring Setup**: Production-ready observability

---

## Expected Results

### Quantitative Predictions

| Metric | NPL | Node.js | Rails | Django | Spring* | .NET* |
|--------|-----|---------|-------|---------|---------|-------|
| **Authorization LOC** | 50-100 | 800-1200 | 600-900 | 600-1000 | 1000-1500 | 900-1300 |
| **Business Rule LOC** | 0** | 500-800 | 400-600 | 400-700 | 600-1000 | 550-850 |
| **Total System LOC** | 300-500 | 3000-4000 | 2800-3800 | 2500-3500 | 3500-5000 | 3200-4500 |
| **Security Vulnerabilities** | 0 | 3-5 | 4-6 | 3-6 | 2-4 | 2-4 |
| **Implementation Time** | 8-16 hours | 3-5 days | 3-4 days | 3-4 days | 4-6 days | 4-5 days |
| **New Rule Addition** | 15 min | 2-4 hours | 2-3 hours | 2-3 hours | 3-6 hours | 2-4 hours |

*Optional frameworks for extended analysis  
**Business rules unified with authorization in NPL

### Qualitative Advantages

#### NPL Advantages
- **Impossible Authorization Bugs**: Compiler prevents unauthorized operations
- **Unified Business Logic**: No separation between authorization and business rules
- **Automatic Audit Trails**: Complete compliance documentation generated
- **Declarative Authorization**: Intent clear from protocol definition

#### Traditional Framework Challenges
- **Authorization Scattered**: Logic spread across multiple files and layers
- **Runtime Vulnerabilities**: Authorization can be bypassed or forgotten
- **Manual Audit Implementation**: Significant effort for compliance features
- **Business Rule Duplication**: Same logic in authorization and business layers

---

## Success Criteria for Benchmark

### Primary Success Metrics
1. **Code Reduction**: >90% reduction in authorization-related code
2. **Security Improvement**: Zero authorization vulnerabilities in NPL vs 3+ in others
3. **Development Speed**: >10x faster to implement complex authorization rules
4. **Compliance Automation**: Automatic report generation vs manual implementation

### Secondary Success Metrics
1. **Performance**: Comparable or better authorization check performance
2. **Maintainability**: Easier to understand and modify authorization logic
3. **Developer Experience**: Better error messages and debugging capabilities
4. **Auditability**: Complete, automatically generated audit trails

### Demonstration Scenarios
1. **"The Impossible Bug"**: Show authorization bypass in traditional frameworks
2. **"The 15-Minute Rule"**: Add complex business rule in NPL vs hours in others  
3. **"The Compliance Report"**: Generate SOX compliance report instantly vs manual work
4. **"The Security Audit"**: Zero findings in NPL vs multiple in traditional stacks

---

## Getting Started

### Repository Structure
```
npl-authorization-benchmark/
├── specifications/
│   └── this-document.md
├── implementations/
│   ├── npl/
│   ├── nodejs-express/
│   ├── rails/
│   ├── django/
│   ├── spring-boot/          # Optional
│   └── dotnet-core/          # Optional
├── testing/
│   ├── security-tests/
│   ├── performance-tests/
│   └── compliance-tests/
├── results/
│   ├── metrics/
│   └── reports/
└── documentation/
    ├── setup-guides/
    └── api-specifications/
```

### Implementation Order
1. **Start with NPL**: Define the complete protocol and business rules
2. **Ruby on Rails Implementation**: Convention-driven framework for comparison
3. **Node.js Implementation**: Most flexible/unopinionated web stack
4. **Django Implementation**: Python alternative with different paradigms
5. **Security Testing**: Validate NPL's security advantages across primary frameworks
6. **Optional Extensions**: Spring Boot and .NET Core implementations
7. **Performance Testing**: Comprehensive benchmark across all implementations
8. **Results Analysis**: Document findings and create presentation materials

### Deliverables
1. **Working Implementations**: Complete expense systems in primary frameworks (NPL, Rails, Node.js, Django)
2. **Security Analysis Report**: Vulnerability assessment across implementations
3. **Performance Benchmark Report**: Detailed performance comparison
4. **Developer Experience Study**: Qualitative analysis of implementation experience
5. **Business Case Document**: ROI analysis for NPL adoption
6. **Optional Extensions**: Spring Boot and .NET Core implementations for broader comparison

---

## Conclusion

This benchmark will provide concrete evidence of NPL's revolutionary approach to authorization-native application development. By implementing the same complex business system across multiple traditional frameworks, we'll demonstrate NPL's ability to eliminate entire categories of security vulnerabilities while dramatically reducing code complexity and development time.

The expense approval system provides a perfect testing ground because it combines all the challenges that make traditional authorization frameworks inadequate: multi-role permissions, state-dependent access control, data-dependent business rules, and complex compliance requirements.

**Key Message**: NPL doesn't just make authorization easier—it makes authorization bugs impossible by design.

---

*Document Version: 1.0*  
*Last Updated: September 2025*  
*Next Review: Upon completion of Phase 1 implementation*