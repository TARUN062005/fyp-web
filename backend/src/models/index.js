import User from './User.js';
import Device from './Device.js';
import EmergencyReport from './EmergencyReport.js';
import EmergencyCluster from './EmergencyCluster.js';
import AuditLog from './AuditLog.js';
import AdminUser from './AdminUser.js';
import IdentityCertificate from './IdentityCertificate.js';
import RefreshToken from './RefreshToken.js';
import AdminRefreshToken from './AdminRefreshToken.js';

/**
 * Blocking uses User.isBlocked + AuditLog entries.
 * No separate BlockedUser collection — avoids dual sources of truth.
 */
const models = {
  User,
  Device,
  EmergencyReport,
  EmergencyCluster,
  AuditLog,
  AdminUser,
  IdentityCertificate,
  RefreshToken,
  AdminRefreshToken,
};

export {
  User,
  Device,
  EmergencyReport,
  EmergencyCluster,
  AuditLog,
  AdminUser,
  IdentityCertificate,
  RefreshToken,
  AdminRefreshToken,
};

export default models;
