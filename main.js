const emptyState = {
  completedTasks: [],
  currentTask: null,
  todoTasks: []
}

const $ = sel => document.querySelector(sel)

const breakContainer = $('#Break')
const breakProgress = $('#BreakProgress')
const breakTime = $('#BreakTime')
const chimeAudio = $('#Chime')
const clearCompletedButton = $('#ClearCompleted')
const clearTodosButton = $('#ClearTodos')
const completedList = $('#CompletedTasks ul')
const currentTask = $('#CurrentTask')
const currentTaskName = $('#CurrentTask .name')
const currentTimer = $('#CurrentTask .timer')
const finishTaskButton = $('#FinishTask')
const interruptedButton = $('#Interrupted')
const interruptedCount = $('#Interrupted .count')
const todoList = $('#TodoTasks ul')

let breaking = false
let currentTimerInterval = null
let currentTimerTimeout = null
let state = JSON.parse(window.localStorage.getItem('state')) || emptyState

function addTodo () {
  const task = { id: Date.now().toString(), name: '' }
  appendTodo(task, true)
  updateState({ todoTasks: state.todoTasks.concat(task) })
}

function appendCompleted (task) {
  const item = document.createElement('li')
  item.textContent = task.name
  const timer = document.createElement('span')
  timer.classList.add('timer')
  const elapsedMinutes = Math.ceil((task.finished - task.started) / 60000)
  const anyInterruptions = task.interruptions > 0
    ? `, ${task.interruptions} interruption${task.interruptions === 1 ? '' : 's'}`
    : ''
  timer.textContent = `${elapsedMinutes} min${anyInterruptions}`
  item.appendChild(timer)
  completedList.appendChild(item)
}

function appendTodo (task, focus = false) {
  const item = document.createElement('li')
  item.setAttribute('data-id', task.id)
  const startButton = document.createElement('button')
  startButton.classList.add('-start')
  startButton.addEventListener('click', () => {
    todoList.removeChild(item)
    updateState({ todoTasks: state.todoTasks.filter(t => t.id !== task.id) })
    startTask(task)
  })
  startButton.textContent = 'Start'
  if (task.name.length === 0) {
    startButton.setAttribute('disabled', '')
  }
  item.appendChild(startButton)
  const nameInput = document.createElement('input')
  nameInput.setAttribute('type', 'text')
  nameInput.value = task.name
  nameInput.addEventListener('input', () => {
    task.name = nameInput.value
    if (nameInput.value.length > 0 && state.currentTask === null && !breaking) {
      enable(startButton)
    } else {
      disable(startButton)
    }
    updateState({
      todoTasks: state.todoTasks.map(t => t.id === task.id ? task : t)
    })
  })
  item.appendChild(nameInput)
  const deleteButton = document.createElement('button')
  deleteButton.classList.add('-danger', '-icon')
  deleteButton.textContent = '×'
  deleteButton.addEventListener('click', () => {
    if (window.confirm('Are you sure?')) {
      todoList.removeChild(item)
      updateState({ todoTasks: state.todoTasks.filter(t => t.id !== task.id) })
    }
  })
  item.appendChild(deleteButton)
  todoList.appendChild(item)
  if (focus) setTimeout(() => nameInput.focus(), 50)
}

function breakMinutes (minutesSpent) {
  if (minutesSpent <= 4) return 1
  if (minutesSpent <= 25) return 5
  if (minutesSpent <= 50) return 8
  if (minutesSpent <= 90) return 10
  return 15
}

function disable (button) {
  if (!button.hasAttribute('disabled')) {
    button.setAttribute('disabled', '')
  }
}

function enable (button) {
  if (button.hasAttribute('disabled')) {
    button.removeAttribute('disabled')
  }
}

