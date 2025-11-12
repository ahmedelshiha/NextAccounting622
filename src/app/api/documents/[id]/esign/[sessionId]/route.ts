import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantFromRequest } from '@/lib/tenant'
import { logAuditSafe } from '@/lib/observability-helpers'
import { esignService } from '@/lib/esign/esign-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
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

    const { id, sessionId } = params
    const action = request.nextUrl.searchParams.get('action')

    // Verify document exists
    const document = await prisma.attachment.findFirst({
      where: { id, tenantId },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Get signing status
    const signingStatus = await esignService.getSigningStatus(sessionId)

    if (action === 'download') {
      // Download signed document
      if (signingStatus.overallStatus !== 'COMPLETED') {
        return NextResponse.json(
          {
            error: 'Document not yet signed',
            status: signingStatus.overallStatus,
          },
          { status: 400 }
        )
      }

      try {
        const signedDocumentData = await esignService.downloadSignedDocument(sessionId)

        // Log download
        await logAuditSafe({
          action: 'documents:download_signed',
          details: {
            documentId: id,
            sessionId,
            size: signedDocumentData.length,
          },
        }).catch(() => {})

        return new NextResponse(signedDocumentData, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${document.name || 'signed-document.pdf'}"`,
          },
        })
      } catch (error) {
        return NextResponse.json(
          {
            error: 'Failed to download signed document',
            details: String(error),
          },
          { status: 500 }
        )
      }
    }

    // Default: return status
    return NextResponse.json(
      {
        documentId: id,
        sessionId,
        status: signingStatus.overallStatus,
        signers: signingStatus.signers,
        completedAt: signingStatus.completedAt?.toISOString() || null,
        signedDocumentUrl: signingStatus.signedDocumentUrl,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('E-signature status API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
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

    const { id, sessionId } = params

    // Verify document exists
    const document = await prisma.attachment.findFirst({
      where: { id, tenantId },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Cancel signing flow
    await esignService.cancelSigningFlow(sessionId)

    // Log cancellation
    await logAuditSafe({
      action: 'documents:cancel_signing',
      details: {
        documentId: id,
        sessionId,
        cancelledBy: session.user.id,
      },
    }).catch(() => {})

    return NextResponse.json(
      { success: true, message: 'Signing flow cancelled' },
      { status: 200 }
    )
  } catch (error) {
    console.error('E-signature cancellation API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
