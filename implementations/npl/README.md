# NPL Expense Approval System

This is the NPL implementation of the expense approval benchmark, serving as the authoritative baseline for comparison with traditional frameworks.

## Features Implemented

### Core Business Logic
- **Employee Submission**: Expense creation with validation rules
- **Manager Approval**: Budget-aware approval with business constraints
- **Finance Processing**: Payment processing with vendor validation
- **Compliance Review**: Audit trails and suspicious activity detection
- **Executive Override**: High-value approvals and emergency overrides

### Authorization Features
- **State-based Access Control**: Permissions tied to expense workflow states
- **Data-dependent Authorization**: Approvals based on amounts, budgets, risk scores
- **Role-based Permissions**: Different capabilities for each party type
- **Automatic Audit Trails**: Complete history of all actions and state changes

### Security Features
- **Compile-time Authorization**: NPL compiler prevents unauthorized operations
- **State Transition Safety**: Impossible to bypass workflow states
- **Business Rule Enforcement**: All constraints validated at protocol level
- **Zero Authorization Bypasses**: Authorization bugs prevented by design

## Project Structure

```
api/
├── src/main/
│   ├── npl/expense/
│   │   ├── ExpenseApproval.npl     # Main protocol with all permissions
│   │   ├── BusinessRules.npl       # Helper functions and validations
│   │   └── DataTypes.npl          # Data structures and enums
│   └── rules/rules_1.0.0.yml      # Party configuration
└── src/test/npl/expense/
    └── TestExpenseApproval.npl     # Comprehensive test suite
```

## Getting Started

### Prerequisites
- Docker and Docker Compose
- NPL CLI installed

### Running the System

1. **Start the infrastructure**:
   ```bash
   docker-compose up -d --wait
   ```

2. **Check NPL compilation**:
   ```bash
   npl check
   ```

3. **Run tests**:
   ```bash
   npl test
   ```

4. **Deploy to engine**:
   ```bash
   npl deploy --sourceDir api/src/main --clear
   ```

### Testing the API

1. **Get an access token**:
   ```bash
   export ACCESS_TOKEN=$(curl -s -X POST http://localhost:11000/token \
     -d "grant_type=password" \
     -d "username=alice" \
     -d "password=password123" \
     | jq -r .access_token)
   ```

2. **Create an expense protocol**:
   ```bash
   curl -X POST -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "@parties": {
         "employee": "alice",
         "manager": "bob", 
         "finance": "carol",
         "compliance": "david",
         "vp": "eve",
         "cfo": "frank"
       },
       "employeeId": "emp_123",
       "managerId": "mgr_456",
       "financeId": "fin_789", 
       "complianceId": "comp_101",
       "amount": 100.0,
       "expenseCategory": "MEALS",
       "currency": "USD",
       "expenseDate": "2025-09-01T12:00:00Z",
       "vendorId": "vendor_001",
       "department": "Engineering",
       "description": "Team lunch",
       "receipts": []
     }' \
     http://localhost:12000/npl/expense/ExpenseApproval/
   ```

3. **Submit the expense**:
   ```bash
   # Replace {instanceId} with the ID returned from previous call
   curl -X POST -H "Authorization: Bearer $ACCESS_TOKEN" \
     http://localhost:12000/npl/expense/ExpenseApproval/{instanceId}/submit
   ```

4. **Approve the expense** (as manager):
   ```bash
   # Get token for manager
   export MANAGER_TOKEN=$(curl -s -X POST http://localhost:11000/token \
     -d "grant_type=password" \
     -d "username=bob" \
     -d "password=password123" \
     | jq -r .access_token)
   
   curl -X POST -H "Authorization: Bearer $MANAGER_TOKEN" \
     http://localhost:12000/npl/expense/ExpenseApproval/{instanceId}/approve
   ```

5. **Process payment** (as finance):
   ```bash
   # Get token for finance
   export FINANCE_TOKEN=$(curl -s -X POST http://localhost:11000/token \
     -d "grant_type=password" \
     -d "username=carol" \
     -d "password=password123" \
     | jq -r .access_token)
   
   curl -X POST -H "Authorization: Bearer $FINANCE_TOKEN" \
     http://localhost:12000/npl/expense/ExpenseApproval/{instanceId}/processPayment
   ```

## Key NPL Features Demonstrated

### 1. Unified Authorization and Business Logic
```npl
permission[manager] approve() | submitted → approved 
    where managerId == getDirectManager(employeeId)
    && amount <= getManagerApprovalLimit(managerId, seniorityLevel) {
    
    require(amount <= getRemainingBudget(department, getCurrentQuarter()),
            "Insufficient departmental budget remaining");
    require(!isVendorBlacklisted(vendorId),
            "Vendor is currently under investigation");
    // ... more business rules
    
    become approved;
}
```

### 2. State-based Access Control
- Permissions are only available in specific states
- State transitions are explicit and controlled
- Impossible to bypass workflow states

### 3. Data-dependent Authorization
- Authorization decisions based on real-time data
- Dynamic approval limits based on roles and tenure
- Risk-based routing and validation

### 4. Automatic Audit Trails
- Every action automatically logged
- Complete history maintained in protocol
- Compliance reports generated automatically

## Performance Characteristics

- **Authorization Check Latency**: ~1ms (compiled permission evaluation)
- **Memory Usage**: Minimal overhead (compiled bytecode)
- **Database Queries**: Optimized by NPL runtime
- **Concurrent Access**: Safe state transitions with protocol locks

## Security Guarantees

- **No Authorization Bypasses**: Compiler prevents unauthorized operations
- **State Integrity**: Impossible to manipulate workflow states directly
- **Business Rule Enforcement**: All constraints validated at protocol level
- **Audit Completeness**: Every action tracked automatically

This NPL implementation serves as the security and functionality baseline for comparison with traditional framework implementations.