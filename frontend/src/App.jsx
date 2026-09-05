import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useSettings } from './context/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Landing from './pages/Landing';
import Maintenance from './pages/Maintenance';
import Security from './pages/Security';
import Unauthorized from './pages/Unauthorized';

import SuperadminDashboard from './pages/superadmin/Dashboard';
import ManageUsers from './pages/superadmin/ManageUsers';
import ActivityLog from './pages/superadmin/ActivityLog';
import SystemSettings from './pages/superadmin/Settings';
import LandingEditor from './pages/superadmin/LandingEditor';

import HrDashboard from './pages/hr/Dashboard';
import Employees from './pages/hr/Employees';
import LeaveApprovals from './pages/hr/LeaveApprovals';
import LeaveCalendar from './pages/hr/LeaveCalendar';
import LeaveTypes from './pages/hr/LeaveTypes';
import HrChat from './pages/hr/Chat';
import HrActivityLog from './pages/hr/ActivityLog';

import InventoryDashboard from './pages/inventory/Dashboard';
import Buildings from './pages/inventory/Buildings';
import BuildingRooms from './pages/inventory/BuildingRooms';
import RoomInventory from './pages/inventory/RoomInventory';
import AssetSummary from './pages/inventory/AssetSummary';
import Records from './pages/inventory/Records';
import Personnel from './pages/inventory/Personnel';
import InventoryManageUsers from './pages/inventory/ManageUsers';
import InventoryActivityLog from './pages/inventory/ActivityLog';
import InventoryTrash from './pages/inventory/Trash';
import RepairWatch from './pages/inventory/RepairWatch';

import EmployeeDashboard from './pages/employee/Dashboard';
import Profile from './pages/employee/Profile';
import Documents from './pages/employee/Documents';
import ApplyLeave from './pages/employee/ApplyLeave';
import LeaveHistory from './pages/employee/LeaveHistory';
import EmployeeChat from './pages/employee/Chat';
import { HOME_BY_ROLE } from './utils/homeRoutes';

