import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantFromRequest } from '@/lib/tenant'
import { logAuditSafe } from '@/lib/observability-helpers'
import { z } from 'zod'

const UpdateTicketSchema = z.object({
  title: z.string().min(5).max(255).optional(),
  description: z.string().min(10).max(5000).optional(),
  category: z.enum(['GENERAL', 'BILLING', 'TECHNICAL', 'ACCOUNT', 'OTHER']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']).optional(),
  assignedToId: z.string().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  tags: z.array(z.string()).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = await getTenantFromRequest(request)
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 })
    }

    const { id } = params

    // Fetch ticket with comments
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, tenantId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        assignedTo: { select: { id: true, email: true, name: true } },
        comments: {
          include: {
            author: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    return NextResponse.json(
      {
        ticket: {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description,
          category: ticket.category,
          priority: ticket.priority,
          status: ticket.status,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
          resolvedAt: ticket.resolvedAt?.toISOString(),
          dueAt: ticket.dueAt?.toISOString(),
          createdBy: {
            id: ticket.user.id,
            email: ticket.user.email,
            name: ticket.user.name,
          },
          assignedTo: ticket.assignedTo
            ? {
                id: ticket.assignedTo.id,
                email: ticket.assignedTo.email,
                name: ticket.assignedTo.name,
              }
            : null,
          tags: ticket.tags,
          comments: ticket.comments.map((comment) => ({
            id: comment.id,
            content: comment.content,
            isInternal: comment.isInternal,
            createdAt: comment.createdAt.toISOString(),
            author: {
              id: comment.author.id,
              email: comment.author.email,
              name: comment.author.name,
            },
          })),
          statusHistory: ticket.statusHistory.map((history) => ({
            id: history.id,
            previousStatus: history.previousStatus,
            newStatus: history.newStatus,
            changedAt: history.changedAt.toISOString(),
            reason: history.reason,
          })),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Support ticket detail API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = await getTenantFromRequest(request)
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 })
    }

    const { id } = params
    const body = await request.json()
    const validated = UpdateTicketSchema.parse(body)

    // Fetch current ticket
    const currentTicket = await prisma.supportTicket.findFirst({
      where: { id, tenantId },
    })

    if (!currentTicket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Update ticket
    const updatedTicket = await prisma.supportTicket.update({
      where: { id },
      data: {
        title: validated.title,
        description: validated.description,
        category: validated.category,
        priority: validated.priority,
        status: validated.status,
        assignedToId: validated.assignedToId,
        dueAt: validated.dueAt ? new Date(validated.dueAt) : validated.dueAt,
        tags: validated.tags,
        resolvedAt: validated.status === 'RESOLVED' ? new Date() : currentTicket.resolvedAt,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        assignedTo: { select: { id: true, email: true, name: true } },
      },
    })

    // Log status change
    if (validated.status && validated.status !== currentTicket.status) {
      await prisma.supportTicketStatusHistory.create({
        data: {
          ticketId: id,
          previousStatus: currentTicket.status,
          newStatus: validated.status,
          changedBy: session.user.id,
        },
      })
    }

    // Log update
    await logAuditSafe({
      action: 'support:update_ticket',
      details: {
        ticketId: id,
        changes: {
          status: validated.status,
          priority: validated.priority,
          assignedTo: validated.assignedToId,
        },
      },
    }).catch(() => {})

    return NextResponse.json(
      {
        success: true,
        ticket: {
          id: updatedTicket.id,
          title: updatedTicket.title,
          status: updatedTicket.status,
          priority: updatedTicket.priority,
          assignedTo: updatedTicket.assignedTo
            ? {
                id: updatedTicket.assignedTo.id,
                name: updatedTicket.assignedTo.name,
              }
            : null,
          updatedAt: updatedTicket.updatedAt.toISOString(),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    console.error('Support ticket update API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = await getTenantFromRequest(request)
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 })
    }

    const { id } = params

    // Verify ticket exists
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, tenantId },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Only allow deletion by creator or admin
    if (ticket.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the ticket creator can delete it' },
        { status: 403 }
      )
    }

    // Delete ticket (cascades to comments and status history)
    await prisma.supportTicket.delete({ where: { id } })

    // Log deletion
    await logAuditSafe({
      action: 'support:delete_ticket',
      details: {
        ticketId: id,
        title: ticket.title,
        deletedBy: session.user.id,
      },
    }).catch(() => {})

    return NextResponse.json(
      { success: true, message: 'Ticket deleted' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Support ticket delete API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
