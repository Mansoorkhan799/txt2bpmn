'use client';

import React from 'react';
import AdminBpmnFiles from './AdminBpmnFiles';
import { ROLES } from '../utils/permissions';

interface AdminFileManagementProps {
  userRole?: string;
}

const AdminFileManagement: React.FC<AdminFileManagementProps> = ({ userRole = 'user' }) => {
  const isAdmin = userRole === ROLES.ADMIN;
  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
          <p className="text-xl font-semibold text-red-600 mb-2">Access Denied</p>
          <p className="text-gray-600">Only admins can view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="bg-white border-b px-4 py-3">
        <h2 className="text-xl font-semibold text-gray-800">File Management</h2>
      </div>

      <div className="flex-1 min-h-0">
        <AdminBpmnFiles userRole={userRole} />
      </div>
    </div>
  );
};

export default AdminFileManagement;


