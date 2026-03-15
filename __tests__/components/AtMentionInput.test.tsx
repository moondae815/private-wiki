import { render, screen, fireEvent } from '@testing-library/react'
import { AtMentionInput } from '@/components/AtMentionInput'

function setup(value = '', onChange = jest.fn()) {
  const utils = render(
    <AtMentionInput
      value={value}
      onChange={onChange}
      placeholder="입력"
    />
  )
  const input = screen.getByPlaceholderText('입력')
  return { input, onChange, ...utils }
}

describe('AtMentionInput – 기본 렌더링', () => {
  it('input을 렌더링한다', () => {
    setup()
    expect(screen.getByPlaceholderText('입력')).toBeInTheDocument()
  })

  it('@가 없으면 드롭다운이 보이지 않는다', () => {
    setup('hello')
    expect(screen.queryByText('@due:', { exact: false })).not.toBeInTheDocument()
  })
})

describe('AtMentionInput – 드롭다운 표시', () => {
  it('@만 입력하면 4개 항목이 모두 표시된다', () => {
    const today = new Date().toISOString().slice(0, 10)
    setup('@')
    expect(screen.getByText(`@due:${today}`)).toBeInTheDocument()
    expect(screen.getByText('@priority:high')).toBeInTheDocument()
    expect(screen.getByText('@priority:medium')).toBeInTheDocument()
    expect(screen.getByText('@priority:low')).toBeInTheDocument()
  })

  it('@d 입력 시 @due만 표시된다', () => {
    setup('@d')
    expect(screen.getByText(/@due:/)).toBeInTheDocument()
    expect(screen.queryByText('@priority:high')).not.toBeInTheDocument()
  })

  it('@p 입력 시 @priority 3개만 표시된다', () => {
    setup('@p')
    expect(screen.getByText('@priority:high')).toBeInTheDocument()
    expect(screen.getByText('@priority:medium')).toBeInTheDocument()
    expect(screen.getByText('@priority:low')).toBeInTheDocument()
    expect(screen.queryByText(/@due:/)).not.toBeInTheDocument()
  })

  it('일치 항목 없으면 드롭다운이 숨겨진다', () => {
    setup('@xyz')
    expect(screen.queryByText(/@due:/)).not.toBeInTheDocument()
    expect(screen.queryByText('@priority:high')).not.toBeInTheDocument()
  })

  it('@due 오른쪽에 "오늘" 힌트가 표시된다', () => {
    setup('@')
    expect(screen.getByText('오늘')).toBeInTheDocument()
  })
})

describe('AtMentionInput – 제안 삽입', () => {
  it('항목 클릭 시 onChange가 삽입된 값으로 호출된다', () => {
    const today = new Date().toISOString().slice(0, 10)
    const onChange = jest.fn()
    render(<AtMentionInput value="할일 @d" onChange={onChange} placeholder="입력" />)
    const option = screen.getByText(`@due:${today}`)
    fireEvent.mouseDown(option)
    expect(onChange).toHaveBeenCalledWith(`할일 @due:${today} `)
  })

  it('항목 삽입 후 드롭다운이 닫힌다', () => {
    const today = new Date().toISOString().slice(0, 10)
    const { rerender } = render(
      <AtMentionInput value="@d" onChange={jest.fn()} placeholder="입력" />
    )
    const option = screen.getByText(`@due:${today}`)
    fireEvent.mouseDown(option)
    rerender(
      <AtMentionInput value={`@due:${today} `} onChange={jest.fn()} placeholder="입력" />
    )
    expect(screen.queryByText(`@due:${today}`)).not.toBeInTheDocument()
  })
})

