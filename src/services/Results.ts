import {FieldsConfig, LogFormatter, QueryManipulator} from "./Log"
import {Lookup} from "../helpers/Lookup"
import {LogMessage} from "../backends/elasticsearch/Elasticsearch"
import {Direction, SwapDirection, TimeZone} from "./Prefs"
import {Time} from "../helpers/Time"

export interface IStats {
  visible: number
}

export class Results {
  stats: IStats
  private logs: HTMLElement
  private templateElement: HTMLTemplateElement
  private templateContent: DocumentFragment
  logFormatter: LogFormatter

  private maxVisible = 2000
  private maxChunkSize = 50
  private currentChunkSize = 0
  private currentChunkDirection: Direction
  private chunk: HTMLDivElement
  private direction: Direction
  private tz: TimeZone
  private fieldsConfig: FieldsConfig
  private following: boolean
  private beforeLogs: HTMLElement
  private afterLogs: HTMLElement
  private savedScrollEntry: HTMLElement
  private queryManipulator: QueryManipulator
  private entries: any[]

  constructor(direction: Direction, tz: TimeZone) {
    this.direction = direction
    this.tz = tz
    this.entries = []
    this.stats = {
      visible: 0,
    }
  }

  attach(element: HTMLElement, fieldsConfig: FieldsConfig, queryManipulator: QueryManipulator) {
    this.logs = element
    this.beforeLogs = Lookup.element("#before-logs")
    this.beforeLogs.hidden = true
    this.afterLogs = Lookup.element("#after-logs")
    this.afterLogs.hidden = true
    this.templateElement = Lookup.element('#logs-entry-template')
    this.templateContent = this.templateElement.content
    this.queryManipulator = queryManipulator
    this.fieldsConfig = fieldsConfig
    this.newLogFormatter()
    this.newChunk(this.direction)
    this.followInterval()
  }

  private newLogFormatter() {
    this.logFormatter = new LogFormatter(this.fieldsConfig, this.tz).setTemplate(this.templateContent)
    this.logFormatter.queryManipulator = this.queryManipulator
  }

  setFieldsConfig(fieldsConfig: FieldsConfig) {
    this.fieldsConfig = fieldsConfig
    this.newLogFormatter()
  }

  setTimeZone(tz: TimeZone) {
    this.tz = tz
    this.newLogFormatter()
  }

  setDirection(direction: Direction) {
    if (this.direction === direction) {
      return
    }

    this.direction = direction
    this.swapDirection()
  }

  followInterval() {
    if (this.following) {
      this.scrollToLatest()
    }
    requestAnimationFrame(this.followInterval.bind(this))
  }

  follow(following: boolean) {
    this.following = following
  }

  scrollToLatest() {
    switch (this.direction) {
      case Direction.Down:
        this.scroll(document.body.scrollHeight)
        break
      case Direction.Up:
        this.scroll(0)
        break
      default:
        throw new Error(`Некоректное значение: ${this.direction}`)
    }
  }

  addFragment(fragment, direction: Direction) {
    if (direction !== this.currentChunkDirection) {
      if (this.stats.visible === 0) {
        this.currentChunkDirection = direction
      } else {
        this.newChunk(direction)
      }
    }

    switch (direction) {
      case Direction.Down:
        this.chunk.appendChild(fragment)
        break
      case Direction.Up:
        this.chunk.insertBefore(fragment, this.chunk.children[0])
        break
      default:
        throw new Error(`Некоректное значени: ${direction}`)
    }

    this.stats.visible++

    if (this.stats.visible > this.maxVisible) {
      switch (direction) {
        case Direction.Down:
          this.logs.removeChild(this.logs.children[0])
          break
        case Direction.Up:
          this.logs.removeChild(this.logs.children[this.logs.children.length - 1])
          break
        default:
          throw new Error(`Некоректное значени: ${direction}`)
      }
      this.stats.visible -= this.maxChunkSize
    }

    this.currentChunkSize++
    if (this.currentChunkSize >= this.maxChunkSize) {
      this.newChunk(direction)
    }
  }

  append(entry: LogMessage) {
    this.entries.push(entry)
    const fragment = this.logFormatter.build(entry)
    this.addFragment(fragment, this.direction)
  }

  prepend(entry: any) {
    this.entries.unshift(entry)
    const fragment = this.logFormatter.build(entry)
    this.addFragment(fragment, SwapDirection(this.direction))
  }

  addMarker() {
    const fragment = document.createElement('div')
    fragment.classList.add('log-divider')
    this.addFragment(fragment, this.direction)
  }

  isOlderAtTop(older: boolean): boolean {
    return ((older && this.direction === Direction.Down) || (!older && this.direction === Direction.Up))
  }

  getMarker(older: boolean): HTMLElement {
    return this.isOlderAtTop(older) ? this.beforeLogs : this.afterLogs
  }

  setMarkerCallback(older: boolean, callback: () => void) {
    this.getMarker(older).addEventListener("click", () => {
      callback()
    })
  }

