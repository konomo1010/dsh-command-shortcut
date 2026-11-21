window.__ModuleLoader__.load({
  id: 'dsh-command-shortcut',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef } = React

    let createPortal = null
    try {
      const reactDom = require('react-dom')
      if (reactDom && typeof reactDom.createPortal === 'function') createPortal = reactDom.createPortal
    } catch (error) {
      createPortal = null
    }

    const STORAGE_KEY = 'dsh:command-shortcut:v1'
    const DEFAULT_ITEMS = [
      {
        id: 'summary',
        title: '总结要点',
        text: '把上面的内容压缩成 5 条要点，每条不超过 30 字，先给结论再给依据。',
      },
      {
        id: 'weekly',
        title: '写周报',
        text: '把本周的进展整理成周报：目标、进展、风险、下周计划，每条一两句话。',
      },
    ]

    /* ---------------- 数据 ---------------- */

    let items = null
    const itemListeners = new Set()

    function loadItems() {
      if (items) return items
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        const parsed = raw ? JSON.parse(raw) : null
        items = Array.isArray(parsed) ? parsed : DEFAULT_ITEMS.slice()
      } catch (error) {
        items = DEFAULT_ITEMS.slice()
      }
      return items
    }

    function persist(next) {
      items = next
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch (error) {}
      itemListeners.forEach((fn) => fn(next))
    }

    /* ---------------- 开合状态与锚点 ---------------- */

    const ui = { open: false, anchor: null }
    const uiListeners = new Set()
    /** 工具行按钮所在会话的 inputActions，面板即使挂在别的槽位也能取到 */
    let lastActions = null

    function publish() {
      uiListeners.forEach((fn) => fn({ open: ui.open, anchor: ui.anchor }))
    }

    function openAt(anchor) {
      ui.anchor = anchor
      ui.open = true
      publish()
    }

    function close() {
      ui.open = false
      publish()
    }

    function useUi() {
      const [value, setValue] = useState({ open: ui.open, anchor: ui.anchor })
      useEffect(() => {
        uiListeners.add(setValue)
        return () => uiListeners.delete(setValue)
      }, [])
      return value
    }

    function anchorOf(element) {
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width }
    }

    /* ---------------- 样式 ---------------- */

    const CSS = `
.dshcs-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 8px;border:0;
  border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary,inherit);
  font:inherit;font-size:13px;font-weight:500;line-height:20px;white-space:nowrap;cursor:pointer;flex:none}
.dshcs-chip:hover,.dshcs-chip[data-open="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary,inherit)}
.dshcs-chip:disabled{opacity:.5;cursor:default}

.dshcs-panel{position:fixed;z-index:1200;box-sizing:border-box;display:flex;flex-direction:column;
  width:340px;max-width:calc(100vw - 24px);overflow:hidden;
  border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.22));border-radius:var(--dsw-radius-lg,10px);
  background:var(--dsw-specific-menu,var(--dsw-alias-bg-module-platform,#fff));
  backdrop-filter:var(--dsw-menu-backdrop-filter,none);box-shadow:var(--dsw-elevation-prominent,0 8px 28px rgba(0,0,0,.18));
  color:var(--dsw-alias-label-primary,inherit);font:inherit;font-size:13px;line-height:20px}

.dshcs-hd{display:flex;align-items:center;gap:8px;padding:10px 12px;
  border-bottom:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.18))}
.dshcs-hd-icon{flex:none;display:inline-flex;align-items:center}
.dshcs-title{flex:none;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}
.dshcs-search{flex:1 1 auto;min-width:0;height:26px;padding:0 8px;border-radius:var(--dsw-radius-sm,6px);
  border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));background:var(--dsw-specific-input-major,transparent);
  color:inherit;font:inherit;font-size:12px;outline:none}
.dshcs-search:focus{border-color:var(--dsw-alias-border-l4,rgba(128,128,128,.6))}
.dshcs-x{flex:none;width:24px;height:24px;padding:0;border:0;border-radius:var(--dsw-radius-sm,6px);
  background:transparent;color:var(--dsw-alias-label-tertiary,inherit);font:inherit;font-size:12px;cursor:pointer}
.dshcs-x:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary,inherit)}

.dshcs-list{max-height:264px;overflow-y:auto;padding:6px;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2,transparent)}
.dshcs-item{position:relative;display:flex;align-items:center;gap:8px;height:30px;padding:0 8px;
  border-radius:var(--dsw-radius-sm,6px);cursor:pointer;outline:none}
.dshcs-item:hover,.dshcs-item:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
.dshcs-item-title{flex:0 0 auto;max-width:45%;font-weight:600;color:var(--dsw-alias-label-primary,inherit);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dshcs-item-text{flex:1 1 auto;min-width:0;margin-right:44px;font-size:12px;line-height:16px;
  color:var(--dsw-alias-label-tertiary,inherit);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dshcs-ops{position:absolute;top:50%;right:6px;transform:translateY(-50%);display:none;gap:2px}
.dshcs-item:hover .dshcs-ops{display:flex}
.dshcs-op{width:22px;height:22px;padding:0;border:0;border-radius:5px;background:transparent;cursor:pointer;
  color:var(--dsw-alias-label-secondary,inherit);font:inherit;font-size:11px;line-height:1}
.dshcs-op:hover{background:var(--dsw-alias-interactive-bg-hover-solid,rgba(0,0,0,.12))}
.dshcs-empty{padding:22px 10px;text-align:center;font-size:12px;color:var(--dsw-alias-label-tertiary,inherit)}

.dshcs-ft{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;
  border-top:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.18))}
.dshcs-hint{font-size:11px;color:var(--dsw-alias-label-tertiary,inherit)}

.dshcs-form{display:flex;flex-direction:column;gap:8px;padding:10px 12px}
.dshcs-field{box-sizing:border-box;width:100%;padding:6px 8px;border-radius:var(--dsw-radius-sm,6px);
  border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));background:var(--dsw-specific-input-major,transparent);
  color:inherit;font:inherit;font-size:12px;outline:none}
.dshcs-field:focus{border-color:var(--dsw-alias-border-l4,rgba(128,128,128,.6))}
.dshcs-area{min-height:88px;line-height:1.6;resize:vertical}
.dshcs-actions{display:flex;justify-content:flex-end;gap:8px}

.dshcs-btn{height:26px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));
  border-radius:var(--dsw-radius-sm,6px);background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer}
.dshcs-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dshcs-btn-primary{border-color:transparent;background:var(--dsw-alias-button-info-fill,#2563eb);
  color:var(--dsw-alias-label-on-color,#fff)}
.dshcs-btn-primary:hover{background:var(--dsw-alias-button-info-hover,#1d4ed8)}
`

    function Styles() {
      return h('style', { dangerouslySetInnerHTML: { __html: CSS } })
    }

    function BoltIcon(props) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: props && props.size ? props.size : 14,
          height: props && props.size ? props.size : 14,
          'aria-hidden': true,
        },
        h('path', { d: 'M9.9 1.6L3 9.9h4.2l-1.5 4.9 6.9-9h-4.1z', fill: 'url(#dshcs-bolt)' }),
      )
    }

    function BoltGradient() {
      return h(
        'svg',
        { width: 0, height: 0, 'aria-hidden': true, style: { position: 'absolute', width: 0, height: 0 } },
        h(
          'defs',
          null,
          h(
            'linearGradient',
            { id: 'dshcs-bolt', x1: '0', y1: '0', x2: '0', y2: '1' },
            h('stop', { offset: '0', stopColor: '#FFDA5C' }),
            h('stop', { offset: '1', stopColor: '#F0930B' }),
          ),
        ),
      )
    }

    /* ---------------- 工具行按钮 ---------------- */

    function Chip(props) {
      const state = useUi()
      const ref = useRef(null)
      const available = !!props.inputActions

      useEffect(() => {
        if (props.inputActions) lastActions = props.inputActions
      }, [props.inputActions])

      const toggle = () => {
        if (ui.open) {
          close()
          return
        }
        openAt(anchorOf(ref.current))
      }

      return h(
        React.Fragment,
        null,
        h(Styles),
        h(BoltGradient),
        h(
          'button',
          {
            ref,
            type: 'button',
            className: 'dshcs-chip',
            'data-open': state.open ? 'true' : 'false',
            'aria-haspopup': 'dialog',
            'aria-expanded': state.open,
            title: '快捷指令：把常用提示词填进输入框',
            disabled: !available,
            onMouseDown: (e) => e.preventDefault(),
            onClick: (e) => {
              e.preventDefault()
              e.stopPropagation()
              toggle()
            },
          },
          h(BoltIcon),
          h('span', null, '快捷指令'),
        ),
      )
    }

    /* ---------------- 快捷指令面板 ---------------- */

    function Panel(props) {
      const state = useUi()
      const [list, setList] = useState(loadItems())
      const [query, setQuery] = useState('')
      const [draft, setDraft] = useState(null)
      const rootRef = useRef(null)
      const searchRef = useRef(null)

      useEffect(() => {
        const fn = (next) => setList(next)
        itemListeners.add(fn)
        return () => itemListeners.delete(fn)
      }, [])

      useEffect(() => {
        if (!state.open) return
        setQuery('')
        setDraft(null)
        const timer = setTimeout(() => {
          if (createPortal && searchRef.current) searchRef.current.focus()
        }, 30)
        return () => clearTimeout(timer)
      }, [state.open])

      useEffect(() => {
        if (!state.open) return
        const onPointerDown = (e) => {
          const target = e.target
          if (!(target instanceof Node)) return
          if (rootRef.current && rootRef.current.contains(target)) return
          if (target instanceof Element && target.closest('.dshcs-chip') !== null) return
          close()
        }
        const onKeyDown = (e) => {
          if (e.key !== 'Escape') return
          if (draft) setDraft(null)
          else close()
        }
        const dismiss = () => close()
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        window.addEventListener('resize', dismiss)
        window.addEventListener('scroll', dismiss, true)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
          window.removeEventListener('resize', dismiss)
          window.removeEventListener('scroll', dismiss, true)
        }
      }, [state.open, draft])

      if (!state.open) return null

      const actions = props.inputActions || lastActions
      const anchor = state.anchor

      const filtered = query
        ? list.filter((item) => (item.title + ' ' + item.text).toLowerCase().includes(query.toLowerCase()))
        : list

      function apply(item) {
        if (!actions) return false
        if (typeof actions.setDraft === 'function') actions.setDraft(item.text)
        else actions.insertText(item.text, actions.captureInsertion())
        close()
        return true
      }

      const placement = anchor
        ? {
            left: Math.min(Math.max(12, anchor.left), Math.max(12, window.innerWidth - 340 - 12)),
            bottom: Math.max(12, window.innerHeight - anchor.top + 6),
          }
        : { left: 12, bottom: 12 }

      const body = draft
        ? h(
            'div',
            { className: 'dshcs-form' },
            h('input', {
              className: 'dshcs-field',
              placeholder: '名称，例如「写周报」',
              value: draft.title,
              onChange: (e) => setDraft({ ...draft, title: e.target.value }),
            }),
            h('textarea', {
              className: 'dshcs-field dshcs-area',
              placeholder: '要填进输入框的完整文字',
              value: draft.text,
              onChange: (e) => setDraft({ ...draft, text: e.target.value }),
            }),
            h(
              'div',
              { className: 'dshcs-actions' },
              h('button', { type: 'button', className: 'dshcs-btn', onClick: () => setDraft(null) }, '取消'),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dshcs-btn dshcs-btn-primary',
                  onClick: () => {
                    const title = draft.title.trim()
                    const text = draft.text.trim()
                    if (!title || !text) return
                    const next = draft.id
                      ? list.map((item) => (item.id === draft.id ? { ...item, title, text } : item))
                      : list.concat([{ id: 'c' + Date.now().toString(36), title, text }])
                    persist(next)
                    setDraft(null)
                  },
                },
                '保存',
              ),
            ),
          )
        : h(
            React.Fragment,
            null,
            h(
              'div',
              { className: 'dshcs-list' },
              filtered.length === 0
                ? h('div', { className: 'dshcs-empty' }, query ? '没有匹配的快捷指令' : '还没有快捷指令，点下方「新建」')
                : filtered.map((item) =>
                    h(
                      'div',
                      {
                        key: item.id,
                        className: 'dshcs-item',
                        role: 'button',
                        tabIndex: 0,
                        onClick: () => apply(item),
                        onKeyDown: (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            apply(item)
                          }
                        },
                      },
                      h('div', { className: 'dshcs-item-title' }, item.title),
                      h('div', { className: 'dshcs-item-text' }, item.text),
                      h(
                        'div',
                        { className: 'dshcs-ops' },
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'dshcs-op',
                            title: '编辑',
                            onClick: (e) => {
                              e.stopPropagation()
                              setDraft({ ...item })
                            },
                          },
                          '改',
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'dshcs-op',
                            title: '删除',
                            onClick: (e) => {
                              e.stopPropagation()
                              persist(list.filter((entry) => entry.id !== item.id))
                            },
                          },
                          '删',
                        ),
                      ),
                    ),
                  ),
            ),
            h(
              'div',
              { className: 'dshcs-ft' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dshcs-btn',
                  onClick: () => setDraft({ id: null, title: '', text: '' }),
                },
                '新建',
              ),
              h('span', { className: 'dshcs-hint' }, '点一条即填入，不会发送'),
            ),
          )

      const panel = h(
        'div',
        {
          ref: rootRef,
          className: 'dshcs-panel',
          role: 'dialog',
          'aria-label': '快捷指令',
          style: createPortal
            ? { position: 'fixed', left: placement.left + 'px', bottom: placement.bottom + 'px' }
            : { position: 'absolute', left: 0, bottom: '100%', marginBottom: '6px' },
        },
        h(Styles),
        h(BoltGradient),
        h(
          'div',
          { className: 'dshcs-hd' },
          h('span', { className: 'dshcs-hd-icon' }, h(BoltIcon, { size: 13 })),
          h('span', { className: 'dshcs-title' }, '快捷指令'),
          h('input', {
            ref: searchRef,
            className: 'dshcs-search',
            placeholder: '搜索快捷指令…',
            value: query,
            onChange: (e) => setQuery(e.target.value),
          }),
          h('button', { type: 'button', className: 'dshcs-x', title: '关闭', onClick: () => close() }, '✕'),
        ),
        body,
      )

      return createPortal ? createPortal(panel, document.body) : panel
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.input.left', () =>
          ctx.slots.register({ name: 'conversation.input.left', id: 'command-shortcut-chip', order: 10 }, Chip),
        )
        ctx.slots.inject('conversation.input.overlay', () =>
          ctx.slots.register({ name: 'conversation.input.overlay', id: 'command-shortcut-panel', order: 10 }, Panel),
        )
      },
    }
  },
})
