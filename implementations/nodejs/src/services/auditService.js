const { AuditLog } = require('../models');

/**
 * AuditService handles manual audit logging
 * This demonstrates the complexity of implementing audit trails manually
 * vs NPL's automatic audit trail generation
 */
class AuditService {
  
  // Log action to audit trail (manual implementation vs NPL's automatic)
  async logAction(expenseId, userId, action, description, metadata = null) {
    try {
      const auditLog = await AuditLog.create({
        expenseId: expenseId,
        userId: userId,
        action: action,
        description: description,
        metadata: metadata,
        timestamp: new Date()
      });

      console.log(`Audit log created: ${action} on expense ${expenseId} by user ${userId}`);
      return auditLog;
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // In production, this could be sent to a monitoring service
      // NPL handles this automatically and guarantees it never fails
      throw error;
    }
  }

  // Get complete audit history for an expense
  async getAuditHistory(expenseId) {
    try {
      const auditLogs = await AuditLog.findAll({
        where: { expenseId },
        include: ['user'],
        order: [['timestamp', 'ASC']]
      });

      return auditLogs.map(log => ({
        id: log.id,
        action: log.action,
        description: log.description,
        user: log.user?.preferredUsername || 'System',
        timestamp: log.timestamp.toISOString(),
        metadata: log.metadata
      }));
    } catch (error) {
      console.error('Failed to get audit history:', error);
      throw error;
    }
  }

  // Generate compliance report
  async generateComplianceReport(expenseId) {
    try {
      const auditHistory = await this.getAuditHistory(expenseId);
      
      return {
        expenseId: expenseId,
        totalActions: auditHistory.length,
        actionsSummary: this.summarizeActions(auditHistory),
        complianceStatus: 'COMPLIANT',
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  // Private helper methods
  summarizeActions(auditHistory) {
    const summary = {};
    
    auditHistory.forEach(log => {
      if (summary[log.action]) {
        summary[log.action]++;
      } else {
        summary[log.action] = 1;
      }
    });

    return summary;
  }

  // Bulk audit logging for system operations
  async logBulkActions(actions) {
    try {
      const auditLogs = await AuditLog.bulkCreate(actions.map(action => ({
        expenseId: action.expenseId,
        userId: action.userId,
        action: action.action,
        description: action.description,
        metadata: action.metadata,
        timestamp: new Date()
      })));

      console.log(`Bulk audit logs created: ${auditLogs.length} entries`);
      return auditLogs;
    } catch (error) {
      console.error('Failed to create bulk audit logs:', error);
      throw error;
    }
  }

  // System-level audit logging (for administrative actions)
  async logSystemAction(action, description, metadata = null) {
    try {
      return await AuditLog.create({
        expenseId: null, // System-level actions don't relate to specific expenses
        userId: null,    // System actions don't have a specific user
        action: action,
        description: description,
        metadata: metadata,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to create system audit log:', error);
      throw error;
    }
  }
}

module.exports = new AuditService();