export default function App() {
    const { user } = useAuth();
    const { settings, loaded } = useSettings();

    if (!loaded) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-600"></i>
            </div>
        );
    }

    // Maintenance mode hides the whole app behind a friendly "we'll be
    // right back" page for everyone except an already-logged-in superadmin -
    // that's what guarantees there's always a way in to turn it back off.
    // Login/forgot/reset stay reachable no matter what, since that's how a
    // superadmin gets in during maintenance in the first place.
    const maintenanceActive = settings.maintenance_mode && (!user || user.role !== 'superadmin');

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {maintenanceActive ? (
                <Route path="*" element={<Maintenance />} />
            ) : (
                <>
            <Route path="/" element={user ? <Navigate to={HOME_BY_ROLE[user.role]} replace /> : <Landing />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Superadmin — full access */}
            <Route path="/superadmin" element={<ProtectedRoute roles={['superadmin']}><SuperadminDashboard /></ProtectedRoute>} />
            <Route path="/superadmin/users" element={<ProtectedRoute roles={['superadmin']}><ManageUsers /></ProtectedRoute>} />
            <Route path="/superadmin/activity" element={<ProtectedRoute roles={['superadmin']}><ActivityLog /></ProtectedRoute>} />
            <Route path="/superadmin/settings" element={<ProtectedRoute roles={['superadmin']}><SystemSettings /></ProtectedRoute>} />
            <Route path="/superadmin/landing-page" element={<ProtectedRoute roles={['superadmin']}><LandingEditor /></ProtectedRoute>} />

            {/* HR module — HR staff + superadmin */}
            <Route path="/hr" element={<ProtectedRoute roles={['superadmin', 'hr_staff']}><HrDashboard /></ProtectedRoute>} />
            <Route path="/hr/employees" element={<ProtectedRoute roles={['superadmin', 'hr_staff']}><Employees /></ProtectedRoute>} />
            <Route path="/hr/leaves" element={<ProtectedRoute roles={['superadmin', 'hr_staff']}><LeaveApprovals /></ProtectedRoute>} />
            <Route path="/hr/leaves/calendar" element={<ProtectedRoute roles={['superadmin', 'hr_staff']}><LeaveCalendar /></ProtectedRoute>} />
            <Route path="/hr/leave-types" element={<ProtectedRoute roles={['superadmin', 'hr_staff']}><LeaveTypes /></ProtectedRoute>} />
            <Route path="/hr/chat" element={<ProtectedRoute roles={['superadmin', 'hr_staff']}><HrChat /></ProtectedRoute>} />
            <Route path="/hr/activity" element={<ProtectedRoute roles={['superadmin', 'hr_staff']}><HrActivityLog /></ProtectedRoute>} />

            {/* Inventory module — inventory staff + superadmin manage; inventory_viewer can view + comment only */}
            <Route path="/inventory" element={<ProtectedRoute roles={['superadmin', 'inventory_staff', 'inventory_viewer']}><InventoryDashboard /></ProtectedRoute>} />
            <Route path="/inventory/buildings" element={<ProtectedRoute roles={['superadmin', 'inventory_staff', 'inventory_viewer']}><Buildings /></ProtectedRoute>} />
            <Route path="/inventory/buildings/:building" element={<ProtectedRoute roles={['superadmin', 'inventory_staff', 'inventory_viewer']}><BuildingRooms /></ProtectedRoute>} />
            <Route path="/inventory/rooms/:roomCode" element={<ProtectedRoute roles={['superadmin', 'inventory_staff', 'inventory_viewer']}><RoomInventory /></ProtectedRoute>} />
            <Route path="/inventory/asset-summary" element={<ProtectedRoute roles={['superadmin', 'inventory_staff', 'inventory_viewer']}><AssetSummary /></ProtectedRoute>} />
            <Route path="/inventory/records" element={<ProtectedRoute roles={['superadmin', 'inventory_staff', 'inventory_viewer']}><Records /></ProtectedRoute>} />
            <Route path="/inventory/personnel" element={<ProtectedRoute roles={['superadmin', 'inventory_staff', 'inventory_viewer']}><Personnel /></ProtectedRoute>} />
            <Route path="/inventory/repair-watch" element={<ProtectedRoute roles={['superadmin', 'inventory_staff', 'inventory_viewer']}><RepairWatch /></ProtectedRoute>} />
            {/* Manage Users: superadmin only now - inventory_staff can no longer create its own peer accounts */}
            <Route path="/inventory/users" element={<ProtectedRoute roles={['superadmin']}><InventoryManageUsers /></ProtectedRoute>} />
            <Route path="/inventory/activity" element={<ProtectedRoute roles={['superadmin', 'inventory_staff']}><InventoryActivityLog /></ProtectedRoute>} />
            {/* Trash: superadmin + inventory_staff, per the 30-day soft-delete/undo policy */}
            <Route path="/inventory/trash" element={<ProtectedRoute roles={['superadmin', 'inventory_staff']}><InventoryTrash /></ProtectedRoute>} />

            {/* Employee self-service */}
            <Route path="/employee" element={<ProtectedRoute roles={['employee']}><EmployeeDashboard /></ProtectedRoute>} />
            <Route path="/employee/profile" element={<ProtectedRoute roles={['employee']}><Profile /></ProtectedRoute>} />
            <Route path="/security" element={<ProtectedRoute roles={['superadmin', 'hr_staff', 'inventory_staff', 'inventory_viewer', 'employee']}><Security /></ProtectedRoute>} />
            <Route path="/employee/documents" element={<ProtectedRoute roles={['employee']}><Documents /></ProtectedRoute>} />
            <Route path="/employee/apply-leave" element={<ProtectedRoute roles={['employee']}><ApplyLeave /></ProtectedRoute>} />
            <Route path="/employee/leave-history" element={<ProtectedRoute roles={['employee']}><LeaveHistory /></ProtectedRoute>} />
            <Route path="/employee/chat" element={<ProtectedRoute roles={['employee']}><EmployeeChat /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/login" replace />} />
                </>
            )}
        </Routes>
    );
}
