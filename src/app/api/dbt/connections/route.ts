import { type NextRequest } from "next/server";
import * as connectionService from "@/app/server/services/dbt/connection.service";
import * as connectionRepo from "@/app/server/repositories/dbt/connection.repository";
import { createConnectionSchema, listConnectionsQuerySchema } from "@/app/server/schemas/dbt/connection.schema";
import { handleValidationError, apiError, conflict } from "@/app/server/errors/api-error";
import { requireAuth } from "@/app/server/lib/auth-guard";

/** GET /api/dbt/connections — 连接列表 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const query = listConnectionsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await connectionService.listConnections(query);
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("Failed to list connections", 500);
  }
}

/** POST /api/dbt/connections — 创建连接 */
export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const data = createConnectionSchema.parse(body);

    const existing = await connectionRepo.findByName(data.name);
    if (existing) {
      return conflict("连接名称已存在");
    }

    const connection = await connectionService.createConnection(data);
    return Response.json(connection, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    if (error instanceof Error && error.message.includes("DBT_ENCRYPTION_KEY")) {
      return apiError(error.message, 500);
    }
    return apiError("Failed to create connection", 500);
  }
}
