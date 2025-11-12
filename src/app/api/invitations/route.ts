import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { invitationService } from '@/services/invitations';
import { logger } from '@/lib/logger';

const createInvitationSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['CLIENT_OWNER', 'FINANCE_MANAGER', 'ACCOUNTANT', 'VIEWER', 'AUDITOR', 'ADVISOR']),
  entityIds: z.array(z.string()).optional(),
});

type CreateInvitationRequest = z.infer<typeof createInvitationSchema>;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const validated = createInvitationSchema.parse(data);

    // Get tenant context (from user or request)
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant context' },
        { status: 400 }
      );
    }

    // Create invitation
    const invitation = await invitationService.createInvitation({
      email: validated.email,
      tenantId,
      role: validated.role,
      invitedBy: session.user.id,
      entityIds: validated.entityIds,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Failed to create invitation', { error });
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant context' },
        { status: 400 }
      );
    }

    const status = request.nextUrl.searchParams.get('status');

    const invitations = await invitationService.listInvitations(
      tenantId,
      status as any
    );

    return NextResponse.json({
      success: true,
      data: invitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        invitedAt: inv.invitedAt,
        expiresAt: inv.expiresAt,
        acceptedAt: inv.acceptedAt,
      })),
    });
  } catch (error) {
    logger.error('Failed to list invitations', { error });
    return NextResponse.json(
      { error: 'Failed to list invitations' },
      { status: 500 }
    );
  }
}
