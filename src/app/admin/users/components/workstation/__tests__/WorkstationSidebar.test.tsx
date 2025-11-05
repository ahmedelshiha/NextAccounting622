import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkstationSidebar } from '../WorkstationSidebar'

describe('WorkstationSidebar', () => {
  it('renders sidebar content sections', () => {
    render(
      <WorkstationSidebar
        isOpen={true}
        stats={{
          totalUsers: 42,
          activeUsers: 38,
          pendingApprovals: 2,
          inProgressWorkflows: 5,
          refreshedAt: new Date()
        }}
      />
    )

    expect(screen.getByText('Quick Stats')).toBeInTheDocument()
    expect(screen.getByText('Saved Views')).toBeInTheDocument()
    expect(screen.getByText('Filters')).toBeInTheDocument()
  })

  it('displays quick stats when provided', () => {
    const mockStats = {
      totalUsers: 42,
      activeUsers: 38,
      pendingApprovals: 2,
      inProgressWorkflows: 5,
      refreshedAt: new Date()
    }

    render(
      <WorkstationSidebar
        isOpen={true}
        stats={mockStats}
      />
    )

    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders saved view buttons', () => {
    render(
      <WorkstationSidebar isOpen={true} />
    )

    expect(screen.getByText('All Users')).toBeInTheDocument()
    expect(screen.getByText('Clients')).toBeInTheDocument()
    expect(screen.getByText('Team')).toBeInTheDocument()
    expect(screen.getByText('Admins')).toBeInTheDocument()
  })

  it('calls onReset when reset button is clicked', () => {
    const mockReset = vi.fn()
    render(
      <WorkstationSidebar
        isOpen={true}
        onReset={mockReset}
      />
    )

    const resetButton = screen.getByText('Reset Filters')
    fireEvent.click(resetButton)

    expect(mockReset).toHaveBeenCalledOnce()
  })

  it('calls onClose when close button is triggered', () => {
    const mockClose = vi.fn()
    render(
      <WorkstationSidebar
        isOpen={true}
        onClose={mockClose}
      />
    )

    // Close button will be implemented in Phase 1
  })

  it('applies custom className', () => {
    const { container } = render(
      <WorkstationSidebar
        isOpen={true}
        className="custom-class"
      />
    )

    const sidebar = container.querySelector('.workstation-sidebar-content')
    expect(sidebar).toHaveClass('custom-class')
  })

  describe('mobile drawer behavior', () => {
    it('respects isOpen prop for drawer state', () => {
      const { rerender } = render(
        <WorkstationSidebar isOpen={false} />
      )

      // Mobile drawer state will be tested in Phase 1 with responsive behavior

      rerender(
        <WorkstationSidebar isOpen={true} />
      )

      expect(screen.getByText('Quick Stats')).toBeInTheDocument()
    })
  })
})
