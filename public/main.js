const addTaskButton = document.getElementById('AddTask')
const breakContainer = document.getElementById('Break')
const breakProgress = document.getElementById('BreakProgress')
const breakTimeLabel = document.getElementById('BreakTime')
const chimeAudio = document.getElementById('Chime')
const clearDoneButton = document.getElementById('ClearDone')
const completedList = document.getElementById('CompletedTasks')
const resetButton = document.getElementById('Reset')
const todoContainer = document.getElementById('Todo')

const emptyState = {
  completedTasks: [],
  currentTaskId: null,
  startDate: null,
  todoTasks: []
}

let state = JSON.parse(window.localStorage.getItem('state')) || emptyState

// Functions -----------------------------------------------------------------------------

function addTask () {
  const name = window.prompt('Enter new task')
  if (!name) return
  const task = { id: Date.now().toString(), name }
  appendTodo(task)
  update({ todoTasks: state.todoTasks.concat(task) })
}

function appendCompleted ({ minutes, name }) {
  const taskItem = document.createElement('li')
  const timeSpan = document.createElement('span')
  timeSpan.classList.add('time')
  timeSpan.textContent = `${minutes}m`
  taskItem.appendChild(timeSpan)
  taskItem.appendChild(document.createTextNode(name))
  completedList.append(taskItem)
  if (clearDoneButton.hasAttribute('disabled')) {
    clearDoneButton.removeAttribute('disabled')
  }
  if (resetButton.hasAttribute('disabled')) resetButton.removeAttribute('disabled')
}

function appendTodo ({ id, name }) {
  const taskButton = document.createElement('button')
  taskButton.setAttribute('data-id', id)
  taskButton.textContent = name
  if (state.currentTaskId !== null) {
    if (state.currentTaskId === id) {
      taskButton.classList.add('-current')
      setInProgressTitle(id)
    } else taskButton.setAttribute('disabled', '')
  }
  taskButton.addEventListener('click', () => {
    if (taskButton.classList.contains('-current')) completeTask()
    else startTask(id)
  })
  Array.from(todoContainer.children).concat(taskButton).sort(byTextContent)
    .forEach(button => todoContainer.appendChild(button))
  if (resetButton.hasAttribute('disabled')) resetButton.removeAttribute('disabled')
}

function breakMinutes (minutesSpent) {
  if (minutesSpent <= 4) return 1
  if (minutesSpent <= 25) return 5
  if (minutesSpent <= 50) return 8
  if (minutesSpent <= 90) return 10
  return 15
}

function byTextContent (a, b) {
  return a.textContent.toLowerCase() < b.textContent.toLowerCase() ? -1 : 1
}

function clearTitle () {
  document.title = 'Flowtime'
}

function completeTask () {
  const task = state.todoTasks.find(t => t.id === state.currentTaskId)
  if (!task) throw new Error(`Couldn’t find matching task ID: ${state.currentTaskId}`)
  const completedTask = {
    minutes: Math.ceil((Date.now() - state.startDate) / 60000),
    name: task.name
  }
  startBreak(completedTask.minutes)
    .then(() => {
      for (let i = todoContainer.children.length - 1; i >= 0; i--) {
        const button = todoContainer.children[i]
        if (button.classList.contains('-current')) todoContainer.removeChild(button)
        else button.removeAttribute('disabled')
      }
      appendCompleted(completedTask)
      update({
        completedTasks: state.completedTasks.concat(completedTask),
        currentTaskId: null,
        startDate: null,
        todoTasks: state.todoTasks.filter(t => t.id !== state.currentTaskId)
      })
    })
}

function setInProgressTitle (taskId) {
  const task = state.todoTasks.find(t => t.id === taskId)
  if (task) document.title = `▶️ ${task.name}`
}

function startBreak (minutesSpent) {
  return new Promise(resolve => {
    const breakMs = breakMinutes(minutesSpent) * 60000
    const start = Date.now()
    let remainingSeconds = Math.ceil(breakMs / 1000)
    document.title = `💤 (${remainingSeconds})`
    breakTimeLabel.textContent = Math.ceil(breakMs / 1000)
    breakProgress.style.width = '0%'
    breakContainer.classList.add('-active')
    document.body.classList.add('-break')
    setTimeout(() => {
      resolve()
      const countdown = setInterval(() => {
        const elapsedMs = Date.now() - start
        remainingSeconds = Math.ceil((breakMs - elapsedMs) / 1000)
        document.title = `💤 (${remainingSeconds})`
        breakTimeLabel.textContent = remainingSeconds
        breakProgress.style.width = `${100 * elapsedMs / breakMs}%`
        if (elapsedMs >= (breakMs - 500)) {
          breakContainer.classList.remove('-active')
          document.body.classList.remove('-break')
        }
        if (elapsedMs >= breakMs) {
          chimeAudio.play()
          clearTitle()
          clearInterval(countdown)
        }
      }, 250)
    }, 500)
  })
}

function startTask (taskId) {
  for (const button of todoContainer.children) {
    if (button.getAttribute('data-id') === taskId) button.classList.add('-current')
    else button.setAttribute('disabled', '')
  }
  setInProgressTitle(taskId)
  update({
    currentTaskId: taskId,
    startDate: Date.now()
  })
}

function update (changes) {
  state = { ...state, ...changes }
  window.localStorage.setItem('state', JSON.stringify(state))
}

// Initialization ------------------------------------------------------------------------

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
}

addTaskButton.addEventListener('click', addTask)

clearDoneButton.addEventListener('click', () => {
  completedList.innerHTML = ''
  clearDoneButton.setAttribute('disabled', '')
  if (state.todoTasks.length < 1) resetButton.setAttribute('disabled', '')
  update({ completedTasks: [] })
})

resetButton.addEventListener('click', () => {
  if (!window.confirm('Are you sure?')) return
  todoContainer.innerHTML = ''
  completedList.innerHTML = ''
  clearTitle()
  clearDoneButton.setAttribute('disabled', '')
  resetButton.setAttribute('disabled', '')
  update(emptyState)
})

state.todoTasks.forEach(appendTodo)
state.completedTasks.forEach(appendCompleted)

window.addEventListener('keydown', event => {
  if (event.key === 'a') addTask()
})