describe('AtMentionInput – 키보드 인터랙션', () => {
  it('Enter 키로 첫 번째 항목이 삽입된다', () => {
    const today = new Date().toISOString().slice(0, 10)
    const onChange = jest.fn()
    render(<AtMentionInput value="@d" onChange={onChange} placeholder="입력" />)
    const input = screen.getByPlaceholderText('입력')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(`@due:${today} `)
  })

  it('Tab 키로 첫 번째 항목이 삽입된다', () => {
    const today = new Date().toISOString().slice(0, 10)
    const onChange = jest.fn()
    render(<AtMentionInput value="@d" onChange={onChange} placeholder="입력" />)
    const input = screen.getByPlaceholderText('입력')
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(onChange).toHaveBeenCalledWith(`@due:${today} `)
  })

  it('ArrowDown 후 Enter 시 두 번째 항목이 삽입된다', () => {
    const onChange = jest.fn()
    render(<AtMentionInput value="@p" onChange={onChange} placeholder="입력" />)
    const input = screen.getByPlaceholderText('입력')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('@priority:medium ')
  })

  it('Escape 키로 드롭다운이 닫힌다', () => {
    const { rerender } = render(
      <AtMentionInput value="@p" onChange={jest.fn()} placeholder="입력" />
    )
    expect(screen.getByText('@priority:high')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByPlaceholderText('입력'), { key: 'Escape' })
    rerender(<AtMentionInput value="@p" onChange={jest.fn()} placeholder="입력" />)
    expect(screen.queryByText('@priority:high')).not.toBeInTheDocument()
  })

  it('드롭다운 열린 상태에서 Enter는 부모 onKeyDown을 호출하지 않는다', () => {
    const onKeyDown = jest.fn()
    render(
      <AtMentionInput value="@p" onChange={jest.fn()} onKeyDown={onKeyDown} placeholder="입력" />
    )
    fireEvent.keyDown(screen.getByPlaceholderText('입력'), { key: 'Enter' })
    expect(onKeyDown).not.toHaveBeenCalled()
  })

  it('드롭다운 닫힌 상태에서 Enter는 부모 onKeyDown을 호출한다', () => {
    const onKeyDown = jest.fn()
    render(
      <AtMentionInput value="hello" onChange={jest.fn()} onKeyDown={onKeyDown} placeholder="입력" />
    )
    fireEvent.keyDown(screen.getByPlaceholderText('입력'), { key: 'Enter' })
    expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: 'Enter' }))
  })
})

describe('AtMentionInput – ArrowUp 내비게이션', () => {
  it('ArrowUp으로 마지막 항목으로 순환된다', () => {
    const onChange = jest.fn()
    render(<AtMentionInput value="@p" onChange={onChange} placeholder="입력" />)
    const input = screen.getByPlaceholderText('입력')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('@priority:low ')
  })
})

describe('AtMentionInput – onBlur 전달', () => {
  it('포커스 이탈 시 onBlur prop이 호출된다', () => {
    const onBlur = jest.fn()
    render(
      <AtMentionInput value="hello" onChange={jest.fn()} onBlur={onBlur} placeholder="입력" />
    )
    fireEvent.blur(screen.getByPlaceholderText('입력'))
    expect(onBlur).toHaveBeenCalled()
  })
})

describe('AtMentionInput – 중간 위치 @ 트리거', () => {
  it('문자열 중간의 @도 드롭다운을 표시한다', () => {
    setup('hello @p')
    expect(screen.getByText('@priority:high')).toBeInTheDocument()
  })
})

describe('AtMentionInput – onChange 동작', () => {
  it('onChange는 string을 직접 받는다', () => {
    const onChange = jest.fn()
    const { input } = setup('', onChange)
    fireEvent.change(input, { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalledWith('hello')
  })

  it('value 변경 시 dismissed가 초기화되어 드롭다운이 다시 열린다', () => {
    const today = new Date().toISOString().slice(0, 10)
    const { rerender } = render(
      <AtMentionInput value="@p" onChange={jest.fn()} placeholder="입력" />
    )
    fireEvent.keyDown(screen.getByPlaceholderText('입력'), { key: 'Escape' })
    rerender(<AtMentionInput value="@p" onChange={jest.fn()} placeholder="입력" />)
    expect(screen.queryByText('@priority:high')).not.toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('입력'), { target: { value: '@' } })
    rerender(<AtMentionInput value="@" onChange={jest.fn()} placeholder="입력" />)
    expect(screen.getByText(`@due:${today}`)).toBeInTheDocument()
  })
})
