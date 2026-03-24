// TEMPORARY DEBUG ROUTE — DELETE AFTER FIXING
// Place at: src/app/api/r2-test/route.ts
// Hit: GET https://yourapp.vercel.app/api/r2-test

import { NextResponse } from "next/server"
import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

export const dynamic = "force-dynamic"

export async function GET() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET_NAME

  // Log what we actually have (redacted)
  const debug = {
    R2_ACCOUNT_ID: accountId
      ? `${accountId.slice(0, 4)}...${accountId.slice(-4)} (len=${accountId.length})`
      : "MISSING",
    R2_ACCESS_KEY_ID: accessKeyId
      ? `${accessKeyId.slice(0, 4)}...${accessKeyId.slice(-4)} (len=${accessKeyId.length})`
      : "MISSING",
    R2_SECRET_ACCESS_KEY: secretAccessKey
      ? `${secretAccessKey.slice(0, 4)}...${secretAccessKey.slice(-4)} (len=${secretAccessKey.length})`
      : "MISSING",
    R2_BUCKET_NAME: bucket ?? "MISSING",
    endpoint: accountId
      ? `https://${accountId}.r2.cloudflarestorage.com`
      : "CANNOT BUILD — ACCOUNT ID MISSING",
  }

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return NextResponse.json({ error: "Missing env vars", debug }, { status: 500 })
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  })

  const results: Record<string, unknown> = { debug }

  // Test 1: List objects (needs Read)
  try {
    const list = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 })
    )
    results.list = { ok: true, keyCount: list.KeyCount }
  } catch (e: unknown) {
    results.list = { ok: false, error: (e as Error).message, code: (e as {Code?:string}).Code }
  }

  // Test 2: Write a tiny test object (needs Write)
  const testKey = `__r2_test__/${Date.now()}.txt`
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: Buffer.from("r2 write test"),
        ContentType: "text/plain",
      })
    )
    results.write = { ok: true, key: testKey }
  } catch (e: unknown) {
    results.write = { ok: false, error: (e as Error).message, code: (e as {Code?:string}).Code }
  }

  // Test 3: Delete the test object (needs Delete)
  if ((results.write as {ok:boolean}).ok) {
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: testKey })
      )
      results.delete = { ok: true }
    } catch (e: unknown) {
      results.delete = { ok: false, error: (e as Error).message, code: (e as {Code?:string}).Code }
    }
  }

  const allOk = [results.list, results.write, results.delete].every(
    (r) => r && (r as {ok:boolean}).ok
  )

  return NextResponse.json({ allOk, ...results }, { status: allOk ? 200 : 500 })
}