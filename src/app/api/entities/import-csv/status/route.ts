import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { getImportJobStatus } from "@/lib/jobs/csv-import";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jobId = request.nextUrl.searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json(
        { error: "Missing jobId parameter" },
        { status: 400 }
      );
    }

    // Get job status
    const status = await getImportJobStatus(jobId);

    if (!status) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error("Failed to get CSV import status", { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get job status",
      },
      { status: 500 }
    );
  }
}
