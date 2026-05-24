// Simple transaction helper for pg Pool.
// Ensures a single dedicated client is used for the whole transaction.

export default async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Rollback failure should never mask the original error.
      console.error('Failed to ROLLBACK transaction:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}
