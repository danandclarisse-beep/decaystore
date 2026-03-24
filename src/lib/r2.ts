import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  // Disable automatic checksum injection — R2 does not support
  // x-amz-checksum-* headers in presigned URLs and they cause CORS
  // preflight failures when the browser uploads directly to R2.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
})

const BUCKET = process.env.R2_BUCKET_NAME!

// Generate a presigned upload URL (client uploads directly to R2)
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(r2, command, { expiresIn })
}

// Generate a presigned download URL
export async function getPresignedDownloadUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  })
  return getSignedUrl(r2, command, { expiresIn })
}

// Upload a file buffer directly from the server (no browser CORS needed)
export async function uploadToR2(key: string, body: Buffer, contentType: string) {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )
}

// Delete a file from R2
export async function deleteFromR2(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

// Check if object exists
export async function objectExists(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

// Build a unique R2 key for a user's file
export function buildR2Key(userId: string, filename: string): string {
  const timestamp = Date.now()
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `users/${userId}/${timestamp}-${sanitized}`
}