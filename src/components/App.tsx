import { Component } from "inferno"
import { Logs } from "./Logs"
import { Range } from "../helpers/Time"
import { AttachHistogramCallback, Histogram } from "./Histogram"
import { Manager } from "../services/Manager"
import { Query } from "../services/Query"
import { ChangeFilterCallback, FilterDropdown, FilterItem } from "./FilterDropdown"
import { ChangeSettingCallback, MenuSetting } from "./menu/MenuSetting"
import {Direction, Theme, TimeZone} from "../services/Prefs"
import { Welcome } from "./Welcome"
import { Error } from "./Error"
import { Title } from "./Title"
import { SearchBar, SearchBarCallback } from "./SearchBar"
import { ChangeRangeCallback, Picker } from "./picker/Picker"
import { MenuTitle } from "./menu/MenuTitle"
import { MenuDropdown } from "./menu/MenuDropDown"
import {MenuDivider} from "./menu/MenuDivider";
import {Button} from "./Button";

export type AttachResultsCallback = (el: HTMLElement) => void
export type DisplayCallback = (d: Display, errorMessage?: string) => void

export enum Display {
  logs,
  welcome,
  error,
}

export enum FilterType {
  dataSource = "dataSource",
  singleValue = "singleValue",
  addTerms = "addTerms",
}

interface Props {
  log: Manager
}

interface State {
  display: Display
  theme: Theme
  direction: Direction
  tz: TimeZone
  filters: Filter[]
  errorMessage?: string
  query: Query,
  focusInput: boolean,
  logExportFormat: ExportLogFormat,
}

enum ExportLogFormat {
  JSON = "JSON",
  JSON_PER_LINE = "JSON_PER_LINE",
}

export type FilterEnableRule = {
  kind: 'filter'
  id: string
  value: string | string[] | undefined
}

export type EnableRule = FilterEnableRule

export type Filter = {
  id: string
  title: string
  selected?: string
  default: string
  items: FilterItem[]
  type: FilterType | string
  urlKey: string

  remember?: boolean

  enabled?: EnableRule[]
}

export class App extends Component<Props, State> {
  private log: Manager
  private resultsElement: HTMLElement
  private histogramElement: SVGElement

  constructor(props) {
    super(props)

    this.log = this.props.log

    this.state = {
      filters: [],
      theme: Theme.Light,
      direction: Direction.Up,
      tz: TimeZone.Local,
      display: Display.welcome,
      query: new Query(),
      focusInput: true,
      logExportFormat: ExportLogFormat.JSON_PER_LINE,
    }
  }

  componentDidMount(): void {
    this.log.displayCallback = (display: Display, errorMessage?: string) => this.setState({display, errorMessage})
    this.log.filterCallback = (filters: Filter[]) => this.setState({filters})
    this.log.themeCallback = (theme: Theme) => this.setState({theme})
    this.log.directionCallback = (direction: Direction) => this.setState({direction})
    this.log.timeZoneCallback = (tz: TimeZone) => this.setState({tz})
    this.log.queryCallback = (query: Query) => this.setState({query})
    this.log.run(this.resultsElement, this.histogramElement)
  }

  handleAttachResults: AttachResultsCallback = (el: HTMLElement) => this.resultsElement = el
  handleAttachHistogram: AttachHistogramCallback = (el: SVGElement) => this.histogramElement = el

  handleSearchBarCallback: SearchBarCallback = (text, submit) => this.log.handleSearchBarCallback(text || "", submit)
  handleTimeRangeChanged: ChangeRangeCallback = (range: Range) => this.log.handleRangeCallback(range)
  handleFilterChanged: ChangeFilterCallback = (filter: string, selected: string) => this.log.handleFilterChanged(filter, selected)

  handleThemeChanged: ChangeSettingCallback<Theme> = (theme: Theme) => this.log.handleThemeCallback(theme)
  handleDirectionChanged: ChangeSettingCallback<Direction> = (direction: Direction) => this.log.handleDirectionCallback(direction)
  handleTimeZoneChanged: ChangeSettingCallback<TimeZone> = (tz: TimeZone) => this.log.handleTimeZoneCallback(tz)

  handleLogFormatChanged: ChangeSettingCallback<ExportLogFormat> = (format: ExportLogFormat) => this.setState({logExportFormat: format})

  exportLog = () => {
    this.log.results.getLogEntries().then(async (logs) => {
      // @ts-ignore
      const newHandle = await window.showSaveFilePicker();

      const writableStream = await newHandle.createWritable();

      switch (this.state.logExportFormat) {
        case ExportLogFormat.JSON:
          await writableStream.write(JSON.stringify(logs, null, 2));
          break;
        case ExportLogFormat.JSON_PER_LINE:
          await writableStream.write(logs.map(l => JSON.stringify(l)).join("\n"))
          break;
        default:
          break;
      }

      await writableStream.close();
    })
  }

  render() {
    const range: Range = [this.state.query.startTime, this.state.query.endTime]
    return (
      <>
        <nav class="navbar is-fixed-top log-nav">
          <Title/>
          <SearchBar
            focusInput={this.state.focusInput}
            queryText={this.state.query.terms}
            onQueryText={this.handleSearchBarCallback}
          />

          <FilterDropdown filters={this.state.filters} onChange={this.handleFilterChanged}/>

          <Picker
            range={range}
            onChange={this.handleTimeRangeChanged}
          />

          <MenuDropdown title="Настройки" isActive="auto">
            <MenuTitle>Настройки</MenuTitle>
            <MenuSetting
              onChange={this.handleThemeChanged}
              setting="theme"
              value={this.state.theme}
              title="Тема"
              on={{title: "Темная", value: Theme.Dark}}
              off={{title: "Светлая", value: Theme.Light}}
            />
            <MenuSetting
              onChange={this.handleDirectionChanged}
              setting="direction"
              value={this.state.direction}
              title="Просмотро"
              on={{title: "Сверху вних", value: Direction.Up}}
              off={{title: "Снизу вверх", value: Direction.Down}}
            />
            <MenuSetting
              onChange={this.handleTimeZoneChanged}
              setting="tz"
              value={this.state.tz}
              title="Таймзона"
              on={{title: "локальная", value: TimeZone.Local}}
              off={{title: "UTC", value: TimeZone.UTC}}
            />
            <MenuDivider/>
            <MenuTitle>Экспорт</MenuTitle>
            <MenuSetting
              onChange={this.handleLogFormatChanged}
              setting="export-log-format"
              value={this.state.logExportFormat}
              title="Формат"
              on={{title: "Каждый лог с новой строки в формате json", value: ExportLogFormat.JSON_PER_LINE}}
              off={{title: "JSON", value: ExportLogFormat.JSON}}
            />
            <div className="navbar-action">
                <Button className="level-item" onClick={this.exportLog}>Экспорт</Button>
            </div>

          </MenuDropdown>

          <progress id="loading" class="progress is-info log-progress"/>
        </nav>

        <div class={`columns main-columns ${(this.state.display !== Display.logs) ? "is-hidden" : ""}`}>
          <div class="column logs-column">
            <Logs visible={this.state.display === Display.logs} onAttachResults={this.handleAttachResults}/>
          </div>
          <div class="column is-2 histogram-column">
            <Histogram onAttachHistogram={this.handleAttachHistogram} visible={this.state.display === Display.logs}/>
          </div>
        </div>

        <Welcome visible={this.state.display === Display.welcome}/>
        <Error visible={this.state.display === Display.error} message={this.state.errorMessage}/>

        <textarea id="copy-helper"/>
      </>
    )
  }
}