import { render, screen, fireEvent } from '@testing-library/react'
import { Dialog } from '@/components/Dialog'

describe('Dialog – prompt mode', () => {
  it('renders title and input', () => {
    render(<Dialog type="prompt" title="새 파일 제목:" placeholder="제목" onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByText('새 파일 제목:')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('제목')).toBeInTheDocument()
  })

  it('calls onSubmit with trimmed value', () => {
    const onSubmit = jest.fn()
    render(<Dialog type="prompt" title="제목:" onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  hello  ' } })
    fireEvent.click(screen.getByText('확인'))
    expect(onSubmit).toHaveBeenCalledWith('hello')
  })

  it('does not submit empty value', () => {
    const onSubmit = jest.fn()
    render(<Dialog type="prompt" title="제목:" onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.click(screen.getByText('확인'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits on Enter key', () => {
    const onSubmit = jest.fn()
    render(<Dialog type="prompt" title="제목:" onSubmit={onSubmit} onCancel={jest.fn()} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('test')
  })

  it('pre-fills defaultValue', () => {
    render(<Dialog type="prompt" title="제목:" defaultValue="기존 제목" onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByRole('textbox')).toHaveValue('기존 제목')
  })

  it('submits defaultValue when submitted without editing', () => {
    const onSubmit = jest.fn()
    render(<Dialog type="prompt" title="제목:" defaultValue="기존 제목" onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.click(screen.getByText('확인'))
    expect(onSubmit).toHaveBeenCalledWith('기존 제목')
  })

  it('확인 button is disabled when input is empty', () => {
    render(<Dialog type="prompt" title="제목:" onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByText('확인')).toBeDisabled()
  })
})

describe('Dialog – confirm mode', () => {
  it('renders title and message', () => {
    render(<Dialog type="confirm" title="파일 삭제" message='"foo"을 삭제할까요?' onConfirm={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByText('파일 삭제')).toBeInTheDocument()
    expect(screen.getByText('"foo"을 삭제할까요?')).toBeInTheDocument()
  })

  it('calls onConfirm on 확인 click', () => {
    const onConfirm = jest.fn()
    render(<Dialog type="confirm" title="삭제" message="삭제할까요?" onConfirm={onConfirm} onCancel={jest.fn()} />)
    fireEvent.click(screen.getByText('확인'))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('danger=true applies red button class', () => {
    render(<Dialog type="confirm" title="삭제" message="?" danger onConfirm={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByText('확인')).toHaveClass('bg-red-600')
  })
})

describe('Dialog – shared', () => {
  it('calls onCancel on 취소 click', () => {
    const onCancel = jest.fn()
    render(<Dialog type="confirm" title="삭제" message="?" onConfirm={jest.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('취소'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onCancel on Escape key', () => {
    const onCancel = jest.fn()
    render(<Dialog type="confirm" title="삭제" message="?" onConfirm={jest.fn()} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })
})
