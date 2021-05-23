import { Component } from "inferno"

export type SearchBarCallback = (text: string, submit: boolean) => void

interface Props {
  queryText: string
  focusInput: boolean
  onQueryText: SearchBarCallback
}

export class SearchBar extends Component<Props, any> {
  private inputRef: HTMLInputElement

  componentDidMount() {
    this.focusCheck(true)
  }

  componentDidUpdate() {
    this.focusCheck(false)
  }

  focusCheck(initial: boolean) {
    if (this.props.focusInput) {
      this.inputRef.focus()
      if (initial) {
        this.inputRef.selectionStart = this.inputRef.selectionEnd = this.inputRef.value.length
      }
    }
  }

  saveInputRef = (el: HTMLInputElement) => this.inputRef = el

  handleSearchChanged = e => {
    this.props.onQueryText(e.target.value, false)
  }

  handleSearchKeyPressed = e => {
    if (e.key === "Enter") {
      this.handleSubmit()
    }
  }

  handleSubmit = () => {
    this.props.onQueryText(this.props.queryText, true)
  }

  render() {
    return (
      <div class="navbar-item is-expanded">
        <div class="field has-addons log-wide log-input-outer">
          <p class="control log-wide">
            <input
              class="input"
              ref={this.saveInputRef}
              value={this.props.queryText}
              onInput={this.handleSearchChanged}
              onKeyPress={this.handleSearchKeyPressed}
              placeholder="Поиск..."
            />
          </p>
          <p class="control">
            <button class="button" onClick={this.handleSubmit}>
              <span class="icon">
                <i class="mdi mdi-magnify"/>
              </span>
              <span>Поиск</span>
            </button>
          </p>
        </div>
      </div>
    )
  }
}