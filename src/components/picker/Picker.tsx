import { Component } from "inferno"
import { Endpoint, InvalidDate, Now, Range, Time, When } from "../../helpers/Time"
import { PickerTextInput } from "./PickerTextInput"
import { PickerRangeButton } from "./PickerRangeButton"
import { Button } from "../Button"
import flatpickr from "flatpickr"
import { Russian } from "flatpickr/dist/l10n/ru.js"
import { MenuItem } from "../menu/MenuItem"
import { MenuDropdown } from "../menu/MenuDropDown"

export type ChangeRangeCallback = (range: Range) => void

type InputRange = [InputInfo, InputInfo]

export type InputInfo = {
  when: When
  text: string
  isValid: boolean
}

interface Props {
  range: Range
  onChange: ChangeRangeCallback
}

interface State {
  isActive: boolean
  inputs: InputRange
}

export class Picker extends Component<Props, State> {
  private picker: flatpickr.Instance

  private isPicking = false

  constructor(props) {
    super(props)

    this.state = {
      isActive: false,
      inputs: Picker.rangeToInputRange(props.range),
    }
  }

  static whenToInput(when: When): InputInfo {
    return {
      when,
      text: Time.whenToText(when),
      isValid: true,
    }
  }

  static rangeToInputRange(range: Range): InputRange {
    return [
      Picker.whenToInput(range[Endpoint.Start]),
      Picker.whenToInput(range[Endpoint.End]),
    ]
  }

  componentWillReceiveProps(nextProps: Props): void {
    if (!Time.isRangeEqual(nextProps.range, this.props.range)) {
      this.setState({inputs: Picker.rangeToInputRange(nextProps.range)})
    }
  }

  componentDidUpdate(prevProps: Props): void {
    const propsRangeIsEqual = Time.isRangeEqual(prevProps.range, this.toRange())
    if (!this.isPicking && !propsRangeIsEqual) {
      this.updateFlatPickr()
    }
  }

  saveFlatPickrRef = (el: HTMLElement) => {
    this.picker = flatpickr(el, {
      mode: "range",
      inline: true,
      locale: Russian,
      onChange: (d) => {
        const inputs = [...this.state.inputs] as InputRange

        inputs[0] = Picker.whenToInput(Time.wrapDate(d[0]))
        this.isPicking = true
        if (d.length === 2) {
          this.isPicking = false
          inputs[1] = Picker.whenToInput(Time.wrapDate(d[1]))
        }

        this.setState({inputs})
      }
    })
    this.updateFlatPickr()
  }

  reset = () => {
    this.setState({inputs: Picker.rangeToInputRange(this.props.range)})
    this.updateFlatPickr()
  }

  handleMouseEnter = () => this.setState({isActive: true})
  handleMouseLeave = () => this.setState({isActive: false})
  handleStartText = (e: Event) => this.handleChangedText(Endpoint.Start, (e.target as HTMLInputElement).value)
  handleEndText = (e: Event) => this.handleChangedText(Endpoint.End, (e.target as HTMLInputElement).value)
  handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      this.submit()
    }
  }

  handleChangedText(endpoint: Endpoint, text: string) {
    const when = Time.parseText(text)
    const isValid = when !== InvalidDate
    const inputs = [...this.state.inputs] as InputRange
    inputs[endpoint] = {
      when,
      text,
      isValid,
    }
    this.setState({inputs})
  }

  handleNewRange = (delta: When) => {
    const inputs = [...this.state.inputs] as InputRange
    inputs[0].when = delta
    inputs[1].when = Now
    this.setState({inputs}, this.submit)
  }

  handleSubmit = () => this.submit()

  submit = (closeHover: boolean = true) => {
    this.props.onChange(this.toRange())
    this.setState({isActive: !closeHover})
  }

  toRange(): Range {
    return Picker.inputsToRange(this.state.inputs)
  }

  static inputsToRange(inputRange: InputRange): Range {
    return inputRange.map(i => i.when) as Range
  }

  updateFlatPickr() {
    const dates = this.toRange().map(w => Time.whenToDate(w))
    this.picker.setDate(dates)
  }

  render() {
    const rangeButtonProps = {
      range: this.toRange(),
      onClick: this.handleNewRange,
    }
    const resetActive = !Time.isRangeEqual(this.toRange(), this.props.range)
    const diff = Time.diff(this.state.inputs[0].when, this.state.inputs[1].when)
    const validRange = diff && diff.asMilliseconds() > 0
    const humanRange = validRange ? Time.getRangeHuman(diff) : "???????????????????????? ????????????????????"

    return (
      <MenuDropdown
        title="????????????????"
        extraDropdownClass="time-picker"
        isActive={this.state.isActive}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
      >
        <MenuItem id="time-picker-dropdown">
          <div class="columns">
            <div class="column is-narrow">
              <h1 class="title is-6">?????????? ?????????????????? ??????????????</h1>
              <div ref={this.saveFlatPickrRef}/>
            </div>
            <div class="column">
              <h1 class="title is-6">???????????? ??????????</h1>
              <div class="section" id="quick-ranges">
                <div class="buttons">
                  <PickerRangeButton {...rangeButtonProps} delta="30s" displayDelta="30??" />
                  <PickerRangeButton {...rangeButtonProps} delta="1m" displayDelta="1??" />
                  <PickerRangeButton {...rangeButtonProps} delta="5m" displayDelta="5??" />
                  <PickerRangeButton {...rangeButtonProps} delta="15m" displayDelta="15??" />
                  <PickerRangeButton {...rangeButtonProps} delta="1h" displayDelta="1??" />
                  <PickerRangeButton {...rangeButtonProps} delta="2h" displayDelta="2??" />
                </div>
                <div class="buttons">
                  <PickerRangeButton {...rangeButtonProps} delta="6h" displayDelta="6??" />
                  <PickerRangeButton {...rangeButtonProps} delta="12h" displayDelta="12??" />
                  <PickerRangeButton {...rangeButtonProps} delta="1d" displayDelta="1??" />
                  <PickerRangeButton {...rangeButtonProps} delta="2d" displayDelta="2??" />
                  <PickerRangeButton {...rangeButtonProps} delta="1w" displayDelta="1??" />
                  <PickerRangeButton {...rangeButtonProps} delta="2w" displayDelta="2??" />
                </div>
              </div>
              <div class="content">
                <PickerTextInput
                  value={this.state.inputs[Endpoint.Start]}
                  onChange={this.handleStartText}
                  onKeyPress={this.handleKeyPress}
                  title="????????????"
                  placeholder="-5h"
                />
                <PickerTextInput
                  value={this.state.inputs[Endpoint.End]}
                  onChange={this.handleEndText}
                  onKeyPress={this.handleKeyPress}
                  title="??????????????????"
                  placeholder=""
                />

                <div class={`is-pulled-right ${!validRange ? "has-text-danger" : ""}`}>{humanRange}</div>
                <Button active={validRange} onClick={this.handleSubmit}>??????????????????</Button>
                <Button active={resetActive} onClick={this.reset}>????????????????</Button>
              </div>

              <h1 class="title is-6">??????????????????</h1>
              <div class="content">
                <ul>
                  <li>???????????????????????????? <a href="https://ru.wikipedia.org/wiki/ISO_8601" target="_blank">ISO 8601</a> ???????????? ?? ???????????????????????? ?????????? (-1h, 1d, 1w, -2w).</li>
                  <li>?????????? ?????????????? ???????????????? ???????????????? ?????????? (+10:00)</li>
                </ul>
              </div>
            </div>
          </div>
        </MenuItem>
      </MenuDropdown>
    )
  }
}

