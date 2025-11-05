'use client'

import React, { Suspense, useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { UserItem } from '../../contexts/UsersContextProvider'
import { useUsersContext } from '../../contexts/UsersContextProvider'
import { useWorkstationContext } from '../../contexts/WorkstationContext'
import { useDashboardMetrics } from '../../hooks'
import { WorkstationLayout } from './WorkstationLayout'
import { WorkstationSidebar } from './WorkstationSidebar'
import { WorkstationMainContent } from './WorkstationMainContent'
import { WorkstationInsightsPanel } from './WorkstationInsightsPanel'
import { AdvancedUserFilters, UserFilters } from '../AdvancedUserFilters'
import { UsersTable } from '../UsersTable'
import { QuickActionsBar } from '../QuickActionsBar'
import { OperationsOverviewCards } from '../OperationsOverviewCards'
import { UserProfileDialog } from '../UserProfileDialog'
import { toast } from 'sonner'
import type { WorkstationMainContentProps } from '../../types/workstation'

interface WorkstationIntegratedProps {
  users: UserItem[]
  stats: any
  isLoading?: boolean
  onAddUser?: () => void
  onImport?: () => void
  onBulkOperation?: () => void
  onExport?: () => void
  onRefresh?: () => void
}

/**
 * WorkstationIntegrated Component
 *
 * Phase 2 Integration: Combines the WorkstationLayout with existing components
 * - Left Sidebar: Filters, Quick Stats, Saved Views
 * - Main Content: Actions, Metrics Cards, User Directory (Table)
 * - Right Insights: Analytics, Recommendations
 *
 * Features:
 * - Filter state management with context and URL persistence
 * - Real-time quick stats updates
 * - Bulk user selection and actions
 * - Saved views management
 * - Responsive layout (desktop/tablet/mobile)
 * - Full accessibility support
 */
export function WorkstationIntegrated({
  users,
  stats,
  isLoading = false,
  onAddUser,
  onImport,
  onBulkOperation,
  onExport,
  onRefresh,
}: WorkstationIntegratedProps) {
  const context = useUsersContext()
  const workstationContext = useWorkstationContext()
  const { data: metricsData } = useDashboardMetrics()

  // Local state for selected user dialog
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false)

  // Filter state from context
  const [filters, setFilters] = useState<UserFilters>(() => {
    // Load filters from URL params or localStorage
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      return {
        search: params.get('search') || '',
        role: (params.get('role') as any) || undefined,
        status: (params.get('status') as any) || undefined,
        department: (params.get('department') as any) || undefined,
        dateRange: (params.get('dateRange') as any) || 'all',
      }
    }
    return {}
  })

  // Update workstation context filters when local filters change
  useEffect(() => {
    workstationContext.setFilters(filters)
  }, [filters, workstationContext])

  // Persist filters to URL on change
  const handleFiltersChange = useCallback((newFilters: UserFilters) => {
    setFilters(newFilters)

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams()
      if (newFilters.search) params.set('search', newFilters.search)
      if (newFilters.role) params.set('role', newFilters.role)
      if (newFilters.status) params.set('status', newFilters.status)
      if (newFilters.department) params.set('department', newFilters.department)
      if (newFilters.dateRange) params.set('dateRange', newFilters.dateRange)

      const newUrl = params.toString()
        ? `${window.location.pathname}?${newUrl}`
        : window.location.pathname

      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  // Apply saved view filter
  const handleApplySavedView = useCallback((viewName: string, roleFilter?: string) => {
    const newFilters: UserFilters = {
      search: '',
      role: roleFilter ? (roleFilter as any) : undefined,
      status: undefined,
      department: undefined,
      dateRange: 'all',
    }
    handleFiltersChange(newFilters)
  }, [handleFiltersChange])

  // Handle user selection for profile dialog
  const handleSelectUser = useCallback((user: UserItem) => {
    setSelectedUser(user)
    setIsUserDialogOpen(true)
  }, [])

  // Handle bulk user selection
  const handleToggleUserSelection = useCallback((userId: string) => {
    const newSelection = new Set(workstationContext.selectedUserIds)
    if (newSelection.has(userId)) {
      newSelection.delete(userId)
    } else {
      newSelection.add(userId)
    }
    workstationContext.setSelectedUserIds(newSelection)
  }, [workstationContext])

  // Handle select all users
  const handleSelectAllUsers = useCallback(() => {
    const allUserIds = new Set(users.map(u => u.id))
    workstationContext.setSelectedUserIds(allUserIds)
  }, [users, workstationContext])

  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    workstationContext.setSelectedUserIds(new Set())
  }, [workstationContext])

  // Apply bulk action
  const handleApplyBulkAction = useCallback(async () => {
    if (!workstationContext.bulkActionType || workstationContext.selectedUserIds.size === 0) {
      toast.error('Please select users and action type')
      return
    }

    try {
      await workstationContext.applyBulkAction()
      toast.success('Bulk action applied successfully')
      handleClearSelection()
    } catch (error) {
      toast.error('Failed to apply bulk action')
      console.error('Bulk action error:', error)
    }
  }, [workstationContext, handleClearSelection])

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      await onRefresh()
    }
    await workstationContext.refreshQuickStats()
  }, [onRefresh, workstationContext])

  // Memoized sidebar content
  const sidebarContent = (
    <div className="workstation-sidebar-content">
      <Suspense fallback={<div className="p-4">Loading filters...</div>}>
        <AdvancedUserFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onApplySavedView={handleApplySavedView}
          savedViews={[
            { name: 'All Users', role: undefined },
            { name: 'Clients', role: 'CLIENT' },
            { name: 'Team', role: 'TEAM_MEMBER' },
            { name: 'Admins', role: 'ADMIN' },
          ]}
        />
      </Suspense>
    </div>
  )

  // Memoized main content
  const mainContent = (
    <div className="workstation-main-wrapper">
      <Suspense fallback={<div className="p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
        <QuickActionsBar
          onAddUser={onAddUser}
          onImport={onImport}
          onBulkOperation={onBulkOperation}
          onExport={onExport}
          onRefresh={handleRefresh}
          isLoading={isLoading}
        />
      </Suspense>

      <Suspense fallback={<div className="p-4">Loading metrics...</div>}>
        <OperationsOverviewCards
          stats={stats}
          metricsData={metricsData}
        />
      </Suspense>

      <div className="workstation-table-section">
        <h2 className="text-lg font-semibold mb-4">User Directory</h2>
        <Suspense fallback={<div className="p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
          <UsersTable
            users={users}
            isLoading={isLoading}
            selectedUserIds={workstationContext.selectedUserIds}
            onSelectUser={handleSelectUser}
            onToggleUserSelection={handleToggleUserSelection}
            onSelectAllUsers={handleSelectAllUsers}
            onClearSelection={handleClearSelection}
          />
        </Suspense>
      </div>
    </div>
  )

  // Memoized insights content
  const insightsContent = (
    <div className="workstation-insights-content">
      <Suspense fallback={<div className="p-4">Loading insights...</div>}>
        <WorkstationInsightsPanel
          isOpen={workstationContext.insightsPanelOpen}
          onClose={() => workstationContext.setInsightsPanelOpen(false)}
          stats={stats}
          analyticsData={metricsData}
        />
      </Suspense>
    </div>
  )

  return (
    <>
      <WorkstationLayout
        sidebar={<WorkstationSidebar {...sidebarContent} />}
        main={mainContent}
        insights={insightsContent}
      />

      {selectedUser && (
        <UserProfileDialog
          user={selectedUser}
          open={isUserDialogOpen}
          onOpenChange={setIsUserDialogOpen}
        />
      )}
    </>
  )
}