  updateMoreMarker(older: boolean, loading: boolean) {
    const marker = this.getMarker(older)
    marker.hidden = false
    if (loading) {
      marker.innerText = "Загрузка"
    } else {
      marker.innerHTML = older ? "Старые результаты" : "Новые результаты"
    }
  }

  getTopEntry(): HTMLElement {
    for (const chunk of this.logs.children) {
      if (chunk.children.length > 0) {
        return chunk.children[0] as HTMLElement
      }
    }
    return undefined
  }

  getBottomEntry(): HTMLElement {
    let lastChunk: Element | undefined
    for (const chunk of this.logs.children) {
      if (chunk.children.length > 0) {
        lastChunk = chunk
      }
    }

    return lastChunk ? lastChunk.children[lastChunk.children.length - 1] as HTMLElement : undefined
  }

  getEntryAt(idx: number): HTMLElement {
    for (const chunk of this.logs.children) {
      for (const row of chunk.children) {
        if (idx === 0) {
          return row as HTMLElement
        }
        idx--
      }
    }
    return undefined
  }

  find(predicate: (e: HTMLElement) => boolean): HTMLElement {
    for (const chunk of this.logs.children) {
      for (const row of chunk.children) {
        if (predicate(row as HTMLElement)) {
          return row as HTMLElement
        }
      }
    }
    return undefined
  }

  getCursor(older: boolean) {
    const top = this.isOlderAtTop(older)
    const entry = (top) ? this.getTopEntry() : this.getBottomEntry()
    return JSON.parse(entry.dataset.cursor)
  }

  clear() {
    this.stats.visible = 0
    this.logs.innerHTML = ''
    this.beforeLogs.hidden = true
    this.afterLogs.hidden = true
    this.entries = []
    this.newChunk(this.direction)
  }

  private newChunk(direction: Direction) {
    this.currentChunkSize = 0
    this.currentChunkDirection = direction
    this.chunk = document.createElement('div')
    switch (direction) {
      case Direction.Down:
        this.logs.appendChild(this.chunk)
        break
      case Direction.Up:
        this.logs.insertBefore(this.chunk, this.logs.children[0])
        break
      default:
        throw new Error(`Неизвестная директория ${direction}`)
    }
  }

  private swapDirection() {
    const elements: Element[] = []
    for (const chunk of this.logs.children) {
      for (const row of chunk.children) {
        elements.push(row as HTMLElement)
      }
    }
    const entries = this.entries

    this.clear()
    elements.reverse()
    entries.reverse()
    this.entries = entries
    for (const elm of elements) {
      this.addFragment(elm, Direction.Down)
    }

    const y = this.logs.offsetHeight + this.logs.offsetTop - window.scrollY - window.innerHeight
    this.scroll(y)
  }

  private scroll(y: number) {
    window.scrollTo(window.scrollX, y)
  }

  saveScroll(older: boolean) {
    if (this.isOlderAtTop(older)) {
      this.savedScrollEntry = this.getTopEntry()
    }
  }

  restoreScroll(older: boolean) {
    if (this.savedScrollEntry === undefined || this.savedScrollEntry.scrollIntoView === undefined) {
      return
    }

    if (this.isOlderAtTop(older)) {
      this.savedScrollEntry.scrollIntoView({block: "start"})

      window.scrollBy(0, -100)
    }
  }

  domEntryToDate(e: HTMLElement): Date {
    return Time.whenToDate(Time.parseText(e.dataset.ts))
  }

  getRange(): [Date, Date] {
    if (this.stats.visible === 0) {
      return undefined
    }

    return [
      this.domEntryToDate(this.getTopEntry()),
      this.domEntryToDate(this.getBottomEntry()),
    ]
  }

  getVisibleRange(): [Date, Date] {
    if (this.stats.visible === 0) {
      return undefined
    }

    return [
      this.getScrollTop() / this.getScrollHeight(),
      (this.getScrollTop() + document.documentElement.clientHeight) / this.getScrollHeight(),
    ]
      .map(e => Math.floor(this.stats.visible * e))
      .map(e => Math.max(0, e))
      .map(e => Math.min(this.stats.visible - 1, e))
      .map(e => this.getEntryAt(e))
      .map(e => this.domEntryToDate(e)) as [Date, Date]
  }

  getScrollTop(): number {
    return document.documentElement.scrollTop || document.body.scrollTop
  }

  getScrollHeight(): number {
    return document.documentElement.scrollHeight || document.body.scrollHeight
  }

  focusID(id: string) {
    const e = this.find((elm: HTMLElement) => elm.dataset.id === id)
    if (!e) {
      // tslint:disable-next-line:no-console
      console.error(`Не удалось найти ни одного элемента с id ${id}.`)
      return
    }

    e.scrollIntoView({block: "center"})
    const el = e.getElementsByClassName("unexpanded")[0] as HTMLElement
    el.click()
  }

  getLogEntries(): Promise<any[]> {
    let entries = this.entries
    switch (this.direction) {
      case Direction.Up:
        entries = this.entries.reverse()
        break;
      case Direction.Down:
      default:
        break;
    }
    return Promise.all(entries.map(e => e._full))
  }
}
