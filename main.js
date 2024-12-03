const version = '4'

let breaking = false
let draggingItem
let tasks = []
let timerTimeout
let timerInterval

if (window.localStorage.getItem('version') !== version) {
  window.localStorage.clear()
  window.localStorage.setItem('version', version)
  window.localStorage.setItem('tasks', JSON.stringify(tasks))
}

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => Array.from(document.querySelectorAll(sel))

const chime = $('audio')
const progressBar = $('progress')
const tasksList = $('ul')
const minute = 60_000

function addTask() {
  const task = createTask()
  const item = taskItem(task)
  tasksList.appendChild(item)
  item.querySelector('input').focus()
  updateTasks(tasks.concat(task))
}

function breakMinutes(minutesSpent) {
  if (minutesSpent <= 4) return 1
  if (minutesSpent <= 25) return 5
  if (minutesSpent <= 50) return 8
  if (minutesSpent <= 90) return 10
  return 15
}

function busyWithTask() {
  return tasks.some(
    (task) =>
      Number.isInteger(task.started) && !Number.isInteger(task.completed)
  )
}

function button(actionName, options = {}) {
  if (typeof options === 'string') options = { textContent: options }
  if (Array.isArray(options)) options = { children: options }
  const b = h('button', {
    ...options,
    attributes: {
      'data-action': actionName,
      ...options.attributes
    }
  })
  return b
}

function completeTask(taskId) {
  if (timerTimeout) clearTimeout(timerTimeout)
  if (timerInterval) clearInterval(timerInterval)
  const task = getTask(taskId)
  task.completed = Date.now()
  const minutes = breakMinutes(elapsedMinutes(task))
  const item = $(`li[data-id="${taskId}"]`)
  item.classList.add('-done')
  item.classList.remove('-active')
  item
    .querySelector('button[data-action="complete"]')
    .setAttribute('disabled', '')
  startBreak(minutes)
  updateTasks(tasks.filter((t) => t.id !== taskId).concat(task))
  tasksList.appendChild(item)
}

function createTask() {
  return {
    completed: null,
    id: Date.now().toString(),
    name: '',
    started: null
  }
}

function elapsedMinutes(task) {
  return Math.ceil((task.completed - task.started) / 60000)
}

function findTaskIndex(item) {
  for (let i in tasksList.children) {
    if (tasksList.children.item(i) === item) return i
  }
}

function getTask(id) {
  return tasks.find((t) => t.id === id)
}

function h(def, options = {}) {
  if (typeof options === 'string') options = { textContent: options }
  if (Array.isArray(options)) options = { children: options }
  const { actions, attributes, children, classes = [], textContent } = options
  const [type, ...inlineClasses] = def.split('.')
  const element = document.createElement(type)
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined) element.setAttribute(key, value)
    }
  }
  for (const className of inlineClasses.filter((c) => c)) {
    element.classList.add(className)
  }
  for (const className of classes.filter((c) => c)) {
    element.classList.add(className)
  }
  if (textContent) element.textContent = textContent
  if (children) {
    for (const child of children) {
      if (child) element.appendChild(child)
    }
  }
  if (actions) {
    for (const [eventType, handler] of Object.entries(actions)) {
      element.addEventListener(eventType, (event) => handler(event, element))
    }
  }
  return element
}

function icon(shape) {
  const icon = $(`svg[data-shape="${shape}"]`).cloneNode(true)
  icon.removeAttribute('data-shape')
  return icon
}

function promptClearTasks() {
  if (!confirm('Clear all tasks?')) return
  clearTimeout(timerTimeout)
  tasksList.innerHTML = ''
  updateTasks([])
}

function promptRemoveTask(taskId) {
  tasksList.removeChild($(`li[data-id="${taskId}"]`))
  updateTasks(tasks.filter((t) => t.id !== taskId))
}

function renderTasks() {
  tasksList.innerHTML = ''
  for (const task of tasks) {
    const item = taskItem(task)
    tasksList.appendChild(item)
    if (Number.isInteger(task.started)) {
      if (Number.isInteger(task.completed)) {
        item.querySelector('.timer').textContent =
          elapsedMinutes(task).toString()
      } else {
        startCounting(task)
      }
    }
  }
}

function saveState() {
  window.localStorage.setItem('tasks', JSON.stringify(tasks))
}

function startBreak(numMinutes) {
  breaking = true
  const total = numMinutes * minute
  let start
  let elapsed = 0
  progressBar.setAttribute('max', total)
  progressBar.setAttribute('value', 0)
  const step = (timestamp) => {
    if (!start) start = timestamp
    elapsed = timestamp - start
    progressBar.setAttribute('value', elapsed)
    if (elapsed < total) return window.requestAnimationFrame(step)
    chime.play()
    progressBar.removeAttribute('value')
    progressBar.removeAttribute('max')
    for (const button of $$('button[data-action="start"]')) {
      button.removeAttribute('disabled')
    }
  }
  window.requestAnimationFrame(step)
}

