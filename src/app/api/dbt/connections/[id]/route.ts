import * as connectionService from "@/app/server/services/dbt/connection.service";
import { updateConnectionSchema, connectionIdSchema } from "@/app/server/schemas/dbt/connection.schema";
import { handleValidationError, apiError, notFound, conflict } from "@/app/server/errors/api-error";

/** GET /api/dbt/connections/[id] — 连接详情 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = connectionIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  const connection = await connectionService.getConnection(Number(id));
  if (!connection) return notFound("连接不存在");
  return Response.json(connection);
}

/** PUT /api/dbt/connections/[id] — 更新连接 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = connectionIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  try {
    const body = await request.json();
    const data = updateConnectionSchema.parse(body);
    const connection = await connectionService.updateConnection(Number(id), data);
    if (!connection) return notFound("连接不存在");
    return Response.json(connection);
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    if (error instanceof Error && error.message.includes("DBT_ENCRYPTION_KEY")) {
      return apiError(error.message, 500);
    }
    return apiError("Failed to update connection", 500);
  }
}

/** DELETE /api/dbt/connections/[id] — 删除连接 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = connectionIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  try {
    const result = await connectionService.deleteConnection(Number(id));
    if (!result) return notFound("连接不存在");
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("引用")) {
      return conflict(error.message);
    }
    return apiError("Failed to delete connection", 500);
  }
}
