import { NextRequest, NextResponse } from 'next/server'
import { listFiles, writeFile } from '@/lib/files'
import { toFilename } from '@/lib/slugify'
import { FileType, CreateFileRequest } from '@/types'

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') as FileType
  if (type !== 'notes' && type !== 'todos') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  try {
    const files = await listFiles(type)
    return NextResponse.json(files)
  } catch {
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body: CreateFileRequest = await req.json()
  const { title, type } = body

  if (!title || !type) {
    return NextResponse.json({ error: 'title and type required' }, { status: 400 })
  }
  if (type !== 'notes' && type !== 'todos') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  const filename = toFilename(title)
  const initialContent = `# ${title}\n\n`

  try {
    await writeFile(type, filename, initialContent)
    return NextResponse.json({ filename }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create file' }, { status: 500 })
  }
}