function populateCurrentTask (task) {
  currentTaskName.textContent = task.name
  const updateCount = () => {
    const elapsed = Math.ceil((Date.now() - task.started) / 60000)
    currentTimer.textContent = `${Math.max(1, elapsed)} min`
  }
  updateCount()
  const currentMs = Date.now() % 60000
  const taskOffset = task.started % 60000
  const delay = currentMs > taskOffset
    ? 60000 + taskOffset - currentMs
    : taskOffset - currentMs
  currentTimerTimeout = setTimeout(() => {
    updateCount()
    currentTimerTimeout = null
    currentTimerInterval = setInterval(updateCount, 60000)
  }, delay)
  interruptedCount.textContent = '0'
  currentTask.classList.add('-busy')
}

function startBreak (minutesSpent) {
  breaking = true
  const breakMs = breakMinutes(minutesSpent) * 60000
  const start = Date.now()
  let remainingSeconds = Math.ceil(breakMs / 1000)
  breakTime.textContent = remainingSeconds
  breakProgress.style.width = '0%'
  breakContainer.classList.add('-active')
  const countdown = setInterval(() => {
    const elapsedMs = Date.now() - start
    remainingSeconds = Math.ceil((breakMs - elapsedMs) / 1000)
    breakTime.textContent = remainingSeconds
    breakProgress.style.width = `${100 * elapsedMs / breakMs}%`
    if (breaking && elapsedMs >= (breakMs - 250)) {
      breakContainer.classList.remove('-active')
      breaking = false
      Array.from(document.querySelectorAll('button.-start'))
        .filter(b => b.nextSibling.value.length > 0)
        .forEach(b => enable(b))
    }
    if (elapsedMs >= breakMs) {
      chimeAudio.play()
      clearInterval(countdown)
    }
  }, 250)
}

function startTask (todo) {
  const currentTask = {
    ...todo,
    interruptions: 0,
    started: Date.now()
  }
  populateCurrentTask(currentTask)
  updateState({
    currentTask,
    todoTasks: state.todoTasks.filter(t => t.id !== todo.id)
  })
}

function updateState (changes = {}) {
  state = { ...state, ...changes }
  window.localStorage.setItem('state', JSON.stringify(state))

  if (state.currentTask === null) {
    disable(finishTaskButton)
    disable(interruptedButton)
  } else {
    interruptedCount.textContent = state.currentTask.interruptions.toString()
    enable(finishTaskButton)
    enable(interruptedButton)
    Array.from(document.querySelectorAll('button.-start'))
      .forEach(b => disable(b))
  }

  if (state.todoTasks.length > 0) {
    enable(clearTodosButton)
  } else {
    disable(clearTodosButton)
  }

  if (state.completedTasks.length > 0) {
    enable(clearCompletedButton)
  } else {
    disable(clearCompletedButton)
  }
}

if (state.currentTask) {
  populateCurrentTask(state.currentTask)
}

state.todoTasks.forEach(t => appendTodo(t))
state.completedTasks.forEach(t => appendCompleted(t))

finishTaskButton.addEventListener('click', () => {
  const task = { ...state.currentTask, finished: Date.now() }
  appendCompleted(task)
  currentTask.classList.remove('-busy')
  interruptedCount.textContent = '—'
  breakContainer.classList.add('-active')
  if (currentTimerTimeout) {
    clearTimeout(currentTimerTimeout)
    currentTimerTimeout = null
  }
  if (currentTimerInterval) {
    clearInterval(currentTimerInterval)
    currentTimerInterval = null
  }
  startBreak(Math.ceil((task.finished - task.started) / 60000))
  updateState({
    completedTasks: state.completedTasks.concat(task),
    currentTask: null
  })
})

interruptedButton.addEventListener('click', () => {
  updateState({
    currentTask: {
      ...state.currentTask,
      interruptions: state.currentTask.interruptions + 1
    }
  })
})

$('#AddTodo').addEventListener('click', addTodo)

clearCompletedButton.addEventListener('click', () => {
  if (window.confirm('Are you sure?')) {
    completedList.innerHTML = ''
    updateState({ completedTasks: [] })
  }
})

clearTodosButton.addEventListener('click', () => {
  if (window.confirm('Are you sure?')) {
    todoList.innerHTML = ''
    updateState({ todoTasks: [] })
  }
})

updateState()

window.addEventListener('keydown', event => {
  if (event.target === document.body && event.key === 'a') addTodo()
})

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
}
