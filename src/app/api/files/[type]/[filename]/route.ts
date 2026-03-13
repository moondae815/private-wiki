import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, deleteFile, renameFile } from '@/lib/files'
import { toFilename } from '@/lib/slugify'
import { FileType } from '@/types'

type Params = { type: FileType; filename: string }

export async function GET(_req: NextRequest, { params }: { params: Promise<Params> }) {
  const { type, filename } = await params
  try {
    const content = await readFile(type, filename)
    return NextResponse.json({ content })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { type, filename } = await params
  const body = await req.json()

  // Handle rename
  if (body.newTitle) {
    const newFilename = toFilename(body.newTitle)
    try {
      await renameFile(type, filename, newFilename)
      return NextResponse.json({ filename: newFilename })
    } catch {
      return NextResponse.json({ error: 'Rename failed' }, { status: 500 })
    }
  }

  // Handle content update
  if (body.content !== undefined) {
    try {
      await writeFile(type, filename, body.content)
      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ error: 'Write failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'No action specified' }, { status: 400 })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<Params> }) {
  const { type, filename } = await params
  try {
    await deleteFile(type, filename)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
