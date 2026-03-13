import { NextRequest, NextResponse } from 'next/server'
import { listFiles } from '@/lib/files'
import { FileType, SearchResult } from '@/types'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.toLowerCase() ?? ''
  const typeParam = req.nextUrl.searchParams.get('type') as FileType | null

  const types: FileType[] = typeParam ? [typeParam] : ['notes', 'todos']

  try {
    const results: SearchResult[] = []
    for (const type of types) {
      const files = await listFiles(type)
      for (const file of files) {
        if (file.title.toLowerCase().includes(q)) {
          results.push({ filename: file.filename, title: file.title, type })
        }
      }
    }
    return NextResponse.json(results)
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