function startCounting(task) {
  const taskItem = $(`li[data-id="${task.id}"]`)
  const timer = taskItem.querySelector('.timer')
  const updateCount = () => {
    const elapsed = Math.ceil((Date.now() - task.started) / minute)
    timer.textContent = Math.max(1, elapsed).toString()
  }
  updateCount()
  const currentMs = Date.now() % minute
  const taskOffset = task.started % minute
  const delay =
    currentMs > taskOffset
      ? minute + taskOffset - currentMs
      : taskOffset - currentMs
  timerTimeout = setTimeout(() => {
    updateCount()
    timerTimeout = null
    timerInterval = setInterval(updateCount, minute)
  }, delay)
}

function startMoving(taskItem) {
  taskItem.setAttribute('draggable', 'true')
}

function startTask(taskItem) {
  const task = {
    ...getTask(taskItem.getAttribute('data-id')),
    started: Date.now()
  }
  updateTask(task)
  startCounting(task)
  taskItem.classList.add('-active')
  for (const startButton of $$('button[data-action="start"]')) {
    startButton.setAttribute('disabled', '')
  }
}

function taskItem(task) {
  return h('li', {
    attributes: {
      'data-id': task.id
    },
    children: [
      button('move', { children: [icon('move')] }),
      button('start', {
        attributes: {
          disabled: busyWithTask() ? '' : undefined
        },
        children: [icon('start')]
      }),
      button('complete', {
        attributes: {
          disabled: Number.isInteger(task.completed) ? '' : undefined
        },
        children: [h('span.timer'), icon('check')]
      }),
      h('input', {
        attributes: {
          type: 'text',
          value: task.name
        }
      }),
      button('delete', { children: [icon('trash')] })
    ],
    classes: [
      Number.isInteger(task.started)
        ? Number.isInteger(task.completed)
          ? '-done'
          : '-active'
        : undefined
    ]
  })
}

function updateTask(task) {
  updateTasks(tasks.map((t) => (t.id === task.id ? task : t)))
}

function updateTasks(_tasks) {
  tasks = _tasks
  saveState()
}

window.addEventListener('click', (event) => {
  const action = event.target.getAttribute('data-action')
  if (!action) return

  switch (action) {
    case 'clear':
      return promptClearTasks()
    case 'complete':
      return completeTask(event.target.parentElement.getAttribute('data-id'))
    case 'create':
      return addTask()
    case 'delete':
      return promptRemoveTask(
        event.target.parentElement.getAttribute('data-id')
      )
    case 'move':
      return // Don't do anything for full click event of the move button
    case 'start':
      return startTask(event.target.parentElement)
    default:
      console.log(`Didn‘t handle “${action}” action`)
  }
})

window.addEventListener('dragend', () => {
  updateTasks(
    Array.from(tasksList.children).map((item) =>
      tasks.find((t) => t.id === item.getAttribute('data-id'))
    )
  )
  tasksList.classList.remove('-dragging')
  draggingItem.removeAttribute('draggable')
  draggingItem = undefined
})

window.addEventListener('dragover', (event) => {
  event.preventDefault()
  if (!event.target.hasAttribute('data-id')) return
  if (event.target === draggingItem) return
  const src = findTaskIndex(draggingItem)
  const dest = findTaskIndex(event.target)
  if (dest < src) return tasksList.insertBefore(draggingItem, event.target)
  if (dest === tasksList.children.length - 1)
    return todoList.appendChild(draggingItem)
  tasksList.insertBefore(draggingItem, tasksList.children.item(dest + 1))
})

window.addEventListener('dragstart', (event) => {
  draggingItem = event.target
  tasksList.classList.add('-dragging')
})

window.addEventListener('input', (event) => {
  const taskId = event.target.parentElement.getAttribute('data-id')
  updateTask({ ...getTask(taskId), name: event.target.value })
})

window.addEventListener('keyup', (event) => {
  if (event.target === document.body) {
    event.stopPropagation()
    switch (event.key) {
      case 'a':
        return addTask()
    }
  } else {
    switch (event.key) {
      case 'Enter':
        return event.target.blur()
    }
  }
})

window.addEventListener('mousedown', (event) => {
  if (event.target.getAttribute('data-action') !== 'move') return
  startMoving(event.target.parentElement)
})

const savedTasks = window.localStorage.getItem('tasks')
if (savedTasks) tasks = JSON.parse(savedTasks)
renderTasks()
