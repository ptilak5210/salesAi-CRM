/**
 * usePermissions.ts
 * 
 * Central RBAC hook — use this in any component to check what the
 * current user is allowed to do. 
 * 
 * Super Admins always get full access.
 * Team members get whatever permissions were set for them.
 */

import { AuthSession } from '../../utils/types';

export interface Permissions {
  isAdmin: boolean;           // true if super_admin
  isManager: boolean;         // true if team_member with title === 'Manager'
  isTeamMember: boolean;      // true if role === 'team_member'
  canExport: boolean;         // can export leads to CSV
  canImport: boolean;         // can import leads from CSV
  canDelete: boolean;         // can delete leads
  canEdit: boolean;           // can edit lead details
  canViewAnalytics: boolean;  // can see Analytics tab
  canManageTeam: boolean;     // can access Admin & Team tab
  canManagePipelines: boolean;// can create/edit/delete pipelines
  canAddLead: boolean;        // can add new leads
  canAssignLead: boolean;     // can assign leads to other team members
  pipelineIds: string[];      // which pipeline IDs this user can access ([] = all for admin)
}

export const usePermissions = (session: AuthSession | null): Permissions => {
  if (!session) {
    // Not logged in — deny everything
    return {
      isAdmin: false, isManager: false, isTeamMember: false,
      canExport: false, canImport: false, canDelete: false, canEdit: false,
      canViewAnalytics: false, canManageTeam: false, canManagePipelines: false,
      canAddLead: false, canAssignLead: false, pipelineIds: [],
    };
  }

  const isAdmin = session.user.role === 'super_admin';
  const isTeamMember = session.user.role === 'team_member';
  const isManager = isTeamMember && session.user.title === 'Manager';
  const perms = session.user.permissions;

  if (isAdmin) {
    // Super Admin gets EVERYTHING
    return {
      isAdmin: true, isManager: false, isTeamMember: false,
      canExport: true, canImport: true, canDelete: true, canEdit: true,
      canViewAnalytics: true, canManageTeam: true, canManagePipelines: true,
      canAddLead: true, canAssignLead: true, pipelineIds: [],
    };
  }

  // Team member — check their specific permissions
  return {
    isAdmin: false,
    isManager,
    isTeamMember: true,
    canExport: !!perms?.can_export,
    canImport: !!perms?.can_import,
    canDelete: !!perms?.can_delete,
    canEdit: perms?.can_edit !== false,  // default true
    canViewAnalytics: !!perms?.can_view_analytics,
    canManageTeam: false,           // never for team members
    canManagePipelines: false,      // never for team members
    canAddLead: true,               // all members can add leads
    canAssignLead: isManager,       // only managers can reassign
    pipelineIds: session.user.pipeline_ids || [],
  };
};
