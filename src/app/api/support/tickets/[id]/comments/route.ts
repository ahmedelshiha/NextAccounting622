import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantFromRequest } from '@/lib/tenant'
import { logAuditSafe } from '@/lib/observability-helpers'
import { z } from 'zod'

const AddCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  isInternal: z.boolean().default(false),
  attachmentIds: z.array(z.string()).default([]),
})

export async function POST(
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
    const validated = AddCommentSchema.parse(body)

    // Verify ticket exists
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, tenantId },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Create comment
    const comment = await prisma.supportTicketComment.create({
      data: {
        ticketId: id,
        authorId: session.user.id,
        content: validated.content,
        isInternal: validated.isInternal,
        attachmentIds: validated.attachmentIds,
      },
      include: {
        author: { select: { id: true, email: true, name: true } },
      },
    })

    // Log comment creation
    await logAuditSafe({
      action: 'support:add_comment',
      details: {
        ticketId: id,
        commentId: comment.id,
        isInternal: validated.isInternal,
      },
    }).catch(() => {})

    return NextResponse.json(
      {
        success: true,
        comment: {
          id: comment.id,
          content: comment.content,
          isInternal: comment.isInternal,
          createdAt: comment.createdAt.toISOString(),
          author: {
            id: comment.author.id,
            email: comment.author.email,
            name: comment.author.name,
          },
        },
      },
      { status: 201 }
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

    console.error('Support ticket comment API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50'), 100)
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0')

    // Verify ticket exists
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, tenantId },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Fetch comments
    const total = await prisma.supportTicketComment.count({
      where: { ticketId: id },
    })

    const comments = await prisma.supportTicketComment.findMany({
      where: { ticketId: id },
      include: {
        author: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    const formattedComments = comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      isInternal: comment.isInternal,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      attachmentIds: comment.attachmentIds,
      author: {
        id: comment.author.id,
        email: comment.author.email,
        name: comment.author.name,
      },
    }))

    return NextResponse.json(
      {
        comments: formattedComments,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Support ticket comments list API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
