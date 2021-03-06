import { Component } from "inferno"
import { AttachResultsCallback } from "./App"

interface Props {
  onAttachResults: AttachResultsCallback
  visible: boolean
}

export class Logs extends Component<Props, any> {
  saveRef = ref => this.props.onAttachResults(ref)

  render() {
    return (
      <div id="results" className="logs">
        <div id="before-logs" className="entry more-marker"/>
        <div id="logs" ref={this.saveRef} class={this.props.visible ? "" : "is-hidden"}/>
        <div id="after-logs" className="entry more-marker"/>
      </div>
    )
  }
}