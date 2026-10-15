import "server-only"

import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"

// The ledger: one DynamoDB table, append-only. Nothing is updated in place;
// a decision that changes status is a new item, so the history is the table.
//
//   pk                      sk                              item
//   LOAD#<dataset>          <file hash>                     a load event (a second load of the same file is refused)
//   SNAP#<flight>           <as-of>#<window end>            a results snapshot
//   REF#<reference>         META                            a frozen reference scale
//   TAKE#<take>             FINDING#<iso>                   a Hermes finding with its score version and evidence
//   TAKE#<take>             STEP#<step>#<iso>               a next-step decision event
//   TAKE#<take>             CALL#<iso>                      a forecast, locked before the results it predicts
//   PICK#<claim>            <iso>                           a script choice and the reason for it
//   VOTE#<conversation>     <voter>#<statement>             a consensus vote

const TABLE = process.env.HERMES_LEDGER_TABLE ?? "hermes-ledger"
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.HERMES_REGION ?? "us-east-1" }), { marshallOptions: { removeUndefinedValues: true } })

export type Item = { pk: string; sk: string; [k: string]: unknown }

/** Write once. Returns false when the key already exists (the double-count guard). */
export async function putOnce(item: Item): Promise<boolean> {
  try {
    await client.send(new PutCommand({ TableName: TABLE, Item: item, ConditionExpression: "attribute_not_exists(pk)" }))
    return true
  } catch (e) {
    if ((e as { name?: string }).name === "ConditionalCheckFailedException") return false
    throw e
  }
}

export async function get<T extends Item>(pk: string, sk: string): Promise<T | null> {
  const r = await client.send(new GetCommand({ TableName: TABLE, Key: { pk, sk } }))
  return (r.Item as T) ?? null
}

export async function query<T extends Item>(pk: string, prefix?: string): Promise<T[]> {
  const out: T[] = []
  let start: Record<string, unknown> | undefined
  do {
    const r = await client.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: prefix ? "pk = :pk and begins_with(sk, :p)" : "pk = :pk",
        ExpressionAttributeValues: prefix ? { ":pk": pk, ":p": prefix } : { ":pk": pk },
        ExclusiveStartKey: start,
      }),
    )
    out.push(...((r.Items as T[]) ?? []))
    start = r.LastEvaluatedKey
  } while (start)
  return out
}

export const now = () => new Date().toISOString()
