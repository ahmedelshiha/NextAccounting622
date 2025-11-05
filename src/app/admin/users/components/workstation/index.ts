/**
 * Workstation Components Barrel Export
 * Oracle Fusion-inspired layout components
 */

export { WorkstationLayout, default as WorkstationLayoutComponent } from './WorkstationLayout'
export { WorkstationSidebar, default as WorkstationSidebarComponent } from './WorkstationSidebar'
export { WorkstationMainContent, default as WorkstationMainContentComponent } from './WorkstationMainContent'
export { WorkstationInsightsPanel, default as WorkstationInsightsPanelComponent } from './WorkstationInsightsPanel'
export { QuickStatsCard } from './QuickStatsCard'
export { SavedViewsButtons } from './SavedViewsButtons'

export type {
  WorkstationLayoutProps,
  WorkstationSidebarProps,
  WorkstationMainContentProps,
  WorkstationInsightsPanelProps,
  QuickStatsData,
  QuickStatsCardProps,
  SavedViewsButtonProps
} from '../../types/workstation'
