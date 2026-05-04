/**
 * POST /api/mpesa/c2b/validate
 *
 * Safaricom calls this BEFORE processing the payment to ask if we want to accept it.
 * We always accept — returning ResultCode 0.
 */
export async function POST() {
  return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
